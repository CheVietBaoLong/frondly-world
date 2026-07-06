import * as Location from "expo-location";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

// Recent rainfall (mm, last 7 days) for the watering schedule's rain
// adjustment. Mirrors weather.ts's permission/fetch flow but skips
// reverse-geocoding — Care doesn't need a city name, so this stays a
// separate module rather than growing weather.ts's responsibility.
export async function getRecentRainfall(): Promise<number | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const { latitude, longitude } = pos.coords;
    const lat = Math.round(latitude * 100) / 100;
    const lon = Math.round(longitude * 100) / 100;

    const res = await fetch(
      `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&daily=precipitation_sum&past_days=7&forecast_days=0`
    );
    if (!res.ok) return null;

    const data = (await res.json()) as { daily?: { precipitation_sum?: (number | null)[] } };
    const days = data.daily?.precipitation_sum;
    if (!days) return null;

    const sum = days.slice(0, 7).reduce((total: number, mm: number | null) => total + (mm ?? 0), 0);
    // Rounded to 1 decimal to match server/plantcare/tools/weather.py's
    // round(...,1) — keeps lib/care.ts's reason-text formatting consistent
    // between the server and the local fallback.
    return Math.round(sum * 10) / 10;
  } catch {
    return null;
  }
}
