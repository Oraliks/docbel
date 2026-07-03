/**
 * Parcours de lecture thématiques : pour chaque thème métier (cf. themes.ts),
 * la liste ordonnée des articles qui le concernent — un « fil de lecture »
 * plutôt qu'une recherche. DÉRIVÉ des données (présence de mots-clés), jamais
 * curé à la main (on n'invente pas de numéros d'article dans un outil juridique).
 * Mémoïsé en mémoire, zéro écriture DB.
 */

import { prisma } from "@/lib/prisma";
import { THEMES, deriveThemes } from "./themes";
import { compareArticles } from "./loi";

export interface ParcoursStep {
  riolexId: string;
  loi: string;
  articleNumber: string;
  title: string;
}

export interface Parcours {
  key: string;
  label: string;
  steps: ParcoursStep[];
}

interface Cache {
  builtAt: number;
  parcours: Parcours[];
}
let cache: Cache | null = null;
let building: Promise<Parcours[]> | null = null;
const TTL_MS = 1000 * 60 * 30;

async function build(): Promise<Parcours[]> {
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
       AND s."legalMeta" IS NOT NULL
       AND COALESCE(s."legalMeta"->>'isOnemCommentary', '') <> 'true'`,
  );

  const byTheme = new Map<string, ParcoursStep[]>();
  for (const r of rows) {
    if (!r.rid) continue;
    const step: ParcoursStep = {
      riolexId: r.rid,
      loi: r.loi ?? "",
      articleNumber: r.art ?? "",
      title: r.title,
    };
    for (const th of deriveThemes(r.content ?? "", THEMES.length)) {
      const arr = byTheme.get(th.key);
      if (arr) arr.push(step);
      else byTheme.set(th.key, [step]);
    }
  }

  return THEMES.map((th) => ({
    key: th.key,
    label: th.label,
    steps: (byTheme.get(th.key) ?? []).sort(compareArticles),
  })).filter((p) => p.steps.length > 0);
}

/** Tous les parcours (fail-soft : [] si échec). */
export async function getParcours(): Promise<Parcours[]> {
  if (!cache || Date.now() - cache.builtAt > TTL_MS) {
    if (!building) {
      building = build()
        .then((parcours) => {
          cache = { builtAt: Date.now(), parcours };
          building = null;
          return parcours;
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
  return cache?.parcours ?? [];
}
