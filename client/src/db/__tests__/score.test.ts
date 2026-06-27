import { scoreFromSeverity, THRIVING_THRESHOLD, chipForScore } from "../health";

describe("scoreFromSeverity (ports Models.swift)", () => {
  it("maps the 3 severity buckets", () => {
    expect(scoreFromSeverity("high")).toBe(45);
    expect(scoreFromSeverity("medium")).toBe(70);
    expect(scoreFromSeverity("low")).toBe(90);
    expect(scoreFromSeverity(null)).toBe(90);
  });
});

describe("THRIVING_THRESHOLD", () => {
  it("matches Health.thrivingThreshold from the Swift app", () => {
    expect(THRIVING_THRESHOLD).toBe(85);
  });
});

describe("chipForScore (ports Health.chip)", () => {
  it("maps score buckets to label + token colors", () => {
    expect(chipForScore(92)).toEqual({ label: "Healthy", bg: "mintBg", fg: "leafText" });
    expect(chipForScore(85)).toEqual({ label: "Healthy", bg: "mintBg", fg: "leafText" });
    expect(chipForScore(70)).toEqual({ label: "Water soon", bg: "blushBg", fg: "rust" });
    expect(chipForScore(60)).toEqual({ label: "Water soon", bg: "blushBg", fg: "rust" });
    expect(chipForScore(48)).toEqual({ label: "Treat now", bg: "blushBg", fg: "rust" });
    expect(chipForScore(null)).toEqual({ label: "New", bg: "stoneBg", fg: "secondary" });
  });
});
