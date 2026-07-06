import { File } from "expo-file-system";
import { deletePhoto, isDurablePhoto, persistPhoto } from "../photo-storage";
import { mockFs } from "../../test-support/expo-file-system-mock";

// jest-expo's preset only auto-mocks the legacy expo-file-system/legacy
// namespace — the new File/Directory/Paths class API needs its own fake.
jest.mock("expo-file-system", () =>
  require("../../test-support/expo-file-system-mock").createExpoFileSystemMock()
);

beforeEach(() => {
  mockFs().clear();
});

describe("persistPhoto", () => {
  it("copies a non-durable cache URI into durable storage, preserving the extension", async () => {
    const result = await persistPhoto("file:///cache/photo123.jpg");
    expect(result).toMatch(/^file:\/\/\/doc\/photos\/.+\.jpg$/);
    expect(isDurablePhoto(result)).toBe(true);
  });

  it("falls back to a .jpg extension when the source URI has none", async () => {
    const result = await persistPhoto("file:///cache/no-extension");
    expect(result).toMatch(/\.jpg$/);
  });

  it("is a no-op for an already-durable URI", async () => {
    const durable = await persistPhoto("file:///cache/a.jpg");
    const copySpy = jest.spyOn(File.prototype, "copy");
    const result = await persistPhoto(durable);
    expect(result).toBe(durable);
    expect(copySpy).not.toHaveBeenCalled();
    copySpy.mockRestore();
  });
});

describe("isDurablePhoto", () => {
  it("does not treat a sibling directory sharing the durable dir's string prefix as durable", () => {
    expect(isDurablePhoto("file:///doc/photosArchive/evil.jpg")).toBe(false);
  });
});

describe("deletePhoto", () => {
  it("no-ops for null", async () => {
    await expect(deletePhoto(null)).resolves.toBeUndefined();
  });

  it("no-ops for a non-durable URI", async () => {
    const deleteSpy = jest.spyOn(File.prototype, "delete");
    await deletePhoto("file:///cache/untouched.jpg");
    expect(deleteSpy).not.toHaveBeenCalled();
    deleteSpy.mockRestore();
  });

  it("deletes a durable URI", async () => {
    const durable = await persistPhoto("file:///cache/b.jpg");
    await deletePhoto(durable);
    expect(new File(durable).exists).toBe(false);
  });

  it("swallows an error when the file is already gone", async () => {
    const durable = await persistPhoto("file:///cache/c.jpg");
    await deletePhoto(durable); // removes it
    await expect(deletePhoto(durable)).resolves.toBeUndefined(); // second delete would throw, swallowed
  });
});
