/**
 * Module 2 — Sauvegarde d'une simulation de coût employeur.
 * POST { title, inputs, result } → persiste un CostSimulation pour l'utilisateur.
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { logActivity } from "@/lib/activity-logger";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const reliabilitySchema = z.enum(["low", "medium", "high", "needs_human_validation"]);

const resultSchema = z.object({
  estimatedEmployerContributions: z.number().finite(),
  estimatedMonthlyEmployerCost: z.number().finite(),
  estimatedAnnualEmployerCost: z.number().finite(),
  estimatedNetSalary: z.number().finite().nullish(),
  assumptions: z.array(z.string()).optional().default([]),
  missingData: z.array(z.string()).optional().default([]),
  reliability: reliabilitySchema,
  warnings: z.array(z.string()).optional().default([]),
});

const bodySchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(160).optional(),
  scenarioId: z.string().trim().min(1).optional(),
  inputs: z.object({ grossMonthlySalary: z.number().finite() }).passthrough(),
  result: resultSchema,
});

export async function POST(req: NextRequest) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const userId = auth.user.id;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: jsonHeaders });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400, headers: jsonHeaders }
    );
  }
  const { title, scenarioId, inputs, result } = parsed.data;

  try {
    const row = await prisma.costSimulation.create({
      data: {
        userId,
        scenarioId: scenarioId ?? null,
        title: title ?? "Simulation de coût",
        inputs: inputs as Prisma.InputJsonValue,
        grossMonthlySalary: inputs.grossMonthlySalary,
        estimatedEmployerContributions: result.estimatedEmployerContributions,
        estimatedMonthlyEmployerCost: result.estimatedMonthlyEmployerCost,
        estimatedAnnualEmployerCost: result.estimatedAnnualEmployerCost,
        estimatedNetSalary: result.estimatedNetSalary ?? null,
        assumptions: result.assumptions as Prisma.InputJsonValue,
        missingData: result.missingData as Prisma.InputJsonValue,
        reliability: result.reliability,
        warnings: result.warnings as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await logActivity(
      userId,
      "created",
      "employer",
      title ?? "Simulation de coût",
      row.id,
      "Simulation de coût"
    );

    return NextResponse.json({ id: row.id }, { status: 201, headers: jsonHeaders });
  } catch (error) {
    console.error("[employeur] save cost simulation failed:", error);
    return NextResponse.json(
      { error: "Échec de l'enregistrement de la simulation." },
      { status: 500, headers: jsonHeaders }
    );
  }
}
