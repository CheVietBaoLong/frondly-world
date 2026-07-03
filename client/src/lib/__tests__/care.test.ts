import fs from "fs";
import path from "path";

import { historyFromWatered, nextWaterDate, scheduleStatus } from "../care";

const fixturePath = path.join(__dirname, "../../../../fixtures/watering-schedule.golden.json");
type GoldenCase = {
  species: string;
  precip_7d: number;
  history: { date: string }[];
  expected: { next_water_date: string | null; interval_days: number; reason: string };
};
const cases: GoldenCase[] = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

describe("nextWaterDate golden fixture", () => {
  cases.forEach((c, i) => {
    it(`case ${i}: ${c.species}`, () => {
      expect(nextWaterDate(c.species, c.precip_7d, c.history)).toEqual(c.expected);
    });
  });
});

describe("historyFromWatered", () => {
  it("uses lastWatered when set", () => {
    expect(
      historyFromWatered(new Date("2026-06-15T00:00:00Z"), new Date("2026-01-01T00:00:00Z"))
    ).toEqual([{ date: "2026-06-15" }]);
  });

  it("falls back to dateAdded when lastWatered is null", () => {
    expect(historyFromWatered(null, new Date("2026-01-01T00:00:00Z"))).toEqual([
      { date: "2026-01-01" },
    ]);
  });
});

describe("scheduleStatus", () => {
  it("labels a future date as 'Water in Xd'", () => {
    expect(scheduleStatus("2026-07-06", "2026-07-02")).toEqual({
      label: "Water in 4d",
      bg: "mintBg",
      fg: "leafText",
    });
  });

  it("labels today as 'Water today'", () => {
    expect(scheduleStatus("2026-07-02", "2026-07-02")).toEqual({
      label: "Water today",
      bg: "blushBg",
      fg: "rust",
    });
  });

  it("labels a past date as overdue", () => {
    expect(scheduleStatus("2026-06-30", "2026-07-02")).toEqual({
      label: "Overdue by 2d",
      bg: "blushBg",
      fg: "rust",
    });
  });

  it("labels null as unknown", () => {
    expect(scheduleStatus(null, "2026-07-02")).toEqual({
      label: "Unknown",
      bg: "stoneBg",
      fg: "secondary",
    });
  });
});
