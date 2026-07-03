import { Model } from "@nozbe/watermelondb";
import { field, date, json } from "@nozbe/watermelondb/decorators";
import type { ForageResult } from "@/forage/api";

// A saved forage find: the durable, offline snapshot of one identification.
// result_json holds the full ForageResult so the find detail re-renders exactly
// what the user saw, independent of the server (mirrors Observation.care_steps).
const sanitizeResult = (raw: unknown): ForageResult =>
  (raw && typeof raw === "object" ? raw : {}) as ForageResult;

export class Find extends Model {
  static table = "finds";

  @field("common_name") commonName: string | null;
  @field("scientific_name") scientificName: string | null;
  @field("state") state: string;
  @field("confidence") confidence: number;
  @field("photo") photo: string | null;
  @date("saved_at") savedAt: Date;
  @json("result_json", sanitizeResult) result: ForageResult;

  // Edibility bucket driving the finds-list chip + filter.
  get status(): "edible" | "caution" | "unconfirmed" {
    if (this.state === "verified_edible") return "edible";
    if (this.state === "verified_toxic") return "caution";
    return "unconfirmed"; // unverified | low_confidence
  }
}
