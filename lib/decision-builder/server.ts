/// Logique métier serveur du Decision Builder (avec Prisma). Extraite des routes
/// pour être appelable directement (smoke script, tests d'intégration) sans
/// passer par HTTP/auth. Les routes restent fines : auth + parsing + délégation.
///
/// NB : pas de `import "server-only"` ici (contrairement à d'autres modules
/// serveur du repo) car ce module doit rester importable par les scripts tsx —
/// même choix que `lib/prisma.ts`. L'import de Prisma le rend server-only en
/// pratique (il planterait dans un bundle client).

import type { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { trackDecisionTreeEvent } from "./analytics";
import { computeTreeDiff } from "./diff";
import { safeParseTreeContent } from "./schema";
import {
  validateDecisionTree,
  type ValidationReport,
} from "./validator";
import type { DecisionTreeContent } from "./types";

// ---------------------------------------------------------------------------
// Référentiel bundles (pour la validation des résultats)
// ---------------------------------------------------------------------------

/// Slugs de tous les DocumentBundle actifs.
export async function getActiveBundleSlugs(): Promise<Set<string>> {
  const rows = await withDbRetry(() =>
    prisma.documentBundle.findMany({
      where: { active: true },
      select: { slug: true },
    }),
  );
  return new Set(rows.map((r) => r.slug));
}

/// Slugs de bundles actifs SANS aucun item rattaché à un PdfForm
/// (cul-de-sac fonctionnel → warning `missing_form`).
export async function getBundleSlugsWithoutForm(): Promise<Set<string>> {
  const rows = await withDbRetry(() =>
    prisma.documentBundle.findMany({
      where: { active: true },
      select: {
        slug: true,
        items: { where: { pdfFormId: { not: null } }, select: { id: true }, take: 1 },
      },
    }),
  );
  return new Set(rows.filter((r) => r.items.length === 0).map((r) => r.slug));
}

/// Valide un contenu d'arbre contre l'état réel de la DB (bundles existants +
/// bundles sans formulaire).
export async function validateTreeContentAgainstDb(
  content: DecisionTreeContent,
): Promise<ValidationReport> {
  const [active, withoutForm] = await Promise.all([
    getActiveBundleSlugs(),
    getBundleSlugsWithoutForm(),
  ]);
  return validateDecisionTree(content, active, { bundlesWithoutForm: withoutForm });
}

// ---------------------------------------------------------------------------
// Publication
// ---------------------------------------------------------------------------

export type PublishResult =
  | { ok: false; reason: "tree_not_found" }
  | { ok: false; reason: "invalid_content" }
  | { ok: false; reason: "not_publishable"; report: ValidationReport }
  | {
      ok: true;
      report: ValidationReport;
      version: number;
      revisionId: string;
    };

/// Publie le `draftContent` d'un arbre : valide, snapshot dans une révision
/// (avec diff vs le contenu publié précédent), puis met à jour `publishedContent`.
export async function publishTree(
  treeId: string,
  actor: string,
  changeNotes?: string,
  changeType: "minor" | "major" = "minor",
): Promise<PublishResult> {
  const tree = await withDbRetry(() =>
    prisma.decisionTree.findUnique({ where: { id: treeId } }),
  );
  if (!tree) return { ok: false, reason: "tree_not_found" };

  const content = safeParseTreeContent(tree.draftContent);
  if (!content) return { ok: false, reason: "invalid_content" };

  const report = await validateTreeContentAgainstDb(content);
  if (!report.publishable) {
    await trackDecisionTreeEvent("decision_tree_validation_failed", {
      treeId,
      userId: actor,
      metadata: { errors: report.errors.length },
    });
    return { ok: false, reason: "not_publishable", report };
  }

  // Version monotone : dernière révision + 1.
  const last = await withDbRetry(() =>
    prisma.decisionTreeRevision.findFirst({
      where: { treeId },
      orderBy: { version: "desc" },
      select: { version: true },
    }),
  );
  const nextVersion = (last?.version ?? 0) + 1;

  const prevPublished = safeParseTreeContent(tree.publishedContent);
  const diff = computeTreeDiff(prevPublished, content);

  const revision = await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const rev = await tx.decisionTreeRevision.create({
        data: {
          treeId,
          version: nextVersion,
          content: content as unknown as Prisma.InputJsonValue,
          changeType,
          changeNotes: changeNotes ?? null,
          diffSummary: diff as unknown as Prisma.InputJsonValue,
          publishedBy: actor,
        },
      });
      await tx.decisionTree.update({
        where: { id: treeId },
        data: {
          status: "published",
          publishedContent: content as unknown as Prisma.InputJsonValue,
          publishedAt: rev.publishedAt,
          publishedRevisionId: rev.id,
          updatedBy: actor,
        },
      });
      return rev;
    }),
  );

  await logActivity(
    actor,
    "published",
    "decision_tree",
    tree.title,
    treeId,
    `Version ${nextVersion}${changeNotes ? ` — ${changeNotes}` : ""}`,
  );
  await trackDecisionTreeEvent("decision_tree_published", {
    treeId,
    userId: actor,
    metadata: { version: nextVersion },
  });

  return { ok: true, report, version: nextVersion, revisionId: revision.id };
}

// ---------------------------------------------------------------------------
// Restauration d'une révision (= clone vers draft)
// ---------------------------------------------------------------------------

export type RestoreResult =
  | { ok: false; reason: "tree_not_found" | "revision_not_found" }
  | { ok: true; restoredFrom: number };

/// Restaure une révision dans le `draftContent` (jamais d'écrasement direct du
/// `publishedContent` — l'admin doit re-publier explicitement).
export async function restoreRevisionToDraft(
  treeId: string,
  revisionId: string,
  actor: string,
): Promise<RestoreResult> {
  const [tree, revision] = await Promise.all([
    withDbRetry(() => prisma.decisionTree.findUnique({ where: { id: treeId } })),
    withDbRetry(() =>
      prisma.decisionTreeRevision.findUnique({ where: { id: revisionId } }),
    ),
  ]);
  if (!tree) return { ok: false, reason: "tree_not_found" };
  if (!revision || revision.treeId !== treeId) {
    return { ok: false, reason: "revision_not_found" };
  }

  await withDbRetry(() =>
    prisma.decisionTree.update({
      where: { id: treeId },
      data: {
        draftContent: revision.content as unknown as Prisma.InputJsonValue,
        updatedBy: actor,
      },
    }),
  );

  await logActivity(
    actor,
    "restored",
    "decision_tree",
    tree.title,
    treeId,
    `Restauration de la version ${revision.version} vers le brouillon`,
  );
  await trackDecisionTreeEvent("decision_tree_restored", {
    treeId,
    userId: actor,
    metadata: { version: revision.version },
  });

  return { ok: true, restoredFrom: revision.version };
}
