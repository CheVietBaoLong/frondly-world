import type { Database } from "@nozbe/watermelondb";
import { File, Paths } from "expo-file-system";
import { isDurablePhoto, persistPhoto } from "@/lib/photo-storage";
import { Plant } from "./models/Plant";
import { Observation } from "./models/Observation";
import { Find } from "./models/Find";

const MARKER = new File(Paths.document, ".photo-backfill-done");

// One row's photo, migrated in place if it's a recoverable non-durable URI,
// or nulled out if the OS already evicted it. `undefined` means "leave as-is"
// (already durable or null).
async function migratedPhoto(current: string | null): Promise<string | null | undefined> {
  if (!current || isDurablePhoto(current)) return undefined;
  return new File(current).exists ? await persistPhoto(current) : null;
}

// Migrates any surviving cache-URI photo into durable storage; nulls out
// photos already evicted by the OS. Runs exactly once per install.
export async function backfillPhotosOnce(database: Database): Promise<void> {
  if (MARKER.exists) return;

  const plants = await database.get<Plant>("plants").query().fetch();
  for (const plant of plants) {
    const next = await migratedPhoto(plant.heroPhoto);
    if (next === undefined) continue;
    await database.write(async () => {
      await plant.update((p) => {
        p.heroPhoto = next;
      });
    });
  }

  const observations = await database.get<Observation>("observations").query().fetch();
  for (const obs of observations) {
    const next = await migratedPhoto(obs.photo);
    if (next === undefined) continue;
    await database.write(async () => {
      await obs.update((o) => {
        o.photo = next;
      });
    });
  }

  const finds = await database.get<Find>("finds").query().fetch();
  for (const find of finds) {
    const next = await migratedPhoto(find.photo);
    if (next === undefined) continue;
    await database.write(async () => {
      await find.update((f) => {
        f.photo = next;
      });
    });
  }

  MARKER.create();
}
