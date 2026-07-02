# Live Weather Card — Design Spec

**Date:** 2026-07-02 · **Status:** approved

Replace the static "Boston · sunny" `AssistantCard` on Garden Home
(`client/src/app/(tabs)/index.tsx`) with live local weather. The existing
`dev-note` on that card marks this as the deferred work.

## Decisions (made during brainstorm)

- **Data source:** Open-Meteo (`api.open-meteo.com/v1/forecast`), fetched
  directly from the client. Free, no API key, no backend involvement — the
  card works even when the FastAPI dev server isn't running.
- **Location:** device GPS via `expo-location` (foreground permission,
  `Accuracy.Low` — city-level is sufficient), reverse-geocoded to a city name
  with `Location.reverseGeocodeAsync`. Native module → requires one dev-client
  rebuild.
- **Temperature:** shown in the card title. Request
  `temperature_unit=fahrenheit` from Open-Meteo.
- **Scope cut:** auth/avatar/multi-device sync explicitly deferred to its own
  future spec. No settings UI, no backend `/weather` endpoint, no
  weather-aware AI care tips.

## Components

### `client/src/lib/weather.ts` (new)

- `getWeather(): Promise<Weather | null>` where
  `Weather = { city: string; label: string; icon: string; tempF: number }`.
- Flow: request foreground permission → `getCurrentPositionAsync` (low
  accuracy) → `reverseGeocodeAsync` for city → fetch Open-Meteo
  `current=weather_code,temperature_2m` with `temperature_unit=fahrenheit`.
- Exported WMO weather-code → `{ label, icon }` mapping (~7 buckets: clear,
  partly cloudy, cloudy/fog, drizzle/rain, snow, showers, thunderstorm),
  icons chosen from Ionicons (`sunny`, `partly-sunny`, `cloudy`, `rainy`,
  `snow`, `thunderstorm`).
- Any failure (permission denied, geocode miss, network error) → resolve
  `null`. Never throws to the UI.

### `client/src/hooks/use-weather.ts` (new)

- `useWeather(): Weather | null` — fetches on mount; module-level cache with
  30-minute TTL so tab remounts don't refetch or re-prompt for permission.
- Same "hook feeds the screen" pattern as `use-garden`.

### `client/src/app/(tabs)/index.tsx` (edit)

- Card title: `` `${city} · ${Math.round(tempF)}° · ${label}` `` (e.g.
  "Boston · 72° · sunny"); icon from the mapping.
- While loading / on `null`: title `"Your garden"`, current `sunny` icon —
  silent degradation, no error UI on the home screen.
- Detail line (care summary) unchanged. Remove the static-copy `dev-note`.

### Config

- Add `expo-location` to `app.json` plugins with
  `locationWhenInUsePermission: "Frondly uses your location to show local
  weather for your plants."`

## Error handling

Every failure path collapses to `null` inside `lib/weather.ts`; the card
falls back to the generic title. No retries, no error states surfaced.

## Testing

- One jest test for the WMO code mapping (the only branchy logic): known
  codes map to expected label/icon buckets, unknown codes fall back to a
  sane default.
- Location/fetch glue verified by running the app on the simulator.

## Known ceilings (dev-notes in code)

- Fahrenheit hardcoded; add unit detection from device locale if
  international users matter.
- No manual-city fallback when permission is denied; add alongside a future
  settings screen.
