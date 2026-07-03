/**
 * Recherche dans le corpus légal RioLex (réglementation chômage).
 *
 * GET /api/partenaire/reglementation/search
 *   ?q=…            recherche (plein texte + sémantique, fusion RRF)
 *   &nature=AR      filtre nature juridique (AR|AM|Loi-programme|Loi|Arrete-loi)
 *   &statut=vigueur filtre "vigueur" | "abroge"
 *   &loi=…          filtre texte de loi exact (ex. "AR 25/11/1991")
 *   &page=1&pageSize=20 (max 50)
 *
 * Réservé partenaires + admins (`requirePartnerOrAdminAuth`). Les visibilités
 * effectives suivent le rôle (`allowedVisibilities`) : un partenaire voit
 * public+partner, un admin voit tout. Les sources « commentaire ONEM »
 * (isOnemCommentary) sont TOUJOURS exclues des résultats de recherche — elles
 * ne sont chargées que sur la fiche article, et seulement pour un admin.
 *
 * Sans `q` : mode liste (navigation par loi / n° d'article).
 * Avec `q` : plein texte (tsvector `contentTsv`, ts_rank_cd + ts_headline)
 * fusionné avec la recherche sémantique pgvector (chunks) par Reciprocal
 * Rank Fusion. Jamais de contenu complet renvoyé ici (extraits seulement).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { allowedVisibilities } from "@/lib/chomage-ia/context";
import { parseQueryIntent } from "@/lib/reglementation/query-intent";
import { themeByKey } from "@/lib/reglementation/themes";
import {
  embedTexts,
  getEmbeddingProvider,
  vectorToSqlLiteral,
} from "@/lib/chomage-ia/embeddings";

/**
 * Fragment SQL détectant la réforme chômage (Loi-programme 18/07/2025, EV 1.3.2026)
 * dans le texte de l'article. Littéral constant sans entrée utilisateur → sûr
 * à inliner (pas d'injection possible).
 */
const REFORME_SQL = `s."content" ILIKE '%Loi-programme 18.7.2025%'`;

export const dynamic = "force-dynamic";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const NATURES = new Set(["AR", "AM", "Loi-programme", "Loi", "Arrete-loi"]);

/** Limite haute du plein texte avant fusion. */
const FTS_TOP_K = 50;
/** Chunks sur-échantillonnés pour la branche sémantique (dédup par source ensuite). */
const SEM_CHUNK_K = 90;
/** Sources max retenues côté sémantique après dédup. */
const SEM_TOP_K = 30;
/** Constante RRF standard. */
const RRF_K = 60;

interface LegalMetaLite {
  riolexId?: string;
  loi?: string;
  natureJuridique?: string;
  articleNumber?: string;
  datePublication?: string | null;
  dateEntreeVigueur?: string | null;
  statut?: string | null;
  abroge?: boolean;
}

interface ResultItem {
  id: string;
  riolexId: string;
  title: string;
  loi: string;
  natureJuridique: string;
  articleNumber: string;
  abroge: boolean;
  statut: string | null;
  dateEntreeVigueur: string | null;
  datePublication: string | null;
  sourceUrl: string | null;
  headline: string | null;
  reforme2026: boolean;
}

