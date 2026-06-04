import { NextResponse, type NextRequest } from "next/server";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { prisma, withDbRetry } from "@/lib/prisma";
import { AppointmentParseError, parseAppointments } from "@/lib/rendez-vous/ics";
import {
  computeDuplicates,
  normalizeName,
  resolveScope,
  toStoredRdvs,
  type StoredRdv,
} from "@/lib/rendez-vous/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * POST /api/rendez-vous/history
 *
 * Body : `{ action: "check" | "save", content: "<texte collé>" }`
 *
 *  • `check` (lecture) → renvoie les doublons : noms répétés dans la liste et/ou
 *    déjà présents dans l'historique du service (avec leur créneau précédent).
 *  • `save`  (écriture) → enregistre les rendez-vous de la liste dans
 *    l'historique (idempotent grâce à la contrainte d'unicité).
 *
 * Accès réservé aux PARTENAIRES (dont la FGTB) et aux ADMINS. L'historique est
 * cloisonné par `scope` = organisation partenaire → partagé entre collègues du
 * même service.
 */
export async function POST(req: NextRequest) {
  const authResult = await requirePartnerOrAdminAuth();
  if (!authResult.isAuthorized) {
    return authResult.error;
  }
  const { user } = authResult;

  let action: unknown;
  let content: unknown;
  let requestedOrg: string | null = null;
  try {
    const body = (await req.json()) as {
      action?: unknown;
      content?: unknown;
      org?: unknown;
    } | null;
    action = body?.action;
    content = body?.content;
    if (typeof body?.org === "string") requestedOrg = body.org;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête JSON invalide.", code: "BAD_REQUEST" },
      { status: 400, headers: jsonHeaders },
    );
  }

  if (action !== "check" && action !== "save") {
    return NextResponse.json(
      { error: "Action inconnue (attendu : check ou save).", code: "BAD_REQUEST" },
      { status: 400, headers: jsonHeaders },
    );
  }
  if (typeof content !== "string" || content.trim() === "") {
    return NextResponse.json(
      {
        error: "Aucun texte fourni. Collez la liste des rendez-vous.",
        code: "NO_APPOINTMENTS",
      },
      { status: 400, headers: jsonHeaders },
    );
  }

  // Seuls les admins peuvent cibler une autre organisation ; un partenaire est
  // toujours cloisonné à la sienne.
  const scope = resolveScope({
    isAdmin: user.isAdmin,
    partnerOrganization: user.partnerOrganization,
    requestedOrg: user.isAdmin ? requestedOrg : null,
    userId: user.id,
  });
  if (!scope) {
    return NextResponse.json(
      { error: "Aucune organisation rattachée à ce compte.", code: "NO_SCOPE" },
      { status: 400, headers: jsonHeaders },
    );
  }

  let current: StoredRdv[];
  try {
    current = toStoredRdvs(parseAppointments(content));
  } catch (err) {
    if (err instanceof AppointmentParseError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400, headers: jsonHeaders },
      );
    }
    console.error("[rdv-history] parsing inattendu", err);
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL" },
      { status: 500, headers: jsonHeaders },
    );
  }

  // Noms normalisés distincts de la liste : limite la requête à l'utile.
  const normalizedNames = [...new Set(current.map((r) => normalizeName(r.name)))];

  try {
    if (action === "save") {
      const result = await withDbRetry(() =>
        prisma.rendezVousHistory.createMany({
          data: current.map((r) => ({
            scope,
            nameNormalized: normalizeName(r.name),
            name: r.name,
            date: r.date,
            startTime: r.startTime,
            endTime: r.endTime,
            createdById: user.id,
          })),
          skipDuplicates: true, // ré-enregistrer la même liste ne crée pas de doublon
        }),
      );
      return NextResponse.json(
        { saved: result.count, total: current.length },
        { status: 200, headers: jsonHeaders },
      );
    }

    // action === "check"
    const existingRows = await withDbRetry(() =>
      prisma.rendezVousHistory.findMany({
        where: { scope, nameNormalized: { in: normalizedNames } },
        select: { name: true, date: true, startTime: true, endTime: true },
      }),
    );
    const duplicates = computeDuplicates(current, existingRows);
    return NextResponse.json(
      { duplicates, count: current.length },
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error("[rdv-history] erreur base de données", err);
    return NextResponse.json(
      { error: "Erreur interne lors de l'accès à l'historique.", code: "INTERNAL" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
