import { schema } from "../schema";
import { migrations } from "../migrations";

describe("schema v2 (observation confidence)", () => {
  it("adds an optional confidence column to observations", () => {
    expect(schema.tables.observations.columns.confidence).toEqual({
      name: "confidence",
      type: "number",
      isOptional: true,
    });
  });
});

describe("schema v3 (forage finds)", () => {
  it("adds a finds table with the snapshot column", () => {
    expect(schema.tables.finds).toBeDefined();
    expect(schema.tables.finds.columns.result_json).toEqual({
      name: "result_json",
      type: "string",
    });
    expect(schema.tables.finds.columns.state).toEqual({ name: "state", type: "string" });
  });
});

describe("schema v4 (room/light)", () => {
  it("bumps the schema version to 4", () => {
    expect(schema.version).toBe(4);
  });

  it("adds optional room and light columns to plants", () => {
    expect(schema.tables.plants.columns.room).toEqual({
      name: "room",
      type: "string",
      isOptional: true,
    });
    expect(schema.tables.plants.columns.light).toEqual({
      name: "light",
      type: "string",
      isOptional: true,
    });
  });
});

describe("migrations", () => {
  it("migrates existing installs up to the current version", () => {
    expect(migrations.maxVersion).toBe(schema.version);
  });
});
