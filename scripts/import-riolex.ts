// =====================================================================
//  Import — corpus légal RioLex (réglementation ONEM chômage).
// ---------------------------------------------------------------------
//  Lit tous les fichiers `private/riolex/staging/*.json` qui contiennent
//  un tableau `articles`, valide chaque article avec Zod, puis crée/met à
//  jour des `KnowledgeSource` idempotentes (clé = legalMeta.riolexId + version).
//
//  Réutilise le pipeline existant :
//    - `extractLegalReferences` (lib/chomage-ia/legal-refs.ts) pour pré-calculer
//      les renvois légaux du texte → stockés dans legalMeta.refs.
//    - `indexKnowledgeSource` (lib/chomage-ia/indexer.ts) pour chunk+embed après
//      upsert. Fail-soft : si pas de provider d'embeddings, l'échec est loggé et
//      l'import continue (le chat retombe sur le fallback KB complète).
//
//  Modèle d'accès (colonnes migration RioLex sur KnowledgeSource) :
//    - visibility="partner" pour le texte de loi (partenaires + admin) ;
//    - visibility="admin"   pour le commentaire ONEM (source SÉPARÉE, jamais
//      mélangée au texte public), clé `riolexId + "#comment"`.
//
//  ⚠️ DB Neon PARTAGÉE. Ce script fait des upserts idempotents (pas de
//  `db push`, pas de DDL). Toujours lancer d'abord un `--dry-run` pour valider
//  le parsing sans écrire.
//
//  Lancement :
//    - dry-run (parse + rapport, AUCUNE écriture DB ni indexation) :
//        pnpm dlx tsx scripts/import-riolex.ts --dry-run
//        (ou : pnpm exec tsx scripts/import-riolex.ts --dry-run)
//    - import réel (nécessite DATABASE_URL, cf. .env.local) :
//        pnpm exec dotenv -e .env.local -- tsx scripts/import-riolex.ts
// =====================================================================

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
//  Configuration
// ─────────────────────────────────────────────────────────────────────

const STAGING_DIR = join(process.cwd(), "private", "riolex", "staging");
const DOMAIN = "chomage";
const ROOT_FOLDER_NAME = "Réglementation ONEM (RioLex)";

/** Reconstruit l'URL publique d'une fiche RioLex à partir de son id. */
function riolexUrl(riolexId: string): string {
  return `https://rvaonemtech.powerappsportals.com/fr-FR/wetsartikel/?id=${riolexId}`;
}

/**
 * Rangement par TEXTE DE LOI : chaque loi (AR 25/11/1991, AM 26/11/1991,
 * AR 12/06/2024, AR 26/03/2003, Arrêté-loi 28/12/1944, Loi-programme 18/07/2025…)
 * devient un sous-dossier sous la racine « Réglementation ONEM (RioLex) ».
 * Décision Oraliks (2026-07-01) : sous-catégories = textes de loi, pas nature juridique.
 */

// ─────────────────────────────────────────────────────────────────────
//  Schéma Zod du staging (tolère les champs manquants)
// ─────────────────────────────────────────────────────────────────────

const NatureJuridique = z.enum([
  "AR",
  "AM",
  "Loi-programme",
  "Loi",
  "Arrete-loi",
]);

const ArticleSchema = z.object({
  riolexId: z.string().min(1),
  url: z.string().optional(),
  loi: z.string().min(1),
  natureJuridique: NatureJuridique,
  articleNumber: z.string().min(1),
  titre: z.string().optional().default(""),
  texte: z.string().optional().default(""),
  commentaireOnem: z.string().optional().default(""),
  datePublication: z.string().optional().default(""),
  dateEntreeVigueur: z.string().optional().default(""),
  dateMoniteur: z.string().optional().default(""),
  statut: z.string().optional().default(""),
  version: z.string().optional().default(""),
  abroge: z.boolean().optional().default(false),
});

type Article = z.infer<typeof ArticleSchema>;

