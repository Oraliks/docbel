import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { deleteSourcePdf } from "@/lib/pdf-forms/storage";
import { isLocale, Locale, PdfFormField } from "@/lib/pdf-forms/types";
import { sanitizeFields } from "@/lib/pdf-forms/sanitize-fields";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET — détail complet d'un formulaire (admin).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });
  return NextResponse.json(form, { headers: json });
}

/// PATCH — édite les métadonnées et/ou le schéma enrichi.
/// Tout changement de `fields` crée une révision et incrémente la version.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const existing = await prisma.pdfForm.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  const data: Prisma.PdfFormUpdateInput = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.description === "string" || body.description === null) data.description = (body.description as string) ?? null;
  if (typeof body.issuer === "string" || body.issuer === null) data.issuer = (body.issuer as string) ?? null;
  if (typeof body.organismeId === "string" || body.organismeId === null) {
    // Connect / disconnect explicite (Prisma typing pour FK nullable).
    data.organisme =
      body.organismeId === null || body.organismeId === ""
        ? { disconnect: true }
        : { connect: { id: body.organismeId as string } };
  }
  if (typeof body.allowDownload === "boolean") data.allowDownload = body.allowDownload;
  if (typeof body.allowDoccle === "boolean") data.allowDoccle = body.allowDoccle;
  if (typeof body.allowItsme === "boolean") data.allowItsme = body.allowItsme;
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.disabledMessage === "string" || body.disabledMessage === null) {
    data.disabledMessage = (body.disabledMessage as string | null) ?? null;
  }
  if (body.status === "draft" || body.status === "archived") data.status = body.status;
  if (typeof body.defaultLocale === "string" && isLocale(body.defaultLocale)) data.defaultLocale = body.defaultLocale;
  if (Array.isArray(body.locales)) {
    const locs = (body.locales as unknown[]).filter(isLocale) as Locale[];
    data.locales = Array.from(new Set(["fr", ...locs])) as unknown as Prisma.InputJsonValue;
  }

  let createRevision = false;
  if (Array.isArray(body.fields)) {
    const clean = sanitizeFields(body.fields);
    const old = (existing.fields as unknown as PdfFormField[]) || [];
    if (JSON.stringify(old) !== JSON.stringify(clean)) {
      createRevision = true;
      data.fields = clean as unknown as Prisma.InputJsonValue;
      data.version = existing.version + 1;
    }
  }

  if (createRevision) {
    await prisma.pdfFormRevision.create({
      data: {
        formId: existing.id,
        version: existing.version,
        fields: existing.fields as Prisma.InputJsonValue,
        technicalSchema: existing.technicalSchema as Prisma.InputJsonValue,
        sourceSha256: existing.sourceSha256,
        sourceFileName: existing.sourceFileName,
        changeType: typeof body.changeType === "string" ? (body.changeType as string) : "minor",
        changeNotes: typeof body.changeNotes === "string" ? (body.changeNotes as string) : null,
        createdBy: auth.user.id,
      },
    });
  }

  const updated = await prisma.pdfForm.update({ where: { id }, data });
  return NextResponse.json(updated, { headers: json });
}

/// DELETE — archive par défaut. `?hard=true&confirmSlug=<slug>` = définitif
/// (cascade revisions/submissions/drafts + suppression du PDF source).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "true";

  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  if (!hard) {
    await prisma.pdfForm.update({ where: { id }, data: { status: "archived" } });
    return NextResponse.json({ ok: true, archived: true }, { headers: json });
  }

  if (url.searchParams.get("confirmSlug") !== form.slug) {
    return NextResponse.json(
      { error: "Confirmation invalide", expectedSlug: form.slug },
      { status: 422, headers: json }
    );
  }

  await deleteSourcePdf(form.sourceStoragePath).catch(() => {});
  await prisma.pdfForm.delete({ where: { id } });
  return NextResponse.json({ ok: true, hardDeleted: true }, { headers: json });
}
