import * as Location from "expo-location";

// Live local weather for the Garden Home assistant card (docs/weather-card-spec.md).
// Open-Meteo is keyless and free for non-commercial use.

export type WeatherIcon = "sunny" | "partly-sunny" | "cloudy" | "rainy" | "snow" | "thunderstorm";

export type Weather = {
  city: string;
  label: string;
  icon: WeatherIcon;
  tempF: number;
};

// WMO weather interpretation codes (Open-Meteo's `weather_code`) bucketed to
// the ~7 conditions the card can express. https://open-meteo.com/en/docs
export function describeWmoCode(code: number): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: "sunny", icon: "sunny" };
  if (code === 1 || code === 2) return { label: "partly cloudy", icon: "partly-sunny" };
  if (code === 3) return { label: "overcast", icon: "cloudy" };
  if (code === 45 || code === 48) return { label: "foggy", icon: "cloudy" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return { label: "rainy", icon: "rainy" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { label: "snowy", icon: "snow" };
  if (code >= 95) return { label: "stormy", icon: "thunderstorm" };
  return { label: "cloudy", icon: "cloudy" }; // unknown codes read as mild weather
}

// Permission → coarse position → city name → current conditions.
// Resolves null on ANY failure (denied, no city, network) — the card degrades
// silently, so this must never throw.
export async function getWeather(): Promise<Weather | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    // dev-note: no manual-city fallback when denied — add alongside a future settings screen.
    if (status !== "granted") return null;

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low, // city-level is enough; cheaper than a GPS fix
    });
    const { latitude, longitude } = pos.coords;

    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const city = place?.city;
    if (!city) return null;

    // dev-note: Fahrenheit hardcoded — derive from device locale if non-US users matter.
    const lat = Math.round(latitude * 100) / 100;
    const lon = Math.round(longitude * 100) / 100;
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=weather_code,temperature_2m&temperature_unit=fahrenheit`
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      current?: { weather_code?: number; temperature_2m?: number };
    };
    const code = data.current?.weather_code;
    const tempF = data.current?.temperature_2m;
    if (code == null || tempF == null) return null;

    return { city, tempF, ...describeWmoCode(code) };
  } catch {
    return null;
  }
}
