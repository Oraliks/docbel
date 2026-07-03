import "server-only";

import { prisma } from "@/lib/prisma";
import type { LegalMeta } from "@/components/reglementation/types";

const RIOLEX_ID_RE = /^[a-z0-9_-]{5,80}$/i;

/** Ensemble des riolexId visibles du corpus (pour résoudre les renvois). */
export async function getCorpusRiolexIds(
  visibilities: string[],
): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<Array<{ rid: string | null }>>(
    `SELECT DISTINCT s."legalMeta"->>'riolexId' AS rid
     FROM "KnowledgeSource" s
     WHERE s."domain" = 'chomage' AND s."enabled" = true
       AND s."visibility" = ANY($1::text[])
       AND s."legalMeta" IS NOT NULL
       AND COALESCE(s."legalMeta"->>'isOnemCommentary', '') <> 'true'`,
    visibilities,
  );
  return new Set(rows.map((r) => r.rid).filter((v): v is string => !!v));
}

export interface CompareArticle {
  riolexId: string;
  title: string;
  content: string;
  meta: LegalMeta;
}

/** Fiche minimale (titre + texte + méta) pour la vue de comparaison. */
export async function getCompareArticle(
  riolexId: string,
  visibilities: string[],
): Promise<CompareArticle | null> {
  if (!RIOLEX_ID_RE.test(riolexId)) return null;
  const rows = await prisma.knowledgeSource.findMany({
    where: {
      domain: "chomage",
      enabled: true,
      visibility: { in: visibilities },
      legalMeta: { path: ["riolexId"], equals: riolexId },
    },
    select: { title: true, content: true, legalMeta: true },
    take: 5,
  });
  const article = rows.find(
    (r) => (r.legalMeta as LegalMeta | null)?.isOnemCommentary !== true,
  );
  if (!article) return null;
  return {
    riolexId,
    title: article.title,
    content: article.content,
    meta: (article.legalMeta ?? {}) as LegalMeta,
  };
}
