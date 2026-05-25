/**
 * Parsers RSS / HTML pour la veille (Feature 1 — migration 22).
 *
 * Isolés du `ingestion.ts` runtime pour respecter la limite 250 LOC du projet
 * et faciliter les futurs tests unitaires (les parsers sont pure functions).
 *
 * Pas de cheerio (dépendance évitée). Regex simples sur :
 *   - RSS 2.0 : <item><title>/<link>/<pubDate>
 *   - Atom    : <entry><title>/<link href="…"/>/<published>
 *   - HTML    : <a href="…">…</a> avec heuristique mots-clés admin chômage
 *
 * Volontairement permissif sur le scrape HTML — l'admin filtre via la queue.
 */

export interface IngestedDoc {
  title: string;
  externalUrl: string;
  publishedAt: Date | null;
}

/**
 * Parse un flux RSS 2.0 ou Atom. Détecte automatiquement le format via la
 * présence d'un `<feed xmlns>` (Atom) vs `<item>` (RSS).
 *
 * Décode les entités HTML basiques + strip CDATA wrapper. Dedup par URL.
 */
export function parseRssFeed(xml: string, baseUrl: string): IngestedDoc[] {
  const out: IngestedDoc[] = [];
  const seen = new Set<string>();
  const isAtom = /<feed\b[^>]*xmlns/i.test(xml);

  if (isAtom) {
    const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
    let m: RegExpExecArray | null;
    while ((m = entryRe.exec(xml)) !== null) {
      const entry = m[1];
      const title = matchInner(entry, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
      const linkHref = entry.match(/<link\b[^>]*\bhref="([^"]+)"/i)?.[1];
      const published =
        matchInner(entry, /<published\b[^>]*>([\s\S]*?)<\/published>/i) ||
        matchInner(entry, /<updated\b[^>]*>([\s\S]*?)<\/updated>/i);
      if (!title || !linkHref) continue;
      const url = absolutize(linkHref, baseUrl);
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        title: decodeEntities(title).trim(),
        externalUrl: url,
        publishedAt: parseDateMaybe(published),
      });
    }
  } else {
    const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) !== null) {
      const item = m[1];
      const title = matchInner(item, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
      const link = matchInner(item, /<link\b[^>]*>([\s\S]*?)<\/link>/i);
      const pubDate = matchInner(item, /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i);
      if (!title || !link) continue;
      const url = absolutize(link.trim(), baseUrl);
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        title: decodeEntities(title).trim(),
        externalUrl: url,
        publishedAt: parseDateMaybe(pubDate),
      });
    }
  }
  return out;
}

/**
 * Parse une page HTML et extrait les liens "intéressants" :
 *   - href termine par `.pdf` (priorité absolue)
 *   - OU href/text contient un mot-clé chômage / instruction / circulaire
 *
 * Cap à 500 Ko de HTML pour ne pas analyser des sites trop lourds. Très
 * permissif — l'admin filtre via la queue d'un click.
 */
export function parseHtmlForLinks(html: string, baseUrl: string): IngestedDoc[] {
  const out: IngestedDoc[] = [];
  const seen = new Set<string>();
  const sample = html.slice(0, 500_000);

  const aRe = /<a\b[^>]*\bhref="([^"#]+)"[^>]*>([\s\S]{1,500}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(sample)) !== null) {
    const href = m[1].trim();
    const text = decodeEntities(stripTags(m[2])).replace(/\s+/g, " ").trim();
    if (text.length < 4 || text.length > 200) continue;

    const lower = href.toLowerCase();
    const isPdf = lower.endsWith(".pdf");
    const isInteresting =
      isPdf ||
      /\b(instruction|circulaire|communique|publication|documentation|news|actualite|reglement|arr[êe]te)/i.test(
        href + " " + text,
      );
    if (!isInteresting) continue;

    const url = absolutize(href, baseUrl);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title: text, externalUrl: url, publishedAt: null });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Utils                                                              */
/* ------------------------------------------------------------------ */

function matchInner(text: string, re: RegExp): string {
  const m = text.match(re);
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i, "$1");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function absolutize(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function parseDateMaybe(s: string): Date | null {
  const cleaned = (s ?? "").trim();
  if (!cleaned) return null;
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}
