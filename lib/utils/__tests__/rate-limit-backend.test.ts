import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import path from "node:path";

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("VERCEL", undefined);
  vi.stubEnv("RATE_LIMIT_BACKEND", undefined);
  vi.stubEnv("RATE_LIMIT_KEY_SECRET", "rate-limit-backend-fixture");
  vi.stubEnv("NODE_ENV", "test");
  db.$executeRaw.mockResolvedValue(0);
  db.$queryRaw.mockResolvedValue([{ count: 1, remainingMs: BigInt(60_000) }]);
});
afterEach(() => vi.unstubAllEnvs());

describe("sélection explicite du backend rate limit", () => {
  it.each(["production", "development"] as const)("refuse une configuration absente en %s", async (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    const { checkRateLimit } = await import("../rate-limit");
    expect(await checkRateLimit("key")).toMatchObject({ ok: false, unavailable: true });
  });

  it.each(["production", "vercel"])("interdit le backend mémoire sur %s", async (mode) => {
    vi.stubEnv("RATE_LIMIT_BACKEND", "memory");
    if (mode === "vercel") vi.stubEnv("VERCEL", "1");
    else vi.stubEnv("NODE_ENV", "production");
    const { checkRateLimit } = await import("../rate-limit");
    expect(await checkRateLimit("key")).toMatchObject({ ok: false, unavailable: true });
  });

  it("unifie les imports PDF et général dans le même compteur local", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RATE_LIMIT_BACKEND", "memory");
    const general = await import("../rate-limit");
    const pdf = await import("@/lib/pdf-forms/security");
    expect(pdf.checkRateLimit).toBe(general.checkRateLimit);
    expect((await general.checkRateLimit("same-key", { windowMs: 60_000, max: 1 })).ok).toBe(true);
    expect((await pdf.checkRateLimit("same-key", { windowMs: 60_000, max: 1 })).ok).toBe(false);
  });

  it("utilise PostgreSQL sur Vercel lorsque configuré et refuse ses pannes", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("RATE_LIMIT_BACKEND", "postgres");
    const { checkRateLimit } = await import("../rate-limit");
    expect((await checkRateLimit("key")).ok).toBe(true);
    expect(db.$queryRaw).toHaveBeenCalledOnce();
    db.$queryRaw.mockRejectedValue(new Error("Connection unavailable"));
    expect(await checkRateLimit("new-key")).toMatchObject({ ok: false, unavailable: true });
  });
});

it("chaque appel applicatif attend le résultat avant d'évaluer .ok", () => {
  const root = process.cwd();
  const files = ts.sys.readDirectory(root, [".ts", ".tsx"], ["**/__tests__/**", "**/*.test.ts"], ["app/api/**/*", "lib/**/*"]);
  const missing: string[] = [];
  let calls = 0;
  for (const file of files) {
    const source = ts.createSourceFile(file, ts.sys.readFile(file) ?? "", ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "checkRateLimit") {
        calls++;
        if (!ts.isAwaitExpression(node.parent)) {
          const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          missing.push(`${path.relative(root, file)}:${line}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(calls).toBeGreaterThanOrEqual(50);
  expect(missing).toEqual([]);
});
