import type { Database } from "@nozbe/watermelondb";
import { Plant } from "@/db/models/Plant";
import { Observation } from "@/db/models/Observation";
import { Find } from "@/db/models/Find";
import type { ForageResult } from "@/forage/api";

export const SNAPSHOT_VERSION = 1;

export type PlantSnap = {
  id: string;
  name: string;
  species: string;
  dateAdded: number;
  lastWatered: number | null;
  latitude: number | null;
  longitude: number | null;
  heroPhoto: string | null;
  room: string | null;
  light: string | null;
};

export type ObservationSnap = {
  id: string;
  plantId: string;
  date: number;
  note: string;
  severity: string | null;
  healthScore: number | null;
  careSteps: string[];
  confidence: number | null;
  photo: string | null;
};

export type FindSnap = {
  id: string;
  commonName: string | null;
  scientificName: string | null;
  state: string;
  confidence: number;
  photo: string | null;
  result: ForageResult;
  savedAt: number;
};

export type Snapshot = {
  version: number;
  plants: PlantSnap[];
  observations: ObservationSnap[];
  finds: FindSnap[];
};

// Last path segment of a durable file URI (the stable name persistPhoto generates).
export function basename(uri: string | null): string | null {
  if (!uri) return null;
  const i = uri.lastIndexOf("/");
  return i >= 0 ? uri.slice(i + 1) : uri;
}

export async function toSnapshot(db: Database): Promise<Snapshot> {
  const plants = await db.get<Plant>("plants").query().fetch();
  const observations = await db.get<Observation>("observations").query().fetch();
  const finds = await db.get<Find>("finds").query().fetch();

  return {
    version: SNAPSHOT_VERSION,
    plants: plants.map((p) => ({
      id: p.id,
      name: p.name,
      species: p.species,
      dateAdded: p.dateAdded.getTime(),
      lastWatered: p.lastWatered ? p.lastWatered.getTime() : null,
      latitude: p.latitude,
      longitude: p.longitude,
      heroPhoto: basename(p.heroPhoto),
      room: p.room,
      light: p.light,
    })),
    observations: observations.map((o) => ({
      id: o.id,
      plantId: o._raw.plant_id as string,
      date: o.date.getTime(),
      note: o.note,
      severity: o.severity,
      healthScore: o.healthScore,
      careSteps: o.careSteps,
      confidence: o.confidence,
      photo: basename(o.photo),
    })),
    finds: finds.map((f) => ({
      id: f.id,
      commonName: f.commonName,
      scientificName: f.scientificName,
      state: f.state,
      confidence: f.confidence,
      photo: basename(f.photo),
      result: f.result,
      savedAt: f.savedAt.getTime(),
    })),
  };
}

// Replaces all local records with the snapshot's, inside one write transaction.
// `photoUriByBasename` maps a stored basename to its freshly re-persisted local URI;
// a basename missing from the map (photo not recovered) collapses to null.
export async function applySnapshot(
  db: Database,
  snap: Snapshot,
  photoUriByBasename: Record<string, string>
): Promise<void> {
  const rewrite = (name: string | null): string | null =>
    name ? (photoUriByBasename[name] ?? null) : null;

  await db.write(async () => {
    const old = [
      ...(await db.get("plants").query().fetch()),
      ...(await db.get("observations").query().fetch()),
      ...(await db.get("finds").query().fetch()),
    ];

    const creates = [
      ...snap.plants.map((s) =>
        db.get<Plant>("plants").prepareCreate((r) => {
          r._raw.id = s.id;
          r.name = s.name;
          r.species = s.species;
          r.dateAdded = new Date(s.dateAdded);
          r.lastWatered = s.lastWatered != null ? new Date(s.lastWatered) : null;
          r.latitude = s.latitude;
          r.longitude = s.longitude;
          r.heroPhoto = rewrite(s.heroPhoto);
          r.room = s.room;
          r.light = s.light;
        })
      ),
      ...snap.observations.map((s) =>
        db.get<Observation>("observations").prepareCreate((r) => {
          r._raw.id = s.id;
          r._raw.plant_id = s.plantId;
          r.date = new Date(s.date);
          r.note = s.note;
          r.severity = s.severity;
          r.healthScore = s.healthScore;
          r.careSteps = s.careSteps;
          r.confidence = s.confidence;
          r.photo = rewrite(s.photo);
        })
      ),
      ...snap.finds.map((s) =>
        db.get<Find>("finds").prepareCreate((r) => {
          r._raw.id = s.id;
          r.commonName = s.commonName;
          r.scientificName = s.scientificName;
          r.state = s.state;
          r.confidence = s.confidence;
          r.photo = rewrite(s.photo);
          r.result = s.result;
          r.savedAt = new Date(s.savedAt);
        })
      ),
    ];

    await db.batch(...old.map((r) => r.prepareDestroyPermanently()), ...creates);
  });
}
