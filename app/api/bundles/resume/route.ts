import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  isValidResumeCodeFormat,
  normalizeResumeCode,
} from "@/lib/bundles/resume-code";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

const BUNDLE_COOKIE = "beldoc-bundle-session";

const BodySchema = z.object({
  code: z.string().min(8).max(40),
});

/// POST /api/bundles/resume
///
/// Body : `{ code: "BELDOC-XXXX-XXXX" }`
///
/// Si le code est valide et non-expiré :
///   1. Configure le cookie `beldoc-bundle-session` avec le `sessionId` du run
///      (ainsi la page bundle retrouvera le run via le cookie).
///   2. Retourne `{ bundleSlug, runId }` pour que le client puisse rediriger.
///
/// **Volontairement non-authentifié** (pas de comptes). Le code lui-même fait
/// office de preuve d'accès au dossier anonyme.
///
/// Rate-limit : 10 tentatives / 5 min / IP pour limiter le brute-force.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bundle-resume:${ip}`, {
    windowMs: 5 * 60_000,
    max: 10,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de tentatives — réessayez dans quelques minutes" },
      { status: 429 }
    );
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Données invalides"
            : "Données invalides",
      },
      { status: 400 }
    );
  }

  const code = normalizeResumeCode(parsed.code);
  if (!isValidResumeCodeFormat(code)) {
    return NextResponse.json(
      { error: "Format de code invalide" },
      { status: 400 }
    );
  }

  const run = await prisma.bundleRun.findUnique({
    where: { resumeCode: code },
    include: {
      bundle: {
        select: { id: true, slug: true, name: true, active: true },
      },
    },
  });

  if (!run || !run.bundle.active) {
    return NextResponse.json(
      { error: "Code introuvable" },
      { status: 404 }
    );
  }

  if (run.resumeCodeExpiresAt && run.resumeCodeExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "Code expiré" },
      { status: 410 }
    );
  }

  // Si le run a un sessionId, on positionne le cookie pour que la page bundle
  // retrouve le run via la session anonyme habituelle. Sinon, on génère un
  // sessionId neuf et on le persiste sur le run.
  let sessionId = run.sessionId;
  if (!sessionId) {
    sessionId = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await prisma.bundleRun.update({
      where: { id: run.id },
      data: { sessionId },
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(BUNDLE_COOKIE, sessionId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  return NextResponse.json({
    runId: run.id,
    bundleSlug: run.bundle.slug,
    bundleName: run.bundle.name,
    status: run.status,
  });
}
