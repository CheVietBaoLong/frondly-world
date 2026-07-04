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
// @Query(Plant): re-resolves the VMs whenever the garden changes. Seeds sample
// data on first run (idempotent).
// A plant's card shows its health score / status line, both derived from its
// observations — but observe() on the plants query only fires on plant
// add/remove, NOT on observation inserts. So we also subscribe to the
// observations collection; a new diagnosis (e.g. health 95) then updates the
// home card live, matching Plant Detail.
// dev-note: on any change we re-query + re-resolve all plants — simplest correct
// approach at garden scale; batch/incrementally if the garden ever gets large.
// dev-note: slice-1 bootstrap seeds here; move to root app init when other
// screens also write to the DB.
export function useGarden(): { plants: PlantVM[]; loading: boolean } {
  const [plants, setPlants] = useState<PlantVM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    seedSampleGardenIfEmpty(database).catch((e) => console.error("garden seed failed:", e));

    const reload = () => {
      database
        .get<Plant>("plants")
        .query(Q.sortBy("date_added", Q.desc))
        .fetch()
        .then((rows) => Promise.all(rows.map(toVM)))
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
    };

    const plantsSub = database.get<Plant>("plants").query().observe().subscribe(reload);
    const obsSub = database.get("observations").query().observe().subscribe(reload);

    return () => {
      cancelled = true;
      plantsSub.unsubscribe();
      obsSub.unsubscribe();
    };
  }, []);

  return { plants, loading };
}
