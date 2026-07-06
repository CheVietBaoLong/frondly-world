import { Directory, File, Paths } from "expo-file-system";

const photosDir = new Directory(Paths.document, "photos");

function ensureDir(): void {
  if (!photosDir.exists) photosDir.create({ intermediates: true });
}

function extensionOf(uri: string): string {
  const match = uri.match(/\.(\w+)$/);
  return match ? match[1] : "jpg";
}

// True if `uri` already lives inside our durable photos directory.
export function isDurablePhoto(uri: string): boolean {
  return uri.startsWith(`${photosDir.uri}/`);
}

// Copies a camera/picker cache URI into durable app storage and returns the
// new URI. No-op if `uri` is already durable, so callers can invoke this
// unconditionally on every save.
export async function persistPhoto(uri: string): Promise<string> {
  if (isDurablePhoto(uri)) return uri;
  ensureDir();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionOf(uri)}`;
  const dest = new File(photosDir, name);
  await new File(uri).copy(dest);
  return dest.uri;
}

// Best-effort delete. No-op for null or any URI outside our durable
// directory (never touches a photo-library asset or anything we don't own).
export async function deletePhoto(uri: string | null): Promise<void> {
  if (!uri || !isDurablePhoto(uri)) return;
  try {
    await new File(uri).delete();
  } catch {
    // already gone — nothing to do
  }
}
