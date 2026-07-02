import { schemaMigrations, addColumns } from "@nozbe/watermelondb/Schema/migrations";

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
  ],
});
