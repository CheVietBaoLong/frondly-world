import { schema } from "../schema";
import { migrations } from "../migrations";

describe("schema v2 (observation confidence)", () => {
  it("bumps the schema version to 2", () => {
    expect(schema.version).toBe(2);
  });

  it("adds an optional confidence column to observations", () => {
    expect(schema.tables.observations.columns.confidence).toEqual({
      name: "confidence",
      type: "number",
      isOptional: true,
    });
  });

  it("migrates existing installs up to the current version", () => {
    expect(migrations.maxVersion).toBe(schema.version);
  });
});
