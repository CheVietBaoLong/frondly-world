# Frondly

A plant-care companion: snap a photo, get an AI diagnosis and care plan, and track each plant's health over time. *Frondly* = **frond** (a leaf) + **friendly**.

This is a monorepo with a Python backend and a React Native (Expo) client.

## Structure

```
frondly-world/
├── server/    # Python — FastAPI + Google ADK agent + Gemini vision (stateless)
├── client/    # React Native (Expo) app — "Frondly" — Expo Router + NativeWind + WatermelonDB
└── docs/      # Design specs and tokens
```

- **`server/`** — A stateless HTTP/JSON service. The `plantcare` ADK agent (chat + tool-calling for diagnosis, watering schedule, weather, decline tracking) is mounted via `get_fast_api_app` (`/run`, `/sessions`, …), alongside a deterministic `/forage/identify` endpoint backed by Gemini vision. Persists nothing — clients send history per request.
- **`client/`** — The Frondly mobile app. On-device garden stored in **WatermelonDB** (SQLite); UI in Expo Router + NativeWind (Tailwind). Talks to `server/` over plain HTTP.

## Quickstart

### Backend (`server/`)

Requires [uv](https://docs.astral.sh/uv/) and a `GEMINI_API_KEY` in a root `.env`.

```bash
cd server
uv sync
uv run uvicorn main:app --reload   # serves on http://localhost:8000
```

### Client (`client/`)

Requires Node + [yarn](https://yarnpkg.com/). WatermelonDB needs native modules, so use an Expo **development build** (not Expo Go).

```bash
cd client
yarn install
yarn start            # Metro dev server
# build a dev client (iOS/Android) via EAS — see docs:
# npx eas build --profile development --platform ios|android
```

Point the client at the backend by setting `BASE_URL` in `client/src/lib/api.ts` (use your machine's LAN IP on a physical device).

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python, FastAPI, Google ADK, Gemini |
| Client | React Native (Expo SDK 56), Expo Router, NativeWind (Tailwind v3), WatermelonDB |
| Tooling | uv (server), yarn + ESLint + Prettier + Husky (client) |

## Status

Backend (forage identify + plantcare agent) is implemented and tested. The client is mid-migration from an earlier SwiftUI app to React Native; see `docs/react-native-migration-design.md` for the architecture and rationale.
