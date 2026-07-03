/**
 * Graphe « cité par » du corpus RioLex, calculé À LA VOLÉE et mémoïsé en
 * mémoire process (le corpus est quasi statique). On évite ainsi toute
 * écriture en base partagée : les backlinks sont dérivés des renvois internes
 * résolus (resolve-ref) et reconstruits au plus une fois par TTL.
 */

import { prisma } from "@/lib/prisma";
import { loiToPrefix, collectRefTargets, type RefContext } from "./resolve-ref";
import { compareArticles } from "./loi";

export interface Citation {
  riolexId: string;
  loi: string;
  articleNumber: string;
  title: string;
}

interface Graph {
  builtAt: number;
  citedBy: Map<string, Citation[]>;
}

let cached: Graph | null = null;
let building: Promise<Graph> | null = null;
const TTL_MS = 1000 * 60 * 30; // 30 min

async function buildGraph(): Promise<Graph> {
  // Tous les textes d'articles visibles (public + partner ; les commentaires
  // admin ne sont pas des articles et n'entrent pas dans le graphe).
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      rid: string | null;
      loi: string | null;
      art: string | null;
      title: string;
      content: string | null;
    }>
  >(
    `SELECT s."legalMeta"->>'riolexId' AS rid,
            s."legalMeta"->>'loi' AS loi,
            s."legalMeta"->>'articleNumber' AS art,
            s."title" AS title,
            s."content" AS content
     FROM "KnowledgeSource" s
     WHERE s."domain" = 'chomage' AND s."enabled" = true
       AND s."visibility" = ANY($1::text[])
       AND s."legalMeta" IS NOT NULL
       AND COALESCE(s."legalMeta"->>'isOnemCommentary', '') <> 'true'`,
    ["public", "partner"],
  );

  const ids = new Set(
    rows.map((r) => r.rid).filter((v): v is string => !!v),
  );
  const citedBy = new Map<string, Citation[]>();

  for (const r of rows) {
    if (!r.rid) continue;
    const ctx: RefContext = {
      currentPrefix: loiToPrefix(r.loi),
      exists: (id) => ids.has(id),
    };
    const source: Citation = {
      riolexId: r.rid,
      loi: r.loi ?? "",
      articleNumber: r.art ?? "",
      title: r.title,
    };
    for (const target of collectRefTargets(r.content ?? "", ctx)) {
      if (target === r.rid) continue;
      const arr = citedBy.get(target);
      if (arr) arr.push(source);
      else citedBy.set(target, [source]);
    }
  }

  for (const arr of citedBy.values()) arr.sort(compareArticles);
  return { builtAt: Date.now(), citedBy };
}

/** Articles qui citent `riolexId` (fail-soft : [] si le graphe échoue). */
export async function getCitedBy(riolexId: string): Promise<Citation[]> {
  if (!cached || Date.now() - cached.builtAt > TTL_MS) {
    if (!building) {
      building = buildGraph()
        .then((g) => {
          cached = g;
          building = null;
          return g;
        })
        .catch((err) => {
          building = null;
          throw err;
        });
    }
    try {
      await building;
    } catch {
      return [];
    }
  }
  return cached?.citedBy.get(riolexId) ?? [];
}
