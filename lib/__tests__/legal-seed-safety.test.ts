import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), disconnect: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    page: { findUnique: mocks.findUnique, create: mocks.create, update: mocks.update },
    $disconnect: mocks.disconnect,
  },
}));

describe("legal page seed safety", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.create.mockImplementation(async ({ data }) => ({ id: "new-page", ...data }));
    mocks.disconnect.mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(["published", "scheduled", "draft"])("preserves existing %s legal content", async (status) => {
    mocks.findUnique.mockImplementation(async ({ where }) => ({ slug: where.slug, status }));
    await import("@/scripts/seed-legal-pages");
    await vi.waitFor(() => expect(mocks.disconnect).toHaveBeenCalledOnce());
    expect(mocks.findUnique).toHaveBeenCalledTimes(3);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("creates missing pages only as drafts", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await import("@/scripts/seed-legal-pages");
    await vi.waitFor(() => expect(mocks.disconnect).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledTimes(3);
    for (const [call] of mocks.create.mock.calls) expect(call.data.status).toBe("draft");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
