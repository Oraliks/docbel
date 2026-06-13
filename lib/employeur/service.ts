/**
 * Orchestration serveur Docbel Employeur : à partir d'un scénario, charge les
 * règles actives, exécute le moteur déterministe, construit la checklist et
 * persiste le tout (checklist + items, fiabilité + alertes sur le scénario).
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { evaluateRules, type EngineRule, type EngineAlert } from "./rules/engine";
import { buildItemDrafts, pickCategory } from "./checklists/generate";
import { labelCategory, type ReliabilityLevel } from "./constants";

/** Charge les règles employeur actives sous la forme attendue par le moteur. */
export async function loadActiveRules(): Promise<EngineRule[]> {
  const rows = await prisma.employerRule.findMany({ where: { active: true } });
  return rows.map((r) => ({
    code: r.code,
    conditionJson: r.conditionJson,
    outputJson: r.outputJson,
    severity: r.severity,
    sourceCode: r.sourceCode,
    active: r.active,
  }));
}

export interface StoredAlert {
  severity: EngineAlert["severity"];
  message: string;
  sourceCode?: string;
  ruleCode: string;
}

export interface PipelineResult {
  checklistId: string;
  category: string;
  reliability: ReliabilityLevel;
  itemsCount: number;
  alerts: StoredAlert[];
}

/**
 * (Re)génère la checklist d'un scénario et met à jour fiabilité + alertes.
 * Idempotent : supprime les checklists existantes du scénario avant de recréer.
 */
export async function runScenarioPipeline(scenarioId: string): Promise<PipelineResult> {
  const scenario = await prisma.workerScenario.findUnique({
    where: { id: scenarioId },
    include: { employerProfile: true },
  });
  if (!scenario) throw new Error(`Scénario introuvable: ${scenarioId}`);

  const profile = scenario.employerProfile;
  const rules = await loadActiveRules();

  const engine = evaluateRules(
    {
      hasEmployees: profile.hasEmployees,
      hasOnssNumber: profile.hasOnssNumber,
      legalForm: profile.legalForm,
      region: profile.region,
      sector: profile.sector,
      jointCommitteeKnown: profile.jointCommitteeKnown,
      jointCommitteeNumber: profile.jointCommitteeNumber,
    },
    {
      workerType: scenario.workerType,
      contractType: scenario.contractType,
      weeklyHours: scenario.weeklyHours,
      fullTimeReferenceHours: scenario.fullTimeReferenceHours,
      grossMonthlySalary: scenario.grossMonthlySalary,
      jointCommitteeNumber: scenario.jointCommitteeNumber,
      scheduleType: scenario.scheduleType,
      plannedStartDate: scenario.plannedStartDate,
    },
    rules
  );

  const category = pickCategory({ hasEmployees: profile.hasEmployees });
  const drafts = buildItemDrafts(category, engine.items);

  const alerts: StoredAlert[] = engine.alerts.map((a) => ({
    severity: a.severity,
    message: a.message,
    sourceCode: a.sourceCode,
    ruleCode: a.ruleCode,
  }));

  const checklistId = await prisma.$transaction(async (tx) => {
    await tx.employerChecklist.deleteMany({ where: { scenarioId } });

    const checklist = await tx.employerChecklist.create({
      data: {
        scenarioId,
        title: `Checklist — ${labelCategory(category)}`,
        category,
        items: {
          create: drafts.map((d, index) => ({
            title: d.title,
            description: d.description ?? null,
            priority: d.priority,
            sourceCode: d.sourceCode ?? null,
            tooltip: d.tooltip ?? null,
            legalBasisRef: d.legalBasisRef ?? null,
            ruleCode: d.ruleCode,
            order: index,
          })),
        },
      },
    });

    await tx.workerScenario.update({
      where: { id: scenarioId },
      data: {
        reliabilityScore: engine.reliability,
        alerts: alerts as unknown as object,
      },
    });

    return checklist.id;
  });

  return {
    checklistId,
    category,
    reliability: engine.reliability,
    itemsCount: drafts.length,
    alerts,
  };
}
