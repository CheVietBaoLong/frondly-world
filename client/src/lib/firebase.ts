// Firebase Auth + Firestore, configured from EXPO_PUBLIC_FIREBASE_* env vars
// (web config keys are public-safe). Same env pattern as lib/config.ts.
// Firestore (not Storage) because new Firebase projects require the paid Blaze
// plan to provision a Storage bucket; Firestore is free on the Spark plan.
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
import { initializeFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
// experimentalForceLongPolling: the JS SDK's default WebChannel transport can
// hang on React Native; long-polling is the documented fix for RN.
export const firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
