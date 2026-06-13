import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { loadActiveRules } from "@/lib/employeur/service";
import { evaluateRules } from "@/lib/employeur/rules/engine";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/** Testeur de règles : exécute le moteur sur un scénario fictif (Critère admin). */
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: jsonHeaders });
  }
  const b = body as {
    hasEmployees?: boolean | null;
    hasOnssNumber?: boolean | null;
    workerType?: string;
    contractType?: string;
    weeklyHours?: number | null;
    fullTimeReferenceHours?: number | null;
    grossMonthlySalary?: number | null;
    jointCommitteeNumber?: string;
  };

  const rules = await loadActiveRules();
  const result = evaluateRules(
    { hasEmployees: b.hasEmployees ?? null, hasOnssNumber: b.hasOnssNumber ?? null },
    {
      workerType: b.workerType ?? "",
      contractType: b.contractType ?? "",
      weeklyHours: b.weeklyHours ?? null,
      fullTimeReferenceHours: b.fullTimeReferenceHours ?? null,
      grossMonthlySalary: b.grossMonthlySalary ?? null,
      jointCommitteeNumber: b.jointCommitteeNumber ?? "",
    },
    rules
  );

  return NextResponse.json(result, { headers: jsonHeaders });
}
