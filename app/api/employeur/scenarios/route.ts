import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { runScenarioPipeline } from "@/lib/employeur/service";
import { labelWorkerType } from "@/lib/employeur/constants";
import {
  createScenarioSchema,
  triToBool,
  parseOptionalDate,
  emptyToNull,
} from "@/lib/employeur/validation";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function POST(req: NextRequest) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const userId = auth.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: jsonHeaders });
  }

  const parsed = createScenarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400, headers: jsonHeaders }
    );
  }
  const { profile, scenario } = parsed.data;

  try {
    const profileData = {
      organisationName: emptyToNull(profile.organisationName),
      legalForm: profile.legalForm ?? null,
      enterpriseNumber: emptyToNull(profile.enterpriseNumber),
      hasEmployees: triToBool(profile.hasEmployees),
      hasOnssNumber: triToBool(profile.hasOnssNumber),
      onssNumber: emptyToNull(profile.onssNumber),
      region: profile.region ?? null,
      sector: emptyToNull(profile.sector),
      naceCode: emptyToNull(profile.naceCode),
    };

    // Un profil employeur par utilisateur pour le MVP : upsert manuel.
    const existing = await prisma.employerProfile.findFirst({ where: { userId } });
    const profileRow = existing
      ? await prisma.employerProfile.update({ where: { id: existing.id }, data: profileData })
      : await prisma.employerProfile.create({ data: { userId, ...profileData } });

    const title =
      emptyToNull(scenario.title) ??
      `${labelWorkerType(scenario.workerType)}${
        emptyToNull(scenario.functionTitle) ? ` — ${scenario.functionTitle!.trim()}` : ""
      }`;

    const scenarioRow = await prisma.workerScenario.create({
      data: {
        employerProfileId: profileRow.id,
        title,
        workerType: scenario.workerType,
        contractType: scenario.contractType,
        status: "ready",
        plannedStartDate: parseOptionalDate(scenario.plannedStartDate) ?? null,
        plannedEndDate: parseOptionalDate(scenario.plannedEndDate) ?? null,
        functionTitle: emptyToNull(scenario.functionTitle),
        workplace: emptyToNull(scenario.workplace),
        weeklyHours: scenario.weeklyHours ?? null,
        fullTimeReferenceHours: scenario.fullTimeReferenceHours ?? null,
        grossMonthlySalary: scenario.grossMonthlySalary ?? null,
        benefits: scenario.benefits ?? [],
        jointCommitteeNumber: emptyToNull(scenario.jointCommitteeNumber),
        region: scenario.region ?? profile.region ?? null,
        nightWork: scenario.nightWork ?? null,
        sundayWork: scenario.sundayWork ?? null,
        saturdayWork: scenario.saturdayWork ?? null,
        telework: scenario.telework ?? null,
      },
    });

    await runScenarioPipeline(scenarioRow.id);

    return NextResponse.json({ id: scenarioRow.id }, { status: 201, headers: jsonHeaders });
  } catch (error) {
    console.error("[employeur] create scenario failed:", error);
    return NextResponse.json(
      { error: "Échec de la création du dossier." },
      { status: 500, headers: jsonHeaders }
    );
  }
}
