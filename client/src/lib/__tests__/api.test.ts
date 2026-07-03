import {
  buildDiagnoseParts,
  extractDiagnosis,
  foldEventText,
  functionCallsOfEvent,
  parseSseChunks,
} from "../api";

const diagnosisEvent = (args: Record<string, unknown>, key = "functionCall") => ({
  content: { parts: [{ [key]: { name: "record_diagnosis", args } }], role: "model" },
});

const GOOD_ARGS = {
  problem: "overwatering",
  severity: "medium",
  health_score: 55,
  confidence: 0.85,
  care_steps: ["let soil dry", "check drainage"],
};

describe("parseSseChunks", () => {
  it("returns complete data payloads and keeps the partial remainder", () => {
    const { payloads, rest } = parseSseChunks('data: {"a":1}\n\ndata: {"b"');
    expect(payloads).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"b"');
  });

  it("handles multiple frames in one chunk", () => {
    const { payloads, rest } = parseSseChunks('data: {"a":1}\n\ndata: {"b":2}\n\n');
    expect(payloads).toEqual(['{"a":1}', '{"b":2}']);
    expect(rest).toBe("");
  });

  it("reassembles a frame split across chunks via the remainder", () => {
    const first = parseSseChunks('data: {"a"');
    expect(first.payloads).toEqual([]);
    const second = parseSseChunks(first.rest + ":1}\n\n");
    expect(second.payloads).toEqual(['{"a":1}']);
  });
});

describe("functionCallsOfEvent", () => {
  it("reads camelCase functionCall (ADK's by_alias serialization)", () => {
    expect(functionCallsOfEvent(diagnosisEvent(GOOD_ARGS))).toHaveLength(1);
  });

  it("also accepts snake_case function_call", () => {
    expect(functionCallsOfEvent(diagnosisEvent(GOOD_ARGS, "function_call"))).toHaveLength(1);
  });

  it("returns [] for text-only or empty events", () => {
    expect(functionCallsOfEvent({ content: { parts: [{ text: "hi" }] } })).toEqual([]);
    expect(functionCallsOfEvent({})).toEqual([]);
  });
});

describe("extractDiagnosis", () => {
  it("maps snake_case args to a camelCase Diagnosis", () => {
    expect(extractDiagnosis(diagnosisEvent(GOOD_ARGS))).toEqual({
      problem: "overwatering",
      severity: "medium",
      healthScore: 55,
      confidence: 0.85,
      careSteps: ["let soil dry", "check drainage"],
    });
  });

  it("clamps score to 0–100 and confidence to 0–1", () => {
    const d = extractDiagnosis(
      diagnosisEvent({ ...GOOD_ARGS, health_score: 150, confidence: 1.4 })
    );
    expect(d?.healthScore).toBe(100);
    expect(d?.confidence).toBe(1);
  });

  it("defaults an unknown severity to medium", () => {
    const d = extractDiagnosis(diagnosisEvent({ ...GOOD_ARGS, severity: "catastrophic" }));
    expect(d?.severity).toBe("medium");
  });

  it("returns null for events without a record_diagnosis call", () => {
    expect(extractDiagnosis({ content: { parts: [{ text: "hmm" }] } })).toBeNull();
    expect(
      extractDiagnosis({
        content: { parts: [{ functionCall: { name: "get_weather", args: {} } }] },
      })
    ).toBeNull();
  });

  it("ignores partial streaming chunks (the aggregated final event saves)", () => {
    expect(extractDiagnosis({ ...diagnosisEvent(GOOD_ARGS), partial: true })).toBeNull();
  });
});

describe("foldEventText", () => {
  it("accumulates partial chunks, then the final event replaces them", () => {
    let text = foldEventText("", { partial: true, content: { parts: [{ text: "Your " }] } });
    text = foldEventText(text, { partial: true, content: { parts: [{ text: "plant" }] } });
    expect(text).toBe("Your plant");
    text = foldEventText(text, { content: { parts: [{ text: "Your plant looks dry." }] } });
    expect(text).toBe("Your plant looks dry.");
  });

  it("ignores events without text", () => {
    expect(foldEventText("keep", diagnosisEvent(GOOD_ARGS))).toBe("keep");
  });
});

describe("buildDiagnoseParts", () => {
  const plant = {
    name: "Basil",
    species: "Ocimum basilicum",
    latitude: 42.36,
    longitude: -71.06,
    lastWatered: null,
  };

  it("produces one text part with profile+history and one inline image part", () => {
    const parts = buildDiagnoseParts(
      plant,
      [{ date: "2026-06-25", note: "yellow leaves" }],
      "QUJD"
    );
    expect(parts).toHaveLength(2);
    const text = (parts[0] as { text: string }).text;
    expect(text).toContain("Ocimum basilicum");
    expect(text).toContain("lat 42.36");
    expect(text).toContain("yellow leaves");
    expect(parts[1]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "QUJD" } });
  });

  it("says so when there is no history", () => {
    const text = (buildDiagnoseParts(plant, [], "QUJD")[0] as { text: string }).text;
    expect(text).toContain("no observations yet");
  });
});
