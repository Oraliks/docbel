import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  deleteMany: vi.fn(),
  getCookie: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: mocks.getCookie }),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/prisma", () => ({
  prisma: { userProfile: { deleteMany: mocks.deleteMany } },
  withDbRetry: <T>(operation: () => Promise<T>) => operation(),
}));

import { DELETE } from "@/app/api/user/profile/route";

describe("DELETE /api/user/profile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1", email: "owner@example.test" },
      session: {},
    });
    mocks.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("refuse une session absente sans toucher au profil", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await DELETE()).status).toBe(401);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("refuse l'impersonation en lecture seule avant l'effacement", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "user-1", email: "owner@example.test" },
      session: { impersonatedBy: "admin-1" },
    });
    mocks.getCookie.mockReturnValue({ value: "1" });
    const response = await DELETE();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "impersonation_read_only" });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("refuse un compte de démonstration même sans impersonation", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "demo-1", email: "demo+citoyen@docbel.local" },
      session: {},
    });
    mocks.getCookie.mockReturnValue({ value: "0" });
    const response = await DELETE();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "demo_read_only" });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("efface uniquement le profil du propriétaire autorisé", async () => {
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("content-type")).toContain("charset=utf-8");
    expect(mocks.deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { userId: "user-1" } });
  });
});
