import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

import type { ColorToken } from "@/constants/tokens";
import { database } from "@/db";
import { chipForScore } from "@/db/health";
import type { Plant } from "@/db/models/Plant";
import { seedSampleGardenIfEmpty } from "@/db/seed";

export type PlantVM = {
  id: string;
  name: string;
  species: string;
  lastWatered: Date | null;
  dateAdded: Date;
  statusLine: string;
  score: number | null;
  needsAttention: boolean;
  heroPhoto: string | null;
  chip: { label: string; bg: ColorToken; fg: ColorToken };
};

// Resolve a Plant model's async derived values (currentScore/needsAttention/
// statusLine) into a flat, render-ready view-model.
async function toVM(plant: Plant): Promise<PlantVM> {
  const score = await plant.currentScore();
  return {
    id: plant.id,
    name: plant.name,
    species: plant.species,
    lastWatered: plant.lastWatered,
    dateAdded: plant.dateAdded,
    statusLine: await plant.statusLine(),
    score,
    needsAttention: await plant.needsAttention(),
    heroPhoto: plant.heroPhoto,
    chip: chipForScore(score),
  };
}

// Reactive garden view-models, newest plant first. Ports GardenHomeView's
// @Query(Plant): subscribes to the plants collection and re-resolves VMs on
// every emission. Seeds sample data on first run (idempotent).
// dev-note: observe() re-emits on plant add/remove, not on observation inserts
// (which change a score) — fine for slice-1 seed data; swap to observeWithColumns
// once the capture flow writes observations live.
// dev-note: slice-1 bootstrap seeds here; move to root app init when other
// screens also write to the DB.
export function useGarden(): { plants: PlantVM[]; loading: boolean } {
  const [plants, setPlants] = useState<PlantVM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    seedSampleGardenIfEmpty(database).catch((e) => console.error("garden seed failed:", e));

    const sub = database
      .get<Plant>("plants")
      .query(Q.sortBy("date_added", Q.desc))
      .observe()
      .subscribe((rows) => {
        Promise.all(rows.map(toVM))
          .then((vms) => {
            if (cancelled) return;
            setPlants(vms);
            setLoading(false);
          })
          .catch((e) => {
            if (cancelled) return;
            console.error("garden load failed:", e);
            setLoading(false); // clear the spinner instead of hanging on it
          });
      });

    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, []);

  return { plants, loading };
}
