import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { getAppEnvironment } from "@/lib/config/runtime-environment";

function closed(staging: boolean) {
  return apiError(403, "L'enregistrement de dossiers est fermé.", {
    code: "public_persistence_closed",
    headers: {
      "Cache-Control": staging ? "private, no-store" : "no-store",
      ...(staging ? { "X-Robots-Tag": "noindex, nofollow, noarchive" } : {}),
    },
  });
}

function equalSecret(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function unavailable(): NextResponse {
  return new NextResponse("Staging access is not configured", {
    status: 503,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" },
  });
}

async function applyExistingApiClosures(request: NextRequest, staging: boolean, allowStagingTestPersistence = false) {
  let parts: string[];
  try {
    parts = request.nextUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return NextResponse.next();
  }
  const read = ["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (parts[0] !== "api" || read) return null;

  if (parts.length === 3 && parts[1] === "user" && parts[2] === "profile") return closed(staging);
  if (parts.length === 4 && parts[1] === "booking" && ["book", "waitlist"].includes(parts[3])) return closed(staging);
  if (parts.length === 5 && parts[1] === "documents" && parts[2] === "bundles" && parts[4] === "run" && !allowStagingTestPersistence) return closed(staging);
  if (parts[1] === "bundles" && parts[2] === "runs" &&
      (parts.length === 4 || (parts.length === 5 && parts[4] === "email-code"))) return closed(staging);
  if (parts.length === 4 && parts[1] === "pdf" && parts[3] === "draft" && !allowStagingTestPersistence) return closed(staging);
  if (request.method === "POST" && parts.length === 4 && parts[1] === "pdf" && parts[3] === "generate") {
    let body: Record<string, unknown> | null;
    try {
      body = await request.clone().json();
    } catch {
      return apiError(400, "Invalid JSON", { code: "invalid_json" });
    }
    if (allowStagingTestPersistence && staging) {
      const delivery = body?.delivery;
      const hasBundleRun = typeof body?.bundleRunId === "string" && body.bundleRunId.length > 0;
      if (delivery === "save" && hasBundleRun) return null;
      if ((delivery === undefined || delivery === "download") && !hasBundleRun) return null;
      return closed(staging);
    }
    if (body?.delivery === "save" || typeof body?.bundleRunId === "string") return closed(staging);
  }
  return null;
}

export async function proxy(request: NextRequest) {
  let appEnvironment: ReturnType<typeof getAppEnvironment>;
  try {
    appEnvironment = getAppEnvironment();
  } catch {
    return unavailable();
  }

  const gitBranch = process.env.VERCEL_GIT_COMMIT_REF;
  if (process.env.VERCEL === "1" && gitBranch === "staging" && appEnvironment !== "staging") {
    return unavailable();
  }
  if (appEnvironment !== "staging") return await applyExistingApiClosures(request, false) ?? NextResponse.next();
  if (process.env.VERCEL === "1" && gitBranch && gitBranch !== "staging") return unavailable();

  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/admin/pdf/cron/") ||
    pathname === "/api/inbox/sync" ||
    pathname === "/api/chomage-ia/ingestion/cron" ||
    pathname === "/api/chomage-ia/sources/cron-obsolescence"
  ) {
    return new NextResponse("Scheduled jobs are disabled in staging", {
      status: 503,
      headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" },
    });
  }

  const username = process.env.STAGING_ACCESS_USERNAME;
  const password = process.env.STAGING_ACCESS_PASSWORD;
  if (!username || !password || password.length < 24) return unavailable();

  const responseHeaders = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i);
  if (match) {
    try {
      const [providedUsername, ...passwordParts] = Buffer.from(match[1], "base64").toString("utf8").split(":");
      const providedPassword = passwordParts.join(":");
      if (equalSecret(providedUsername, username) && equalSecret(providedPassword, password)) {
        const allowStagingTestPersistence = process.env.STAGING_TEST_PERSISTENCE === "1" &&
          process.env.VERCEL === "1" && gitBranch === "staging";
        const closedResponse = await applyExistingApiClosures(request, true, allowStagingTestPersistence);
        if (closedResponse) return closedResponse;
        const response = NextResponse.next();
        response.headers.set("X-Robots-Tag", responseHeaders["X-Robots-Tag"]);
        response.headers.set("Cache-Control", responseHeaders["Cache-Control"]);
        return response;
      }
    } catch {
      // Invalid Basic credentials receive the same response as missing credentials.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { ...responseHeaders, "WWW-Authenticate": 'Basic realm="DocBel staging", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/:path*"] };
