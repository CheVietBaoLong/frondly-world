import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import { schema } from "../schema";
import { Find } from "../models/Find";
import type { ForageResult } from "../../forage/api";

function makeDb() {
  const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  return new Database({ adapter, modelClasses: [Find] });
}

const SAMPLE: ForageResult = {
  state: "verified_edible",
  confidence: 0.92,
  name: "Salmonberry",
  scientific_name: "Rubus spectabilis",
  facts: { season: "Late spring through summer" },
  toxic_lookalikes: [],
  benign_lookalikes: [],
  possible_matches: [],
  sources: ["PNW dataset"],
  safety_strip: "Field ID aid only — never eat on an app's word alone.",
};

async function createFind(db: Database, result: ForageResult) {
  let created!: Find;
  await db.write(async () => {
    created = await db.get<Find>("finds").create((f) => {
      f.commonName = result.name ?? null;
      f.scientificName = result.scientific_name ?? null;
      f.state = result.state;
      f.confidence = result.confidence;
      f.result = result;
      f.savedAt = new Date();
    });
  });
  return created;
}

describe("Find snapshot", () => {
  it("round-trips the ForageResult through result_json", async () => {
    const db = makeDb();
    const { id } = await createFind(db, SAMPLE);
    const reloaded = await db.get<Find>("finds").find(id);
    expect(reloaded.result).toEqual(SAMPLE);
    expect(reloaded.confidence).toBe(0.92);
    expect(reloaded.commonName).toBe("Salmonberry");
  });

  it("maps forage state -> edibility status", async () => {
    const db = makeDb();
    const buckets: Record<string, Find["status"]> = {
      verified_edible: "edible",
      verified_toxic: "caution",
      unverified: "unconfirmed",
      low_confidence: "unconfirmed",
    };
    for (const [state, expected] of Object.entries(buckets)) {
      const f = await createFind(db, { ...SAMPLE, state: state as ForageResult["state"] });
      expect(f.status).toBe(expected);
    }
  });
});
