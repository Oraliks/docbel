import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormationsViewer } from "@/lib/formations/page-auth";
import { getTrainingAccess, isFlagEnabled } from "@/lib/formations/module";
import { ModuleGate } from "@/components/formations/module-gate";
import { ProposerClient } from "./proposer-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Proposer vos formations — Docbel",
  description:
    "Écoles, ASBL, sociétés, administrations et formateurs : publiez vos formations sur Docbel. Inscription gratuite, vérification du numéro d'entreprise, validation par l'équipe Docbel.",
};

export default async function ProposerPage() {
  const viewer = await getFormationsViewer();
  const { access, config } = await getTrainingAccess(viewer, "public");
  if (access === "hidden" || !(await isFlagEnabled("organizationCreation"))) notFound();
  if (access !== "ok")
    return <ModuleGate access={access} maintenanceMessage={config.maintenanceMessage} />;

  return <ProposerClient />;
}
