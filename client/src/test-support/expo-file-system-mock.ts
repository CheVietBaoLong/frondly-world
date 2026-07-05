// Shared in-memory fake for the `expo-file-system` File/Directory/Paths class
// API (jest-expo's preset only auto-mocks the legacy expo-file-system/legacy
// namespace). Used by both photo-storage.test.ts and photo-backfill.test.ts.
//
// Lives outside any `__tests__/` directory on purpose: Jest's default
// testMatch treats every file under `__tests__/` as a test file, and this
// module has no tests of its own.
export function createExpoFileSystemMock() {
  const fs = new Set<string>();

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
      fs.add(this.uri);
    }
    async copy(dest: MockFile) {
      fs.add(dest.uri);
    }
    async delete() {
      if (!fs.has(this.uri)) throw new Error("ENOENT");
      fs.delete(this.uri);
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
      fs.add(this.uri);
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
    Paths: { document: { uri: "file:///doc/" } },
    __fs: fs,
  };
}

export function mockFs(): Set<string> {
  return (jest.requireMock("expo-file-system") as { __fs: Set<string> }).__fs;
}
