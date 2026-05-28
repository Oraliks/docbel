import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST — restaure le SCHÉMA ENRICHI d'une révision passée.
/// Ne touche pas au PDF source (la révision peut viser un autre PDF) ; si le
/// sha256 diffère, on prévient via `sourceMismatch`. Crée une révision avant.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id, revisionId } = await params;
  const [form, revision] = await Promise.all([
    prisma.pdfForm.findUnique({ where: { id } }),
    prisma.pdfFormRevision.findUnique({ where: { id: revisionId } }),
  ]);
  if (!form) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404, headers: json });
  if (!revision || revision.formId !== id) {
    return NextResponse.json({ error: "Révision introuvable" }, { status: 404, headers: json });
  }

  // Snapshot de l'état courant avant restauration.
  await prisma.pdfFormRevision.create({
    data: {
      formId: form.id,
      version: form.version,
      fields: form.fields as Prisma.InputJsonValue,
      technicalSchema: form.technicalSchema as Prisma.InputJsonValue,
      sourceSha256: form.sourceSha256,
      sourceFileName: form.sourceFileName,
      changeType: "minor",
      changeNotes: `Avant restauration de la version ${revision.version}`,
      createdBy: auth.user.id,
    },
  });

  const updated = await prisma.pdfForm.update({
    where: { id },
    data: {
      fields: revision.fields as Prisma.InputJsonValue,
      version: form.version + 1,
      status: "draft",
    },
  });

  return NextResponse.json(
    { ok: true, restoredFrom: revision.version, sourceMismatch: revision.sourceSha256 !== form.sourceSha256, form: updated },
    { headers: json }
  );
}
