import fs from "fs";
import path from "path";

import { getWateringSchedule, historyFromWatered, nextWaterDate, scheduleStatus } from "../care";

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

  it("softens a never-watered plant to 'Water when dry' regardless of the estimated date", () => {
    expect(scheduleStatus("2026-07-06", "2026-07-02", true)).toEqual({
      label: "Water when dry",
      bg: "mintBg",
      fg: "leafText",
    });
  });
});

describe("getWateringSchedule", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the server result when the request succeeds", async () => {
    const serverResult = {
      next_water_date: "2026-07-05",
      interval_days: 3,
      reason: "server says so",
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => serverResult,
    }) as unknown as typeof fetch;

    const result = await getWateringSchedule("monstera", 0, [{ date: "2026-07-02" }]);
    expect(result).toEqual(serverResult);
  });

  it("falls back to the local calc when the network call rejects", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const history = [{ date: "2026-06-20" }];
    const result = await getWateringSchedule("monstera", 0, history);
    expect(result).toEqual(nextWaterDate("monstera", 0, history));
  });

  it("falls back to the local calc on a non-2xx response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const history = [{ date: "2026-06-25" }];
    const result = await getWateringSchedule("pothos", 0, history);
    expect(result).toEqual(nextWaterDate("pothos", 0, history));
  });
});
