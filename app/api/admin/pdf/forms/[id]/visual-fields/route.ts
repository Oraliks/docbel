import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { readSourcePdf } from "@/lib/pdf-forms/storage";
import { parseVisualFieldsDoc, serializeVisualFieldsDoc } from "@/lib/pdf-forms/visual/types";
import {
  validateVisualFieldsDoc,
  findNameCollisions,
} from "@/lib/pdf-forms/visual/validation";
import type { AcroFieldRaw } from "@/lib/pdf-forms/types";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET — état de l'éditeur visuel : doc actuel + métadonnées de contexte.
///
/// Renvoie aussi `sourceHasAcroForm` et `hasRotatedPages` pour que l'UI
/// désactive l'onglet quand l'éditeur ne peut pas matérialiser (v1).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      pageCount: true,
      visualFields: true,
      visualFieldsMaterializedAt: true,
      updatedAt: true,
      technicalSchema: true,
      sourceStoragePath: true,
    },
  });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  const tech = (form.technicalSchema as unknown as AcroFieldRaw[]) || [];
  const sourceHasAcroForm = tech.length > 0;

  // Détection de pages pivotées (best-effort — peut être absent si erreur de lecture).
  let hasRotatedPages = false;
  try {
    const source = await readSourcePdf(form.sourceStoragePath);
    if (source) {
      const pdf = await PDFDocument.load(source, { ignoreEncryption: true });
      hasRotatedPages = pdf.getPages().some((p) => p.getRotation().angle !== 0);
    }
  } catch {
    /* ignore : on n'expose pas une erreur de lecture côté admin */
  }

  return NextResponse.json(
    {
      doc: parseVisualFieldsDoc(form.visualFields),
      updatedAt: form.updatedAt.toISOString(),
      materializedAt: form.visualFieldsMaterializedAt?.toISOString() ?? null,
      sourceHasAcroForm,
      hasRotatedPages,
      pageCount: form.pageCount,
    },
    { headers: json }
  );
}

/// PUT — sauvegarde explicite du wrapper VisualFieldsDoc.
/// Optimistic locking : le client envoie `If-Match: <updatedAt ISO>`. Si la
/// valeur diffère du `updatedAt` en BDD, on renvoie 412.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({
    where: { id },
    select: { id: true, updatedAt: true, technicalSchema: true },
  });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  const ifMatch = req.headers.get("if-match");
  if (ifMatch && ifMatch !== form.updatedAt.toISOString()) {
    return NextResponse.json(
      { error: "Conflit de version : rechargez la page (modification concurrente)." },
      { status: 412, headers: json }
    );
  }

  let body: { doc?: unknown };
  try {
    body = (await req.json()) as { doc?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  const v = validateVisualFieldsDoc(body.doc);
  if (!v.ok) {
    return NextResponse.json({ error: "Document invalide", details: v.errors }, { status: 422, headers: json });
  }

  // Vérif collision avec les noms AcroForm existants (v1 : on refuse).
  const tech = (form.technicalSchema as unknown as AcroFieldRaw[]) || [];
  const collisions = findNameCollisions(v.doc!, tech.map((t) => t.pdfFieldName));
  if (collisions.length) {
    return NextResponse.json(
      { error: `Nom(s) déjà présent(s) dans l'AcroForm source : ${collisions.join(", ")}` },
      { status: 422, headers: json }
    );
  }

  const updated = await prisma.pdfForm.update({
    where: { id },
    data: { visualFields: serializeVisualFieldsDoc(v.doc!) as Prisma.InputJsonValue },
    select: { updatedAt: true },
  });

  return NextResponse.json(
    { ok: true, updatedAt: updated.updatedAt.toISOString() },
    { headers: json }
  );
}
