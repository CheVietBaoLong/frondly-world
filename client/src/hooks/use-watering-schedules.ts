import { useEffect, useState } from "react";

import { getWateringSchedule, historyFromWatered, type ScheduleResult } from "@/lib/care";

export type SchedulablePlant = {
  id: string;
  species: string;
  lastWatered: Date | null;
  dateAdded: Date;
};

// Resolves a next-water schedule per plant (server-primary with the offline
// fallback baked into getWateringSchedule). Keyed by plant id so callers can
// sort/render once every plant has resolved, instead of each row racing its
// own network call independently.
export function useWateringSchedules(
  plants: SchedulablePlant[],
  precip7d: number | null
): Map<string, ScheduleResult> {
  const [schedules, setSchedules] = useState<Map<string, ScheduleResult>>(new Map());

  // Plants array identity changes on every useGarden emission even when the
  // watering-relevant fields didn't — key on the fields that actually affect
  // the result so we don't refetch on unrelated re-renders.
  const key = plants
    .map((p) => `${p.id}:${p.species}:${(p.lastWatered ?? p.dateAdded).getTime()}`)
    .join(",");

  useEffect(() => {
    let cancelled = false;

    Promise.all(
      plants.map(async (p) => {
        const result = await getWateringSchedule(
          p.species,
          precip7d ?? 0,
          historyFromWatered(p.lastWatered, p.dateAdded)
        );
        return [p.id, result] as const;
      })
    ).then((entries) => {
      if (!cancelled) setSchedules(new Map(entries));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, precip7d]);

  return schedules;
}
