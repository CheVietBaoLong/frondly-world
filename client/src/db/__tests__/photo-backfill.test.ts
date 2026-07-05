import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import { File } from "expo-file-system";
import { schema } from "../schema";
import { Plant } from "../models/Plant";
import { Observation } from "../models/Observation";
import { Find } from "../models/Find";
import { backfillPhotosOnce } from "../photo-backfill";
import type { ForageResult } from "../../forage/api";

jest.mock("expo-file-system", () => {
  const fs = new Set<string>();

  function partUri(part: unknown): string {
    return typeof part === "string" ? part : (part as { uri: string }).uri;
  }

  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(partUri).join("/");
    }
    get exists() {
      return fs.has(this.uri);
    }
    create() {
      fs.add(this.uri);
    }
    async copy(dest: MockFile) {
      fs.add(dest.uri);
    }
    async delete() {
      if (!fs.has(this.uri)) throw new Error("ENOENT");
      fs.delete(this.uri);
    }
  }

  class MockDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(partUri).join("/");
    }
    get exists() {
      return fs.has(this.uri);
    }
    create() {
      fs.add(this.uri);
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: { document: { uri: "file:///doc" } },
    __fs: fs,
  };
});

function mockFs(): Set<string> {
  return (jest.requireMock("expo-file-system") as { __fs: Set<string> }).__fs;
}

function makeDb() {
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
  name: "Salmonberry",
  scientific_name: "Rubus spectabilis",
  facts: { season: "Late spring through summer" },
  toxic_lookalikes: [],
  benign_lookalikes: [],
  possible_matches: [],
  sources: ["PNW dataset"],
  safety_strip: "Field ID aid only — never eat on an app's word alone.",
};

beforeEach(() => {
  mockFs().clear();
});

it("migrates a recoverable cache-URI photo and nulls out an evicted one", async () => {
  const db = makeDb();
  new File("file:///cache/still-here.jpg").create(); // simulates a surviving cache file

  let plant!: Plant;
  let obs!: Observation;
  await db.write(async () => {
    plant = await db.get<Plant>("plants").create((p) => {
      p.name = "Monstera";
      p.species = "Monstera deliciosa";
      p.dateAdded = new Date();
      p.latitude = null;
      p.longitude = null;
      p.heroPhoto = "file:///cache/still-here.jpg";
    });
    obs = await db.get<Observation>("observations").create((o) => {
      o.plant.set(plant);
      o.note = "test";
      o.date = new Date();
      o.photo = "file:///cache/long-gone.jpg"; // never created in the mock fs
    });
  });

  await backfillPhotosOnce(db);

  const reloadedPlant = await db.get<Plant>("plants").find(plant.id);
  const reloadedObs = await db.get<Observation>("observations").find(obs.id);
  expect(reloadedPlant.heroPhoto).toMatch(/^file:\/\/\/doc\/photos\//);
  expect(reloadedObs.photo).toBeNull();
});

it("leaves an already-durable photo untouched", async () => {
  const db = makeDb();
  const durableUri = "file:///doc/photos/already-migrated.jpg";
  new File(durableUri).create();

  let find!: Find;
  await db.write(async () => {
    find = await db.get<Find>("finds").create((f) => {
      f.commonName = SAMPLE_RESULT.name ?? null;
      f.scientificName = SAMPLE_RESULT.scientific_name ?? null;
      f.state = SAMPLE_RESULT.state;
      f.confidence = SAMPLE_RESULT.confidence;
      f.photo = durableUri;
      f.result = SAMPLE_RESULT;
      f.savedAt = new Date();
    });
  });

  await backfillPhotosOnce(db);

  const reloaded = await db.get<Find>("finds").find(find.id);
  expect(reloaded.photo).toBe(durableUri);
});

it("is a no-op on a second call (marker file present)", async () => {
  const db = makeDb();
  new File("file:///cache/first-run.jpg").create();
  await db.write(async () => {
    await db.get<Plant>("plants").create((p) => {
      p.name = "Basil";
      p.species = "Ocimum basilicum";
      p.dateAdded = new Date();
      p.latitude = null;
      p.longitude = null;
      p.heroPhoto = "file:///cache/first-run.jpg";
    });
  });
  await backfillPhotosOnce(db); // marker now created

  new File("file:///cache/second-run.jpg").create();
  let laterPlant!: Plant;
  await db.write(async () => {
    laterPlant = await db.get<Plant>("plants").create((p) => {
      p.name = "Snake Plant";
      p.species = "Dracaena trifasciata";
      p.dateAdded = new Date();
      p.latitude = null;
      p.longitude = null;
      p.heroPhoto = "file:///cache/second-run.jpg";
    });
  });

  await backfillPhotosOnce(db); // should be a no-op this time

  const reloaded = await db.get<Plant>("plants").find(laterPlant.id);
  expect(reloaded.heroPhoto).toBe("file:///cache/second-run.jpg"); // untouched
});
