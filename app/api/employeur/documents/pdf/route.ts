import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireEmployerOrAdminAuth } from "@/lib/auth-check";
import { DOCUMENT_TYPES } from "@/lib/employeur/documents/types";
import { buildDocumentText, documentTitle } from "@/lib/employeur/documents/render";
import { buildDocumentPdf } from "@/lib/employeur/documents/export-pdf";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const pdfSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().trim().max(200).optional(),
  values: z.record(z.string(), z.string()),
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

  const parsed = pdfSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400, headers: jsonHeaders }
    );
  }
  const { type, values } = parsed.data;
  const title = parsed.data.title?.trim() || documentTitle(type, values);
  const bodyText = buildDocumentText(type, values);

  try {
    const doc = await buildDocumentPdf({ type, title, values, bodyText });
    const buffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `docbel-document-${type}.pdf`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[employeur] document pdf generation failed:", error);
    return NextResponse.json(
      { error: "Échec de la génération du PDF." },
      { status: 500, headers: jsonHeaders }
    );
  }
}