/** Fichier de staging : on ne s'intéresse qu'aux fichiers avec `articles[]`. */
const StagingFileSchema = z.object({
  articles: z.array(z.unknown()),
});

// ─────────────────────────────────────────────────────────────────────
//  Rapport d'exécution
// ─────────────────────────────────────────────────────────────────────

interface Report {
  filesRead: string[];
  filesSkipped: string[]; // fichiers sans tableau `articles`
  articlesParsed: number;
  created: number;
  updated: number;
  errors: Array<{ ref: string; message: string }>;
  commentSources: number; // sources commentaire ONEM (created+updated)
  indexFailures: Array<{ ref: string; message: string }>;
}

function emptyReport(): Report {
  return {
    filesRead: [],
    filesSkipped: [],
    articlesParsed: 0,
    created: 0,
    updated: 0,
    errors: [],
    commentSources: 0,
    indexFailures: [],
  };
}

// ─────────────────────────────────────────────────────────────────────
//  Lecture + parsing du staging
// ─────────────────────────────────────────────────────────────────────

/**
 * Lit tous les `*.json` du dossier staging et retourne les articles validés.
 * Les fichiers sans tableau `articles` (ex. index.json / catalogue) sont
 * ignorés proprement (ajoutés à `filesSkipped`). Les articles individuels qui
 * ne passent pas la validation Zod sont comptés en `errors` sans planter le run.
 */
async function loadArticles(report: Report): Promise<Article[]> {
  let entries: string[];
  try {
    entries = await readdir(STAGING_DIR);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Impossible de lire le dossier staging ${STAGING_DIR} : ${message}`,
    );
  }

  const jsonFiles = entries.filter((f) => f.toLowerCase().endsWith(".json")).sort();
  const articles: Article[] = [];

  for (const fileName of jsonFiles) {
    const fullPath = join(STAGING_DIR, fileName);
    let raw: string;
    try {
      raw = await readFile(fullPath, "utf8");
    } catch (err) {
      report.errors.push({
        ref: fileName,
        message: `Lecture échouée : ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      report.errors.push({
        ref: fileName,
        message: `JSON invalide : ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    // Un fichier de staging valide a un tableau `articles`. Sinon on l'ignore
    // (catalogue index.json, notes, etc.) sans erreur.
    const fileCheck = StagingFileSchema.safeParse(parsed);
    if (!fileCheck.success) {
      report.filesSkipped.push(fileName);
      continue;
    }

    report.filesRead.push(fileName);

    fileCheck.data.articles.forEach((item, idx) => {
      const res = ArticleSchema.safeParse(item);
      if (!res.success) {
        // Essaie d'extraire un identifiant lisible pour le rapport.
        const maybeId =
          item && typeof item === "object" && "riolexId" in item
            ? String((item as { riolexId: unknown }).riolexId)
            : `${fileName}[#${idx}]`;
        report.errors.push({
          ref: maybeId,
          message: `Validation Zod : ${res.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`,
        });
        return;
      }
      report.articlesParsed++;
      articles.push(res.data);
    });
  }

  return articles;
}

// ─────────────────────────────────────────────────────────────────────
//  Construction des payloads KnowledgeSource
// ─────────────────────────────────────────────────────────────────────

/**
 * Titre de la source texte : `<loi> — Art. <articleNumber>`, ou le `titre`
 * fourni s'il est renseigné et informatif.
 */
function textTitle(a: Article): string {
  const base = `${a.loi} — Art. ${a.articleNumber}`;
  const t = a.titre?.trim();
  if (t && t.length > 0) return `${base} — ${t}`;
  return base;
}

interface SourcePayload {
  key: string; // clé d'idempotence (riolexId ou riolexId#comment)
  title: string;
  content: string;
  summary: string | null;
  sourceUrl: string | null;
  tags: string[];
  visibility: string;
  validityStatus?: string;
  legalMeta: Record<string, unknown>;
}

