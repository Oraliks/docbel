// Logique partagée entre le script CLI (scripts/apply-c1-improvements.ts) et
// la route admin (app/api/admin/pdf-forms/apply-c1-improvements/route.ts) —
// un seul jeu de cibles et une seule fonction d'application, pour que les
// deux points d'entrée ne puissent jamais diverger.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyC1Improvements, C1_TRIGGERS } from "./c1-fields-improvements";
import { applyC1RegisImprovements } from "./c1-regis-fields";
import { applyC1PartenaireImprovements } from "./c1-partenaire-fields";
import { applyC1AImprovements } from "./c1a-fields";
import { applyC1BImprovements } from "./c1b-fields";
import { applyC1CImprovements } from "./c1c-fields";
import { applyC46Improvements } from "./c46-fields";
import { applyC47Improvements } from "./c47-fields";
import type { AcroFieldRaw, PdfFormField, PdfFormTrigger } from "../types";
import { planSeedSync } from "./sync-plan";

export interface C1ImprovementTarget {
  slug: string;
  improve: (
    fields: PdfFormField[],
    context?: { technicalSchema: AcroFieldRaw[] },
  ) => PdfFormField[];
  triggers: PdfFormTrigger[];
}

export const C1_IMPROVEMENT_TARGETS: C1ImprovementTarget[] = [
  {
    slug: "c1-changement-situation",
    improve: (fields, context) =>
      applyC1Improvements(fields, {
        defaultMotif: "modification",
        restrictMotifTo5Situations: true,
        technicalSchema: context?.technicalSchema,
      }),
    triggers: C1_TRIGGERS,
  },
  { slug: "c1-regis", improve: applyC1RegisImprovements, triggers: [] },
  { slug: "c1-partenaire", improve: applyC1PartenaireImprovements, triggers: [] },
  { slug: "c1a", improve: applyC1AImprovements, triggers: [] },
  { slug: "c1b", improve: applyC1BImprovements, triggers: [] },
  { slug: "c1c", improve: applyC1CImprovements, triggers: [] },
  { slug: "c46", improve: applyC46Improvements, triggers: [] },
  { slug: "c47", improve: applyC47Improvements, triggers: [] },
];

/// Slugs des 8 formulaires semés — source de vérité pour verrouiller leur
/// édition admin côté schéma (S5 de l'audit du 2026-08-01). N'importer ce
/// module que côté serveur : il tire les fonctions `improve` (lourdes) de
/// chaque document en plus de Prisma.
export const SEEDED_SLUGS = C1_IMPROVEMENT_TARGETS.map((t) => t.slug);

export interface ApplyC1ImprovementResult {
  slug: string;
  /// `unchanged` : le seed produit exactement ce qui est déjà en base, rien
  /// n'a été écrit. `conflict` : la ligne a bougé entre la lecture et
  /// l'écriture (une autre session a gagné la course) — rien n'a été écrit
  /// non plus, le re-semis est à relancer.
  status: "applied" | "previewed" | "not_found" | "unchanged" | "conflict";
  formId?: string;
  /// Version telle que lue AVANT l'opération.
  version?: number;
  fieldsBefore?: number;
  fieldsAfter?: number;
  triggersBefore?: number;
  triggersAfter?: number;
  // --- Traçabilité du re-semis (S6) ---
  fieldsChanged?: boolean;
  triggersChanged?: boolean;
  /// Id de la `PdfFormRevision` créée — présent uniquement quand les champs
  /// ont réellement changé (un instantané ne se justifie que là).
  revisionId?: string;
  /// Version après écriture (incrémentée seulement avec une révision).
  newVersion?: number;
}

