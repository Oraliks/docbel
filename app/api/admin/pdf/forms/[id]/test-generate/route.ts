import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { readSourcePdf } from "@/lib/pdf-forms/storage";
import { fillForm } from "@/lib/pdf-forms/filler";
import { generateSeedPayload } from "@/lib/pdf-forms/seed-payload";
import { PdfFormField, FormPayload } from "@/lib/pdf-forms/types";

/// POST — génère un PDF de test (données seed ou payload fourni). Admin only.
/// Stream direct, AUCUN stockage. Accepte `{ schema?, payload? }` pour tester
/// un schéma en cours d'édition non sauvegardé.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  let body: { schema?: PdfFormField[]; payload?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    /* pas de body → tout depuis la BDD */
  }

  const fields: PdfFormField[] =
    Array.isArray(body.schema) && body.schema.length
      ? body.schema.filter((f) => f && f.id && f.pdfFieldName && f.type)
      : (form.fields as unknown as PdfFormField[]) || [];

  const payload = (body.payload as FormPayload) || generateSeedPayload(fields);

  const source = await readSourcePdf(form.sourceStoragePath);
  if (!source) return NextResponse.json({ error: "PDF source introuvable" }, { status: 500 });

  let result;
  try {
    result = await fillForm(source, fields, payload);
  } catch (err) {
    console.error("test-generate error:", err);
    return NextResponse.json({ error: "Échec de génération" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(result.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="test-${form.slug}.pdf"`,
      "X-Unicode-Font": result.unicodeFont ? "1" : "0",
      "Cache-Control": "no-store",
    },
  });
}
