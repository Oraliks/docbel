import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
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
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: { items: { select: { id: true } } },
    })
    .catch(() => []);

  const serializable: MonDossierBundle[] = bundles.map((b) => ({
    slug: b.slug,
    name: b.name,
    description: b.description,
    color: b.color,
    icon: b.icon,
    lifeEventCategory: b.lifeEventCategory,
    itemCount: b.items.length,
    createdAt: b.createdAt ? b.createdAt.toISOString() : null,
    popular: b.showOnOnboarding,
  }));

  return <MonDossierClient bundles={serializable} />;
}
