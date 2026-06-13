/**
 * Module 2 — Export PDF d'une simulation de coût employeur.
 * POST { data: CostPdfData } → renvoie un application/pdf.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { buildCostPdf, type CostPdfData } from "@/lib/employeur/cost/export-pdf";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const reliabilitySchema = z.enum(["low", "medium", "high", "needs_human_validation"]);

const dataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  reliability: reliabilitySchema,
  facts: z.array(z.tuple([z.string(), z.string()])).optional().default([]),
  estimatedEmployerContributions: z.number().finite(),
  estimatedMonthlyEmployerCost: z.number().finite(),
  estimatedAnnualEmployerCost: z.number().finite(),
  estimatedNetSalary: z.number().finite().nullish(),
  assumptions: z.array(z.string()).optional().default([]),
  missingData: z.array(z.string()).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
});

const bodySchema = z.object({ data: dataSchema });

export async function POST(req: NextRequest) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;

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

  const data: CostPdfData = parsed.data.data;

  try {
    const doc = await buildCostPdf(data);
    const buffer = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="docbel-simulation-cout.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[employeur] cost pdf generation failed:", error);
    return NextResponse.json({ error: "Échec de la génération du PDF." }, { status: 500, headers: jsonHeaders });
  }
}
