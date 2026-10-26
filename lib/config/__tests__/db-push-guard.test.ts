import { describe, expect, it } from "vitest";
import { assertDisposableDbPushTarget } from "@/scripts/db-push-guard";

const confirmation = { DOCBEL_DB_PUSH_CONFIRM: "lookup_hardening_test" };
const localFixtureUrl = "postgresql://docbel_test:fake@127.0.0.1:55434/lookup_hardening_test?schema=public";

describe("db push safety guard", () => {
  it("allows the exact confirmed loopback test database", () => {
    const target = assertDisposableDbPushTarget({
      ...confirmation,
      APP_ENV: "development",
      DATABASE_URL: localFixtureUrl,
      DIRECT_URL: localFixtureUrl,
    });
    expect(target).toBe("lookup_hardening_test");
  });

  it("rejects a shared Neon target even when the confirmation is present", () => {
    expect(() => assertDisposableDbPushTarget({
      ...confirmation,
      DATABASE_URL: "postgresql://test:secret@ep-shared.neon.tech/neondb",
      DIRECT_URL: "postgresql://test:secret@ep-shared.neon.tech/neondb",
    })).toThrow("known local test host and port");
  });

  it("does not let confirmation alone authorize any database", () => {
    expect(() => assertDisposableDbPushTarget(confirmation)).toThrow("both required");
  });

  it("rejects a different local database even with explicit confirmation", () => {
    expect(() => assertDisposableDbPushTarget({
      ...confirmation,
      DATABASE_URL: "postgresql://docbel_test:fake@127.0.0.1:55434/docbel_dev?schema=public",
      DIRECT_URL: "postgresql://docbel_test:fake@127.0.0.1:55434/docbel_dev?schema=public",
    })).toThrow("only permits the lookup_hardening_test database");
  });

  it("rejects different ports even when both URLs are loopback", () => {
    expect(() => assertDisposableDbPushTarget({
      ...confirmation,
      DATABASE_URL: localFixtureUrl,
      DIRECT_URL: "postgresql://docbel_test:fake@127.0.0.1:5432/lookup_hardening_test?schema=public",
    })).toThrow("known local test host and port");
  });

  it("rejects a different database role", () => {
    expect(() => assertDisposableDbPushTarget({
      ...confirmation,
      DATABASE_URL: "postgresql://other_role:fake@127.0.0.1:55434/lookup_hardening_test?schema=public",
      DIRECT_URL: localFixtureUrl,
    })).toThrow("known local test role");
  });

  it.each(["staging", "production"])("rejects APP_ENV=%s", (appEnv) => {
    expect(() => assertDisposableDbPushTarget({
      ...confirmation,
      APP_ENV: appEnv,
      DATABASE_URL: localFixtureUrl,
      DIRECT_URL: localFixtureUrl,
    })).toThrow("unavailable in staging, production, or Vercel");
  });

  it("rejects Vercel even with local URLs", () => {
    expect(() => assertDisposableDbPushTarget({
      ...confirmation,
      VERCEL: "1",
      DATABASE_URL: localFixtureUrl,
      DIRECT_URL: localFixtureUrl,
    })).toThrow("unavailable in staging, production, or Vercel");
  });

  it("rejects non-PostgreSQL protocols", () => {
    expect(() => assertDisposableDbPushTarget({
      ...confirmation,
      DATABASE_URL: localFixtureUrl.replace("postgresql:", "mysql:"),
      DIRECT_URL: localFixtureUrl.replace("postgresql:", "mysql:"),
    })).toThrow("PostgreSQL protocol");
  });

  it("rejects URL options that can redirect the connection", () => {
    expect(() => assertDisposableDbPushTarget({
      ...confirmation,
      DATABASE_URL: localFixtureUrl + "&host=example.com",
      DIRECT_URL: localFixtureUrl,
    })).toThrow("Only the Prisma schema=public URL option is permitted");
  });
});
