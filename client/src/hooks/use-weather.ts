import { useEffect, useState } from "react";

import { getWeather, type Weather } from "@/lib/weather";

const TTL_MS = 30 * 60 * 1000;

// Module-level cache: tab remounts within the TTL reuse the last result and
// never re-hit the permission prompt or the network. Null results are cached
// too (denied permission shouldn't re-prompt every remount).
let cached: { at: number; value: Weather | null } | null = null;

// Weather for the assistant card. Returns null while loading and on failure —
// the card renders its generic fallback for both, per the spec.
export function useWeather(): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(cached?.value ?? null);

  useEffect(() => {
    if (cached && Date.now() - cached.at < TTL_MS) return;

    let cancelled = false;
    getWeather().then((value) => {
      cached = { at: Date.now(), value };
      if (!cancelled) setWeather(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return weather;
}
