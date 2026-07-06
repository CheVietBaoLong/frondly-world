// Backs up / restores the local WatermelonDB garden as a single Firestore
// document (backups/{uid}). Metadata-only: photos stay device-local because
// Firestore is a document store, not a blob store, and Storage needs the paid
// Blaze plan. The snapshot still records each photo's basename, so restore
// nulls any photo (see applySnapshot) and a future photo-sync could backfill.
import { doc, setDoc, getDoc } from "firebase/firestore";
import { firestore } from "../firebase";
import { database } from "@/db";
import { toSnapshot, applySnapshot, type Snapshot } from "./snapshot";

const backupRef = (uid: string) => doc(firestore, "backups", uid);

export async function backup(uid: string): Promise<number> {
  const snap = await toSnapshot(database);
  const updatedAt = Date.now();
  // Stored as a JSON string field, sidestepping Firestore's nested-array and
  // undefined-value restrictions. Well under the 1 MiB/document limit for a
  // metadata-only garden.
  await setDoc(backupRef(uid), { json: JSON.stringify(snap), updatedAt });
  return updatedAt;
}

export async function restore(uid: string): Promise<void> {
  const snapshot = await getDoc(backupRef(uid));
  if (!snapshot.exists()) throw new Error("No backup found for this account.");
  const snap = JSON.parse(snapshot.data().json as string) as Snapshot;
  // Empty photo map → every photo basename collapses to null (photos are local-only).
  await applySnapshot(database, snap, {});
}

export async function lastBackupAt(uid: string): Promise<number | null> {
  try {
    const snapshot = await getDoc(backupRef(uid));
    return snapshot.exists() ? ((snapshot.data().updatedAt as number) ?? null) : null;
  } catch {
    return null;
  }
}
