import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { localizeRecords } from "@/lib/i18n/content";
import {
  parseBundleWarnings,
  parseOfficialSources,
  parseStringArray,
  parseWarningLevel,
} from "@/lib/bundles/types";
import type { WizardCatalog } from "@/lib/dossier-wizard/derive-results";
import { WIZARD_SITUATIONS } from "@/lib/dossier-wizard/config";
import { loadPublishedDecisionTree } from "@/lib/decision-builder/loader";
import { loadActiveBundleRuns } from "@/lib/landing/resume";
import { getDossier } from "@/lib/dossiers/registry";
import { deriveDossierDiscoveryMetadata } from "@/lib/dossiers/discovery";
import { MonDossierClient, type MonDossierBundle } from "./mon-dossier-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.dossier");
  return {
    title: t("monDossierMetaTitle"),
    description: t("monDossierMetaDescription"),
  };
}

export const dynamic = "force-dynamic";

export default async function MonDossierPage({
  searchParams,
}: {
  searchParams: Promise<{ situation?: string }>;
}) {
  const { situation } = await searchParams;
  // Fail-soft : si la base est froide (Neon) ou indisponible, on rend une page
  // vide plutôt qu'une 500. Même pattern que /creer-ma-demande.
  const bundles = await prisma.documentBundle
    .findMany({
      where: { active: true },
      orderBy: [{ showOnOnboarding: "desc" }, { order: "asc" }, { name: "asc" }],
      take: 100,
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        color: true,
        icon: true,
        lifeEventCategory: true,
        createdAt: true,
        showOnOnboarding: true,
        organism: true,
        vocabularyTags: true,
        keywords: true,
        synonyms: true,
        warnings: true,
        requiredDocuments: true,
        relatedBundles: true,
        estimatedTime: true,
        warningLevel: true,
        officialSources: true,
        lastVerifiedAt: true,
        items: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            required: true,
            pdfForm: {
              select: {
                slug: true,
                title: true,
                issuer: true,
                status: true,
                active: true,
              },
            },
          },
        },
      },
    })
    .catch(() => []);

  const locale = await getLocale();
  const localizedBundles = await localizeRecords(
    "DocumentBundle",
    bundles,
    ["name", "description"],
    locale,
  );

  const discoveryBySlug = new Map(
    localizedBundles.map((bundle) => [
      bundle.slug,
      deriveDossierDiscoveryMetadata(bundle, getDossier(bundle.slug)),
    ]),
  );

  const serializable: MonDossierBundle[] = localizedBundles.map((bundle) => {
    const discovery = discoveryBySlug.get(bundle.slug)!;
    return {
      slug: bundle.slug,
      name: bundle.name,
      description: bundle.description,
      color: bundle.color,
      icon: bundle.icon,
      lifeEventCategory: bundle.lifeEventCategory,
      itemCount: discovery.documentCount,
      createdAt: bundle.createdAt ? bundle.createdAt.toISOString() : null,
      popular: bundle.showOnOnboarding,
      organism: discovery.organism,
      vocabularyTags: discovery.vocabularyTags,
      keywords: parseStringArray(bundle.keywords),
      synonyms: parseStringArray(bundle.synonyms),
    };
  });

  // Catalogue passé au wizard pour résoudre documents/points/proches.
  const catalog: WizardCatalog = {};
  for (const bundle of localizedBundles) {
    const discovery = discoveryBySlug.get(bundle.slug)!;
    catalog[bundle.slug] = {
      slug: bundle.slug,
      name: bundle.name,
      organism: discovery.organism,
      requiredDocuments: discovery.requiredDocuments,
      points: parseBundleWarnings(bundle.warnings).map((w) => w.title),
      warningLevel: parseWarningLevel(bundle.warningLevel),
      estimatedTime: bundle.estimatedTime ?? null,
      relatedBundles: parseStringArray(bundle.relatedBundles),
      available: true, // la requête ne ramène que des bundles actifs
      officialSources: parseOfficialSources(bundle.officialSources),
      lastVerifiedAt: bundle.lastVerifiedAt
        ? bundle.lastVerifiedAt.toISOString()
        : null,
    };
  }

  // Dernier dossier local en cours (zone « Reprendre »). On ignore le cookie de
  // fermeture de la bande home : ici c'est une zone permanente, pas une bande.
  const activeRuns = await loadActiveBundleRuns({ respectDismiss: false });

  // Decision Builder (phase 6) : si un arbre est publié pour le segment chômage
  // ET que le flag runtime est actif, il pilote le wizard ; sinon fallback sur
  // la config TS `WIZARD_SITUATIONS` (try/catch dans le loader → zéro régression).
  const dbSituations = await loadPublishedDecisionTree("chomage");
  const situations = dbSituations ?? WIZARD_SITUATIONS;

  return (
    <MonDossierClient
      bundles={serializable}
      catalog={catalog}
      activeRuns={activeRuns}
      situations={situations}
      initialSituation={situation ?? null}
    />
  );
}
