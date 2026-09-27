import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => sdk);
import { deleteBlob, getBlob, isBlobsEnabled, isPrivateBlobPath, moveBlob, saveBlob } from "../blob-storage";

const publicUrl = "https://example.public.blob.vercel-storage.com/private/a.pdf";
const privateUrl = "https://secret.private.blob.vercel-storage.com/private/a.pdf";
const source = `blobs:${publicUrl}`;
const destination = `blobs:${privateUrl}`;
function privateRead(text: string) {
  return { statusCode: 200, stream: new Response(text).body };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "public-test-token");
  vi.stubEnv("BLOB_PRIVATE_READ_WRITE_TOKEN", "private-test-token");
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("data")));
  sdk.put.mockResolvedValue({ url: privateUrl });
  sdk.get.mockImplementation(async () => privateRead("data"));
  sdk.del.mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Blob store access", () => {
  it("writes private bytes only to the separately configured private store", async () => {
    expect(await saveBlob(Buffer.from("data"), "private/a.pdf", true)).toBe(destination);
    expect(sdk.put).toHaveBeenCalledWith("private/a.pdf", expect.any(Buffer), {
      access: "private", token: "private-test-token", addRandomSuffix: true,
    });
  });
  it("preserves public assets", async () => {
    sdk.put.mockResolvedValue({ url: publicUrl });
    await saveBlob(Buffer.from("data"), "public/a.pdf");
    expect(sdk.put.mock.calls[0][2]).toMatchObject({ access: "public", token: "public-test-token" });
  });
  it("refuses private writes when the private store is missing or shared", async () => {
    vi.stubEnv("BLOB_PRIVATE_READ_WRITE_TOKEN", "");
    expect(isBlobsEnabled()).toBe(true);
    await expect(saveBlob(Buffer.from("data"), "private/a", true)).rejects.toThrow("Missing private");
    vi.stubEnv("BLOB_PRIVATE_READ_WRITE_TOKEN", "public-test-token");
    await expect(saveBlob(Buffer.from("data"), "private/a", true)).rejects.toThrow("separate");
    expect(sdk.put).not.toHaveBeenCalled();
  });
  it("reads real private blobs with the SDK and legacy blobs without credentials", async () => {
    expect(isPrivateBlobPath(source)).toBe(false);
    expect(isPrivateBlobPath(destination)).toBe(true);
    expect(await getBlob(source)).toEqual(Buffer.from("data"));
    expect(fetch).toHaveBeenCalledWith(publicUrl, { cache: "no-store", redirect: "error" });
    expect(await getBlob(destination)).toEqual(Buffer.from("data"));
    expect(sdk.get).toHaveBeenCalledWith(privateUrl, { access: "private", token: "private-test-token", useCache: false });
  });
  it("rejects foreign URLs before sending a credential", async () => {
    await expect(getBlob("blobs:https://evil.example/file")).rejects.toThrow("origin");
    expect(sdk.get).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("selects the matching token on deletion", async () => {
    await deleteBlob(destination);
    await deleteBlob(source);
    expect(sdk.del.mock.calls).toEqual([
      [privateUrl, { token: "private-test-token" }], [publicUrl, { token: "public-test-token" }],
    ]);
  });
  it("migrates a legacy private/ public URL, verifies bytes, and keeps source until DB commit", async () => {
    expect(await moveBlob(source, true)).toBe(destination);
    expect(sdk.del).not.toHaveBeenCalled();
  });
  it("fails closed if the source is missing", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await expect(moveBlob(source, true)).rejects.toThrow("missing");
    expect(sdk.put).not.toHaveBeenCalled();
  });
  it("removes an invalid copy but never its source", async () => {
    sdk.get.mockResolvedValue(privateRead("corrupt"));
    await expect(moveBlob(source, true)).rejects.toThrow("verification");
    expect(sdk.del).toHaveBeenCalledExactlyOnceWith(privateUrl, { token: "private-test-token" });
  });
  it("is idempotent for an already-private location", async () => {
    expect(await moveBlob(destination, true)).toBe(destination);
    expect(sdk.put).not.toHaveBeenCalled();
  });
});