function toItem(
  row: {
    id: string;
    title: string;
    sourceUrl: string | null;
    legalMeta: unknown;
    headline?: string | null;
    reforme2026?: boolean;
  },
  exposeSource: boolean,
): ResultItem {
  const meta = (row.legalMeta ?? {}) as LegalMetaLite;
  return {
    id: row.id,
    riolexId: meta.riolexId ?? "",
    title: row.title,
    loi: meta.loi ?? "",
    natureJuridique: meta.natureJuridique ?? "",
    articleNumber: meta.articleNumber ?? "",
    abroge: meta.abroge === true,
    statut: meta.statut ?? null,
    dateEntreeVigueur: meta.dateEntreeVigueur ?? null,
    datePublication: meta.datePublication ?? null,
    // Lien RioLex réservé aux admins (source interne, cf. demande Oraliks).
    sourceUrl: exposeSource ? row.sourceUrl : null,
    headline: row.headline ?? null,
    reforme2026: row.reforme2026 === true,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const isAdmin = auth.user.isAdmin === true;
  const visibilities = allowedVisibilities(isAdmin ? "admin" : "partner");

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 300);
  const natureRaw = sp.get("nature") ?? "";
  const nature = NATURES.has(natureRaw) ? natureRaw : null;
  const statut = sp.get("statut"); // "vigueur" | "abroge" | null
  const loi = (sp.get("loi") ?? "").trim().slice(0, 200) || null;
  const reforme = sp.get("reforme") === "1" || sp.get("reforme") === "true";
  const themeKey = (sp.get("theme") ?? "").trim().slice(0, 40) || null;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(sp.get("pageSize") ?? "20", 10) || 20),
  );

  // Conditions communes (texte légal RioLex uniquement, jamais les commentaires).
  const params: unknown[] = [visibilities];
  const conds: string[] = [
    `s."domain" = 'chomage'`,
    `s."enabled" = true`,
    `s."visibility" = ANY($1::text[])`,
    `s."legalMeta" IS NOT NULL`,
    `COALESCE(s."legalMeta"->>'isOnemCommentary', '') <> 'true'`,
  ];
  if (nature) {
    params.push(nature);
    conds.push(`s."legalMeta"->>'natureJuridique' = $${params.length}`);
  }
  if (statut === "abroge") {
    conds.push(`s."legalMeta"->>'abroge' = 'true'`);
  } else if (statut === "vigueur") {
    conds.push(`COALESCE(s."legalMeta"->>'abroge', 'false') <> 'true'`);
  }
  if (loi) {
    params.push(loi);
    conds.push(`s."legalMeta"->>'loi' = $${params.length}`);
  }
  if (reforme) {
    conds.push(REFORME_SQL);
  }
  if (themeKey) {
    const th = themeByKey(themeKey);
    if (th) {
      const ors = th.keywords.map((kw) => {
        params.push(`%${kw}%`);
        return `s."content" ILIKE $${params.length}`;
      });
      if (ors.length) conds.push(`(${ors.join(" OR ")})`);
    }
  }
  const whereSql = conds.join("\n  AND ");

  try {
    // Facettes "lois" (pour le Select du front) — petite requête distincte.
    const loiRows = await prisma.$queryRawUnsafe<Array<{ loi: string | null }>>(
      `SELECT DISTINCT s."legalMeta"->>'loi' AS loi
       FROM "KnowledgeSource" s
       WHERE s."domain" = 'chomage' AND s."enabled" = true
         AND s."visibility" = ANY($1::text[])
         AND s."legalMeta" IS NOT NULL
         AND COALESCE(s."legalMeta"->>'isOnemCommentary', '') <> 'true'
       ORDER BY 1`,
      visibilities,
    );
    const lois = loiRows.map((r) => r.loi).filter((v): v is string => !!v);

    // ── Mode liste (pas de requête) : tri naturel loi → n° d'article. ──
    if (q.length === 0) {
      params.push(pageSize, (page - 1) * pageSize);
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          title: string;
          sourceUrl: string | null;
          legalMeta: unknown;
          reforme2026: boolean;
          total: bigint;
        }>
      >(
        `SELECT s."id", s."title", s."sourceUrl", s."legalMeta",
                (${REFORME_SQL}) AS reforme2026,
                COUNT(*) OVER() AS total
         FROM "KnowledgeSource" s
         WHERE ${whereSql}
         ORDER BY s."legalMeta"->>'loi' ASC,
                  NULLIF(regexp_replace(s."legalMeta"->>'articleNumber', '[^0-9].*$', ''), '')::int ASC NULLS LAST,
                  s."legalMeta"->>'articleNumber' ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        ...params,
      );
      const total = rows.length > 0 ? Number(rows[0].total) : 0;
      return NextResponse.json(
        {
          mode: "liste",
          results: rows.map((r) => toItem(r, isAdmin)),
          total,
          page,
          pageSize,
          lois,
        },
        { headers: jsonHeaders },
      );
    }

    // ── Branche plein texte. ──
    const ftsParams = [...params, q];
    const qIdx = ftsParams.length;
    const ftsRows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        title: string;
        sourceUrl: string | null;
        legalMeta: unknown;
        reforme2026: boolean;
        rank: number;
        headline: string;
      }>
    >(
      `SELECT s."id", s."title", s."sourceUrl", s."legalMeta",
              (${REFORME_SQL}) AS reforme2026,
              ts_rank_cd(s."contentTsv", websearch_to_tsquery('french', $${qIdx})) AS rank,
              ts_headline('french', left(s."content", 4000),
                          websearch_to_tsquery('french', $${qIdx}),
                          'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=25, MinWords=8') AS headline
       FROM "KnowledgeSource" s
       WHERE ${whereSql}
         AND s."contentTsv" @@ websearch_to_tsquery('french', $${qIdx})
       ORDER BY rank DESC
       LIMIT ${FTS_TOP_K}`,
      ...ftsParams,
    );

    // ── Branche sémantique (fail-soft : si pas de provider ou erreur → FTS seul). ──
    const semRanked: string[] = [];
    if (getEmbeddingProvider()) {
      try {
        const { vectors } = await embedTexts([q]);
        if (vectors[0]?.length) {
          const vecLit = vectorToSqlLiteral(vectors[0]);
          const semParams = [...params, vecLit];
          const vIdx = semParams.length;
          const chunkRows = await prisma.$queryRawUnsafe<
            Array<{ source_id: string; distance: number }>
          >(
            `SELECT s."id" AS source_id,
                    (c."embedding" <=> $${vIdx}::vector) AS distance
             FROM "KnowledgeChunk" c
             INNER JOIN "KnowledgeSource" s ON s."id" = c."sourceId"
             WHERE ${whereSql}
               AND c."embedding" IS NOT NULL
             ORDER BY c."embedding" <=> $${vIdx}::vector ASC
             LIMIT ${SEM_CHUNK_K}`,
            ...semParams,
          );
          const seen = new Set<string>();
          for (const row of chunkRows) {
            if (seen.has(row.source_id)) continue;
            seen.add(row.source_id);
            semRanked.push(row.source_id);
            if (semRanked.length >= SEM_TOP_K) break;
          }
        }
      } catch (err) {
        console.warn(
          "[reglementation search] branche sémantique en échec (fallback FTS seul):",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // ── Fusion RRF (Reciprocal Rank Fusion). ──
    const scores = new Map<string, number>();
    ftsRows.forEach((row, i) => {
      scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (RRF_K + i + 1));
    });
    semRanked.forEach((id, i) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + i + 1));
    });
    const fusedIds = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    // Métadonnées des ids venus de la branche sémantique uniquement.
    const ftsById = new Map(ftsRows.map((r) => [r.id, r]));
    const missingIds = fusedIds.filter((id) => !ftsById.has(id));
    const extra =
      missingIds.length > 0
        ? await prisma.knowledgeSource.findMany({
            where: { id: { in: missingIds } },
            select: {
              id: true,
              title: true,
              sourceUrl: true,
              legalMeta: true,
              summary: true,
              content: true,
            },
            take: SEM_TOP_K,
          })
        : [];
    const extraById = new Map(extra.map((r) => [r.id, r]));

    let fusedItems: ResultItem[] = [];
    for (const id of fusedIds) {
      const fts = ftsById.get(id);
      if (fts) {
        fusedItems.push(toItem(fts, isAdmin));
        continue;
      }
      const row = extraById.get(id);
      if (row) {
        fusedItems.push(
          toItem(
            {
              ...row,
              headline: row.summary ?? null,
              reforme2026: /Loi-programme 18\.7\.2025/i.test(row.content ?? ""),
            },
            isAdmin,
          ),
        );
      }
    }

    // Boost : si la requête est un n° d'article (« art. 79 »), épingle la fiche
    // exacte en tête (corrige le ranking où l'article visé était noyé).
    const intent = parseQueryIntent(q);
    if (intent.articleNumber) {
      const exactParams = [...params, intent.articleNumber];
      let exactWhere = `${whereSql} AND lower(s."legalMeta"->>'articleNumber') = $${exactParams.length}`;
      if (intent.nature) {
        exactParams.push(intent.nature);
        exactWhere += ` AND s."legalMeta"->>'natureJuridique' = $${exactParams.length}`;
      }
      const exactRows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          title: string;
          sourceUrl: string | null;
          legalMeta: unknown;
          reforme2026: boolean;
        }>
      >(
        `SELECT s."id", s."title", s."sourceUrl", s."legalMeta", (${REFORME_SQL}) AS reforme2026
         FROM "KnowledgeSource" s
         WHERE ${exactWhere}
         LIMIT 10`,
        ...exactParams,
      );
      if (exactRows.length > 0) {
        const exactItems = exactRows.map((r) => toItem(r, isAdmin));
        const exactIds = new Set(exactItems.map((i) => i.id));
        fusedItems = [
          ...exactItems,
          ...fusedItems.filter((i) => !exactIds.has(i.id)),
        ];
      }
    }

    const start = (page - 1) * pageSize;
    return NextResponse.json(
      {
        mode: semRanked.length > 0 ? "hybride" : "fts",
        results: fusedItems.slice(start, start + pageSize),
        total: fusedItems.length,
        page,
        pageSize,
        lois,
      },
      { headers: jsonHeaders },
    );
  } catch (err) {
    console.error("[reglementation search] échec:", err);
    return NextResponse.json(
      { error: "Recherche indisponible" },
      { status: 500, headers: jsonHeaders },
    );
  }
}
