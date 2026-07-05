import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import { schema } from "@/db/schema";
import { Plant } from "@/db/models/Plant";
import { Observation } from "@/db/models/Observation";
import { Find } from "@/db/models/Find";
import type { ForageResult } from "@/forage/api";
import { toSnapshot, applySnapshot, basename, SNAPSHOT_VERSION } from "../snapshot";

// In-memory DB (LokiJS) — same harness as src/db/__tests__/find.test.ts and
// photo-backfill.test.ts (no `migrations` option; not part of the real setup).
function makeDb(): Database {
  const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  return new Database({ adapter, modelClasses: [Plant, Observation, Find] });
}

const SAMPLE_RESULT: ForageResult = {
  state: "verified_edible",
  confidence: 0.9,
  toxic_lookalikes: [],
  benign_lookalikes: [],
  possible_matches: [],
  sources: [],
  safety_strip: "Field ID aid only — never eat on an app's word alone.",
};

describe("basename", () => {
  it("returns the file name from a durable URI, null for null", () => {
    expect(basename("file:///doc/photos/123-abc.jpg")).toBe("123-abc.jpg");
    expect(basename(null)).toBeNull();
  });
});

describe("snapshot round-trip", () => {
  it("serializes records to basenames and restores them with new local URIs, preserving ids and plant links", async () => {
    const db = makeDb();
    let plantId = "";
    await db.write(async () => {
      const p = await db.get<Plant>("plants").create((r) => {
        r.name = "Monstera";
        r.species = "Monstera deliciosa";
        r.dateAdded = new Date(1000);
        r.heroPhoto = "file:///doc/photos/hero.jpg";
      });
      plantId = p.id;
      await db.get<Observation>("observations").create((r) => {
        r._raw.plant_id = p.id;
        r.date = new Date(2000);
        r.note = "New leaf";
        r.photo = "file:///doc/photos/obs.jpg";
      });
      await db.get<Find>("finds").create((r) => {
        r.state = "verified_edible";
        r.confidence = 0.9;
        r.result = SAMPLE_RESULT;
        r.savedAt = new Date(3000);
        r.photo = null;
      });
    });

    const snap = await toSnapshot(db);
    expect(snap.version).toBe(SNAPSHOT_VERSION);
    expect(snap.plants[0].heroPhoto).toBe("hero.jpg"); // collapsed to basename
    expect(snap.observations[0].photo).toBe("obs.jpg");
    expect(snap.observations[0].plantId).toBe(plantId);
    expect(snap.finds[0].photo).toBeNull();

    // fresh DB, restore with a rewrite map
    const db2 = makeDb();
    await applySnapshot(db2, snap, {
      "hero.jpg": "file:///doc/photos/NEW-hero.jpg",
      "obs.jpg": "file:///doc/photos/NEW-obs.jpg",
    });

    const plants = await db2.get<Plant>("plants").query().fetch();
    expect(plants).toHaveLength(1);
    expect(plants[0].id).toBe(plantId); // id preserved
    expect(plants[0].heroPhoto).toBe("file:///doc/photos/NEW-hero.jpg");
    const obs = await db2.get<Observation>("observations").query().fetch();
    expect(obs[0]._raw.plant_id).toBe(plantId); // link intact
    expect(obs[0].photo).toBe("file:///doc/photos/NEW-obs.jpg");
  });

  it("nulls a photo whose basename is missing from the rewrite map", async () => {
    const db = makeDb();
    await db.write(async () => {
      await db.get<Plant>("plants").create((r) => {
        r.name = "X";
        r.species = "Y";
        r.dateAdded = new Date(1);
        r.heroPhoto = "file:///doc/photos/gone.jpg";
      });
    });
    const snap = await toSnapshot(db);
    const db2 = makeDb();
    await applySnapshot(db2, snap, {}); // empty map
    const plants = await db2.get<Plant>("plants").query().fetch();
    expect(plants[0].heroPhoto).toBeNull();
  });

  it("replaces existing records rather than appending", async () => {
    const db = makeDb();
    await db.write(async () => {
      await db.get<Plant>("plants").create((r) => {
        r.name = "Old";
        r.species = "s";
        r.dateAdded = new Date(1);
      });
    });
    const emptySnap = { version: SNAPSHOT_VERSION, plants: [], observations: [], finds: [] };
    await applySnapshot(db, emptySnap, {});
    expect(await db.get<Plant>("plants").query().fetchCount()).toBe(0);
  });
});
