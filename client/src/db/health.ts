import type { ColorToken } from "@/constants/tokens";

export const THRIVING_THRESHOLD = 85;

// Ports scoreFromSeverity in Models.swift — coarse 3-bucket fallback.
// NOTE: real smoothness needs the agent to emit a continuous health_score.
export function scoreFromSeverity(severity: string | null | undefined): number {
  switch (severity) {
    case "high":
      return 45;
    case "medium":
      return 70;
    default:
      return 90; // "low" or unspecified
  }
}

// Ports Health.chip(for:) in Theme.swift — score-driven status chip.
// NOTE: label defaults from the score; a real diagnosis can override it later.
export function chipForScore(score: number | null): {
  label: string;
  bg: ColorToken;
  fg: ColorToken;
} {
  if (score == null) return { label: "New", bg: "stoneBg", fg: "secondary" };
  if (score >= THRIVING_THRESHOLD) return { label: "Healthy", bg: "mintBg", fg: "leafText" };
  if (score >= 60) return { label: "Water soon", bg: "blushBg", fg: "rust" };
  return { label: "Treat now", bg: "blushBg", fg: "rust" };
}
