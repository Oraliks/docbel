import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  file: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  appSetting: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  transaction: vi.fn(), moveBlob: vi.fn(), deleteBlob: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { file: mocks.file, appSetting: mocks.appSetting, $transaction: mocks.transaction } }));
vi.mock("../blob-storage", () => ({
  isBlobsPath: (path: string | null) => path?.startsWith("blobs:"),
  isPrivateBlobPath: (path: string | null) => path?.includes(".private.blob."),
  moveBlob: mocks.moveBlob, deleteBlob: mocks.deleteBlob,
}));
import { changeFilePrivacy, finishPrivacyCleanup, needsPrivacyMove, retryPrivacyCleanup } from "../file-privacy";

const source = "blobs:https://a.public.blob.vercel-storage.com/private/file.pdf";
const destination = "blobs:https://b.private.blob.vercel-storage.com/private/file.pdf";
const item = { id: "one", type: "file", isPrivate: false, filePath: source, updatedAt: new Date(0) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.file.findMany.mockResolvedValue([item]);
  mocks.file.count.mockResolvedValue(0);
  mocks.file.updateMany.mockResolvedValue({ count: 1 });
  mocks.appSetting.findMany.mockResolvedValue([]);
  mocks.appSetting.upsert.mockResolvedValue({});
  mocks.appSetting.deleteMany.mockResolvedValue({ count: 1 });
  mocks.moveBlob.mockResolvedValue(destination);
  mocks.deleteBlob.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (callback) => callback({ file: mocks.file, appSetting: mocks.appSetting }));
});

describe("privacy transitions", () => {
  it("moves legacy PUBLIC objects even when the DB flag already says private", () => {
    expect(needsPrivacyMove(item, true)).toBe(true);
    expect(needsPrivacyMove({ ...item, filePath: destination }, true)).toBe(false);
  });
  it("commits paths and cleanup journal before deleting source", async () => {
    expect(await changeFilePrivacy(["one"], true)).toEqual({ updated: 1, moved: 1 });
    expect(mocks.file.updateMany).toHaveBeenCalledWith({
      where: { id: "one", filePath: source, isPrivate: false, updatedAt: item.updatedAt },
      data: { isPrivate: true, filePath: destination },
    });
    expect(mocks.appSetting.upsert.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteBlob.mock.invocationCallOrder[0]);
    expect(mocks.deleteBlob).toHaveBeenCalledExactlyOnceWith(source);
    expect(mocks.appSetting.deleteMany).toHaveBeenCalledOnce();
  });
  it("rejects a public source shared with an unselected alias", async () => {
    mocks.file.count.mockResolvedValueOnce(1);
    await expect(changeFilePrivacy(["one"], true)).rejects.toMatchObject({ code: "SHARED_PUBLIC_SOURCE_SELECT_ALL_ALIASES" });
    expect(mocks.moveBlob).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("copies once when all selected aliases share the same source", async () => {
    mocks.file.findMany.mockResolvedValue([item, { ...item, id: "two" }]);
    expect(await changeFilePrivacy(["one", "two"], true)).toEqual({ updated: 2, moved: 2 });
    expect(mocks.moveBlob).toHaveBeenCalledOnce();
    expect(mocks.deleteBlob).toHaveBeenCalledExactlyOnceWith(source);
  });
  it("does not change DB or delete source if the copy fails", async () => {
    mocks.moveBlob.mockRejectedValue(new Error("copy failed"));
    await expect(changeFilePrivacy(["one"], true)).rejects.toThrow("copy failed");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.deleteBlob).not.toHaveBeenCalled();
  });
  it("removes only the staged copy if DB commit fails", async () => {
    mocks.transaction.mockRejectedValue(new Error("transaction failed"));
    await expect(changeFilePrivacy(["one"], true)).rejects.toThrow("transaction failed");
    expect(mocks.deleteBlob).toHaveBeenCalledExactlyOnceWith(destination);
  });
  it("detects concurrent row changes instead of overwriting their path", async () => {
    mocks.file.updateMany.mockResolvedValue({ count: 0 });
    await expect(changeFilePrivacy(["one"], true)).rejects.toMatchObject({ code: "FILE_CHANGED_RETRY" });
    expect(mocks.deleteBlob).toHaveBeenCalledExactlyOnceWith(destination);
    expect(mocks.appSetting.upsert).not.toHaveBeenCalled();
  });
  it("preserves a referenced destination after an ambiguous commit failure", async () => {
    mocks.file.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mocks.transaction.mockRejectedValue(new Error("connection lost after commit"));
    await expect(changeFilePrivacy(["one"], true)).rejects.toThrow("connection lost");
    expect(mocks.deleteBlob).not.toHaveBeenCalled();
  });
  it("keeps durable journal and reports failure when source deletion fails", async () => {
    mocks.deleteBlob.mockRejectedValue(new Error("storage unavailable"));
    await expect(changeFilePrivacy(["one"], true)).rejects.toMatchObject({ code: "PRIVACY_CLEANUP_PENDING", status: 503 });
    expect(mocks.appSetting.upsert).toHaveBeenCalledOnce();
    expect(mocks.appSetting.deleteMany).not.toHaveBeenCalled();
  });
  it("resumes cleanup on retry of an already-private row", async () => {
    mocks.file.findMany.mockResolvedValue([{ ...item, filePath: destination, isPrivate: true }]);
    mocks.appSetting.findMany.mockResolvedValue([{ key: "pending", value: JSON.stringify({ source, destination, targetIsPrivate: true }) }]);
    await changeFilePrivacy(["one"], true);
    expect(mocks.moveBlob).not.toHaveBeenCalled();
    expect(mocks.deleteBlob).toHaveBeenCalledExactlyOnceWith(source);
  });
  it("keeps private bytes still referenced when an alias becomes public", async () => {
    mocks.file.count.mockResolvedValue(1);
    await finishPrivacyCleanup("pending", { source: destination, destination: source, targetIsPrivate: false });
    expect(mocks.deleteBlob).not.toHaveBeenCalled();
    expect(mocks.appSetting.deleteMany).toHaveBeenCalledOnce();
  });
  it("never deletes a public source with references during journal replay", async () => {
    mocks.file.count.mockResolvedValue(1);
    await expect(finishPrivacyCleanup("pending", { source, destination, targetIsPrivate: true })).rejects.toMatchObject({ code: "SHARED_PUBLIC_SOURCE_REMAINS" });
    expect(mocks.deleteBlob).not.toHaveBeenCalled();
  });
  it("retains failed cleanup records during a bounded migration replay", async () => {
    mocks.appSetting.findMany.mockResolvedValue([{ key: "pending", value: JSON.stringify({ source, destination, targetIsPrivate: true }) }]);
    mocks.deleteBlob.mockRejectedValue(new Error("offline"));
    expect(await retryPrivacyCleanup(10)).toEqual({ completed: 0, pending: 1 });
    expect(mocks.appSetting.findMany.mock.calls[0][0].take).toBe(10);
  });
});
