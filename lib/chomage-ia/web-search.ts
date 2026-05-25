/**
 * Web search via Brave Search API (Feature 5 — migration 22).
 *
 * Choix Brave plutôt que l'API Web Search Anthropic native :
 *   - Contrôle total côté backend (filtrage domaine, rate-limit, cap résultats).
 *   - Pas de feature flag Anthropic bêta à attendre.
 *   - Tarification connue (Brave free tier = 1 req/s ; payant à partir de 1000/mois).
 *
 * Le toggle UI "🌐" est explicite — JAMAIS automatique. L'admin décide message
 * par message s'il autorise la recherche web (cf. ChatRequestSchema.enableWebSearch).
 *
 * Cache mémoire 1h sur la query (même clé → même résultats) pour éviter de
 * facturer plusieurs fois la même question pendant qu'on itère. Suffisant
 * pour un déploiement single-instance ; à remplacer par Redis en multi.
 */

import { getSetting, SETTING_KEYS } from "@/lib/app-settings";

export interface WebSearchResult {
  /** Titre de la page (déjà décodé). */
  title: string;
  /** URL de la page. */
  url: string;
  /** Snippet textuel renvoyé par Brave (max ~300 chars). */
  snippet: string;
  /** Source du domain (ex. "onem.be"). */
  domain: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const cache = new Map<string, { at: number; results: WebSearchResult[] }>();

/**
 * Vérifie si la web search est activée (env var clé + toggle admin).
 */
export async function isWebSearchAvailable(): Promise<boolean> {
  if (!process.env.BRAVE_SEARCH_API_KEY) return false;
  const setting = await getSetting(SETTING_KEYS.CHOMAGE_IA_WEB_SEARCH_ENABLED);
  return setting === "true";
}

/**
 * Effectue une recherche Brave. Cache 1h. Retourne max `count` résultats
 * (cap dur à 5, défaut 3).
 *
 * Throw si la clé API est absente ou si Brave renvoie une erreur HTTP.
 *
 * Note de contenu : Brave renvoie aussi des résultats "news", "videos", etc.
 * On ne consomme que `web.results` pour rester simple.
 */
export async function searchWeb(
  query: string,
  count: number = 3,
): Promise<WebSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error("BRAVE_SEARCH_API_KEY manquante");
  }
  const trimmed = (query ?? "").trim().slice(0, 500);
  if (trimmed.length < 2) return [];

  const capped = Math.max(1, Math.min(count, 5));
  const cacheKey = `${capped}::${trimmed.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.results;
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("count", String(capped));
  // Belgique / FR par défaut — l'API supporte le param country pour la pertinence.
  url.searchParams.set("country", "BE");
  url.searchParams.set("search_lang", "fr");

  const res = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "x-subscription-token": apiKey,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Brave Search ${res.status} : ${text.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
        meta_url?: { hostname?: string };
      }>;
    };
  };

  const items = (data.web?.results ?? []).slice(0, capped);
  const results: WebSearchResult[] = items.map((it) => ({
    title: stripHtml(it.title ?? ""),
    url: it.url ?? "",
    snippet: stripHtml(it.description ?? "").slice(0, 600),
    domain: it.meta_url?.hostname ?? safeDomain(it.url),
  }));

  cache.set(cacheKey, { at: Date.now(), results });
  return results;
}

/**
 * Formate un set de résultats web en bloc de "sources temporaires" injectable
 * dans le `cachedContext` du chat IA. Chaque résultat reçoit un pseudo-ID
 * `web:N` que Claude peut citer comme [SRC:web:N]. Le post-process ignore ces
 * IDs côté validation (ils ne correspondent à aucune KnowledgeSource).
 */
export function formatWebResultsForContext(
  results: WebSearchResult[],
): string {
  if (results.length === 0) return "";
  const blocks: string[] = [
    "## Résultats web (autorisés pour ce message uniquement)",
    "*Ces résultats viennent d'une recherche Brave — pas de la KB. Cite-les comme [WEB:N] dans ta réponse si tu les utilises. Ne les considère pas comme des sources officielles sans vérification.*",
    "",
  ];
  results.forEach((r, i) => {
    const idx = i + 1;
    blocks.push(`### [WEB:${idx}] ${r.title}`);
    blocks.push(`URL : ${r.url}`);
    blocks.push(`Domaine : ${r.domain}`);
    blocks.push(``);
    blocks.push(r.snippet);
    blocks.push(``);
  });
  return blocks.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Utils                                                              */
/* ------------------------------------------------------------------ */

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeDomain(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
