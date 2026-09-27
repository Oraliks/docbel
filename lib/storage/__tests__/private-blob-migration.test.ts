import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), change: vi.fn(), retry: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { file: { findMany: mocks.findMany }, appSetting: { count: mocks.count } } }));
vi.mock("../file-privacy", () => ({
  MAX_PRIVACY_FILES: 500, PRIVACY_CLEANUP_PREFIX: "storage-privacy-cleanup:",
  changeFilePrivacy: mocks.change, retryPrivacyCleanup: mocks.retry,
  FilePrivacyError: class FilePrivacyError extends Error {},
}));
import { migratePrivateBlobs } from "../private-blob-migration";
const source = "blobs:https://a.public.blob.vercel-storage.com/private/sensitive-name.pdf";
const destination = "blobs:https://b.private.blob.vercel-storage.com/private/file.pdf";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.count.mockResolvedValue(0);
  mocks.change.mockResolvedValue({ updated: 1, moved: 1 });
  mocks.retry.mockResolvedValue({ completed: 0, pending: 0 });
  mocks.findMany.mockResolvedValue([]);
});
function legacyRows(aliases = [{ id: "one", isPrivate: true }]) {
  mocks.findMany.mockResolvedValueOnce([{ id: "one", filePath: source }]).mockResolvedValueOnce(aliases).mockResolvedValueOnce([]);
}
describe("private Blob migration", () => {
  it("defaults to an inventory without mutations or identifying paths", async () => {
    legacyRows();
    const result = await migratePrivateBlobs();
    expect(result.mode).toBe("dry-run");
    expect(result.groups[0]).toMatchObject({ privateReferences: 1, publicReferences: 0, status: "ready" });
    expect(JSON.stringify(result)).not.toContain("sensitive-name");
    expect(JSON.stringify(result)).not.toContain("https:");
    expect(mocks.change).not.toHaveBeenCalled();
    expect(mocks.retry).not.toHaveBeenCalled();
    for (const call of mocks.findMany.mock.calls) expect(call[0].take).toBeGreaterThan(0);
  });
  it("blocks mixed public/private references without removing public content", async () => {
    legacyRows([{ id: "one", isPrivate: true }, { id: "two", isPrivate: false }]);
    const result = await migratePrivateBlobs({ apply: true });
    expect(result.groups[0].status).toBe("shared-public-blocked");
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("migrates all private aliases of a source as one verified transition", async () => {
    legacyRows([{ id: "one", isPrivate: true }, { id: "two", isPrivate: true }]);
    const result = await migratePrivateBlobs({ apply: true });
    expect(result.groups[0].status).toBe("migrated");
    expect(mocks.change).toHaveBeenCalledExactlyOnceWith(["one", "two"], true);
  });
  it("is idempotent for already-private URLs", async () => {
    mocks.findMany.mockResolvedValueOnce([{ id: "one", filePath: destination }]).mockResolvedValueOnce([]);
    const result = await migratePrivateBlobs({ apply: true });
    expect(result.groups).toEqual([]);
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("reports failure without logging URLs from SDK errors", async () => {
    legacyRows();
    mocks.change.mockRejectedValue(new Error(`could not copy ${source}`));
    const result = await migratePrivateBlobs({ apply: true });
    expect(result.groups[0]).toMatchObject({ status: "failed", errorCode: "STORAGE_OR_DATABASE_FAILURE" });
    expect(JSON.stringify(result)).not.toContain(source);
  });
  it("reports pending source cleanup even when no legacy row remains", async () => {
    mocks.count.mockResolvedValue(1);
    const result = await migratePrivateBlobs({ apply: true });
    expect(result.cleanupPending).toBe(1);
    expect(mocks.retry).toHaveBeenCalledExactlyOnceWith(500);
  });
  it("signals a partial inventory when the explicit scan limit is reached", async () => {
    mocks.findMany.mockResolvedValueOnce([{ id: "one", filePath: destination }]);
    const result = await migratePrivateBlobs({ maxFiles: 1 });
    expect(result.scanLimitReached).toBe(true);
    expect(mocks.findMany).toHaveBeenCalledOnce();
  });
});
