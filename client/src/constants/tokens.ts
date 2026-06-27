// Cozy Botanical palette for use where a NativeWind className can't reach:
// vector-icon colors, navigator options, and data-driven (per-score) colors.
// Mirrors tailwind.config.js — keep the two in sync.
// ponytail: a shared JS module imported by both would kill the dupe; 13 stable
// values isn't worth refactoring the committed tailwind.config now.
export const tokens = {
  paper: "#EEF1E9",
  surface: "#F7F8F3",
  forest: "#20322A",
  secondary: "#7A7F76",
  citron: "#C7D64F",
  sage: "#BFD0A8",
  mintBg: "#E4EAD8",
  leafText: "#5C7E4A",
  rust: "#C8553D",
  blushBg: "#F2DDD4",
  stoneBg: "#ECEEE8",
  border: "#DCE2D2",
  onDarkSecondary: "#C3CDBE",
} as const;

export type ColorToken = keyof typeof tokens;