/**
 * Payload de la source TEXTE (loi) — visibility "partner".
 * `refs` = renvois légaux extraits du texte via le pipeline existant.
 */
function buildTextPayload(
  a: Article,
  extractLegalReferences: (text: string) => string[],
): SourcePayload {
  const refs = extractLegalReferences(a.texte ?? "");
  const legalMeta: Record<string, unknown> = {
    riolexId: a.riolexId,
    loi: a.loi,
    natureJuridique: a.natureJuridique,
    articleNumber: a.articleNumber,
    datePublication: a.datePublication || null,
    dateEntreeVigueur: a.dateEntreeVigueur || null,
    dateMoniteur: a.dateMoniteur || null,
    statut: a.statut || null,
    version: a.version || null,
    abroge: a.abroge,
    refs,
  };

  return {
    key: keyForVersion(a.riolexId, a.version),
    title: textTitle(a),
    content: a.texte ?? "",
    summary: (a.titre?.trim() || textTitle(a)) || null,
    sourceUrl: a.url?.trim() || riolexUrl(a.riolexId),
    tags: [a.natureJuridique, "RioLex", "chomage"],
    visibility: "partner",
    validityStatus: a.abroge ? "obsolete" : undefined,
    legalMeta,
  };
}

/**
 * Payload de la source COMMENTAIRE ONEM — visibility "admin", SÉPARÉE du texte
 * public. Clé `riolexId + "#comment"`. Marquée `isOnemCommentary:true`.
 */
function buildCommentPayload(a: Article): SourcePayload {
  const legalMeta: Record<string, unknown> = {
    riolexId: a.riolexId,
    loi: a.loi,
    natureJuridique: a.natureJuridique,
    articleNumber: a.articleNumber,
    datePublication: a.datePublication || null,
    dateEntreeVigueur: a.dateEntreeVigueur || null,
    dateMoniteur: a.dateMoniteur || null,
    statut: a.statut || null,
    version: a.version || null,
    abroge: a.abroge,
    isOnemCommentary: true,
  };

  return {
    key: keyForVersion(`${a.riolexId}#comment`, a.version),
    title: `${textTitle(a)} — Commentaire ONEM`,
    content: a.commentaireOnem ?? "",
    summary: `Commentaire ONEM — ${textTitle(a)}`,
    sourceUrl: a.url?.trim() || riolexUrl(a.riolexId),
    tags: [a.natureJuridique, "RioLex", "chomage", "commentaire-onem"],
    visibility: "admin",
    validityStatus: a.abroge ? "obsolete" : undefined,
    legalMeta,
  };
}

/**
 * Clé d'idempotence : `riolexId` seul si version vide, sinon `riolexId@version`.
 * Le lookup en DB se fait par `legalMeta.riolexId` (+ version) — cf. upsert.
 */
function keyForVersion(baseId: string, version: string): string {
  return version && version.length > 0 ? `${baseId}@${version}` : baseId;
}

// ─────────────────────────────────────────────────────────────────────
//  Upsert + indexation (import réel uniquement)
// ─────────────────────────────────────────────────────────────────────

/**
 * Upsert idempotent d'une source par `legalMeta.riolexId` (+ version).
 * findFirst puis update, sinon create. Retourne l'id + le mode (created/updated).
 */
