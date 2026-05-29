import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { readSourcePdf, saveSourcePdf, deleteSourcePdf } from "@/lib/pdf-forms/storage";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { buildEnrichedSchema } from "@/lib/pdf-forms/field-inference";
import { sha256Hex } from "@/lib/pdf-forms/security";
import { parseVisualFieldsDoc, serializeVisualFieldsDoc } from "@/lib/pdf-forms/visual/types";
import { validateVisualFieldsDoc, findNameCollisions } from "@/lib/pdf-forms/visual/validation";
import { materializeVisualFields, MaterializeError } from "@/lib/pdf-forms/visual/materialize";
import type { AcroFieldRaw, PdfFormField } from "@/lib/pdf-forms/types";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST — matérialise le wrapper visualFields en AcroForms natifs dans le PDF
/// source. Crée une révision « source_update » avec les anciens binaires, écrit
/// le nouveau PDF et synchronise `technicalSchema` + `fields` en fusionnant les
/// nouveaux champs au schéma enrichi existant. Optimistic locking via If-Match.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  const ifMatch = req.headers.get("if-match");
  if (ifMatch && ifMatch !== form.updatedAt.toISOString()) {
    return NextResponse.json(
      { error: "Conflit de version : rechargez la page (modification concurrente)." },
      { status: 412, headers: json }
    );
  }

  const doc = parseVisualFieldsDoc(form.visualFields);
  const v = validateVisualFieldsDoc(doc);
  if (!v.ok || !v.doc) {
    return NextResponse.json({ error: "Doc visuel invalide", details: v.errors }, { status: 422, headers: json });
  }
  if (v.doc.fields.length === 0) {
    return NextResponse.json({ error: "Aucun champ visuel à matérialiser." }, { status: 422, headers: json });
  }

  const existingTech = (form.technicalSchema as unknown as AcroFieldRaw[]) || [];
  // `technicalSchema` inclut les champs que NOUS avons matérialisés au tour
  // précédent (tracés dans `materializedNames`) — la lib les nettoie avant
  // recréation. On ne considère comme « étrangers » que les noms qui ne
  // proviennent pas d'une matérialisation antérieure, sinon la re-matérialisation
  // se bloquerait elle-même sur une fausse collision.
  const previouslyMaterialized = new Set(v.doc.materializedNames ?? []);
  const foreignNames = existingTech
    .map((t) => t.pdfFieldName)
    .filter((n) => !previouslyMaterialized.has(n));
  const collisions = findNameCollisions(v.doc, foreignNames);
  if (collisions.length) {
    return NextResponse.json(
      { error: `Nom(s) déjà présent(s) dans l'AcroForm source : ${collisions.join(", ")}` },
      { status: 422, headers: json }
    );
  }

  const source = await readSourcePdf(form.sourceStoragePath);
  if (!source) return NextResponse.json({ error: "PDF source introuvable" }, { status: 500, headers: json });

  let materialized;
  try {
    materialized = await materializeVisualFields(source, v.doc, {
      // Refuser uniquement en présence d'un AcroForm ÉTRANGER (fusion out-of-scope
      // v1). Nos propres champs précédents ne comptent pas : la lib les supprime
      // d'abord, ce qui permet la re-matérialisation.
      rejectIfHasAcroForm: foreignNames.length > 0,
    });
  } catch (e) {
    if (e instanceof MaterializeError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 422, headers: json });
    }
    console.error("materialize error", e);
    return NextResponse.json({ error: "Échec de matérialisation" }, { status: 500, headers: json });
  }

  // Re-parse pour obtenir le nouveau technicalSchema authentique.
  const parsed = await parsePdf(materialized.bytes);

  // Fusion enrichissement : on garde les champs enrichis existants par ancre,
  // et on ajoute les nouveaux (matérialisés) avec l'inférence par défaut.
  const oldEnriched = (form.fields as unknown as PdfFormField[]) || [];
  const existingNames = new Set(oldEnriched.map((f) => f.pdfFieldName));
  const addedRaws = parsed.fields.filter(
    (r) => materialized.createdNames.includes(r.pdfFieldName) && !existingNames.has(r.pdfFieldName)
  );
  const merged = [...oldEnriched, ...buildEnrichedSchema(addedRaws)].map((f, i) => ({ ...f, order: i }));

  // Snapshot révision (avant écriture).
  await prisma.pdfFormRevision.create({
    data: {
      formId: form.id,
      version: form.version,
      fields: form.fields as Prisma.InputJsonValue,
      technicalSchema: form.technicalSchema as Prisma.InputJsonValue,
      sourceSha256: form.sourceSha256,
      sourceFileName: form.sourceFileName,
      changeType: "source_update",
      changeNotes: "Matérialisation éditeur visuel",
      createdBy: auth.user.id,
    },
  });

  // Sauvegarde du nouveau PDF source.
  const newPath = await saveSourcePdf(materialized.bytes, form.sourceFileName);
  const oldPath = form.sourceStoragePath;

  // MAJ wrapper : on remet à jour materializedNames, on garde les fields.
  const nextDoc = { ...v.doc, materializedNames: materialized.createdNames };

  const updated = await prisma.pdfForm.update({
    where: { id: form.id },
    data: {
      sourceStoragePath: newPath,
      sourceByteSize: materialized.bytes.byteLength,
      sourceSha256: sha256Hex(materialized.bytes),
      pageCount: parsed.pageCount,
      technicalSchema: parsed.fields as unknown as Prisma.InputJsonValue,
      fields: merged as unknown as Prisma.InputJsonValue,
      visualFields: serializeVisualFieldsDoc(nextDoc) as Prisma.InputJsonValue,
      visualFieldsMaterializedAt: new Date(),
      version: form.version + 1,
      status: "draft",
    },
  });

  await deleteSourcePdf(oldPath).catch(() => {});

  return NextResponse.json(
    {
      ok: true,
      createdNames: materialized.createdNames,
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString(),
      materializedAt: updated.visualFieldsMaterializedAt?.toISOString() ?? null,
    },
    { headers: json }
  );
}
