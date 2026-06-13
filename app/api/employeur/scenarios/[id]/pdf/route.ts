import { NextRequest, NextResponse } from "next/server";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { getScenarioDetail, getSourceMap, ownsScenario } from "@/lib/employeur/queries";
import {
  buildChecklistPdf,
  type ChecklistPdfData,
} from "@/lib/employeur/export-checklist-pdf";
import {
  labelWorkerType,
  labelContractType,
  labelCategory,
  type AlertSeverity,
  type ItemPriority,
  type ItemStatus,
  type ReliabilityLevel,
} from "@/lib/employeur/constants";

interface StoredAlert {
  severity: AlertSeverity;
  message: string;
  sourceCode?: string;
}

function complexity(reliability: ReliabilityLevel, alerts: StoredAlert[]): string {
  if (reliability === "needs_human_validation") return "À valider";
  const serious = alerts.filter((a) => a.severity !== "info").length;
  if (serious >= 3) return "Complexe";
  if (serious >= 1) return "Moyen";
  return "Simple";
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await context.params;

  const scenario = await getScenarioDetail(id);
  if (!scenario || !ownsScenario(scenario, auth.user.id, auth.user.isAdmin)) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const sourceMap = await getSourceMap();
  const alerts = (Array.isArray(scenario.alerts) ? scenario.alerts : []) as unknown as StoredAlert[];
  const reliability = (scenario.reliabilityScore ?? "medium") as ReliabilityLevel;
  const items = scenario.checklists[0]?.items ?? [];

  const usedCodes = Array.from(
    new Set(
      [...items.map((i) => i.sourceCode), ...alerts.map((a) => a.sourceCode)].filter(
        (c): c is string => Boolean(c)
      )
    )
  );

  const data: ChecklistPdfData = {
    title: scenario.title,
    subtitle: `${labelWorkerType(scenario.workerType)} · ${labelContractType(scenario.contractType)}`,
    categoryLabel: scenario.checklists[0]
      ? labelCategory(scenario.checklists[0].category)
      : "Checklist",
    reliability,
    complexity: complexity(reliability, alerts),
    facts: [
      ["Commission paritaire", scenario.jointCommitteeNumber ?? "—"],
      ["Salaire brut mensuel", scenario.grossMonthlySalary ? `${scenario.grossMonthlySalary} €` : "—"],
      ["Horaire", scenario.weeklyHours ? `${scenario.weeklyHours} h/sem` : "—"],
      ["Fonction", scenario.functionTitle ?? "—"],
      [
        "Date d'entrée prévue",
        scenario.plannedStartDate
          ? new Date(scenario.plannedStartDate).toLocaleDateString("fr-BE")
          : "—",
      ],
      ["Lieu de travail", scenario.workplace ?? "—"],
    ],
    items: items.map((i) => ({
      title: i.title,
      priority: i.priority as ItemPriority,
      status: i.status as ItemStatus,
      sourceCode: i.sourceCode,
    })),
    alerts: alerts.map((a) => ({
      severity: a.severity,
      message: a.message,
      sourceCode: a.sourceCode,
    })),
    sources: usedCodes.map((code) => {
      const s = sourceMap.get(code);
      return {
        code,
        title: s?.title ?? code,
        institution: s?.institution ?? "",
        url: s?.url ?? "",
      };
    }),
  };

  try {
    const doc = await buildChecklistPdf(data);
    const buffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `docbel-dossier-${scenario.id}.pdf`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[employeur] pdf generation failed:", error);
    return NextResponse.json({ error: "Échec de la génération du PDF." }, { status: 500 });
  }
}
