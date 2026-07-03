import type { ColorToken } from "@/constants/tokens";

// TS port of server/plantcare/tools/schedule.py's watering_schedule — pure,
// offline fallback for when the server endpoint (Task 2, wired in Task 4) is
// unreachable. Kept in sync with the Python original via
// fixtures/watering-schedule.golden.json, asserted by both suites.

const DEFAULT_INTERVAL_DAYS = 7;
const SPECIES_INTERVALS: Record<string, number> = {
  monstera: 7,
  pothos: 7,
  "snake plant": 14,
  succulent: 14,
  cactus: 21,
  fern: 4,
  "fiddle leaf fig": 7,
  "peace lily": 5,
};

export type ScheduleHistoryEntry = { date: string };

export type ScheduleResult = {
  next_water_date: string | null;
  interval_days: number;
  reason: string;
};

export function nextWaterDate(
  species: string,
  precip7d: number,
  history: ScheduleHistoryEntry[]
): ScheduleResult {
  const base = SPECIES_INTERVALS[(species || "").toLowerCase().trim()] ?? DEFAULT_INTERVAL_DAYS;
  const precip = precip7d || 0;
  const interval = Math.min(base + Math.floor(precip / 10), base * 2);

  const dates = history
    .map((h) => h.date)
    .filter(Boolean)
    .sort();
  const last = dates.length ? dates[dates.length - 1] : null;
  const nextDate = last ? addDays(last, interval) : null;

  const extra = interval - base;
  const reason =
    `${species || "plant"}: base ${base}d` +
    (extra ? `, +${extra}d for ${trimNum(precip)}mm recent rain` : ", no rain adjustment");

  return { next_water_date: nextDate, interval_days: interval, reason };
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Mirrors Python's `{precip:g}` for the values this app ever passes in
// (rounded to 1 decimal by lib/rainfall.ts / server's weather.py) — trims a
// trailing ".0".
function trimNum(n: number): string {
  return String(Math.round(n * 10) / 10);
}

// Baseline for "last watered": the dedicated field once the mark-watered
// action (Task 9/10) has been used, dateAdded until then.
export function historyFromWatered(
  lastWatered: Date | null,
  dateAdded: Date
): ScheduleHistoryEntry[] {
  const baseline = lastWatered ?? dateAdded;
  return [{ date: baseline.toISOString().slice(0, 10) }];
}

export type ScheduleStatus = { label: string; bg: ColorToken; fg: ColorToken };

// Ports db/health.ts's chipForScore bucket style to watering status.
export function scheduleStatus(
  nextWaterDateIso: string | null,
  todayIso: string = new Date().toISOString().slice(0, 10)
): ScheduleStatus {
  if (nextWaterDateIso == null) return { label: "Unknown", bg: "stoneBg", fg: "secondary" };
  if (nextWaterDateIso < todayIso) {
    return {
      label: `Overdue by ${daysBetween(nextWaterDateIso, todayIso)}d`,
      bg: "blushBg",
      fg: "rust",
    };
  }
  if (nextWaterDateIso === todayIso) return { label: "Water today", bg: "blushBg", fg: "rust" };
  return {
    label: `Water in ${daysBetween(todayIso, nextWaterDateIso)}d`,
    bg: "mintBg",
    fg: "leafText",
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}
