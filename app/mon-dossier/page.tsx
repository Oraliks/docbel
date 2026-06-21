import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { parseStringArray } from "@/lib/bundles/types";
import { MonDossierClient, type MonDossierBundle } from "./mon-dossier-client";

export const metadata: Metadata = {
  title: "Mon dossier — beldoc",
  description:
    "Créez ou retrouvez le bon dossier administratif belge : laissez-vous guider en quelques questions, ou accédez directement au dossier dont vous avez besoin.",
};

export const dynamic = "force-dynamic";

export default async function MonDossierPage() {
  // Fail-soft : si la base est froide (Neon) ou indisponible, on rend une page
  // vide plutôt qu'une 500. Même pattern que /creer-ma-demande.
  const bundles = await prisma.documentBundle
    .findMany({
      where: { active: true },
      orderBy: [{ showOnOnboarding: "desc" }, { order: "asc" }, { name: "asc" }],
      take: 100,
      select: {
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
        items: { select: { id: true } },
      },
    })
    .catch(() => []);

  const serializable: MonDossierBundle[] = bundles.map((bundle) => ({
    slug: bundle.slug,
    name: bundle.name,
    description: bundle.description,
    color: bundle.color,
    icon: bundle.icon,
    lifeEventCategory: bundle.lifeEventCategory,
    itemCount: bundle.items.length,
    createdAt: bundle.createdAt ? bundle.createdAt.toISOString() : null,
    popular: bundle.showOnOnboarding,
    organism: bundle.organism,
    vocabularyTags: parseStringArray(bundle.vocabularyTags),
    keywords: parseStringArray(bundle.keywords),
    synonyms: parseStringArray(bundle.synonyms),
  }));

  return <MonDossierClient bundles={serializable} />;
}
