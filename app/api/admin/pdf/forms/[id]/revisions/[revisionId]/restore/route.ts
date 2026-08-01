import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { SEEDED_SLUGS } from "@/lib/pdf-forms/seed/apply-c1-improvements-core";
import { SEED_MANAGED_LOCK_ERROR } from "@/lib/pdf-forms/seed-lock";

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

  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  const { id, revisionId } = await params;
  const [form, revision] = await Promise.all([
    prisma.pdfForm.findUnique({ where: { id } }),
    prisma.pdfFormRevision.findUnique({ where: { id: revisionId } }),
  ]);
  if (!form) return NextResponse.json({ error: "Formulaire introuvable" }, { status: 404, headers: json });
  if (!revision || revision.formId !== id) {
    return NextResponse.json({ error: "Révision introuvable" }, { status: 404, headers: json });
  }

  // Formulaires gérés par le seed : cette route écrit `fields` ET repasse le
  // formulaire en `draft` — elle contournait donc le verrou de S5, qui ne vit
  // que dans le PATCH, et pouvait DÉPUBLIER un document ONEM servi aux
  // citoyens. Depuis S6 chaque re-semis y dépose une révision, donc le bouton
  // « Restaurer » y est devenu banal : on le refuse explicitement. L'historique
  // reste consultable — c'est précisément la traçabilité qu'apporte S6 ; pour
  // revenir en arrière on corrige le seed et on relance le re-semis.
  if (SEEDED_SLUGS.includes(form.slug)) {
    return NextResponse.json(SEED_MANAGED_LOCK_ERROR, { status: 409, headers: json });
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
