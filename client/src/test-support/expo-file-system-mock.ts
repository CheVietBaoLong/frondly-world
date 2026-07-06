// Shared in-memory fake for the `expo-file-system` File/Directory/Paths class
// API (jest-expo's preset only auto-mocks the legacy expo-file-system/legacy
// namespace). Used by both photo-storage.test.ts and photo-backfill.test.ts.
//
// Lives outside any `__tests__/` directory on purpose: Jest's default
// testMatch treats every file under `__tests__/` as a test file, and this
// module has no tests of its own.
export function createExpoFileSystemMock() {
  const fs = new Map<string, Uint8Array>();

  function partUri(part: unknown): string {
    return typeof part === "string" ? part : (part as { uri: string }).uri;
  }

  // Joins path segments the way expo-file-system's real Paths.join() does:
  // it parses the first segment as a URL and only normalizes the pathname,
  // never touching the "scheme://" separator (see
  // node_modules/expo-file-system/src/pathUtilities/index.ts's
  // `PathUtilities.join`, which operates on `pathAsUrl.pathname`). Splitting
  // the scheme off before collapsing duplicate slashes avoids mangling the
  // "://" itself while still deduping the extra "/" produced by
  // concatenating a trailing-slash directory URI with a bare segment.
  function joinUris(...parts: unknown[]): string {
    const joined = parts.map(partUri).join("/");
    const match = joined.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)(.*)$/);
    if (!match) return joined.replace(/\/{2,}/g, "/");
    const [, scheme, rest] = match;
    return scheme + rest.replace(/\/{2,}/g, "/");
  }

  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = joinUris(...parts);
    }
    get exists() {
      return fs.has(this.uri);
    }
    create() {
      fs.set(this.uri, new Uint8Array());
    }
    async copy(dest: MockFile) {
      const bytes = fs.get(this.uri);
      fs.set(dest.uri, bytes ? new Uint8Array(bytes) : new Uint8Array());
    }
    async delete() {
      if (!fs.has(this.uri)) throw new Error("ENOENT");
      fs.delete(this.uri);
    }
    // Backup/restore's read path (backup uploads via this). Real
    // expo-file-system@56 has no top-level `bytes()` on `File` — reading
    // bytes goes through the (Blob-interface) `arrayBuffer()` method
    // instead (verified against node_modules/expo-file-system/src/File.ts).
    async arrayBuffer(): Promise<ArrayBuffer> {
      const bytes = fs.get(this.uri);
      if (!bytes) throw new Error(`ENOENT: ${this.uri}`);
      return bytes.slice().buffer;
    }
    // Real expo-file-system@56's `File#write` is synchronous and accepts a
    // Uint8Array directly (inherited from the native FileSystemFile class;
    // see node_modules/expo-file-system/build/internal/NativeFileSystem.types.d.ts).
    // Used by restore's temp-file write.
    write(content: string | Uint8Array): void {
      const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
      fs.set(this.uri, new Uint8Array(bytes));
    }
    // `writeBytes` also lives on the mock (matching a same-named method the
    // real SDK exposes one level down, on `FileHandle` via `file.open()`) so
    // tests can seed photo bytes directly through the File API without a
    // bespoke test-only helper.
    writeBytes(bytes: Uint8Array): void {
      fs.set(this.uri, new Uint8Array(bytes));
    }
  }

  class MockDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = joinUris(...parts);
    }
    get exists() {
      return fs.has(this.uri);
    }
    create() {
      fs.set(this.uri, new Uint8Array());
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    // Trailing slash matches Expo's real native documentDirectory convention
    // (e.g. iOS/Android both return it with a trailing "/") — the
    // scheme-aware slash collapsing in `joinUris` above then mirrors the
    // real library's path-join/normalize behavior (verified against
    // node_modules/expo-file-system/src/pathUtilities/index.ts and path.ts),
    // proving isDurablePhoto's directory-boundary check is correct even when
    // the native documentDirectory carries a trailing slash.
    Paths: { document: { uri: "file:///doc/" }, cache: { uri: "file:///cache/" } },
    __fs: fs,
  };
}

export function mockFs(): Map<string, Uint8Array> {
  return (jest.requireMock("expo-file-system") as { __fs: Map<string, Uint8Array> }).__fs;
}
