import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listPublicTrainings, listActiveCategories } from "@/lib/formations/queries";
import { getFormationsViewer } from "@/lib/formations/page-auth";
import { getTrainingAccess } from "@/lib/formations/module";
import { ModuleGate } from "@/components/formations/module-gate";
import { CatalogueClient } from "./catalogue-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Formations — Docbel",
  description:
    "Des formations gratuites ou payantes proposées par des partenaires vérifiés, pour avancer dans votre emploi, vos démarches ou votre reconversion.",
};

export default async function FormationsPage() {
  const viewer = await getFormationsViewer();
  const { access, config } = await getTrainingAccess(viewer, "public");
  if (access === "hidden") notFound();
  if (access !== "ok")
    return <ModuleGate access={access} maintenanceMessage={config.maintenanceMessage} />;

  const [trainings, categories] = await Promise.all([
    listPublicTrainings({}, 200),
    listActiveCategories(),
  ]);

  return <CatalogueClient trainings={trainings} categories={categories} />;
}
