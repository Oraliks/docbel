import { NextRequest } from "next/server";
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
import {
  deriveBundleRunLifecycle,
  EDITABLE_BUNDLE_RUN_STATUSES,
} from "@/lib/bundles/run-lifecycle";
import { apiError, apiOk } from "@/lib/api/response";
import { parseOrientationAnswers } from "@/lib/dossiers/orientation";
import { bundleRunHasProgress } from "@/lib/bundles/run-progress";
import { resolveForceNewAction } from "@/lib/bundles/run-creation";

const COOKIE_NAME = "beldoc-bundle-session";
const ORIENTATION_COOKIE = "beldoc-orientation";

/// Lit (et efface) le cookie d'orientation posé par le wizard. Renvoie un objet
/// JSON validé sommairement (objet, ≤ 10 clés) ou `null`. Best-effort :
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
  const fresh = `b_${crypto.randomUUID()}`;
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

  const where = userId
    ? { bundleId: id, userId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } }
    : { bundleId: id, sessionId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } };
  const run = await prisma.bundleRun.findFirst({
    where,
    orderBy: { startedAt: "desc" },
  });

  return apiOk(run ? { ...run, lifecycle: deriveBundleRunLifecycle(run) } : null);
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
    return apiError(404, "Bundle indisponible", { code: "not_found" });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const sessionId = await resolveSessionId();

  // Body optionnel (eligibilityAnswers + forceNew)
  let eligibilityAnswers: Record<string, string> = {};
  let forceNew = false;
  try {
    const body = await req.json();
    eligibilityAnswers = parseEligibilityAnswers(body?.eligibilityAnswers);
    // `forceNew` = « Nouvelle demande » : on crée un run distinct au lieu de
    // reprendre celui en cours.
    forceNew = body?.forceNew === true;
  } catch {
    // Pas de body — c'est OK
  }

  // Consommée à chaque démarrage, y compris lorsqu'un run vide est réutilisé.
  // Sans cela, une nouvelle recherche assistant gardait l'ancienne orientation.
  const rawOrientationAnswers = await readOrientationAnswers();
  const parsedOrientation = parseOrientationAnswers(rawOrientationAnswers);
  const orientationAnswers =
    parsedOrientation?.slug === bundle.slug ? rawOrientationAnswers : null;

  // Données CLONÉES depuis la dernière demande (« Nouvelle demande » reprend le
  // dernier dossier pour éviter de tout ressaisir — Oraliks 2026-07-19). Vides
  // hors forceNew ou s'il n'existe pas de demande source.
  let clonedPayloads: Prisma.InputJsonValue | undefined;
  let clonedCompleted: Prisma.InputJsonValue | undefined;
  let clonedEligibility: Record<string, string> | undefined;
  let clonedOrientation: Prisma.InputJsonValue | undefined;
  let clonedFromDate: string | null = null;

  // « Nouvelle demande » (forceNew) : on ne réutilise PAS le run courant. On
  // réutilise un éventuel run VIDE (garde-fou anti-doublon fantôme), refuse
  // au-delà du plafond, sinon on CLONE la dernière demande et on crée plus bas.
  if (forceNew) {
    const editable = await prisma.bundleRun.findMany({
      where: userId
        ? { bundleId: id, userId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } }
        : { bundleId: id, sessionId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        startedAt: true,
        completedTemplateIds: true,
        eligibilityAnswers: true,
        payloads: true,
        orientationAnswers: true,
      },
    });
    const action = resolveForceNewAction(
      editable.map((r) => ({ id: r.id, hasProgress: bundleRunHasProgress(r) })),
    );
    if (action.kind === "too_many") {
      return apiError(409, "Trop de demandes ouvertes pour ce dossier", {
        code: "too_many_runs",
      });
    }
    if (action.kind === "reuse") {
      const reused = await prisma.bundleRun.findUnique({ where: { id: action.runId } });
      if (reused) {
        return apiOk({ ...reused, lifecycle: deriveBundleRunLifecycle(reused) });
      }
    }
    // action.kind === "create" : on clone la demande la plus récente AVEC
    // progression (les réponses des documents + pré-qualif). L'anti-doublon à
    // la génération bloque un document resté strictement identique.
    const source = editable.find((r) => bundleRunHasProgress(r));
    if (source) {
      clonedPayloads = (source.payloads as Prisma.InputJsonValue) ?? undefined;
      clonedCompleted = (source.completedTemplateIds as Prisma.InputJsonValue) ?? undefined;
      const elig = source.eligibilityAnswers as Record<string, string> | null;
      clonedEligibility = elig && Object.keys(elig).length > 0 ? elig : undefined;
      clonedOrientation = (source.orientationAnswers as Prisma.InputJsonValue) ?? undefined;
      clonedFromDate = source.startedAt.toISOString();
    }
  }

  // Récupérer un run existant in_progress pour cet utilisateur/session
  // (sauf « Nouvelle demande » qui force la création).
  if (!forceNew) {
    const existingWhere = userId
      ? { bundleId: id, userId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } }
      : { bundleId: id, sessionId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } };
    const existing = await prisma.bundleRun.findFirst({ where: existingWhere });
    if (existing) {
      const hasEligibilityAnswers = Object.keys(eligibilityAnswers).length > 0;
      // Une nouvelle orientation doit aussi rafraîchir un run réutilisé, même si
      // ce dossier n'a aucune question de pré-qualification.
      if (hasEligibilityAnswers || orientationAnswers) {
        const updated = await prisma.bundleRun.update({
          where: { id: existing.id },
          data: {
            ...(hasEligibilityAnswers ? { eligibilityAnswers } : {}),
            ...(orientationAnswers
              ? { orientationAnswers: orientationAnswers as Prisma.InputJsonValue }
              : {}),
          },
        });
        return apiOk({ ...updated, lifecycle: deriveBundleRunLifecycle(updated) });
      }
      return apiOk({ ...existing, lifecycle: deriveBundleRunLifecycle(existing) });
    }
  }

  // Nouveau run : génère un code de reprise unique. Le code en CLAIR n'est
  // jamais persisté — on ne stocke que son hash HMAC (migration 53).
  const resumeCodePlain = await generateUniqueResumeCode(async (code) => {
    const found = await prisma.bundleRun.findUnique({
      where: { resumeCodeHash: hashResumeCode(code) },
    });
    return !!found;
  });

  const run = await prisma.bundleRun.create({
    data: {
      bundleId: id,
      userId,
      sessionId,
      resumeCodeHash: hashResumeCode(resumeCodePlain),
      resumeCodeExpiresAt: defaultResumeCodeExpiresAt(),
      // Pré-qualif : réponses du body si fournies, sinon clonées de la source.
      eligibilityAnswers:
        Object.keys(eligibilityAnswers).length > 0
          ? eligibilityAnswers
          : (clonedEligibility ?? {}),
      ...(orientationAnswers
        ? { orientationAnswers: orientationAnswers as Prisma.InputJsonValue }
        : clonedOrientation
          ? { orientationAnswers: clonedOrientation }
          : {}),
      // Clone du dernier dossier : reprend les réponses des documents + leur
      // statut « complété » pour ne pas tout ressaisir.
      ...(clonedPayloads ? { payloads: clonedPayloads } : {}),
      ...(clonedCompleted ? { completedTemplateIds: clonedCompleted } : {}),
    },
  });

  await trackBundleEvent("run_created", { bundleId: id, sessionId, userId });

  // Le code en CLAIR n'est renvoyé QU'ICI (affichage unique côté client) ; il
  // n'est pas stocké. Sur les visites suivantes, le run ne le contient plus.
  // `clonedFromDate` (ISO) = date de la demande reprise (alerte informative).
  return apiOk(
    { ...run, lifecycle: deriveBundleRunLifecycle(run), resumeCode: resumeCodePlain, clonedFromDate },
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
    return apiError(400, "Invalid JSON", { code: "invalid_json" });
  }

  // Vérifier que l'utilisateur a accès à ce run
  const where = userId
    ? { bundleId: id, userId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } }
    : { bundleId: id, sessionId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } };
  const run = await prisma.bundleRun.findFirst({ where });
  if (!run) {
    return apiError(404, "Run introuvable", { code: "not_found" });
  }

  const eligibilityAnswers = parseEligibilityAnswers(body?.eligibilityAnswers);
  const updated = await prisma.bundleRun.update({
    where: { id: run.id },
    data: { eligibilityAnswers },
  });
  return apiOk({ ...updated, lifecycle: deriveBundleRunLifecycle(updated) });
}
