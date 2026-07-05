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
import type { PdfFormField, PdfFormTrigger } from "../types";

export interface C1ImprovementTarget {
  slug: string;
  improve: (fields: PdfFormField[]) => PdfFormField[];
  triggers: PdfFormTrigger[];
}

export const C1_IMPROVEMENT_TARGETS: C1ImprovementTarget[] = [
  { slug: "c1", improve: applyC1Improvements, triggers: C1_TRIGGERS },
  { slug: "c1-insertion", improve: applyC1Improvements, triggers: C1_TRIGGERS },
  {
    slug: "c1-changement-situation",
    improve: (fields) => applyC1Improvements(fields, { defaultMotif: "modification" }),
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

export interface ApplyC1ImprovementResult {
  slug: string;
  status: "applied" | "previewed" | "not_found";
  formId?: string;
  version?: number;
  fieldsBefore?: number;
  fieldsAfter?: number;
  triggersBefore?: number;
  triggersAfter?: number;
}

/// Prévisualise (apply=false) ou applique réellement (apply=true) les
/// améliorations pour une cible. Ne mute la DB que si `apply` est vrai.
export async function applyOneC1Improvement(
  target: C1ImprovementTarget,
  apply: boolean,
): Promise<ApplyC1ImprovementResult> {
  const form = await prisma.pdfForm.findUnique({
    where: { slug: target.slug },
    select: { id: true, version: true, fields: true, triggers: true },
  });
  if (!form) {
    return { slug: target.slug, status: "not_found" };
  }

  const current = (form.fields as unknown as PdfFormField[]) || [];
  const improved = target.improve(current);
  const result: ApplyC1ImprovementResult = {
    slug: target.slug,
    status: apply ? "applied" : "previewed",
    formId: form.id,
    version: form.version,
    fieldsBefore: current.length,
    fieldsAfter: improved.length,
    triggersBefore: Array.isArray(form.triggers) ? form.triggers.length : 0,
    triggersAfter: target.triggers.length,
  };

  if (!apply) return result;

  await prisma.pdfForm.update({
    where: { id: form.id },
    data: {
      fields: improved as unknown as Prisma.InputJsonValue,
      triggers: target.triggers as unknown as Prisma.InputJsonValue,
    },
  });
  return result;
}

/// Exécute toutes les cibles dans l'ordre, séquentiellement.
export async function applyAllC1Improvements(apply: boolean): Promise<ApplyC1ImprovementResult[]> {
  const results: ApplyC1ImprovementResult[] = [];
  for (const target of C1_IMPROVEMENT_TARGETS) {
    results.push(await applyOneC1Improvement(target, apply));
  }
  return results;
}
