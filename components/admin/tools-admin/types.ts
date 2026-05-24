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

/** Statut filtrable côté UI. */
export type StatusFilter = "all" | "active" | "inactive";

/** Critère de tri à l'intérieur d'une section. */
export type SortKey = "category" | "name" | "recent";
