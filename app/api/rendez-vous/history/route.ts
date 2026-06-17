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
 *  • `save`  (écriture) → **synchronise** l'historique sur les journées du
 *    collage : ajoute les nouveaux RDV ET retire ceux qui étaient enregistrés
 *    pour ces journées mais sont absents du nouveau collage. Permet de re-coller
 *    la même journée après avoir traité/refusé des demandes, et garder l'état
 *    à jour. Seules les journées présentes dans le collage sont touchées.
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
      // Sync par jour : on n'opère QUE sur les journées présentes dans le
      // collage (jamais celles d'avant). Pour chacune : on supprime les RDV
      // existants qui ne sont plus dans le nouveau collage, puis on ajoute les
      // nouveaux. Garantit que re-coller la liste après traitement reflète
      // exactement l'état courant pour ces jours.
      const datesInPaste = [...new Set(current.map((r) => r.date))];
      const expectedKeys = new Set(
        current.map(
          (r) => `${normalizeName(r.name)}|${r.date}|${r.startTime}`,
        ),
      );

      // Clé d'identité d'un RDV (nom normalisé + jour + créneau de début).
      const keyOf = (e: {
        nameNormalized: string;
        date: string;
        startTime: string;
      }) => `${e.nameNormalized}|${e.date}|${e.startTime}`;

      const result = await withDbRetry(() =>
        prisma.$transaction(async (tx) => {
          const existing = await tx.rendezVousHistory.findMany({
            where: { scope, date: { in: datesInPaste } },
            select: {
              id: true,
              name: true,
              nameNormalized: true,
              date: true,
              startTime: true,
              endTime: true,
            },
          });
          const existingKeys = new Set(existing.map(keyOf));
          // Présents en base pour ces journées mais absents du nouveau collage.
          const obsolete = existing.filter((e) => !expectedKeys.has(keyOf(e)));
          const obsoleteIds = obsolete.map((e) => e.id);

          const del = obsoleteIds.length
            ? await tx.rendezVousHistory.deleteMany({
                where: { scope, id: { in: obsoleteIds } },
              })
            : { count: 0 };

          const ins = await tx.rendezVousHistory.createMany({
            data: current.map((r) => ({
              scope,
              nameNormalized: normalizeName(r.name),
              name: r.name,
              date: r.date,
              startTime: r.startTime,
              endTime: r.endTime,
              createdById: user.id,
            })),
            skipDuplicates: true, // re-coller la même liste ne crée pas de doublon
          });

          // Réellement nouveaux : présents dans le collage, absents de la base.
          const addedEntries = current.filter(
            (r) =>
              !existingKeys.has(
                `${normalizeName(r.name)}|${r.date}|${r.startTime}`,
              ),
          );

          return {
            saved: ins.count,
            removed: del.count,
            removedEntries: obsolete.map((e) => ({
              name: e.name,
              date: e.date,
              startTime: e.startTime,
              endTime: e.endTime,
            })),
            addedEntries,
          };
        }),
      );

      return NextResponse.json(
        {
          saved: result.saved,
          removed: result.removed,
          // Détail nominatif (sert à l'onglet « Mise à jour » de l'historique
          // pour montrer concrètement qui a été retiré / ajouté).
          removedEntries: result.removedEntries,
          added: result.addedEntries,
          total: current.length,
          days: datesInPaste.length,
        },
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
