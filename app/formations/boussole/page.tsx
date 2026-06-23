import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getBoussoleQuestions, toPublicQuestions } from "@/lib/formations/boussole/load";
import { getFormationsViewer } from "@/lib/formations/page-auth";
import { getTrainingAccess, isFlagEnabled } from "@/lib/formations/module";
import { ModuleGate } from "@/components/formations/module-gate";
import { BoussoleClient } from "./boussole-client";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.formations");
  return {
    title: t("metaBoussoleTitle"),
    description: t("metaBoussoleDescription"),
  };
}

export default async function BoussolePage() {
  const viewer = await getFormationsViewer();
  const { access, config } = await getTrainingAccess(viewer, "public");
  if (access === "hidden" || !(await isFlagEnabled("orientation"))) notFound();
  if (access !== "ok")
    return <ModuleGate access={access} maintenanceMessage={config.maintenanceMessage} />;

  const questions = toPublicQuestions(await getBoussoleQuestions());
  return <BoussoleClient questions={questions} />;
}
