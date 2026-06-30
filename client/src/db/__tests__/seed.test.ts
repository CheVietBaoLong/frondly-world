import { Database, Q } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import { schema } from "../schema";
import { Plant } from "../models/Plant";
import { Observation } from "../models/Observation";
import { seedSampleGardenIfEmpty } from "../seed";

function makeDb() {
  const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  return new Database({ adapter, modelClasses: [Plant, Observation] });
}

it("seeds 4 plants once and is idempotent", async () => {
  const db = makeDb();
  await seedSampleGardenIfEmpty(db);
  await seedSampleGardenIfEmpty(db); // second call must be a no-op
  expect(await db.get<Plant>("plants").query().fetchCount()).toBe(4);
});

it("computes currentScore / needsAttention / statusLine from the timeline", async () => {
  const db = makeDb();
  await seedSampleGardenIfEmpty(db);
  const [monstera] = await db.get<Plant>("plants").query(Q.where("name", "Monstera")).fetch();
  const [basil] = await db.get<Plant>("plants").query(Q.where("name", "Basil")).fetch();

  expect(await monstera.currentScore()).toBe(92);
  expect(await monstera.needsAttention()).toBe(false);

  expect(await basil.currentScore()).toBe(48);
  expect(await basil.needsAttention()).toBe(true);
  expect(await basil.statusLine()).toBe("Splotches on lower leaves");
});
