import { Q } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

import type { ColorToken } from "@/constants/tokens";
import { database } from "@/db";
import { chipForScore } from "@/db/health";
import type { Observation } from "@/db/models/Observation";
import type { Plant } from "@/db/models/Plant";

export type VinePoint = { score: number; label: string };

// One journal entry, rendered as a compact card (date + title) that opens the
// full note on tap. Newest first.
export type NoteVM = {
  id: string;
  date: string;
  title: string;
  healthScore: number | null;
};

export type PlantDetailVM = {
  name: string;
  species: string;
  lastWatered: Date | null;
  dateAdded: Date;
  heroPhoto: string | null;
  score: number | null;
  chip: { label: string; bg: ColorToken; fg: ColorToken };
  vine: VinePoint[];
  notes: NoteVM[];
};

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// First non-empty line, used as a card title when the note has no explicit one.
const titleOf = (note: string) =>
  note
    .split("\n")
    .find((l) => l.trim())
    ?.trim() ?? "Note";

function buildVM(plant: Plant, obs: Observation[]): PlantDetailVM {
  const scored = obs.filter((o) => o.healthScore != null);
  const score = scored.length ? scored[scored.length - 1].healthScore : null;
  return {
    name: plant.name,
    species: plant.species,
    lastWatered: plant.lastWatered,
    dateAdded: plant.dateAdded,
    heroPhoto: plant.heroPhoto,
    score,
    chip: chipForScore(score),
    vine: scored.map((o, i) => ({
      score: o.healthScore as number,
      label: i === scored.length - 1 ? "Today" : fmtDate(o.date),
    })),
    notes: obs
      .filter((o) => o.note?.trim())
      .map((o) => ({
        id: o.id,
        date: fmtDate(o.date),
        title: titleOf(o.note),
        healthScore: o.healthScore,
      }))
      .reverse(),
  };
}

// Reactive plant-detail view-model. Ports PlantDetailView: fetches the plant,
// then subscribes to both the Plant record itself (name/species/lastWatered/...)
// and its observations (oldest→newest), rebuilding the VM on either source of
// change. `vm` is null while loading or if the id doesn't exist.
export function usePlantDetail(id: string): PlantDetailVM | null {
  const [vm, setVm] = useState<PlantDetailVM | null>(null);

  useEffect(() => {
    let cancelled = false;
    let latestObs: Observation[] = [];
    let obsLoaded = false;
    let plantSub: { unsubscribe: () => void } | null = null;
    let obsSub: { unsubscribe: () => void } | null = null;

    database
      .get<Plant>("plants")
      .find(id)
      .then((plant) => {
        if (cancelled) return;

        // Plant.observe() re-emits whenever a field on the record changes
        // (e.g. lastWatered via a mark-watered write) — without this,
        // marking a plant watered wouldn't re-render this screen, since
        // the observations-only subscription below doesn't fire on plant
        // field changes. Plant.observe() is a BehaviorSubject and fires
        // synchronously on subscribe, before the async observations query
        // below has ever resolved — obsLoaded gates that first, premature
        // emission so the screen never renders a real layout with an
        // artificially empty journal.
        plantSub = plant.observe().subscribe((p) => {
          if (!cancelled && obsLoaded) setVm(buildVM(p, latestObs));
        });

        obsSub = plant.observations
          .extend(Q.sortBy("date", Q.asc))
          .observe()
          .subscribe((obs) => {
            latestObs = obs;
            obsLoaded = true;
            if (!cancelled) setVm(buildVM(plant, obs));
          });
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("plant detail load failed:", e);
          setVm(null);
        }
      });

    return () => {
      cancelled = true;
      plantSub?.unsubscribe();
      obsSub?.unsubscribe();
    };
  }, [id]);

  return vm;
}
