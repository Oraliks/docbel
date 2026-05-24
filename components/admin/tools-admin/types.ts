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
  audience: AudienceId;
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
 * Filtre principal de la barre de tabs (refonte 2026-05) — combine statut
 * (actif/inactif) ET vue "populaires", car ce sont les 3 axes de tri rapides
 * pour un admin qui veut vérifier sa vitrine publique en un coup d'œil.
 */
export type StatusFilter = "all" | "active" | "inactive" | "popular";

/** Critère de tri à l'intérieur d'une section. */
export type SortKey = "category" | "name" | "recent";
