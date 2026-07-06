import { File } from "expo-file-system";
import { mockFs } from "../../../test-support/expo-file-system-mock";

import { database } from "@/db";
import { Plant } from "@/db/models/Plant";
import { backup, restore, lastBackupAt } from "../index";

jest.mock("expo-file-system", () =>
  require("../../../test-support/expo-file-system-mock").createExpoFileSystemMock()
);

// In-memory Storage fake: path -> Uint8Array
const store: Record<string, Uint8Array> = {};
jest.mock("firebase/storage", () => ({
  ref: (_s: unknown, path: string) => ({ path }),
  uploadBytes: async (r: { path: string }, data: Uint8Array) => {
    store[r.path] = data;
  },
  getBytes: async (r: { path: string }) => {
    if (!store[r.path]) throw new Error("not found");
    return store[r.path].buffer;
  },
  getMetadata: async (r: { path: string }) =>
    store[r.path] ? { updated: "2026-07-05T00:00:00.000Z" } : Promise.reject(new Error("404")),
}));
jest.mock("../../firebase", () => ({ storage: {} }));

// persistPhoto is exercised for real in photo-storage.test.ts; here we just
// need something that returns a durable-looking URI without touching the
// real durable-photos directory logic.
jest.mock("../../photo-storage", () => ({
  persistPhoto: async (uri: string) => uri.replace("/cache/", "/doc/photos/"),
}));

// `@/db`'s real module wires up WatermelonDB's native SQLiteAdapter, which
// throws outside a real app runtime. Every other suite that needs a live
// Database sidesteps this by building its own LokiJS-backed instance (see
// snapshot.test.ts / photo-backfill.test.ts); we do the same here but mock
// "@/db" itself so backup/index.ts's own `import { database } from "@/db"`
// resolves to this same in-memory instance.
jest.mock("@/db", () => {
  const { Database } = require("@nozbe/watermelondb");
  const LokiJSAdapter = require("@nozbe/watermelondb/adapters/lokijs").default;
  const { schema } = require("../../../db/schema");
  const { Plant } = require("../../../db/models/Plant");
  const { Observation } = require("../../../db/models/Observation");
  const { Find } = require("../../../db/models/Find");
  const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  const database = new Database({ adapter, modelClasses: [Plant, Observation, Find] });
  return { database };
});

beforeEach(async () => {
  for (const k of Object.keys(store)) delete store[k];
  mockFs().clear();
  await database.write(async () => {
    const all = await database.get("plants").query().fetch();
    await database.batch(...all.map((r) => r.prepareDestroyPermanently()));
  });
});

it("uploads one file per photo plus snapshot.json, then restores them", async () => {
  // seed one plant with a durable photo whose bytes exist in the fs mock
  new File("file:///doc/photos/hero.jpg").writeBytes(new Uint8Array([1, 2, 3]));
  await database.write(async () => {
    await database.get<Plant>("plants").create((r) => {
      r.name = "Monstera";
      r.species = "M. deliciosa";
      r.dateAdded = new Date(1);
      r.heroPhoto = "file:///doc/photos/hero.jpg";
    });
  });

  const ts = await backup("u1");
  expect(typeof ts).toBe("number");
  expect(store["users/u1/photos/hero.jpg"]).toEqual(new Uint8Array([1, 2, 3]));
  expect(store["users/u1/snapshot.json"]).toBeDefined();

  // wipe local, then restore from the fake Storage
  await database.write(async () => {
    const all = await database.get("plants").query().fetch();
    await database.batch(...all.map((r) => r.prepareDestroyPermanently()));
  });
  await restore("u1");
  const plants = await database.get<Plant>("plants").query().fetch();
  expect(plants).toHaveLength(1);
  expect(plants[0].heroPhoto).toMatch(/^file:\/\/\/doc\/photos\/.+\.jpg$/);
});

it("skips a photo that no longer exists locally without failing the backup", async () => {
  await database.write(async () => {
    await database.get<Plant>("plants").create((r) => {
      r.name = "Ghost";
      r.species = "G. missing";
      r.dateAdded = new Date(1);
      r.heroPhoto = "file:///doc/photos/missing.jpg"; // never written to the fs mock
    });
  });

  const ts = await backup("u1");
  expect(typeof ts).toBe("number");
  expect(store["users/u1/photos/missing.jpg"]).toBeUndefined();
  expect(store["users/u1/snapshot.json"]).toBeDefined();
});

it("nulls a photo whose download fails during restore, without aborting the rest", async () => {
  new File("file:///doc/photos/hero.jpg").writeBytes(new Uint8Array([9, 9, 9]));
  await database.write(async () => {
    await database.get<Plant>("plants").create((r) => {
      r.name = "Monstera";
      r.species = "M. deliciosa";
      r.dateAdded = new Date(1);
      r.heroPhoto = "file:///doc/photos/hero.jpg";
    });
  });
  await backup("u1");
  // simulate the photo object having vanished from Storage after backup
  delete store["users/u1/photos/hero.jpg"];

  await database.write(async () => {
    const all = await database.get("plants").query().fetch();
    await database.batch(...all.map((r) => r.prepareDestroyPermanently()));
  });
  await restore("u1");

  const plants = await database.get<Plant>("plants").query().fetch();
  expect(plants).toHaveLength(1);
  expect(plants[0].heroPhoto).toBeNull();
});

it("lastBackupAt returns null when no snapshot exists", async () => {
  expect(await lastBackupAt("nobody")).toBeNull();
});

it("lastBackupAt returns the epoch-ms of the last backup once one exists", async () => {
  await backup("u2");
  const ts = await lastBackupAt("u2");
  expect(ts).toBe(new Date("2026-07-05T00:00:00.000Z").getTime());
});
