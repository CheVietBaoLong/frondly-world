import type { Database } from "@nozbe/watermelondb";
import { Plant } from "./models/Plant";
import { Observation } from "./models/Observation";

const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

// [score, note, daysAgo] — ports SampleData.swift exactly
const GARDEN: { name: string; species: string; scores: [number, string, number][] }[] = [
  {
    name: "Monstera",
    species: "Monstera deliciosa",
    scores: [
      [70, "Drooping, low light", 18],
      [70, "Moved nearer window", 12],
      [80, "New growth point", 6],
      [88, "Leaf fenestrating", 2],
      [92, "Healthy — new fenestrated leaf unfurling", 0],
    ],
  },
  {
    name: "Snake Plant",
    species: "Dracaena trifasciata",
    scores: [
      [84, "Slight tip browning", 9],
      [88, "Low light OK, firm leaves", 0],
    ],
  },
  {
    name: "Fiddle Fig",
    species: "Ficus lyrata",
    scores: [
      [86, "New leaf", 14],
      [81, "Soil dry · 3cm down", 0],
    ],
  },
  {
    name: "Basil",
    species: "Ocimum basilicum",
    scores: [
      [62, "A few yellow leaves", 7],
      [48, "Splotches on lower leaves", 0],
    ],
  },
];

export async function seedSampleGardenIfEmpty(database: Database): Promise<void> {
  const existing = await database.get<Plant>("plants").query().fetchCount();
  if (existing > 0) return;

  await database.write(async () => {
    for (const spec of GARDEN) {
      const plant = await database.get<Plant>("plants").create((p) => {
        p.name = spec.name;
        p.species = spec.species;
        p.dateAdded = new Date();
        p.latitude = 42.36; // Boston, matches the weather card
        p.longitude = -71.06;
      });
      for (const [score, note, ago] of spec.scores) {
        await database.get<Observation>("observations").create((o) => {
          (o as any).plant.set(plant);
          o.note = note;
          o.healthScore = score;
          o.date = daysAgo(ago);
        });
      }
    }
  });
}