async function upsertSource(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  payload: SourcePayload,
  riolexIdForLookup: string,
  version: string,
): Promise<{ id: string; mode: "created" | "updated" }> {
  // Lookup par legalMeta.riolexId (path JSON) — on affine côté JS sur la version
  // pour ne pas dépendre d'un opérateur JSON imbriqué complexe.
  const candidates = await prisma.knowledgeSource.findMany({
    where: {
      domain: DOMAIN,
      legalMeta: { path: ["riolexId"], equals: riolexIdForLookup },
    },
    select: { id: true, legalMeta: true },
    take: 50,
  });

  const wantComment = payload.visibility === "admin";
  const existing = candidates.find((c: { id: string; legalMeta: unknown }) => {
    const meta = (c.legalMeta ?? {}) as Record<string, unknown>;
    const metaVersion = typeof meta.version === "string" ? meta.version : "";
    const isComment = meta.isOnemCommentary === true;
    // Une source texte et sa source commentaire partagent le même riolexId :
    // on les distingue par le flag isOnemCommentary + la version.
    return isComment === wantComment && metaVersion === (version || "");
  });

  const data = {
    title: payload.title,
    kind: "text",
    content: payload.content,
    summary: payload.summary,
    sourceUrl: payload.sourceUrl,
    tags: payload.tags,
    enabled: true,
    domain: DOMAIN,
    visibility: payload.visibility,
    legalMeta: payload.legalMeta,
    ...(payload.validityStatus
      ? { validityStatus: payload.validityStatus }
      : {}),
  };

  if (existing) {
    await prisma.knowledgeSource.update({
      where: { id: existing.id },
      data,
    });
    return { id: existing.id, mode: "updated" };
  }

  const created = await prisma.knowledgeSource.create({ data });
  return { id: created.id, mode: "created" };
}

/**
 * Assure l'existence des KnowledgeFolder (racine + un sous-dossier par TEXTE DE LOI).
 * Idempotent : findFirst par name+domain+parent, create sinon. Retourne une map
 * `loi → folderId`.
 */
async function ensureFolders(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  lois: string[],
): Promise<Map<string, string>> {
  async function ensureFolder(
    name: string,
    parentId: string | null,
  ): Promise<string> {
    const found = await prisma.knowledgeFolder.findFirst({
      where: { name, domain: DOMAIN, parentId: parentId ?? undefined },
      select: { id: true },
    });
    if (found) return found.id;
    const created = await prisma.knowledgeFolder.create({
      data: { name, domain: DOMAIN, parentId },
      select: { id: true },
    });
    return created.id;
  }

  const rootId = await ensureFolder(ROOT_FOLDER_NAME, null);

  // Un sous-dossier par texte de loi distinct (= une sous-catégorie).
  const byLoi = new Map<string, string>();
  for (const loi of lois) {
    if (!loi || byLoi.has(loi)) continue;
    byLoi.set(loi, await ensureFolder(loi, rootId));
  }
  return byLoi;
}

// ─────────────────────────────────────────────────────────────────────
//  Orchestration
// ─────────────────────────────────────────────────────────────────────

