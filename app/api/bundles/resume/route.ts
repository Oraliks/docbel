import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  isValidResumeCodeFormat,
  normalizeResumeCode,
} from "@/lib/bundles/resume-code";
import { hashResumeCode } from "@/lib/bundles/resume-code-hash";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { trackBundleEvent } from "@/lib/bundles/analytics";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";

const BUNDLE_COOKIE = "beldoc-bundle-session";

// Message UNIQUE pour toute reprise qui échoue (format / introuvable / expiré).
// On ne révèle pas si un code existe ou non (anti-énumération). La cause précise
// est uniquement loguée en interne via l'analytics (reason).
const GENERIC_ERROR = "Ce code de reprise n'est pas valide ou a expiré.";

const BodySchema = z.object({
  code: z.string().min(8).max(40),
});

const BUNDLE_SELECT = {
  bundle: { select: { id: true, slug: true, name: true, active: true } },
} as const;

/// POST /api/bundles/resume — résout un code de reprise BELDOC.
///
/// Le code en clair n'est jamais stocké : on le hache et on cherche par hash
/// (`resumeCodeHash`). Repli legacy sur `resumeCode` en clair tant que le
/// backfill n'a pas tourné. Non authentifié (le code fait preuve d'accès).
///
/// Rate-limit par IP **et** par session ; erreurs génériques.
export async function POST(req: NextRequest) {
  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  const ip = getClientIp(req);
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(BUNDLE_COOKIE)?.value ?? null;

  // Rate-limit par IP ET par session (10 / 5 min chacun).
  const ipRl = checkRateLimit(`bundle-resume:ip:${ip}`, {
    windowMs: 5 * 60_000,
    max: 10,
  });
  const sessRl = sessionId
    ? checkRateLimit(`bundle-resume:sess:${sessionId}`, {
        windowMs: 5 * 60_000,
        max: 10,
      })
    : { ok: true };
  if (!ipRl.ok || !sessRl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives — réessayez dans quelques minutes" },
      { status: 429 },
    );
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    await trackBundleEvent("resume_failed", {
      sessionId,
      metadata: { reason: "format" },
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const code = normalizeResumeCode(parsed.code);
  if (!isValidResumeCodeFormat(code)) {
    await trackBundleEvent("resume_failed", {
      sessionId,
      metadata: { reason: "format" },
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Lookup par hash (nominal), puis repli legacy sur le code en clair.
  let run = await prisma.bundleRun.findUnique({
    where: { resumeCodeHash: hashResumeCode(code) },
    include: BUNDLE_SELECT,
  });
  if (!run) {
    run = await prisma.bundleRun.findUnique({
      where: { resumeCode: code },
      include: BUNDLE_SELECT,
    });
  }

  if (!run || !run.bundle.active) {
    await trackBundleEvent("resume_failed", {
      sessionId,
      metadata: { reason: "not_found" },
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 404 });
  }

  if (run.resumeCodeExpiresAt && run.resumeCodeExpiresAt < new Date()) {
    await trackBundleEvent("resume_failed", {
      sessionId,
      metadata: { reason: "expired" },
    });
    // Même message/statut que "introuvable" : on ne distingue pas pour l'usager.
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 404 });
  }

  // Positionne le cookie de session sur le run (génère un sessionId si absent).
  let runSessionId = run.sessionId;
  if (!runSessionId) {
    runSessionId = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await prisma.bundleRun.update({
      where: { id: run.id },
      data: { sessionId: runSessionId },
    });
  }

  cookieStore.set(BUNDLE_COOKIE, runSessionId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  await trackBundleEvent("resume_success", {
    bundleId: run.bundle.id,
    sessionId: runSessionId,
    metadata: { runId: run.id },
  });

  return NextResponse.json({
    runId: run.id,
    bundleSlug: run.bundle.slug,
    bundleName: run.bundle.name,
    status: run.status,
  });
}
