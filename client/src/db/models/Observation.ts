import { Model } from "@nozbe/watermelondb";
import type { Relation } from "@nozbe/watermelondb";
import { field, date, relation, json } from "@nozbe/watermelondb/decorators";
import type { Plant } from "./Plant";

const sanitizeSteps = (raw: unknown): string[] => (Array.isArray(raw) ? raw.map(String) : []);

export class Observation extends Model {
  static table = "observations";
  static associations = {
    plants: { type: "belongs_to" as const, key: "plant_id" },
  };

  @field("note") note: string;
  @field("severity") severity: string | null;
  @field("health_score") healthScore: number | null;
  @field("confidence") confidence: number | null;
  @field("photo") photo: string | null;
  @date("date") date: Date;
  @json("care_steps", sanitizeSteps) careSteps: string[];
  @relation("plants", "plant_id") plant: Relation<Plant>;
}