async function run(dryRun: boolean): Promise<Report> {
  const report = emptyReport();

  // legal-refs est un module pur (pas d'accès DB) → toujours importé.
  const { extractLegalReferences } = await import(
    "@/lib/chomage-ia/legal-refs"
  );

  const articles = await loadArticles(report);

  if (dryRun) {
    // Simulation : on construit les payloads pour vérifier qu'ils sont bien
    // formés (refs extraites, tags, clés), mais AUCUNE écriture DB.
    for (const a of articles) {
      buildTextPayload(a, extractLegalReferences);
      if ((a.commentaireOnem ?? "").trim().length > 0) {
        buildCommentPayload(a);
        report.commentSources++;
      }
    }
    return report;
  }

  // Import réel : imports lazy pour ne PAS toucher Prisma en dry-run (le module
  // prisma tente de se connecter et exigerait DATABASE_URL).
  const { prisma } = await import("@/lib/prisma");
  const { indexKnowledgeSource } = await import("@/lib/chomage-ia/indexer");

  try {
    const foldersByLoi = await ensureFolders(
      prisma,
      [...new Set(articles.map((a) => a.loi))],
    );

    for (const a of articles) {
      const folderId = foldersByLoi.get(a.loi) ?? null;

      // 1. Source TEXTE (loi) — visibility partner.
      try {
        const textPayload = buildTextPayload(a, extractLegalReferences);
        const res = await upsertSource(
          prisma,
          textPayload,
          a.riolexId,
          a.version || "",
        );
        // folderId appliqué séparément (cf. applyFolder) pour garder
        // upsertSource focalisé sur les champs métier.
        await applyFolder(prisma, res.id, folderId);
        if (res.mode === "created") report.created++;
        else report.updated++;

        // Indexation RAG (chunk+embed). Fail-soft.
        try {
          await indexKnowledgeSource(res.id);
        } catch (err) {
          report.indexFailures.push({
            ref: a.riolexId,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } catch (err) {
        report.errors.push({
          ref: a.riolexId,
          message: `Upsert texte : ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // 2. Source COMMENTAIRE ONEM — visibility admin, SÉPARÉE.
      if ((a.commentaireOnem ?? "").trim().length > 0) {
        try {
          const commentPayload = buildCommentPayload(a);
          const res = await upsertSource(
            prisma,
            commentPayload,
            a.riolexId,
            a.version || "",
          );
          await applyFolder(prisma, res.id, folderId);
          report.commentSources++;
          if (res.mode === "created") report.created++;
          else report.updated++;

          try {
            await indexKnowledgeSource(res.id);
          } catch (err) {
            report.indexFailures.push({
              ref: `${a.riolexId}#comment`,
              message: err instanceof Error ? err.message : String(err),
            });
          }
        } catch (err) {
          report.errors.push({
            ref: `${a.riolexId}#comment`,
            message: `Upsert commentaire : ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  return report;
}

/**
 * Applique le folderId sur une source après upsert. Séparé pour garder
 * `upsertSource` focalisé sur les champs métier.
 */
async function applyFolder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  sourceId: string,
  folderId: string | null,
): Promise<void> {
  if (!folderId) return;
  await prisma.knowledgeSource.update({
    where: { id: sourceId },
    data: { folderId },
  });
}

// ─────────────────────────────────────────────────────────────────────
//  Rapport final + CLI
// ─────────────────────────────────────────────────────────────────────

function printReport(report: Report, dryRun: boolean): void {
  const mode = dryRun ? "DRY-RUN (aucune écriture DB)" : "IMPORT RÉEL";
  console.log("");
  console.log("═════════════════════════════════════════════════════════");
  console.log(`  Import RioLex — ${mode}`);
  console.log("═════════════════════════════════════════════════════════");
  console.log(`  Fichiers lus (avec articles[]) : ${report.filesRead.length}`);
  if (report.filesRead.length > 0) {
    for (const f of report.filesRead) console.log(`      • ${f}`);
  }
  if (report.filesSkipped.length > 0) {
    console.log(
      `  Fichiers ignorés (pas de tableau articles) : ${report.filesSkipped.length}`,
    );
    for (const f of report.filesSkipped) console.log(`      • ${f}`);
  }
  console.log(`  Articles parsés            : ${report.articlesParsed}`);
  if (!dryRun) {
    console.log(`  Sources créées             : ${report.created}`);
    console.log(`  Sources mises à jour       : ${report.updated}`);
  }
  console.log(
    `  Sources commentaire ONEM   : ${report.commentSources}${dryRun ? " (à créer)" : ""}`,
  );
  console.log(`  Erreurs                    : ${report.errors.length}`);
  for (const e of report.errors) {
    console.log(`      ✗ ${e.ref} — ${e.message}`);
  }
  if (!dryRun) {
    console.log(`  Échecs d'indexation        : ${report.indexFailures.length}`);
    for (const f of report.indexFailures) {
      console.log(`      ⚠ ${f.ref} — ${f.message}`);
    }
  }
  console.log("═════════════════════════════════════════════════════════");
  console.log("");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const report = await run(dryRun);
  printReport(report, dryRun);

  // Sortie non-zéro si des erreurs de parsing/upsert (utile en CI). Les échecs
  // d'indexation sont non bloquants (fail-soft du pipeline).
  if (report.errors.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("[import-riolex] échec fatal :", e);
  process.exit(1);
});
