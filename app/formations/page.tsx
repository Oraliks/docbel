import type { Metadata } from "next";
import { listPublicTrainings, listActiveCategories } from "@/lib/formations/queries";
import { CatalogueClient } from "./catalogue-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formations — Docbel",
  description:
    "Des formations gratuites ou payantes proposées par des partenaires vérifiés, pour avancer dans votre emploi, vos démarches ou votre reconversion.",
};

export default async function FormationsPage() {
  const [trainings, categories] = await Promise.all([
    listPublicTrainings({}, 200),
    listActiveCategories(),
  ]);

  return <CatalogueClient trainings={trainings} categories={categories} />;
}
