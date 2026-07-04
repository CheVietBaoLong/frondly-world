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
// `neverWatered` plants have no real anchor — their next-water date is only an
// estimate from dateAdded, so we show a soft "Water when dry" instead of a
// precise countdown that reads like a dummy default.
export function scheduleStatus(
  nextWaterDateIso: string | null,
  todayIso: string = new Date().toISOString().slice(0, 10),
  neverWatered = false
): ScheduleStatus {
  if (neverWatered) return { label: "Water when dry", bg: "mintBg", fg: "leafText" };
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

// dev-note: base URL hardcoded for local dev, same story as forage/api.ts and lib/api.ts.
const API_BASE = "http://localhost:8000";
const FETCH_TIMEOUT_MS = 5_000;

export async function fetchWateringSchedule(
  species: string,
  precip7d: number,
  history: ScheduleHistoryEntry[]
): Promise<ScheduleResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/plantcare/watering_schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ species, precip_7d: precip7d, history }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`watering_schedule failed (${res.status})`);
    return (await res.json()) as ScheduleResult;
  } finally {
    clearTimeout(timeout);
  }
}

// Server is the source of truth; nextWaterDate (the local TS port above) is
// the offline/unreachable fallback so the UI never blocks or shows nothing.
export async function getWateringSchedule(
  species: string,
  precip7d: number,
  history: ScheduleHistoryEntry[]
): Promise<ScheduleResult> {
  try {
    return await fetchWateringSchedule(species, precip7d, history);
  } catch {
    return nextWaterDate(species, precip7d, history);
  }
}
