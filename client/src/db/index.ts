import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { schema } from "./schema";
import { Plant } from "./models/Plant";
import { Observation } from "./models/Observation";

const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
  onSetUpError: (error) => console.error("WatermelonDB setup error:", error),
});

export const database = new Database({
  adapter,
  modelClasses: [Plant, Observation],
});
