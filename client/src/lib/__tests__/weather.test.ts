import { describeWmoCode, formatTemp } from "../weather";

// expo-location is native; the mapping under test is pure, so stub the module out.
jest.mock("expo-location", () => ({}));

describe("formatTemp", () => {
  it("rounds both units", () => {
    expect(formatTemp({ tempF: 71.6, tempC: 22.0 })).toBe("72°F / 22°C");
  });
});

describe("describeWmoCode", () => {
  it.each([
    [0, "sunny", "sunny"],
    [1, "partly cloudy", "partly-sunny"],
    [2, "partly cloudy", "partly-sunny"],
    [3, "overcast", "cloudy"],
    [45, "foggy", "cloudy"],
    [55, "rainy", "rainy"], // drizzle bucket
    [65, "rainy", "rainy"], // rain bucket
    [82, "rainy", "rainy"], // showers bucket
    [75, "snowy", "snow"],
    [86, "snowy", "snow"], // snow showers
    [95, "stormy", "thunderstorm"],
    [99, "stormy", "thunderstorm"],
  ] as const)("maps WMO code %i to %s/%s", (code, label, icon) => {
    expect(describeWmoCode(code)).toEqual({ label, icon });
  });

  it("falls back to cloudy for codes outside the table", () => {
    expect(describeWmoCode(42)).toEqual({ label: "cloudy", icon: "cloudy" });
  });
});
