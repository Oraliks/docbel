/**
 * Types pour la page d'overview admin /admin/news (refonte 2026-05).
 *
 * Le shape de `NewsItem` est aligné sur la réponse de `GET /api/news` côté
 * admin (`ADMIN_LIST_FIELDS`) — voir `app/api/news/route.ts`. Les dates
 * arrivent sérialisées (ISO string) car l'API renvoie du JSON.
 */

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  categoryColor?: string;
  color: string;
  emoji: string;
  status: string;
  featured?: boolean;
  image?: string | null;
  readingTime?: number | null;
  views: number;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Valeur du filtre statut dans la barre de tabs. "all" = pas de filtre,
 * les autres valeurs matchent `NewsItem["status"]`.
 */
export type NewsStatusFilter =
  | "all"
  | "published"
  | "draft"
  | "scheduled"
  | "archived";

/**
 * Compteurs globaux — calculés sur la liste totale (non filtrée), utilisés
 * dans les stat cards et les labels de tabs.
 */
export interface NewsCounts {
  total: number;
  published: number;
  draft: number;
  scheduled: number;
  archived: number;
}
