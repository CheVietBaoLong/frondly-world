import {
  appendFollowUp,
  markTurnDone,
  markTurnError,
  markTurnNoteSaved,
  resetTurnForRetry,
  setTurnDiagnosis,
  setTurnText,
  type Turn,
} from "../diagnose-turns";

const DIAGNOSIS = {
  problem: "overwatering",
  severity: "medium" as const,
  healthScore: 55,
  confidence: 0.85,
  careSteps: ["let soil dry"],
};

describe("appendFollowUp", () => {
  it("appends a done user turn and a streaming assistant turn", () => {
    const turns = appendFollowUp([], "is it dying?", "turn-0");
    expect(turns).toEqual([
      { id: "turn-0-user", role: "user", text: "is it dying?", status: "done" },
      { id: "turn-0", role: "assistant", text: "", status: "streaming" },
    ]);
  });

  it("keeps prior turns untouched when appending a second follow-up", () => {
    const first = appendFollowUp([], "q1", "turn-0");
    const second = appendFollowUp(first, "q2", "turn-1");
    expect(second).toHaveLength(4);
    expect(second[0]).toEqual(first[0]);
    expect(second[1]).toEqual(first[1]);
  });
});

describe("setTurnText / setTurnDiagnosis / markTurnDone / markTurnError", () => {
  const base: Turn[] = [
    { id: "turn-0-user", role: "user", text: "q1", status: "done" },
    { id: "turn-0", role: "assistant", text: "", status: "streaming" },
    { id: "turn-1-user", role: "user", text: "q2", status: "done" },
    { id: "turn-1", role: "assistant", text: "", status: "streaming" },
  ];

  it("setTurnText updates only the matching turn", () => {
    const next = setTurnText(base, "turn-0", "Your plant looks dry.");
    expect(next[1].text).toBe("Your plant looks dry.");
    expect(next[3].text).toBe(""); // untouched
  });

  it("setTurnDiagnosis attaches to the matching turn only", () => {
    const next = setTurnDiagnosis(base, "turn-1", DIAGNOSIS);
    expect(next[3].diagnosis).toEqual(DIAGNOSIS);
    expect(next[1].diagnosis).toBeUndefined();
  });

  it("markTurnDone sets status without touching other turns", () => {
    const next = markTurnDone(base, "turn-0");
    expect(next[1].status).toBe("done");
    expect(next[3].status).toBe("streaming");
  });

  it("markTurnError marks only the matching turn, prior turns keep their status", () => {
    const done = markTurnDone(base, "turn-0");
    const next = markTurnError(done, "turn-1", "Network error.");
    expect(next[1].status).toBe("done"); // turn-0 untouched by turn-1's error
    expect(next[3]).toEqual({
      id: "turn-1",
      role: "assistant",
      text: "",
      status: "error",
      errorMessage: "Network error.",
    });
  });
});

describe("markTurnNoteSaved", () => {
  it("flips noteSaved on the matching turn only", () => {
    const base: Turn[] = [
      { id: "a", role: "assistant", text: "x", status: "done" },
      { id: "b", role: "assistant", text: "y", status: "done" },
    ];
    const next = markTurnNoteSaved(base, "a");
    expect(next[0].noteSaved).toBe(true);
    expect(next[1].noteSaved).toBeUndefined();
  });
});

describe("resetTurnForRetry", () => {
  it("resets one errored turn to streaming, clearing text and errorMessage", () => {
    const base: Turn[] = [
      { id: "turn-0-user", role: "user", text: "q1", status: "done" },
      {
        id: "turn-0",
        role: "assistant",
        text: "",
        status: "error",
        errorMessage: "Network error.",
      },
    ];
    const next = resetTurnForRetry(base, "turn-0");
    expect(next[1]).toEqual({ id: "turn-0", role: "assistant", text: "", status: "streaming" });
    expect(next[0]).toEqual(base[0]); // user turn untouched
  });
});
