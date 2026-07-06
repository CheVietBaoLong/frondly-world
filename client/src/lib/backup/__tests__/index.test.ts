import { database } from "@/db";
import { Plant } from "@/db/models/Plant";
import { backup, restore, lastBackupAt } from "../index";

// In-memory Firestore fake: docPath -> stored data
const store: Record<string, { json: string; updatedAt: number }> = {};
jest.mock("firebase/firestore", () => ({
  doc: (_db: unknown, coll: string, id: string) => ({ path: `${coll}/${id}` }),
  setDoc: async (r: { path: string }, data: { json: string; updatedAt: number }) => {
    store[r.path] = data;
  },
  getDoc: async (r: { path: string }) => ({
    exists: () => store[r.path] !== undefined,
    data: () => store[r.path],
  }),
}));
jest.mock("../../firebase", () => ({ firestore: {} }));

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
  await database.write(async () => {
    const all = await database.get("plants").query().fetch();
    await database.batch(...all.map((r) => r.prepareDestroyPermanently()));
  });
});

it("backs up the garden and restores it; photos come back null (metadata-only)", async () => {
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
  expect(store["backups/u1"]).toBeDefined();

  // wipe local, then restore from the fake Firestore
  await database.write(async () => {
    const all = await database.get("plants").query().fetch();
    await database.batch(...all.map((r) => r.prepareDestroyPermanently()));
  });
  await restore("u1");

  const plants = await database.get<Plant>("plants").query().fetch();
  expect(plants).toHaveLength(1);
  expect(plants[0].name).toBe("Monstera");
  expect(plants[0].heroPhoto).toBeNull(); // photos are local-only, not in the cloud backup
});

it("restore throws when the account has no backup", async () => {
  await expect(restore("nobody")).rejects.toThrow(/no backup/i);
});

it("lastBackupAt returns null when no backup exists", async () => {
  expect(await lastBackupAt("nobody")).toBeNull();
});

it("lastBackupAt returns the timestamp the backup produced", async () => {
  const ts = await backup("u2");
  expect(await lastBackupAt("u2")).toBe(ts);
});
