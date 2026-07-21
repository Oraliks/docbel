import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { localizeRecords } from "@/lib/i18n/content";
import { LandingHero } from "@/components/docbel/landing/hero";
import { LandingToolsRow } from "@/components/docbel/landing/tools-row";
import { ResumeStrip } from "@/components/docbel/landing/resume-strip";
import { TrustBand } from "@/components/docbel/landing/trust-band";
import { WizardTeaser } from "@/components/docbel/landing/wizard-teaser";
import { getAudienceFromPath } from "@/lib/audience";
import { type NewsItem } from "@/lib/docbel-data";
import { filterByAudience, getPublicCatalog } from "@/lib/outils-catalog";
import { loadActiveBundleRun } from "@/lib/landing/resume";
import { formatDate } from "@/lib/i18n/format";

export const dynamic = "force-dynamic";

/**
 * Accueil — Server Component.
 *
 * Les données critiques (news en avant + outils actifs) sont fetchées côté
 * serveur, en parallèle, et rendues dans le HTML initial → meilleur LCP, pas
 * de flash de chargement, zéro fetch client au premier paint (avant : page
 * "use client" avec 2 fetch on-mount sur la route la plus visitée).
 *
 * `.catch(() => [])` sur chaque requête = fail-soft : si la DB hoquette, on
 * affiche tout (outils) / rien (news) plutôt que de casser la page d'accueil.
 * Le persona switcher / la recherche restent des îlots client (header).
 */
export default async function HomePage() {
  const locale = await getLocale();

  const [articles, catalog, activeRun] = await Promise.all([
    prisma.news
      .findMany({
        where: { status: "published", featured: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          slug: true,
          category: true,
          title: true,
          excerpt: true,
          publishedAt: true,
          createdAt: true,
          color: true,
          readingTime: true,
          featured: true,
          image: true,
          heroIllustration: true,
        },
      })
      .catch(() => []),
    // Catalogue d'outils RÉEL (mêmes outils que /outils, DB + entrées statiques),
    // déjà filtré sur active=true. Remplace l'ancienne liste statique TOOLS_DATA
    // → un outil ajouté/activé en admin apparaît automatiquement sur la home.
    getPublicCatalog().catch(() => []),
    // Dossier en cours du visiteur (fail-soft intégré : erreur → null).
    loadActiveBundleRun(),
  ]);

  const localizedArticles = await localizeRecords(
    "News",
    articles,
    ["title", "excerpt"],
    locale,
  );

  // Persona figé pour "/" (citoyen) — le header gère le changement d'espace.
  const persona = getAudienceFromPath("/");
  const citizenTools = filterByAudience(catalog, persona);

  // « Vos outils, en un geste » = uniquement les outils marqués POPULAIRE en
  // admin (étoile sur /admin/chomage/outils). Dynamique : un nouvel outil actif
  // + populaire s'ajoute tout seul ici. Fallback : si aucun n'est marqué
  // populaire, on montre toute la liste citoyen pour ne pas laisser la rangée
  // vide. `totalCount` (sous-titre) reflète le catalogue citoyen complet.
  const importantTools = citizenTools.filter((t) => t.popular);
  const toolsForRow = importantTools.length ? importantTools : citizenTools;

  const news: NewsItem[] = localizedArticles.map((article) => ({
    id: article.id,
    slug: article.slug,
    tag: article.category,
    title: article.title,
    desc: article.excerpt,
    // publishedAt si dispo, sinon createdAt → une date réelle s'affiche toujours
    // dans le hero/listing (un article publié sans publishedAt reste daté).
    date: formatDate(
      (article.publishedAt ?? article.createdAt).toISOString(),
      locale,
    ),
    color: article.color,
    readingTime: article.readingTime ?? undefined,
    popular: article.featured,
    // Image unique = illustration (hero) ; repli sur l'image héritée (legacy).
    image: article.heroIllustration ?? article.image ?? undefined,
  }));

  // Les 5 premières « unes » alimentent le carrousel du hero (points de nav).
  const featuredArticles = news.slice(0, 5);

  return (
    <>
      {activeRun && <ResumeStrip run={activeRun} />}
      <LandingHero articles={featuredArticles} loading={false} />
      <WizardTeaser />
      <LandingToolsRow tools={toolsForRow} />
      <TrustBand />
    </>
  );
}
