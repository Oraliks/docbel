import type { AudienceId } from "@/lib/audience";

/**
 * Type d'un outil reçu par les composants admin. Construit côté server
 * dans `app/admin/chomage/outils/page.tsx` à partir du modèle Prisma `Tool`.
 */
export interface Tool {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  icon?: string;
  popular: boolean;
  timeMin?: number;
  order: number;
  active: boolean;
  /**
   * Audience hiérarchique legacy. Reste le fallback de `canUseTool` quand
   * `access` est vide (cf. lib/entitlements.ts → effectiveRules).
   */
  audience: AudienceId;
  /**
   * Modèle d'accès set-based (cf. lib/entitlements.ts → AccessRule[]). Un
   * tableau de règles { segment, partnerType? }. Optionnel car le client
   * Prisma régénéré peut ne pas l'exposer tant que db:generate n'a pas tourné,
   * et la page server ne le projette pas encore systématiquement.
   */
  access?: { segment: string; partnerType?: string | null }[];
}

/**
 * Section d'outils (ToolSection en DB), avec ses outils inclus et triés
 * par `order` croissant.
 */
export interface Section {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  order: number;
  tools: Tool[];
}

/**
 * Outil "à plat" pour la table : on aplatit les sections en une seule liste
 * et on rapatrie le nom/id de section sur chaque ligne (la section devient
 * la colonne "Catégorie", remplaçant le groupement par section).
 */
export interface FlatTool extends Tool {
  sectionId: string;
  sectionName: string;
}

/**
 * Compteurs affichés dans la barre de stats. Aux 4 globaux (total/actifs/
 * inactifs/populaires) s'ajoutent les compteurs par segment d'accès,
 * calculés via `effectiveRules` (un outil compte pour un segment si ce
 * segment figure dans ses règles effectives).
 */
export interface ToolCounts {
  total: number;
  active: number;
  inactive: number;
  popular: number;
  citoyen: number;
  employeur: number;
  partenaire: number;
}

/**
 * Filtre principal de la barre de tabs (refonte 2026-05) — combine statut
 * (actif/inactif) ET vue "populaires", car ce sont les 3 axes de tri rapides
 * pour un admin qui veut vérifier sa vitrine publique en un coup d'œil.
 */
export type StatusFilter = "all" | "active" | "inactive" | "popular";

/** Critère de tri à l'intérieur d'une section. */
export type SortKey = "category" | "name" | "recent";
