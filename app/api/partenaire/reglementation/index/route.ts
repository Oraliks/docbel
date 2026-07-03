/**
 * Index léger du corpus RioLex pour la palette de commande (Ctrl+K) :
 * ~443 lignes { riolexId, loi, articleNumber, nature, abroge, title }.
 * Réservé partenaires + admins. Lecture seule, aucun contenu.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { allowedVisibilities } from "@/lib/chomage-ia/context";
import { compareArticles } from "@/lib/reglementation/loi";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const visibilities = allowedVisibilities(
    auth.user.isAdmin ? "admin" : "partner",
  );

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      riolexId: string | null;
      loi: string | null;
      articleNumber: string | null;
      nature: string | null;
      abroge: string | null;
      title: string;
    }>
  >(
    `SELECT s."legalMeta"->>'riolexId' AS "riolexId",
            s."legalMeta"->>'loi' AS loi,
            s."legalMeta"->>'articleNumber' AS "articleNumber",
            s."legalMeta"->>'natureJuridique' AS nature,
            s."legalMeta"->>'abroge' AS abroge,
            s."title" AS title
     FROM "KnowledgeSource" s
     WHERE s."domain" = 'chomage' AND s."enabled" = true
       AND s."visibility" = ANY($1::text[])
       AND s."legalMeta" IS NOT NULL
       AND COALESCE(s."legalMeta"->>'isOnemCommentary', '') <> 'true'`,
    visibilities,
  );

  const items = rows
    .filter((r) => r.riolexId)
    .map((r) => ({
      riolexId: r.riolexId as string,
      loi: r.loi ?? "",
      articleNumber: r.articleNumber ?? "",
      nature: r.nature ?? "",
      abroge: r.abroge === "true",
      title: r.title,
    }))
    .sort((a, b) => a.loi.localeCompare(b.loi) || compareArticles(a, b));

  return NextResponse.json(
    { items },
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}
