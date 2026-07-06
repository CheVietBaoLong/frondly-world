// Orchestrates backup/restore between the local WatermelonDB garden and
// Firebase Storage (users/{uid}/snapshot.json + users/{uid}/photos/{basename}).
import { ref, uploadBytes, getBytes, getMetadata } from "firebase/storage";
import { File, Paths } from "expo-file-system";
import { storage } from "../firebase";
import { database } from "@/db";
import { persistPhoto } from "../photo-storage";
import { toSnapshot, applySnapshot, basename, type Snapshot } from "./snapshot";

const snapshotPath = (uid: string) => `users/${uid}/snapshot.json`;
const photoPath = (uid: string, name: string) => `users/${uid}/photos/${name}`;

async function referencedPhotoUris(): Promise<string[]> {
  // photo URIs currently on records (full local file:// paths, pre-basename)
  const plants = await database.get("plants").query().fetch();
  const obs = await database.get("observations").query().fetch();
  const finds = await database.get("finds").query().fetch();
  const uris = [
    ...plants.map((p) => (p._raw as any).hero_photo as string | null),
    ...obs.map((o) => (o._raw as any).photo as string | null),
    ...finds.map((f) => (f._raw as any).photo as string | null),
  ];
  return uris.filter((u): u is string => !!u);
}

export async function backup(uid: string): Promise<number> {
  const uris = await referencedPhotoUris();
  const failed: string[] = [];
  for (const uri of uris) {
    const name = basename(uri)!;
    try {
      const buf = await new File(uri).arrayBuffer();
      const bytes = new Uint8Array(buf);
      await uploadBytes(ref(storage, photoPath(uid, name)), bytes);
    } catch {
      failed.push(name); // photo missing locally — skip, snapshot still records it
    }
  }
  const snap = await toSnapshot(database);
  const json = new TextEncoder().encode(JSON.stringify(snap));
  await uploadBytes(ref(storage, snapshotPath(uid)), json);
  if (failed.length) console.warn("backup: photos not uploaded:", failed);
  return Date.now();
}

export async function restore(uid: string): Promise<void> {
  const buf = await getBytes(ref(storage, snapshotPath(uid)));
  const snap = JSON.parse(new TextDecoder().decode(buf)) as Snapshot;

  const names = new Set<string>();
  for (const p of snap.plants) if (p.heroPhoto) names.add(p.heroPhoto);
  for (const o of snap.observations) if (o.photo) names.add(o.photo);
  for (const f of snap.finds) if (f.photo) names.add(f.photo);

  const map: Record<string, string> = {};
  const failed: string[] = [];
  for (const name of names) {
    try {
      const photoBuf = await getBytes(ref(storage, photoPath(uid, name)));
      const tmp = new File(Paths.cache, name);
      // Synchronous — expo-file-system@56's `File#write` accepts a Uint8Array
      // directly (see node_modules/expo-file-system/build/internal/NativeFileSystem.types.d.ts),
      // no `await` needed.
      tmp.write(new Uint8Array(photoBuf));
      map[name] = await persistPhoto(tmp.uri);
    } catch {
      failed.push(name); // download failed → leave out of map → applySnapshot nulls that photo
    }
  }
  if (failed.length) console.warn("restore: photos not recovered:", failed);
  await applySnapshot(database, snap, map);
}

export async function lastBackupAt(uid: string): Promise<number | null> {
  try {
    const meta = await getMetadata(ref(storage, snapshotPath(uid)));
    return meta.updated ? new Date(meta.updated).getTime() : null;
  } catch {
    return null;
  }
}
