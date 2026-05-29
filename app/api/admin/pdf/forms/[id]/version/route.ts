import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { readPdfUpload } from "@/lib/pdf-forms/ingest";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { buildEnrichedSchema } from "@/lib/pdf-forms/field-inference";
import { computeTechnicalDiff, migrateEnrichment } from "@/lib/pdf-forms/diff";
import { saveSourcePdf, deleteSourcePdf } from "@/lib/pdf-forms/storage";
import { sha256Hex } from "@/lib/pdf-forms/security";
import { AcroFieldRaw, PdfFormField } from "@/lib/pdf-forms/types";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST — ré-upload d'une nouvelle version du PDF officiel (multipart `file`).
///   - `apply` absent/false → PRÉVISUALISATION : renvoie le diff, ne modifie rien.
///   - `apply=true`         → APPLIQUE : archive l'ancienne version en révision,
///                            migre l'enrichissement, remplace le PDF source.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart/form-data attendu" }, { status: 400, headers: json });
  }

  const upload = await readPdfUpload(fd.get("file"));
  if ("error" in upload) {
    return NextResponse.json({ error: upload.error }, { status: 400, headers: json });
  }
  const apply = fd.get("apply") === "true";

  const parsed = await parsePdf(upload.buffer);
  // PDF plat accepté : l'admin peut reconstruire les champs via l'onglet visuel.

  const oldTech = (form.technicalSchema as unknown as AcroFieldRaw[]) || [];
  const oldEnriched = (form.fields as unknown as PdfFormField[]) || [];
  const diff = computeTechnicalDiff(oldTech, parsed.fields);

  if (!apply) {
    return NextResponse.json(
      {
        preview: true,
        diff,
        newFieldCount: parsed.fields.length,
        oldFieldCount: oldTech.length,
        sameFile: sha256Hex(upload.buffer) === form.sourceSha256,
      },
      { headers: json }
    );
  }

  // Appliquer : snapshot révision + migration enrichissement + remplacement source.
  const { kept } = migrateEnrichment(oldEnriched, diff);
  const addedRaws = parsed.fields.filter((r) => diff.added.includes(r.pdfFieldName));
  const merged = [...kept, ...buildEnrichedSchema(addedRaws)].map((f, i) => ({ ...f, order: i }));

  await prisma.pdfFormRevision.create({
    data: {
      formId: form.id,
      version: form.version,
      fields: form.fields as Prisma.InputJsonValue,
      technicalSchema: form.technicalSchema as Prisma.InputJsonValue,
      sourceSha256: form.sourceSha256,
      sourceFileName: form.sourceFileName,
      changeType: "source_update",
      changeNotes: (fd.get("changeNotes") as string) || "Nouveau PDF officiel",
      diffSummary: diff as unknown as Prisma.InputJsonValue,
      createdBy: auth.user.id,
    },
  });

  const newPath = await saveSourcePdf(upload.buffer, upload.name);
  const oldPath = form.sourceStoragePath;

  const updated = await prisma.pdfForm.update({
    where: { id },
    data: {
      sourceStoragePath: newPath,
      sourceFileName: upload.name,
      sourceByteSize: upload.buffer.byteLength,
      sourceSha256: sha256Hex(upload.buffer),
      pageCount: parsed.pageCount,
      technicalSchema: parsed.fields as unknown as Prisma.InputJsonValue,
      fields: merged as unknown as Prisma.InputJsonValue,
      version: form.version + 1,
      // Repasse en draft : re-valider/publier après changement de source.
      status: "draft",
      // Le PDF source change : les coords visuelles deviennent caduques.
      visualFields: { version: 1, fields: [] } as unknown as Prisma.InputJsonValue,
      visualFieldsMaterializedAt: null,
    },
  });

  await deleteSourcePdf(oldPath).catch(() => {});
  return NextResponse.json({ ok: true, applied: true, diff, form: updated }, { headers: json });
}
