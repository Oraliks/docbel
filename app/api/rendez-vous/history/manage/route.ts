import { NextResponse, type NextRequest } from "next/server";

import { requireRdvHistoryAccess } from "@/lib/auth-check";
import { prisma, withDbRetry } from "@/lib/prisma";
import { resolveScope } from "@/lib/rendez-vous/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * POST /api/rendez-vous/history/manage
 *
 * Consultation / gestion de l'historique des rendez-vous. Accès réservé aux
 * RESPONSABLES, aux personnes explicitement autorisées, et aux ADMINS
 * (cf. `requireRdvHistoryAccess`).
 *
 * Body : `{ action, org?, id? }`
 *   • `list`   → liste les rendez-vous enregistrés du service (option `org` pour
 *               les admins qui choisissent l'organisation).
 *   • `delete` → supprime une entrée (`id`), uniquement dans le périmètre autorisé.
 *   • `clear`  → vide tout l'historique du périmètre.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRdvHistoryAccess();
  if (!auth.isAuthorized) return auth.error;
  const { user } = auth;

  let action: unknown;
  let requestedOrg: string | null = null;
  let id: string | null = null;
  try {
    const body = (await req.json()) as {
      action?: unknown;
      org?: unknown;
      id?: unknown;
    } | null;
    action = body?.action;
    if (typeof body?.org === "string") requestedOrg = body.org;
    if (typeof body?.id === "string") id = body.id;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête JSON invalide.", code: "BAD_REQUEST" },
      { status: 400, headers: jsonHeaders },
    );
  }

  const scope = resolveScope({
    isAdmin: user.isAdmin,
    partnerOrganization: user.partnerOrganization,
    requestedOrg: user.isAdmin ? requestedOrg : null,
    userId: user.id,
  });
  if (!scope) {
    return NextResponse.json(
      {
        error: user.isAdmin
          ? "Choisissez une organisation."
          : "Aucune organisation rattachée à ce compte.",
        code: "NO_SCOPE",
      },
      { status: 400, headers: jsonHeaders },
    );
  }

  try {
    if (action === "list") {
      const rows = await withDbRetry(() =>
        prisma.rendezVousHistory.findMany({
          where: { scope },
          select: {
            id: true,
            name: true,
            date: true,
            startTime: true,
            endTime: true,
            createdAt: true,
          },
          orderBy: [{ date: "desc" }, { startTime: "asc" }, { name: "asc" }],
          take: 2000,
        }),
      );
      return NextResponse.json(
        { entries: rows, count: rows.length },
        { status: 200, headers: jsonHeaders },
      );
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json(
          { error: "Identifiant manquant.", code: "BAD_REQUEST" },
          { status: 400, headers: jsonHeaders },
        );
      }
      // Le filtre sur `scope` empêche de supprimer hors de son périmètre.
      const result = await withDbRetry(() =>
        prisma.rendezVousHistory.deleteMany({ where: { id, scope } }),
      );
      return NextResponse.json(
        { deleted: result.count },
        { status: 200, headers: jsonHeaders },
      );
    }

    if (action === "clear") {
      const result = await withDbRetry(() =>
        prisma.rendezVousHistory.deleteMany({ where: { scope } }),
      );
      return NextResponse.json(
        { deleted: result.count },
        { status: 200, headers: jsonHeaders },
      );
    }

    return NextResponse.json(
      { error: "Action inconnue (list, delete ou clear).", code: "BAD_REQUEST" },
      { status: 400, headers: jsonHeaders },
    );
  } catch (err) {
    console.error("[rdv-history/manage] erreur", err);
    return NextResponse.json(
      { error: "Erreur interne lors de l'accès à l'historique.", code: "INTERNAL" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
