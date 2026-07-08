import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkPublishable, hasBlockingIssues } from "@/lib/pdf-forms/publish-checks";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { AcroFieldRaw, Locale, PdfFormField } from "@/lib/pdf-forms/types";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET — pré-vérifie la publiabilité (issues bloquantes + warnings) sans publier.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  const issues = checkPublishable(
    (form.fields as unknown as PdfFormField[]) || [],
    (form.technicalSchema as unknown as AcroFieldRaw[]) || [],
    (form.locales as unknown as Locale[]) || ["fr"],
    {
      visualFieldsRaw: form.visualFields,
      visualFieldsMaterializedAt: form.visualFieldsMaterializedAt,
      updatedAt: form.updatedAt,
      bindingRules: getRulesForSlug(form.slug),
    }
  );
  return NextResponse.json({ issues, canPublish: !hasBlockingIssues(issues) }, { headers: json });
}

/// POST — publie si aucune issue bloquante.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  const issues = checkPublishable(
    (form.fields as unknown as PdfFormField[]) || [],
    (form.technicalSchema as unknown as AcroFieldRaw[]) || [],
    (form.locales as unknown as Locale[]) || ["fr"],
    {
      visualFieldsRaw: form.visualFields,
      visualFieldsMaterializedAt: form.visualFieldsMaterializedAt,
      updatedAt: form.updatedAt,
      bindingRules: getRulesForSlug(form.slug),
    }
  );
  if (hasBlockingIssues(issues)) {
    return NextResponse.json(
      { error: "Publication impossible : corrigez les erreurs.", issues },
      { status: 422, headers: json }
    );
  }

  const updated = await prisma.pdfForm.update({ where: { id }, data: { status: "published" } });
  return NextResponse.json({ ok: true, status: updated.status, issues }, { headers: json });
}
