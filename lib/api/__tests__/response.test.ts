import { describe, expect, it } from "vitest";
import { apiError, apiOk } from "../response";

async function body(res: Response) {
  return JSON.parse(await res.text());
}

describe("apiError", () => {
  it("pose status, body {error} et Content-Type JSON", async () => {
    const res = apiError(404, "Introuvable");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await body(res)).toEqual({ error: "Introuvable" });
  });
  it("ajoute code et details quand fournis", async () => {
    const res = apiError(409, "Conflit", { code: "slug_conflict", details: { slug: "x" } });
    expect(await body(res)).toEqual({ error: "Conflit", code: "slug_conflict", details: { slug: "x" } });
  });
  it("fusionne les headers custom", () => {
    const res = apiError(400, "x", { headers: { "X-Test": "1" } });
    expect(res.headers.get("x-test")).toBe("1");
  });
});

describe("apiOk", () => {
  it("renvoie le corps brut en 200 par défaut", async () => {
    const res = apiOk({ hello: "world" });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ hello: "world" });
  });
  it("respecte le status custom (201)", () => {
    expect(apiOk({ id: 1 }, { status: 201 }).status).toBe(201);
  });
});
