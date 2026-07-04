import { Q, Model } from "@nozbe/watermelondb";
import type { Query } from "@nozbe/watermelondb";
import { field, date, children } from "@nozbe/watermelondb/decorators";
import { THRIVING_THRESHOLD } from "../health";
import type { Observation } from "./Observation";

export class Plant extends Model {
  static table = "plants";
  static associations = {
    observations: { type: "has_many" as const, foreignKey: "plant_id" },
  };

  @field("name") name: string;
  @field("species") species: string;
  @date("date_added") dateAdded: Date;
  @date("last_watered") lastWatered: Date | null;
  @field("latitude") latitude: number | null;
  @field("longitude") longitude: number | null;
  @field("hero_photo") heroPhoto: string | null;
  @field("room") room: string | null;
  @field("light") light: string | null;
  @children("observations") observations: Query<Observation>;

  // oldest→newest, what the timeline + historyForBackend consume (ports Plant.timeline)
  private async timeline(): Promise<Observation[]> {
    return this.observations.extend(Q.sortBy("date", Q.asc)).fetch();
  }

  // latest recorded non-null health score (ports Plant.currentScore)
  async currentScore(): Promise<number | null> {
    const obs = await this.timeline();
    const scored = obs.filter((o) => o.healthScore != null);
    return scored.length ? scored[scored.length - 1].healthScore : null;
  }

  // ports Plant.needsAttention: (currentScore ?? 100) < threshold
  async needsAttention(): Promise<boolean> {
    return ((await this.currentScore()) ?? 100) < THRIVING_THRESHOLD;
  }

  // ports Plant.statusLine: latest note, or a friendly default
  async statusLine(): Promise<string> {
    const obs = await this.timeline();
    return obs.length ? obs[obs.length - 1].note : "Newly added";
  }

  // ports Plant.historyForBackend(): {date(ISO day), note, severity?, health_score?}
  async historyForBackend(): Promise<Record<string, unknown>[]> {
    const obs = await this.timeline();
    return obs.map((o) => {
      const d: Record<string, unknown> = {
        date: o.date.toISOString().slice(0, 10),
        note: o.note,
      };
      if (o.severity != null) d.severity = o.severity;
      if (o.healthScore != null) d.health_score = o.healthScore;
      return d;
    });
  }
}
