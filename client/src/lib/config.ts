// Single source of truth for the backend base URL, shared by lib/api.ts,
// lib/care.ts, lib/identify.ts, and forage/api.ts.
//
// Expo inlines any EXPO_PUBLIC_-prefixed env var into the bundle at build time
// (SDK 50+), so no expo-constants / app.config plumbing is needed. Put a
// machine-specific LAN IP (e.g. http://192.168.1.42:8000) in client/.env.local
// (gitignored) for physical-device testing; the localhost fallback keeps the
// simulator + adb-reverse flow working with no config.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:8000";
