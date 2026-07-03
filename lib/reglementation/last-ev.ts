/**
 * Dernière entrée en vigueur réelle par article, dérivée des crochets
 * d'amendement du texte (la `dateEntreeVigueur` de legalMeta est constante par
 * loi → trompeuse). Alimente le badge de fraîcheur (fiche) et le filtre/tri
 * « modifiés depuis… » (recherche). Mémoïsé en mémoire, zéro écriture DB.
 */

import { prisma } from "@/lib/prisma";
import { extractAmendments, latestEV } from "./parse-amendments";

export interface LastEv {
  /** « JJ/MM/AAAA » ou null si l'article n'a aucune modification datée. */
  display: string | null;
  year: number | null;
  /** Clé de tri AAAAMMJJ (0 si non daté). */
  sortKey: number;
}

/** Convertit « JJ/MM/AAAA » en clé AAAAMMJJ (0 si invalide). */
function toSortKey(display: string | null): { key: number; year: number | null } {
  if (!display || !/^\d{2}\/\d{2}\/\d{4}$/.test(display)) return { key: 0, year: null };
  const [d, m, y] = display.split("/");
  return { key: parseInt(`${y}${m}${d}`, 10), year: parseInt(y, 10) };
}

interface Cache {
  builtAt: number;
  map: Map<string, LastEv>;
}
let cache: Cache | null = null;
let building: Promise<Map<string, LastEv>> | null = null;
const TTL_MS = 1000 * 60 * 30;

async function build(): Promise<Map<string, LastEv>> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ rid: string | null; content: string | null }>
  >(
    `SELECT s."legalMeta"->>'riolexId' AS rid, s."content" AS content
     FROM "KnowledgeSource" s
     WHERE s."domain" = 'chomage' AND s."enabled" = true
       AND s."legalMeta" IS NOT NULL
       AND COALESCE(s."legalMeta"->>'isOnemCommentary', '') <> 'true'`,
  );
  const map = new Map<string, LastEv>();
  for (const r of rows) {
    if (!r.rid) continue;
    const display = latestEV(extractAmendments(r.content ?? ""));
    const { key, year } = toSortKey(display);
    map.set(r.rid, { display, year, sortKey: key });
  }
  return map;
}

export async function getLastEvMap(): Promise<Map<string, LastEv>> {
  if (!cache || Date.now() - cache.builtAt > TTL_MS) {
    if (!building) {
      building = build()
        .then((map) => {
          cache = { builtAt: Date.now(), map };
          building = null;
          return map;
        })
        .catch((err) => {
          building = null;
          throw err;
        });
    }
    try {
      await building;
    } catch {
      return new Map();
    }
  }
  return cache?.map ?? new Map();
}
