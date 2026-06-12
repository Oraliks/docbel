import { prisma } from "@/lib/prisma";
import { LandingBottom, type PopularBundle } from "@/components/docbel/landing/bottom";
import { LandingHero } from "@/components/docbel/landing/hero";
import { LandingToolsRow } from "@/components/docbel/landing/tools-row";
import { HeroSearch } from "@/components/docbel/landing/hero-search";
import { ResumeStrip } from "@/components/docbel/landing/resume-strip";
import { TrustBand } from "@/components/docbel/landing/trust-band";
import { WizardTeaser } from "@/components/docbel/landing/wizard-teaser";
import { getAudienceFromPath } from "@/lib/audience";
import {
  type NewsItem,
  TOOLS_DATA,
  getToolsByAudience,
  getToolSlug,
} from "@/lib/docbel-data";
import { loadActiveBundleRun } from "@/lib/landing/resume";
import { fetchAllToolsActive } from "@/lib/tools-active";

export const dynamic = "force-dynamic";

const MONTH_LABELS = [
  "JAN",
  "FÉV",
  "MARS",
  "AVR",
  "MAI",
  "JUIN",
  "JUIL",
  "AOÛT",
  "SEPT",
  "OCT",
  "NOV",
  "DÉC",
];

function formatFrenchDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${String(parsed.getDate()).padStart(2, "0")} ${
    MONTH_LABELS[parsed.getMonth()]
  } ${String(parsed.getFullYear()).slice(2)}`;
}

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
  const [articles, toolRows, bundleRows, activeRun, documentsCount, issuerRows] =
    await Promise.all([
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
          },
        })
        .catch(() => []),
      fetchAllToolsActive().catch(() => []),
      // Dossiers populaires (vrais DocumentBundle) — même pattern fail-soft
      // que /mon-dossier : DB indisponible → liste vide, la home tient debout.
      prisma.documentBundle
        .findMany({
          where: { active: true },
          orderBy: [{ showOnOnboarding: "desc" }, { order: "asc" }, { name: "asc" }],
          take: 4,
          select: {
            slug: true,
            name: true,
            color: true,
            lifeEventCategory: true,
            items: { select: { id: true } },
          },
        })
        .catch(() => []),
      // Dossier en cours du visiteur (fail-soft intégré : erreur → null).
      loadActiveBundleRun(),
      // Compteurs de la bande de confiance (chiffres réels, fail-soft → 0/[]).
      prisma.pdfForm
        .count({ where: { status: "published", active: true } })
        .catch(() => 0),
      // Organismes émetteurs distincts des documents publiés (champ texte
      // `issuer` — les vides sont filtrés plus bas).
      prisma.pdfForm
        .findMany({
          where: { status: "published", active: true, issuer: { not: null } },
          select: { issuer: true },
          distinct: ["issuer"],
        })
        .catch(() => [] as { issuer: string | null }[]),
    ]);

  const inactiveSlugs = new Set(
    toolRows.filter((r) => !r.active).map((r) => r.slug)
  );

  // Persona figé pour "/" (citoyen) — le header gère le changement d'espace.
  const persona = getAudienceFromPath("/");
  const audienceTools = getToolsByAudience(persona);
  const base = audienceTools.length ? audienceTools : TOOLS_DATA;
  const tools = base.filter((t) => !inactiveSlugs.has(getToolSlug(t)));

  // Bande de confiance : outils = catalogue site entier (toutes audiences),
  // pas le sous-ensemble persona affiché dans la rangée ; organismes = issuers
  // distincts non vides. TrustBand masque tout compteur à 0 (fail-soft DB).
  const activeToolsCount = TOOLS_DATA.filter(
    (t) => !inactiveSlugs.has(getToolSlug(t)),
  ).length;
  const organismesCount = issuerRows.filter(
    (row) => row.issuer && row.issuer.trim(),
  ).length;

  const news: NewsItem[] = articles.map((article) => ({
    id: article.id,
    slug: article.slug,
    tag: article.category,
    title: article.title,
    desc: article.excerpt,
    // publishedAt si dispo, sinon createdAt → une date réelle s'affiche toujours
    // dans le hero/listing (un article publié sans publishedAt reste daté).
    date: formatFrenchDate(
      (article.publishedAt ?? article.createdAt).toISOString(),
    ),
    color: article.color,
    readingTime: article.readingTime ?? undefined,
    popular: article.featured,
    image: article.image ?? undefined,
  }));

  // Les 5 premières « unes » alimentent le carrousel du hero (points de nav).
  const featuredArticles = news.slice(0, 5);

  // Sérialisation minimale pour le panneau « Dossiers populaires ».
  const popularBundles: PopularBundle[] = bundleRows.map((bundle) => ({
    slug: bundle.slug,
    name: bundle.name,
    color: bundle.color,
    lifeEventCategory: bundle.lifeEventCategory,
    itemCount: bundle.items.length,
  }));

  return (
    <>
      {activeRun && <ResumeStrip run={activeRun} />}
      <LandingHero articles={featuredArticles} loading={false} />
      <HeroSearch />
      <LandingToolsRow tools={tools} />
      <WizardTeaser />
      <TrustBand
        stats={{
          documents: documentsCount,
          outils: activeToolsCount,
          organismes: organismesCount,
        }}
      />
      <LandingBottom news={news} loading={false} bundles={popularBundles} />
    </>
  );
}
