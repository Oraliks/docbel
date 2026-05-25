import { NewsOverviewShell } from "@/components/admin/news/overview/news-overview-shell";

/**
 * Page d'overview admin des articles (refonte 2026-05).
 *
 * Server component minimaliste : auth + role check sont assurés par
 * `app/admin/layout.tsx`. Toute la logique de fetch / filtrage / mutations
 * vit dans `<NewsOverviewShell />` (client).
 *
 * Le data fetching est volontairement client (pas SSR) car l'admin a besoin
 * d'un refresh dynamique après chaque mutation (création, suppression,
 * duplication) et la stack existante `GET /api/news` est riche (status
 * counts, sort, search) — ré-implémenter en RSC ajouterait du bruit sans
 * gain UX notable.
 *
 * Le détail / édition vit dans /admin/news/[newsId] — chaque card de
 * l'overview est cliquable vers cette page.
 *
 * Pages adjacentes (boutons en header du shell) :
 *   - /admin/news/stats      : vue stats détaillée
 *   - /admin/news/categories : gestion des catégories
 *   - /admin/news/new        : création d'un nouvel article
 */
export const dynamic = "force-dynamic";

export default function NewsAdminPage() {
  return <NewsOverviewShell />;
}
