import { schemaMigrations, addColumns, createTable } from "@nozbe/watermelondb/Schema/migrations";

// v1 → v2: diagnoses store the agent's confidence (0–1) alongside the score.
export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: "observations",
          columns: [{ name: "confidence", type: "number", isOptional: true }],
        }),
      ],
    },
    // v2 → v3: saved forage finds (identified wild plants).
    {
      toVersion: 3,
      steps: [
        createTable({
          name: "finds",
          columns: [
            { name: "common_name", type: "string", isOptional: true },
            { name: "scientific_name", type: "string", isOptional: true },
            { name: "state", type: "string" },
            { name: "confidence", type: "number" },
            { name: "photo", type: "string", isOptional: true },
            { name: "result_json", type: "string" },
            { name: "saved_at", type: "number" },
          ],
        }),
      ],
    },
    // v3 → v4: room/light captured on Add, previously discarded on save.
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: "plants",
          columns: [
            { name: "room", type: "string", isOptional: true },
            { name: "light", type: "string", isOptional: true },
          ],
        }),
      ],
    },
  ],
});
