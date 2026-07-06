import type { Database } from "@nozbe/watermelondb";
import type { Plant } from "../db/models/Plant";
import type { Observation } from "../db/models/Observation";
import type { Find } from "../db/models/Find";
import { deletePhoto } from "./photo-storage";

// Permanently delete a plant, its observations, and any durable photos they
// own. Local-only app (no server sync), so destroyPermanently — not
// markAsDeleted (which only matters for a sync backend we don't have).
// WatermelonDB has no cascade, so observations are deleted explicitly.
export async function deletePlant(database: Database, id: string): Promise<void> {
  const plant = await database.get<Plant>("plants").find(id);
  const observations = await plant.observations.fetch();
  // Capture photo URIs before the records are gone.
  const photos = [plant.heroPhoto, ...observations.map((o) => o.photo)];

  await database.write(async () => {
    await Promise.all(observations.map((o) => o.destroyPermanently()));
    await plant.destroyPermanently();
  });

  // Best-effort cleanup after the DB commit; deletePhoto no-ops on non-durable URIs.
  await Promise.all(photos.map((p) => deletePhoto(p)));
}

// Permanently delete a single observation (journal note / diagnosis) and its
// durable photo. The plant's derived score/status recompute reactively.
export async function deleteObservation(database: Database, id: string): Promise<void> {
  const obs = await database.get<Observation>("observations").find(id);
  const photo = obs.photo;

  await database.write(async () => {
    await obs.destroyPermanently();
  });

  await deletePhoto(photo);
}

// Permanently delete a forage find and its durable photo.
export async function deleteFind(database: Database, id: string): Promise<void> {
  const find = await database.get<Find>("finds").find(id);
  const photo = find.photo;

  await database.write(async () => {
    await find.destroyPermanently();
  });

  await deletePhoto(photo);
}
