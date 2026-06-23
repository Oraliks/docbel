import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentBuilder } from "@/components/docbel/employeur/documents/document-builder";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { getScenarioDetail, ownsScenario } from "@/lib/employeur/queries";
import { prisma } from "@/lib/prisma";
import {
  DOCUMENT_CONFIGS,
  type DocumentType,
  type DocumentValues,
} from "@/lib/employeur/documents/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("docsMetaTitle"),
  };
}

export const dynamic = "force-dynamic";

/** Mappe un scénario d'engagement vers les champs de la fiche travailleur. */
function prefillFromScenario(scenario: {
  functionTitle: string | null;
  workplace: string | null;
  weeklyHours: number | null;
  fullTimeReferenceHours: number | null;
  grossMonthlySalary: number | null;
  jointCommitteeNumber: string | null;
  workerType: string;
  contractType: string;
  plannedStartDate: Date | null;
  benefits: unknown;
}): DocumentValues {
  const isPartTime =
    scenario.weeklyHours != null &&
    scenario.fullTimeReferenceHours != null &&
    scenario.weeklyHours < scenario.fullTimeReferenceHours;
  const benefits = Array.isArray(scenario.benefits)
    ? (scenario.benefits as unknown[]).map(String).join(", ")
    : "";
  const values: DocumentValues = {};
  if (scenario.functionTitle) values.functionTitle = scenario.functionTitle;
  if (scenario.workplace) values.workplace = scenario.workplace;
  if (scenario.weeklyHours != null) values.weeklyHours = String(scenario.weeklyHours);
  if (scenario.grossMonthlySalary != null)
    values.grossSalary = String(scenario.grossMonthlySalary);
  if (scenario.jointCommitteeNumber) values.jointCommittee = scenario.jointCommitteeNumber;
  if (scenario.workerType) values.workerType = scenario.workerType;
  if (scenario.contractType) values.contractType = scenario.contractType;
  if (scenario.plannedStartDate)
    values.startDate = new Date(scenario.plannedStartDate).toISOString().slice(0, 10);
  if (scenario.weeklyHours != null) values.schedule = isPartTime ? "temps_partiel" : "temps_plein";
  if (benefits) values.benefits = benefits;
  return values;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ scenarioId?: string }>;
}) {
  const t = await getTranslations("public.pro");
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const { scenarioId } = await searchParams;

  let initialType: DocumentType | undefined;
  let initialValues: DocumentValues | undefined;
  if (scenarioId) {
    const scenario = await getScenarioDetail(scenarioId);
    if (scenario && ownsScenario(scenario, user.id, user.isAdmin)) {
      initialType = "fiche_travailleur";
      initialValues = prefillFromScenario(scenario);
    }
  }

  const drafts = await prisma.documentDraft.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, type: true, title: true, status: true, updatedAt: true },
  });

  return (
    <div className="w-full space-y-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" render={<Link href="/employeur" />}>
        <ArrowLeft /> {t("backToDashboard")}
      </Button>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("docsTitle")}</h1>
        <p className="text-muted-foreground">{t("docsIntro")}</p>
      </header>

      <DocumentBuilder initialType={initialType} initialValues={initialValues} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t("docsSavedTitle")}</h2>
        {drafts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t("docsSavedEmpty")}
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y rounded-lg border">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOCUMENT_CONFIGS[d.type as DocumentType]?.label ?? d.type} ·{" "}
                      {new Date(d.updatedAt).toLocaleDateString("fr-BE")}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{d.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
