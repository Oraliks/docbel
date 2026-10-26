import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function request(path = "/admin") {
  return new NextRequest(`https://staging.docbel.be${path}`);
}

describe("staging request gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("denies missing and incorrect access credentials, then marks admitted responses noindex", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "staging");
    vi.stubEnv("STAGING_ACCESS_USERNAME", "tester");
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "a-test-only-password-long-enough");

    expect((await proxy(request())).status).toBe(401);
    const denied = proxy(new NextRequest("https://staging.docbel.be/admin", {
      headers: { authorization: `Basic ${Buffer.from("tester:wrong").toString("base64")}` },
    }));
    expect((await denied).status).toBe(401);
    expect((await denied).headers.get("cache-control")).toContain("no-store");

    const admitted = proxy(new NextRequest("https://staging.docbel.be/admin", {
      headers: {
        authorization: `Basic ${Buffer.from("tester:a-test-only-password-long-enough").toString("base64")}`,
      },
    }));
    expect((await admitted).status).toBe(200);
    expect((await admitted).headers.get("x-robots-tag")).toContain("noindex");
  });

  it("fails closed for a wrongly configured branch and keeps scheduled effects disabled", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "feature/unsafe");
    vi.stubEnv("STAGING_ACCESS_USERNAME", "tester");
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "a-test-only-password-long-enough");
    expect((await proxy(request())).status).toBe(503);

    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "staging");
    const cron = new NextRequest("https://staging.docbel.be/api/inbox/sync", {
      headers: {
        authorization: `Basic ${Buffer.from("tester:a-test-only-password-long-enough").toString("base64")}`,
      },
    });
    expect((await proxy(cron)).status).toBe(503);
  });

  it("opens only synthetic document persistence behind staging Basic Auth on the staging branch", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "staging");
    vi.stubEnv("STAGING_ACCESS_USERNAME", "tester");
    vi.stubEnv("STAGING_ACCESS_PASSWORD", "a-test-only-password-long-enough");
    vi.stubEnv("STAGING_TEST_PERSISTENCE", "1");
    const auth = { authorization: `Basic ${Buffer.from("tester:a-test-only-password-long-enough").toString("base64")}` };

    expect((await proxy(new NextRequest("https://staging.docbel.be/api/documents/bundles/fixture/run", { method: "POST", headers: auth }))).status).toBe(200);
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/pdf/fixture/draft", { method: "PUT", headers: auth }))).status).toBe(200);
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/pdf/fixture/generate", {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ delivery: "save", bundleRunId: "synthetic-run" }),
    }))).status).toBe(200);
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/pdf/fixture/generate", {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ delivery: "download" }),
    }))).status).toBe(200);
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/pdf/fixture/generate", {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({}),
    }))).status).toBe(200);
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/pdf/fixture/generate", {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ delivery: "download", bundleRunId: "synthetic-run" }),
    }))).status).toBe(403);
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/pdf/fixture/generate", {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ delivery: "doccle" }),
    }))).status).toBe(403);
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/pdf/fixture/generate", {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ delivery: "unknown" }),
    }))).status).toBe(403);
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/user/profile", { method: "PUT", headers: auth }))).status).toBe(403);

    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "feature/unsafe");
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/documents/bundles/fixture/run", { method: "POST", headers: auth }))).status).toBe(503);
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "staging");
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/documents/bundles/fixture/run", { method: "POST" }))).status).toBe(401);
    vi.stubEnv("STAGING_TEST_PERSISTENCE", "0");
    expect((await proxy(new NextRequest("https://staging.docbel.be/api/documents/bundles/fixture/run", { method: "POST", headers: auth }))).status).toBe(403);

    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "main");
    vi.stubEnv("STAGING_TEST_PERSISTENCE", "1");
    expect((await proxy(new NextRequest("https://www.docbel.be/api/documents/bundles/fixture/run", { method: "POST", headers: auth }))).status).toBe(403);
  });

  it("does not open an unconfigured staging deployment", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "staging");
    expect((await proxy(request())).status).toBe(503);
  });
});
