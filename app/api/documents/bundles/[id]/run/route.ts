import { NextRequest, NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateUniqueResumeCode,
  defaultResumeCodeExpiresAt,
} from "@/lib/bundles/resume-code";
import { hashResumeCode } from "@/lib/bundles/resume-code-hash";
import { parseEligibilityAnswers } from "@/lib/bundles/eligibility";
import { trackBundleEvent } from "@/lib/bundles/analytics";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";

const COOKIE_NAME = "beldoc-bundle-session";
const ORIENTATION_COOKIE = "beldoc-orientation";

/// Lit (et efface) le cookie d'orientation posé par le wizard. Renvoie un objet
/// JSON validé sommairement (objet plat, ≤ 10 clés) ou `null`. Best-effort :
/// toute anomalie → null, l'orientation reste fonctionnelle sans persistance.
async function readOrientationAnswers(): Promise<Record<string, unknown> | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(ORIENTATION_COOKIE)?.value;
    if (!raw) return null;
    // Consommé une fois → on l'efface.
    cookieStore.set(ORIENTATION_COOKIE, "", { path: "/", maxAge: 0 });
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      Object.keys(parsed as object).length > 10
    ) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function resolveSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing && existing.length >= 10) return existing;
  const fresh = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  cookieStore.set(COOKIE_NAME, fresh, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return fresh;
}

/// GET → retourne le run en cours (ou null) pour un bundle.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = await resolveSessionId();

  const where = userId ? { bundleId: id, userId, status: "in_progress" } : { bundleId: id, sessionId, status: "in_progress" };
  const run = await prisma.bundleRun.findFirst({
    where,
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json(run);
}

/// POST → démarre (ou récupère) un run pour ce bundle.
/// Au premier démarrage, génère un code de reprise unique.
/// Body optionnel : `{ eligibilityAnswers?: Record<string, string> }`
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  const { id } = await params;
  const bundle = await prisma.documentBundle.findUnique({ where: { id } });
  if (!bundle || !bundle.active) {
    return NextResponse.json({ error: "Bundle indisponible" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = await resolveSessionId();

  // Body optionnel (eligibilityAnswers)
  let eligibilityAnswers: Record<string, string> = {};
  try {
    const body = await req.json();
    eligibilityAnswers = parseEligibilityAnswers(body?.eligibilityAnswers);
  } catch {
    // Pas de body — c'est OK
  }

  // Récupérer un run existant in_progress pour cet utilisateur/session
  const existingWhere = userId
    ? { bundleId: id, userId, status: "in_progress" }
    : { bundleId: id, sessionId, status: "in_progress" };
  const existing = await prisma.bundleRun.findFirst({ where: existingWhere });
  if (existing) {
    // Si des réponses d'éligibilité sont fournies, on met à jour
    if (Object.keys(eligibilityAnswers).length > 0) {
      return NextResponse.json(
        await prisma.bundleRun.update({
          where: { id: existing.id },
          data: { eligibilityAnswers },
        })
      );
    }
    return NextResponse.json(existing);
  }

  // Nouveau run : génère un code de reprise unique. Le code en CLAIR n'est
  // jamais persisté — on ne stocke que son hash HMAC (migration 53).
  const resumeCodePlain = await generateUniqueResumeCode(async (code) => {
    const found = await prisma.bundleRun.findUnique({
      where: { resumeCodeHash: hashResumeCode(code) },
    });
    return !!found;
  });

  // Réponses du wizard d'orientation (cookie posé par DossierWizard, phase 6).
  const orientationAnswers = await readOrientationAnswers();

  const run = await prisma.bundleRun.create({
    data: {
      bundleId: id,
      userId,
      sessionId,
      resumeCodeHash: hashResumeCode(resumeCodePlain),
      resumeCodeExpiresAt: defaultResumeCodeExpiresAt(),
      eligibilityAnswers,
      ...(orientationAnswers
        ? { orientationAnswers: orientationAnswers as Prisma.InputJsonValue }
        : {}),
    },
  });

  await trackBundleEvent("run_created", { bundleId: id, sessionId, userId });

  // Le code en CLAIR n'est renvoyé QU'ICI (affichage unique côté client) ; il
  // n'est pas stocké. Sur les visites suivantes, le run ne le contient plus.
  return NextResponse.json(
    { ...run, resumeCode: resumeCodePlain },
    { status: 201 },
  );
}

/// PATCH → met à jour les réponses de pré-qualification d'un run existant.
/// Body : `{ eligibilityAnswers: Record<string, string> }`
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = await resolveSessionId();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Vérifier que l'utilisateur a accès à ce run
  const where = userId
    ? { bundleId: id, userId, status: "in_progress" }
    : { bundleId: id, sessionId, status: "in_progress" };
  const run = await prisma.bundleRun.findFirst({ where });
  if (!run) {
    return NextResponse.json({ error: "Run introuvable" }, { status: 404 });
  }

  const eligibilityAnswers = parseEligibilityAnswers(body?.eligibilityAnswers);
  const updated = await prisma.bundleRun.update({
    where: { id: run.id },
    data: { eligibilityAnswers },
  });
  return NextResponse.json(updated);
}
