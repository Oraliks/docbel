import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBoussoleQuestions, toPublicQuestions } from "@/lib/formations/boussole/load";
import { getFormationsViewer } from "@/lib/formations/page-auth";
import { getTrainingAccess, isFlagEnabled } from "@/lib/formations/module";
import { ModuleGate } from "@/components/formations/module-gate";
import { BoussoleClient } from "./boussole-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boussole d'orientation — Docbel Formations",
  description:
    "Vous ne savez pas quelle formation choisir ? Répondez à quelques questions simples : Docbel vous aide à identifier les domaines adaptés à votre situation.",
};

export default async function BoussolePage() {
  const viewer = await getFormationsViewer();
  const { access, config } = await getTrainingAccess(viewer, "public");
  if (access === "hidden" || !(await isFlagEnabled("orientation"))) notFound();
  if (access !== "ok")
    return <ModuleGate access={access} maintenanceMessage={config.maintenanceMessage} />;

  const questions = toPublicQuestions(await getBoussoleQuestions());
  return <BoussoleClient questions={questions} />;
}
