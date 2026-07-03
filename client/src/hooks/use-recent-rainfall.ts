import { useEffect, useState } from "react";

import { getRecentRainfall } from "@/lib/rainfall";

const TTL_MS = 30 * 60 * 1000;

// Module-level cache: screen remounts within the TTL reuse the last result
// and never re-hit the permission prompt or the network. Mirrors
// use-weather.ts's caching exactly.
let cached: { at: number; value: number | null } | null = null;

// Recent rainfall for the watering schedule. Returns null while loading and
// on failure — callers treat null as "no rain adjustment," never blocking.
export function useRecentRainfall(): number | null {
  // eslint-disable-next-line react-hooks/purity
  const initial = cached && Date.now() - cached.at < TTL_MS ? cached.value : null;
  const [rainfall, setRainfall] = useState<number | null>(initial);

  useEffect(() => {
    if (cached && Date.now() - cached.at < TTL_MS) return;

    let cancelled = false;
    getRecentRainfall().then((value) => {
      cached = { at: Date.now(), value };
      if (!cancelled) setRainfall(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return rainfall;
}
