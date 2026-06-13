import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { analysePayslip, type PayslipControlInput } from "@/lib/employeur/controle/engine";
import { buildControlPdf } from "@/lib/employeur/controle/export-pdf";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const numberish = z
  .union([z.number(), z.null()])
  .optional()
  .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));

const stringish = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (typeof v === "string" ? v : null));

const controlInputSchema = z.object({
  grossMonthlySalary: numberish,
  netReceived: numberish,
  contributionsShown: numberish,
  period: stringish,
  regime: z.enum(["temps_plein", "temps_partiel"]).nullish().transform((v) => v ?? null),
  jointCommitteeNumber: stringish,
  weeklyHours: numberish,
  fullTimeReferenceHours: numberish,
  workerType: stringish,
  benefits: z.array(z.string()).optional().transform((v) => v ?? []),
  prime: numberish,
  pecule: numberish,
  remarque: stringish,
});

export async function POST(req: NextRequest) {
  const auth = await requireEmployerOrAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: jsonHeaders });
  }

  const parsed = controlInputSchema.safeParse((body as { input?: unknown })?.input ?? body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400, headers: jsonHeaders }
    );
  }

  const input = parsed.data as PayslipControlInput;
  // On NE fait PAS confiance aux constats du client : on recalcule côté serveur.
  const result = analysePayslip(input);

  try {
    const doc = await buildControlPdf({ input, result });
    const buffer = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="docbel-controle-fiche.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[employeur] control pdf generation failed:", error);
    return NextResponse.json(
      { error: "Échec de la génération du PDF." },
      { status: 500, headers: jsonHeaders }
    );
  }
}
