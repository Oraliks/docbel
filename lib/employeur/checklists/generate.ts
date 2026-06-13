/**
 * Construction (pure) des items d'une checklist : choix de la catégorie, fusion
 * des items de modèle + des items émis par le moteur de règles, dédoublonnage
 * par titre et tri par priorité. Aucune dépendance Prisma (testable).
 */
import { PRIORITY_RANK, type ChecklistCategory, type ItemPriority } from "../constants";
import type { EngineChecklistItem } from "../rules/engine";
import { getTemplateItems } from "./templates";

export interface ItemDraft {
  title: string;
  description?: string;
  priority: ItemPriority;
  sourceCode?: string;
  tooltip?: string;
  legalBasisRef?: string;
  /** Code de la règle qui a émis l'item ; null pour un item de modèle. */
  ruleCode: string | null;
}

/** Catégorie de checklist déduite du profil (MVP : 2 catégories). */
export function pickCategory(profile: { hasEmployees?: boolean | null }): ChecklistCategory {
  // hasEmployees false ou inconnu → on traite comme premier engagement.
  return profile.hasEmployees ? "engagement_classique" : "premier_engagement";
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Fusionne items de modèle + items de règles, dédoublonne par titre normalisé
 * (la 1re occurrence gagne), puis trie par priorité (obligatoire en tête).
 */
export function buildItemDrafts(
  category: ChecklistCategory,
  engineItems: EngineChecklistItem[]
): ItemDraft[] {
  const templateDrafts: ItemDraft[] = getTemplateItems(category).map((t) => ({
    title: t.title,
    description: t.description,
    priority: t.priority,
    sourceCode: t.sourceCode,
    tooltip: t.tooltip,
    ruleCode: null,
  }));

  const engineDrafts: ItemDraft[] = engineItems.map((i) => ({
    title: i.title,
    description: i.description,
    priority: i.priority,
    sourceCode: i.sourceCode,
    tooltip: i.tooltip,
    legalBasisRef: i.legalBasisRef,
    ruleCode: i.ruleCode,
  }));

  const seen = new Set<string>();
  const merged: ItemDraft[] = [];
  for (const draft of [...templateDrafts, ...engineDrafts]) {
    const key = normalizeTitle(draft.title);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(draft);
  }

  // Tri stable par priorité.
  return merged
    .map((d, idx) => ({ d, idx }))
    .sort((a, b) => PRIORITY_RANK[a.d.priority] - PRIORITY_RANK[b.d.priority] || a.idx - b.idx)
    .map(({ d }) => d);
}
