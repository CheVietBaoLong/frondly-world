import { Database } from "@nozbe/watermelondb";
import LokiJSAdapter from "@nozbe/watermelondb/adapters/lokijs";
import { File } from "expo-file-system";
import { schema } from "../../db/schema";
import { Plant } from "../../db/models/Plant";
import { Observation } from "../../db/models/Observation";
import { Find } from "../../db/models/Find";
import { persistPhoto } from "../photo-storage";
import { deletePlant, deleteFind, deleteObservation } from "../garden-delete";
import { mockFs } from "../../test-support/expo-file-system-mock";

jest.mock("expo-file-system", () =>
  require("../../test-support/expo-file-system-mock").createExpoFileSystemMock()
);

function makeDb() {
  const adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  return new Database({ adapter, modelClasses: [Plant, Observation, Find] });
}

beforeEach(() => {
  mockFs().clear();
});

it("deletePlant removes the plant, cascades to its observations, and deletes their durable photos", async () => {
  const db = makeDb();
  new File("file:///cache/hero.jpg").create();
  new File("file:///cache/obs.jpg").create();
  const heroUri = await persistPhoto("file:///cache/hero.jpg");
  const obsUri = await persistPhoto("file:///cache/obs.jpg");

  let plant!: Plant;
  await db.write(async () => {
    plant = await db.get<Plant>("plants").create((p) => {
      p.name = "Monstera";
      p.species = "Monstera deliciosa";
      p.dateAdded = new Date();
      p.latitude = null;
      p.longitude = null;
      p.heroPhoto = heroUri;
    });
    await db.get<Observation>("observations").create((o) => {
      o.plant.set(plant);
      o.note = "yellowing";
      o.healthScore = 80;
      o.date = new Date();
      o.photo = obsUri;
    });
  });

  expect(new File(heroUri).exists).toBe(true);

  await deletePlant(db, plant.id);

  expect(await db.get("plants").query().fetchCount()).toBe(0);
  expect(await db.get("observations").query().fetchCount()).toBe(0);
  expect(new File(heroUri).exists).toBe(false);
  expect(new File(obsUri).exists).toBe(false);
});

it("deleteObservation removes one note and its photo, leaving the plant and siblings", async () => {
  const db = makeDb();
  new File("file:///cache/note.jpg").create();
  const notePhoto = await persistPhoto("file:///cache/note.jpg");

  let plant!: Plant;
  let target!: Observation;
  await db.write(async () => {
    plant = await db.get<Plant>("plants").create((p) => {
      p.name = "Basil";
      p.species = "Ocimum basilicum";
      p.dateAdded = new Date();
      p.latitude = null;
      p.longitude = null;
    });
    target = await db.get<Observation>("observations").create((o) => {
      o.plant.set(plant);
      o.note = "spots";
      o.healthScore = 60;
      o.date = new Date();
      o.photo = notePhoto;
    });
    await db.get<Observation>("observations").create((o) => {
      o.plant.set(plant);
      o.note = "keep me";
      o.date = new Date();
    });
  });

  await deleteObservation(db, target.id);

  expect(await db.get("observations").query().fetchCount()).toBe(1);
  expect(await db.get("plants").query().fetchCount()).toBe(1);
  expect(new File(notePhoto).exists).toBe(false);
});

it("deleteFind removes the find and its durable photo", async () => {
  const db = makeDb();
  new File("file:///cache/find.jpg").create();
  const photoUri = await persistPhoto("file:///cache/find.jpg");

  let find!: Find;
  await db.write(async () => {
    find = await db.get<Find>("finds").create((f) => {
      f.commonName = "Salmonberry";
      f.scientificName = "Rubus spectabilis";
      f.state = "verified_edible";
      f.confidence = 0.9;
      f.photo = photoUri;
      f.savedAt = new Date();
    });
  });

  await deleteFind(db, find.id);

  expect(await db.get("finds").query().fetchCount()).toBe(0);
  expect(new File(photoUri).exists).toBe(false);
});
