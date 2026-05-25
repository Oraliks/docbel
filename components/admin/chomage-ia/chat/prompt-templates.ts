/**
 * Templates de prompts pré-définis pour le mode "Brief Claude Code"
 * du chat IA (bouton 🪄 dans la barre d'input).
 *
 * Chaque template fournit un `brief` + `contextHint` pré-rempli avec des
 * placeholders entre crochets `[…]` à personnaliser par l'admin. Permet de
 * démarrer rapidement sur les patterns récurrents du projet Beldoc.
 *
 * Étendre la liste : ajouter une entrée à `PROMPT_TEMPLATES` ci-dessous.
 * L'ordre d'affichage suit l'ordre des clés.
 *
 * Convention placeholders :
 *   - `[NOM]`, `[SUJET]`, `[ETC]` à remplacer
 *   - le curseur sera positionné sur le premier `[` rencontré (au moins
 *     sur les navigateurs qui supportent `setSelectionRange`).
 */

import {
  AlertTriangle,
  Bug,
  Calculator,
  Component,
  Database,
  LayoutGrid,
  Paintbrush,
  type LucideIcon,
} from "lucide-react";

export interface PromptTemplate {
  /** ID stable (clé du Record). */
  id: string;
  /** Libellé court affiché dans le sélecteur. */
  label: string;
  /** Description courte (1 ligne) — affichée en sous-titre. */
  hint: string;
  /** Icône Lucide. */
  icon: LucideIcon;
  /** Brief pré-rempli (placeholders [NOM]/[SUJET]). */
  brief: string;
  /** Context hint technique pré-rempli (optionnel). */
  contextHint?: string;
}

/**
 * Catalogue des templates. Order matters : c'est l'ordre d'affichage
 * dans le dropdown.
 *
 * Conventions pour les patterns Beldoc référencés :
 *   - Calculateur : logique dans `lib/calculators/[slug].ts`, UI dans
 *     `components/docbel/calculators/calc-[slug].tsx`, méthodologie
 *     enrichie dans `lib/calculators/_methodology.ts`, debug script
 *     `scripts/debug-[slug].ts`, seed assets `scripts/seed-[slug]-assets.ts`.
 *   - Sources État uniquement (SPF/ONSS/SFP/CREG/Moniteur belge) —
 *     JAMAIS de simulateur privé.
 *   - UI : Shadcn strict, TypeScript strict, < 250 LOC par fichier.
 */
export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  calculator: {
    id: "calculator",
    label: "Calculateur Beldoc",
    hint: "Pattern complet : logique + UI + méthodologie + debug + seed",
    icon: Calculator,
    brief:
      "Crée un calculateur [NOM] pour [SUJET] en suivant strictement le pattern Beldoc :",
    contextHint:
      "Logique dans lib/calculators/[slug].ts, UI dans components/docbel/calculators/calc-[slug].tsx, entrée enrichie dans lib/calculators/_methodology.ts, debug script scripts/debug-[slug].ts, seed assets scripts/seed-[slug]-assets.ts. Pattern UI : layout lg:grid-cols-[3fr_2fr], CountryFlag code='be', export PDF jspdf, badges, footer sources État uniquement (SPF/ONSS/SFP/CREG/Moniteur belge — JAMAIS de simulateur privé).",
  },
  uiRefactor: {
    id: "uiRefactor",
    label: "Refonte UI Shadcn",
    hint: "Refonte/redesign d'une page existante au pattern atomique",
    icon: Paintbrush,
    brief: "Refonte [NOM PAGE] pour : [OBJECTIF]",
    contextHint:
      "Garde le pattern atomique components/admin/[module]/, < 250 LOC par fichier, Shadcn UI strict, TypeScript strict. Préserve API existantes. Pattern récent de référence : components/admin/calculateurs/overview/ (refonte méthodologie compacte).",
  },
  prismaMigration: {
    id: "prismaMigration",
    label: "Migration Prisma",
    hint: "Schéma + migration SQL + génération client + types",
    icon: Database,
    brief:
      "Ajoute [MODÈLE / CHAMP] dans le schema Prisma pour [USE CASE]",
    contextHint:
      "Pattern Beldoc : nommage migration NN_description_kebab, cf historique. Migration créer-only puis manuel resolve si désynchro. Génère le client Prisma. Mets à jour les routes API + types client.",
  },
  adminPage: {
    id: "adminPage",
    label: "Page admin pattern",
    hint: "Page admin /admin/[chemin] complète (header + stats + tabs + cards)",
    icon: LayoutGrid,
    brief: "Crée la page admin /admin/[chemin] pour gérer [RESSOURCE]",
    contextHint:
      "Pattern récent : header compact 1 ligne (cf. compact-ia-header.tsx), stats cards bordure gauche colorée, tabs filtres + search, grille 2-col cards horizontales, AlertDialog pour destructifs, sidebar admin entry.",
  },
  component: {
    id: "component",
    label: "Composant React",
    hint: "Composant Shadcn isolé avec TypeScript strict",
    icon: Component,
    brief: "Crée un composant [NOM] qui [FONCTION]",
    contextHint:
      "Tailwind v4, Shadcn UI, TypeScript strict, < 200 LOC, pas de any.",
  },
  bugFix: {
    id: "bugFix",
    label: "Bug fix",
    hint: "Diagnostic ciblé avant fix — pas de bricolage",
    icon: Bug,
    brief:
      "Bug : [DESCRIPTION]. Symptômes : [QUOI]. Attendu : [QUOI].",
    contextHint:
      "Investigue d'abord avec grep/read avant de modifier. Diagnostic clair puis fix ciblé.",
  },
  audit: {
    id: "audit",
    label: "Audit ciblé",
    hint: "Revue d'un module / pattern existant",
    icon: AlertTriangle,
    brief:
      "Audit [MODULE / FICHIER] : trouve les [BUGS / PERFS / SECURITY] et propose un plan de correction.",
    contextHint:
      "Pas de modif tant que je n'ai pas validé le plan. Liste les findings par sévérité (critical/high/medium/low) + 1 ligne de justification chacune.",
  },
};

/**
 * Liste ordonnée pour l'affichage dans un menu.
 */
export const PROMPT_TEMPLATES_LIST: PromptTemplate[] = Object.values(
  PROMPT_TEMPLATES,
);

/**
 * Positionne le curseur sur le premier `[` rencontré dans une chaîne,
 * pour focaliser le user sur le 1er placeholder à remplir.
 *
 * Utilisé par `chat-input-bar` après l'application d'un template.
 *
 * @returns L'index du `[`, ou la longueur de la chaîne si aucun placeholder.
 */
export function firstPlaceholderIndex(text: string): number {
  const idx = text.indexOf("[");
  return idx === -1 ? text.length : idx;
}
