import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), sheet: vi.fn(), file: vi.fn() }));
vi.mock("@/lib/auth-check", () => ({ requireAdminAuth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  bareSheet: { findUnique: mocks.sheet },
  baremeFile: { findUnique: mocks.file },
} }));
import { GET } from "@/app/api/baremes/export/route";

describe("raw baremes exports remain admin-only", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ isAuthorized: true, user: { id: "fixture-admin" } });
  });

  it.each([
    [401, "sheetId=fixture-sheet"],
    [403, "sheetId=fixture-sheet"],
    [401, "fileId=fixture-file"],
    [403, "fileId=fixture-file"],
  ])("forwards auth refusal %i before any DB access (%s)", async (status, query) => {
    mocks.auth.mockResolvedValue({ isAuthorized: false, error: new Response(null, { status: Number(status) }) });
    const response = await GET(new NextRequest(`https://example.test/api/baremes/export?${query}`));
    expect(response.status).toBe(status);
    expect(mocks.sheet).not.toHaveBeenCalled();
    expect(mocks.file).not.toHaveBeenCalled();
  });

  it("preserves the authorized raw-sheet CSV and formula escaping", async () => {
    mocks.sheet.mockResolvedValue({ name: "Fixture", cellData: JSON.stringify([["Libellé", "=1+1"]]) });
    const response = await GET(new NextRequest("https://example.test/api/baremes/export?sheetId=fixture-sheet"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("Fixture.csv");
    expect(await response.text()).toContain("Libellé,'=1+1");
    expect(mocks.sheet).toHaveBeenCalledWith({ where: { id: "fixture-sheet" } });
  });

  it("preserves the authorized file export without making drafts public", async () => {
    mocks.file.mockResolvedValue({ name: "Fixture.xlsx", status: "draft", sheets: [
      { name: "Brouillon", cellData: JSON.stringify([["Valeur", "fixture"]]) },
    ] });
    const response = await GET(new NextRequest("https://example.test/api/baremes/export?fileId=fixture-file"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("=== Brouillon ===\nValeur,fixture");
    expect(mocks.auth).toHaveBeenCalledOnce();
  });
});
