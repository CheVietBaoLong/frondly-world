import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const schema = appSchema({
  version: 4,
  tables: [
    tableSchema({
      name: "plants",
      columns: [
        { name: "name", type: "string" },
        { name: "species", type: "string" },
        { name: "date_added", type: "number" },
        { name: "last_watered", type: "number", isOptional: true },
        { name: "latitude", type: "number", isOptional: true },
        { name: "longitude", type: "number", isOptional: true },
        { name: "hero_photo", type: "string", isOptional: true }, // file URI
        { name: "room", type: "string", isOptional: true },
        { name: "light", type: "string", isOptional: true },
      ],
    }),
    tableSchema({
      name: "observations",
      columns: [
        { name: "plant_id", type: "string", isIndexed: true },
        { name: "date", type: "number" },
        { name: "note", type: "string" },
        { name: "severity", type: "string", isOptional: true },
        { name: "health_score", type: "number", isOptional: true },
        { name: "care_steps", type: "string", isOptional: true }, // JSON string
        { name: "confidence", type: "number", isOptional: true }, // 0–1, from the agent
        { name: "photo", type: "string", isOptional: true }, // file URI
      ],
    }),
    tableSchema({
      name: "finds",
      columns: [
        { name: "common_name", type: "string", isOptional: true }, // suppressed for low_confidence
        { name: "scientific_name", type: "string", isOptional: true },
        { name: "state", type: "string" }, // ForageState
        { name: "confidence", type: "number" }, // 0–1
        { name: "photo", type: "string", isOptional: true }, // capture URI
        { name: "result_json", type: "string" }, // full ForageResult snapshot
        { name: "saved_at", type: "number" },
      ],
    }),
  ],
});
