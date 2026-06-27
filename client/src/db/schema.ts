import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const schema = appSchema({
  version: 1,
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
        { name: "photo", type: "string", isOptional: true }, // file URI
      ],
    }),
  ],
});