/// Prévisualise (apply=false) ou applique réellement (apply=true) les
/// améliorations pour une cible. Ne mute la DB que si `apply` est vrai.
export async function applyOneC1Improvement(
  target: C1ImprovementTarget,
  apply: boolean,
): Promise<ApplyC1ImprovementResult> {
  const form = await prisma.pdfForm.findUnique({
    where: { slug: target.slug },
    select: {
      id: true,
      version: true,
      fields: true,
      triggers: true,
      technicalSchema: true,
      // Instantané de révision + verrou optimiste (S6).
      sourceSha256: true,
      sourceFileName: true,
      updatedAt: true,
    },
  });
  if (!form) {
    return { slug: target.slug, status: "not_found" };
  }

  const current = (form.fields as unknown as PdfFormField[]) || [];
  const technicalSchema =
    (form.technicalSchema as unknown as AcroFieldRaw[]) || [];
  const improved = target.improve(current, { technicalSchema });
  const plan = planSeedSync({
    existingFields: form.fields,
    improvedFields: improved,
    existingTriggers: form.triggers,
    targetTriggers: target.triggers,
  });
  const result: ApplyC1ImprovementResult = {
    slug: target.slug,
    status: apply ? "applied" : "previewed",
    formId: form.id,
    version: form.version,
    fieldsBefore: current.length,
    fieldsAfter: improved.length,
    triggersBefore: Array.isArray(form.triggers) ? form.triggers.length : 0,
    triggersAfter: target.triggers.length,
    fieldsChanged: plan.fieldsChanged,
    triggersChanged: plan.triggersChanged,
  };

  if (!apply) return result;

  // Sync sans effet : on n'écrit RIEN. Toucher la ligne pour y remettre le
  // même contenu décalerait `updatedAt`, qui n'est pas décoratif — c'est le
  // jeton du verrou optimiste du PATCH admin, et `checkPublishable` s'en sert
  // pour juger un brouillon visuel « modifié depuis la dernière
  // matérialisation ». Un re-semis à vide rendait donc un formulaire à champs
  // visuels non publiable.
  if (!plan.needsWrite) return { ...result, status: "unchanged" };

  try {
    const written = await prisma.$transaction(async (tx) => {
      let revisionId: string | undefined;
      // Instantané de l'état AVANT, comme le PATCH admin : sans lui, un
      // re-semis était irréversible et muet — impossible de savoir ce qu'il
      // avait changé, ni de revenir en arrière.
      if (plan.needsRevision) {
        const revision = await tx.pdfFormRevision.create({
          data: {
            formId: form.id,
            version: form.version,
            fields: form.fields as Prisma.InputJsonValue,
            technicalSchema: form.technicalSchema as Prisma.InputJsonValue,
            sourceSha256: form.sourceSha256,
            sourceFileName: form.sourceFileName,
            changeType: "seed_sync",
            changeNotes: `re-semis ${target.slug}`,
            // `createdBy` reste null : un re-semis n'a pas d'auteur humain,
            // qu'il vienne du script CLI ou de la route admin.
          },
        });
        revisionId = revision.id;
      }
      // `updatedAt` dans le `where` : si une autre session a écrit entre le
      // findUnique et ici, aucune ligne ne matche → P2025 → transaction
      // annulée (pas de révision orpheline) et rien n'est écrasé.
      const updated = await tx.pdfForm.update({
        where: { id: form.id, updatedAt: form.updatedAt },
        data: {
          fields: improved as unknown as Prisma.InputJsonValue,
          triggers: target.triggers as unknown as Prisma.InputJsonValue,
          ...(plan.needsRevision ? { version: form.version + 1 } : {}),
        },
        select: { version: true },
      });
      return { revisionId, newVersion: updated.version };
    });
    return { ...result, revisionId: written.revisionId, newVersion: written.newVersion };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      // Course perdue : on le dit au lieu de faire échouer tout le re-semis —
      // les autres cibles doivent pouvoir continuer.
      return { ...result, status: "conflict" };
    }
    throw err;
  }
}

/// Exécute toutes les cibles dans l'ordre, séquentiellement.
export async function applyAllC1Improvements(apply: boolean): Promise<ApplyC1ImprovementResult[]> {
  const results: ApplyC1ImprovementResult[] = [];
  for (const target of C1_IMPROVEMENT_TARGETS) {
    results.push(await applyOneC1Improvement(target, apply));
  }
  return results;
}
