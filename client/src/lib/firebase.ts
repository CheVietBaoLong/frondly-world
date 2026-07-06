// Firebase Auth + Storage, configured from EXPO_PUBLIC_FIREBASE_* env vars
// (web config keys are public-safe). Same env pattern as lib/config.ts.
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
// getReactNativePersistence IS exported at runtime (Metro resolves the
// "react-native" package.json export condition down to
// @firebase/auth/dist/rn/index.js, which defines it), but firebase's own
// .d.ts exports map lists a single shared "types" key ahead of the
// "react-native" condition branch, so TypeScript never sees the
// platform-specific declaration and reports a false "no exported member".
// Verified against the installed firebase@12.15.0 by inspecting
// node_modules/@firebase/auth/dist/rn/index.js (has the export) vs.
// node_modules/@firebase/auth/dist/auth-public.d.ts (doesn't).
// @ts-expect-error -- see comment above; firebase/auth's types lag its RN export condition
import { getReactNativePersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const storage = getStorage(app);
