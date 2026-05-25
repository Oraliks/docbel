/**
 * Veille / ingestion automatique de sources publiques (Feature 1 — migration 22).
 *
 * Orchestre :
 *   - `runIngestionCheck`         : fetch d'une IngestionSource + parsing + persist
 *   - `validateIngestedDocument`  : transforme un IngestedDocument en KnowledgeSource
 *
 * Les parsers RSS / HTML sont isolés dans `ingestion-parsers.ts` pour respecter
 * la limite 250 LOC (pure functions testables séparément).
 *
 * Fail-soft : toute erreur réseau / parsing est attrapée et retournée comme
 * `lastError` sur l'IngestionSource. Jamais throw côté caller du cron.
 */

import { prisma } from "@/lib/prisma";
import type { IngestionSource } from "@prisma/client";
import { parseRssFeed, parseHtmlForLinks } from "./ingestion-parsers";

/** Cap dur de docs créés par run (anti-explosion sur source mal configurée). */
const MAX_DOCS_PER_RUN = 50;

/** Timeout HTTP fetch pour le polling (10s). */
const FETCH_TIMEOUT_MS = 10_000;

interface RunCheckResult {
  /** Nombre de docs créés (nouveaux). */
  created: number;
  /** Nombre de docs déjà connus (dédupliqués). */
  skipped: number;
  /** Total détecté avant dédup. */
  detected: number;
  /** Erreur fatale s'il y a eu une (sinon null). */
  error: string | null;
}

/**
 * Exécute un check sur une IngestionSource :
 *   1. Fetch l'URL avec timeout.
 *   2. Parse selon `kind` → liste de IngestedDoc.
 *   3. Pour chaque doc : tente `prisma.ingestedDocument.create` — si conflit
 *      sur `externalUrl` (unique), on skippe silencieusement.
 *   4. Update `IngestionSource.lastCheckedAt` / `lastSuccessAt` / `lastError`.
 */
export async function runIngestionCheck(
  source: IngestionSource,
): Promise<RunCheckResult> {
  const result: RunCheckResult = {
    created: 0,
    skipped: 0,
    detected: 0,
    error: null,
  };

  try {
    const html = await fetchWithTimeout(source.url);
    const docs =
      source.kind === "rss"
        ? parseRssFeed(html, source.url)
        : source.kind === "scrape"
          ? parseHtmlForLinks(html, source.url)
          : (() => {
              throw new Error(`Kind inconnu : ${source.kind}`);
            })();
    result.detected = docs.length;

    // Cap pour éviter qu'un site mal configuré nous spam des milliers d'entrées.
    const capped = docs.slice(0, MAX_DOCS_PER_RUN);

    for (const d of capped) {
      try {
        await prisma.ingestedDocument.create({
          data: {
            ingestionSourceId: source.id,
            externalUrl: d.externalUrl,
            title: d.title,
            publishedAt: d.publishedAt,
            status: "pending",
          },
        });
        result.created++;
      } catch (err) {
        // Conflit unique → externalUrl déjà connu, on skip.
        if (err instanceof Error && err.message.includes("Unique")) {
          result.skipped++;
        } else {
          console.warn(
            `[ingestion] insert failed for ${d.externalUrl}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }

    await prisma.ingestionSource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastSuccessAt: result.created > 0 ? new Date() : source.lastSuccessAt,
        lastError: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.error = message;
    await prisma.ingestionSource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastError: message.slice(0, 1000),
      },
    });
  }

  return result;
}

/**
 * Fetch helper avec timeout + User-Agent friendly (les sites .gov.be n'aiment
 * pas les UA vides ou suspects).
 */
async function fetchWithTimeout(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "BeldocBot/1.0 (+https://beldoc.be ; veille admin chômage)",
      accept:
        "application/rss+xml, application/atom+xml, application/xml, text/html;q=0.9, */*;q=0.5",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

/**
 * Valide un IngestedDocument : crée une KnowledgeSource minimale (kind="url")
 * qui pointe vers l'externalUrl. Pas de download/extraction pour rester rapide
 * et léger — l'admin peut enrichir le contenu ensuite via l'UI sources.
 */
export async function validateIngestedDocument(args: {
  ingestedDocumentId: string;
  domain: string;
  createdById: string | null;
  folderId?: string | null;
  extraTags?: string[];
}): Promise<{ knowledgeSourceId: string; title: string }> {
  const { ingestedDocumentId, domain, createdById, folderId, extraTags } = args;
  const doc = await prisma.ingestedDocument.findUnique({
    where: { id: ingestedDocumentId },
    include: { ingestionSource: true },
  });
  if (!doc) throw new Error("IngestedDocument introuvable");
  if (doc.status !== "pending") {
    throw new Error(`Document déjà ${doc.status}`);
  }

  const sourceName = doc.ingestionSource.name;
  const placeholderContent = `# ${doc.title}

Document détecté automatiquement par la veille « ${sourceName} » le ${doc.fetchedAt.toLocaleDateString("fr-BE")}.

URL source : ${doc.externalUrl}

Contenu non extrait automatiquement — édite cette source pour ajouter le contenu intégral, ou re-upload le PDF via "Sources > Upload" pour extraction automatique.`;

  const tags = ["veille", ...(extraTags ?? [])];
  if (sourceName) tags.push(sourceName.toLowerCase().slice(0, 30));

  const ks = await prisma.knowledgeSource.create({
    data: {
      title: doc.title.slice(0, 200),
      kind: "url",
      content: placeholderContent,
      summary: `${doc.title.slice(0, 200)} (veille ${sourceName})`,
      sourceUrl: doc.externalUrl,
      tags: tags.slice(0, 20),
      enabled: true,
      domain,
      folderId: folderId ?? null,
      createdById,
      lastValidatedAt: new Date(),
      validityStatus: "fresh",
    },
  });

  await prisma.ingestedDocument.update({
    where: { id: ingestedDocumentId },
    data: {
      status: "validated",
      knowledgeSourceId: ks.id,
    },
  });

  return { knowledgeSourceId: ks.id, title: ks.title };
}
