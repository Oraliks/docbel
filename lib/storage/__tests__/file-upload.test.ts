import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), aggregate: vi.fn(), create: vi.fn(), save: vi.fn(), enabled: vi.fn() }));
vi.mock("@/lib/auth-check", () => ({ requireAdminAuth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { file: { aggregate: mocks.aggregate, create: mocks.create } } }));
vi.mock("@/lib/storage/blob-storage", () => ({ isBlobsEnabled: mocks.enabled, saveBlob: mocks.save }));
vi.mock("@/lib/file-signatures", () => ({ matchesSignature: () => true }));
import { POST } from "@/app/api/files/upload/route";

function request(isPrivate: boolean, name = "sample.pdf", mime = "application/pdf") {
  const form = new FormData();
  form.append("file", new File(["%PDF-1.7"], name, { type: mime }));
  form.append("isPrivate", String(isPrivate));
  return new NextRequest("https://docbel.example/api/files/upload", { method: "POST", body: form });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ isAuthorized: true, user: { id: "admin-id" } });
  mocks.aggregate.mockResolvedValue({ _sum: { size: 0 } });
  mocks.enabled.mockReturnValue(true);
  mocks.save.mockResolvedValue("blobs:https://test.private.blob.vercel-storage.com/private/file.pdf");
  mocks.create.mockImplementation(async ({ data }) => ({ id: "new-file", ...data }));
});
describe("upload access selection", () => {
  it("passes private access to storage before creating the DB row", async () => {
    expect((await POST(request(true))).status).toBe(201);
    expect(mocks.save.mock.calls[0][2]).toBe(true);
    expect(mocks.create.mock.calls[0][0].data.isPrivate).toBe(true);
  });
  it("passes public access for public uploads", async () => {
    expect((await POST(request(false))).status).toBe(201);
    expect(mocks.save.mock.calls[0][2]).toBe(false);
  });
  it("forces SVG into private storage", async () => {
    expect((await POST(request(false, "image.svg", "image/svg+xml"))).status).toBe(201);
    expect(mocks.save.mock.calls[0][2]).toBe(true);
  });
  it("does not create a file row when private storage is unavailable", async () => {
    mocks.save.mockRejectedValue(new Error("Missing private Blob store configuration"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await POST(request(true))).status).toBe(500);
    expect(mocks.create).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
