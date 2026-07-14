import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { memoCache } from "@/lib/memo-cache";
import { rankCommuneMatches, normalizeForSearch, type CommuneLite } from "@/lib/bureaus/commune-search";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export const dynamic = "force-dynamic";

export type SuggestResponse = {
  municipalities: { insCode: string; nameFr: string; cp: string }[];
  organizations: { code: string; label: string }[];
  offices: { id: string; label: string; secondaryLabel?: string }[];
  services: { key: string; label: string }[];
};

const EMPTY_RESPONSE: SuggestResponse = {
  municipalities: [],
  organizations: [],
  offices: [],
  services: [],
};

// Même clé de cache que app/api/bureaux/communes/route.ts : référentiel
// quasi statique (~565 communes) chargé une seule fois et partagé entre
// les deux routes (TTL 1h, cf. commentaire là-bas pour le détail).
const ALL_COMMUNES_CACHE_KEY = "bureaux:communes:all";
const ALL_COMMUNES_TTL_MS = 60 * 60 * 1000;

async function loadAllCommunes(): Promise<CommuneLite[]> {
  const rows = await prisma.commune.findMany({
    where: { mergedIntoId: null },
    select: {
      insCode: true,
      nameFr: true,
      nameNl: true,
      postalCodes: { select: { code: true }, orderBy: { code: "asc" }, take: 1 },
    },
  });

  const communes: CommuneLite[] = [];
  for (const c of rows) {
    const cp = c.postalCodes[0]?.code;
    if (!cp) continue; // pas de CP représentatif → non résolvable, on l'exclut
    communes.push({ insCode: c.insCode, nameFr: c.nameFr, nameNl: c.nameNl, cp });
  }
  return communes;
}

// Index statique des démarches câblées (cf. lib/bureaus/demarche-map.ts —
// les clés correspondent au type `Demarche`, sans `inconnu`). Petit index
// de recherche côté serveur, pas des données bidon : sert à retrouver une
// démarche depuis un terme libre tapé dans la recherche universelle.
const SERVICE_INDEX: { key: string; label: string; terms: string[] }[] = [
  { key: "chomage", label: "Chômage et allocations", terms: ["chomage", "chômage", "allocation", "onem", "capac", "syndicat", "paiement"] },
  { key: "aide_sociale", label: "Aide sociale", terms: ["aide", "sociale", "cpas", "revenu", "integration"] },
  { key: "documents_communaux", label: "Documents communaux", terms: ["document", "commune", "communal", "carte", "identite", "identité", "administration"] },
  { key: "emploi", label: "Recherche d'emploi", terms: ["emploi", "travail", "actiris", "forem", "vdab", "adg", "job"] },
];

function matchServices(q: string): SuggestResponse["services"] {
  const nq = normalizeForSearch(q);
  const matches: SuggestResponse["services"] = [];
  for (const s of SERVICE_INDEX) {
    const hit = normalizeForSearch(s.label).includes(nq) || s.terms.some((t) => normalizeForSearch(t).includes(nq));
    if (hit) matches.push({ key: s.key, label: s.label });
    if (matches.length >= 6) break;
  }
  return matches;
}

/**
 * Autocomplete groupé de la recherche universelle du finder de bureaux :
 * communes + organismes + bureaux + démarches (services), en une requête.
 *
 * Dégradation gracieuse : toute erreur DB renvoie la forme "tout vide" en
 * 200 (jamais un 500 qui casserait l'UI d'autocomplete).
 */
export async function GET(req: NextRequest) {
  // Rate-limit anti-abus : 60 req / min / IP (endpoint public, pas d'auth)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`bureaux-suggest:${ip}`, { windowMs: 60_000, max: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429, headers: jsonHeaders }
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json(EMPTY_RESPONSE, { headers: jsonHeaders });
  }

  try {
    const [allCommunes, organizations, offices] = await Promise.all([
      memoCache(ALL_COMMUNES_CACHE_KEY, ALL_COMMUNES_TTL_MS, loadAllCommunes),
      prisma.organisme.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { shortName: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { code: true, name: true, shortName: true },
        take: 6,
      }),
      prisma.bureau.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { nameNl: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, city: true },
        take: 6,
      }),
    ]);

    const municipalities = rankCommuneMatches(q, allCommunes, 6).map((c) => ({
      insCode: c.insCode,
      nameFr: c.nameFr,
      cp: c.cp,
    }));

    const response: SuggestResponse = {
      municipalities,
      organizations: organizations.map((o) => ({ code: o.code, label: o.shortName ?? o.name })),
      offices: offices.map((b) => ({ id: b.id, label: b.name, secondaryLabel: b.city ?? undefined })),
      services: matchServices(q),
    };

    return NextResponse.json(response, { headers: jsonHeaders });
  } catch (error) {
    // Pas de query (PII potentielle) dans le log, comme les autres routes
    // /api/bureaux/*.
    console.error("[bureaux/suggest] error:", error);
    return NextResponse.json(EMPTY_RESPONSE, { headers: jsonHeaders });
  }
}
