/**
 * Correspondances croisées AR ↔ AM : l'AR 25/11/1991 pose la règle, l'AM
 * 26/11/1991 son exécution. Au guichet, on saute constamment de l'un à l'autre.
 * On dérive les liens du graphe de renvois (un article AM citant « l'article N
 * de l'arrêté royal » se relie à l'AR art. N), symétrisé. Mémoïsé en mémoire,
 * zéro écriture DB.
 */

import { prisma } from "@/lib/prisma";
import { loiToPrefix, collectRefTargets, type RefContext } from "./resolve-ref";
import { compareArticles } from "./loi";

const AR_MAIN = "25_11_1991";
const AM_MAIN = "26_11_1991";

export interface Correspondence {
  riolexId: string;
  loi: string;
  articleNumber: string;
  title: string;
}

interface Graph {
  builtAt: number;
  map: Map<string, Correspondence[]>;
}

let cache: Graph | null = null;
let building: Promise<Graph> | null = null;
const TTL_MS = 1000 * 60 * 30;

function lawOf(rid: string): "AR" | "AM" | null {
  if (rid.startsWith(AR_MAIN)) return "AR";
  if (rid.startsWith(AM_MAIN)) return "AM";
  return null;
}

async function build(): Promise<Graph> {
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
       AND s."legalMeta"->>'loi' IN ('AR 25/11/1991', 'AM 26/11/1991')
       AND COALESCE(s."legalMeta"->>'isOnemCommentary', '') <> 'true'`,
  );

  const ids = new Set(rows.map((r) => r.rid).filter((v): v is string => !!v));
  const meta = new Map<string, Correspondence>();
  for (const r of rows) {
    if (r.rid) {
      meta.set(r.rid, {
        riolexId: r.rid,
        loi: r.loi ?? "",
        articleNumber: r.art ?? "",
        title: r.title,
      });
    }
  }

  const pairs = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    (pairs.get(a) ?? pairs.set(a, new Set()).get(a)!).add(b);
    (pairs.get(b) ?? pairs.set(b, new Set()).get(b)!).add(a);
  };

  for (const r of rows) {
    if (!r.rid) continue;
    const ctx: RefContext = {
      currentPrefix: loiToPrefix(r.loi),
      exists: (id) => ids.has(id),
    };
    for (const target of collectRefTargets(r.content ?? "", ctx)) {
      const la = lawOf(r.rid);
      const lb = lawOf(target);
      if (la && lb && la !== lb) link(r.rid, target); // uniquement AR↔AM
    }
  }

  const map = new Map<string, Correspondence[]>();
  for (const [rid, set] of pairs) {
    const list = [...set]
      .map((id) => meta.get(id))
      .filter((c): c is Correspondence => !!c)
      .sort(compareArticles);
    if (list.length) map.set(rid, list);
  }
  return { builtAt: Date.now(), map };
}

/** Articles liés dans l'autre texte (AR↔AM). Fail-soft : [] si échec. */
export async function getCorrespondences(
  riolexId: string,
): Promise<Correspondence[]> {
  if (!cache || Date.now() - cache.builtAt > TTL_MS) {
    if (!building) {
      building = build()
        .then((g) => {
          cache = g;
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
  return cache?.map.get(riolexId) ?? [];
}
