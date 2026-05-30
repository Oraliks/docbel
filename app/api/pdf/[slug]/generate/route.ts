import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { readSourcePdf } from "@/lib/pdf-forms/storage";
import { fillForm } from "@/lib/pdf-forms/filler";
import { buildValidator } from "@/lib/pdf-forms/validation";
import { renderFilename } from "@/lib/pdf-forms/filename";
import { sha256Hex, checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";
import { sendToDoccle, isDoccleConfigured } from "@/lib/pdf-forms/integrations/doccle";
import { todayISO } from "@/lib/pdf-forms/system-values";
import { PdfFormField, FormPayload, Locale, isLocale } from "@/lib/pdf-forms/types";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST — génère le PDF rempli. AUCUN stockage (RGPD) :
///   - delivery "download" → stream direct du PDF.
///   - delivery "doccle"   → envoi via Doccle, réponse JSON.
/// Un log d'audit sans PII est enregistré dans tous les cas.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`pdf-generate:${ip}:${slug}`, { windowMs: 60_000, max: 5 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  const form = await prisma.pdfForm.findUnique({ where: { slug } });
  if (!form || form.status !== "published") {
    return NextResponse.json({ error: "Formulaire indisponible" }, { status: 404, headers: json });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  if (body.consent !== true) {
    return NextResponse.json({ error: "Consentement RGPD requis" }, { status: 400, headers: json });
  }

  const lang: Locale = isLocale(body.locale) ? body.locale : (form.defaultLocale as Locale);
  const delivery = body.delivery === "doccle" ? "doccle" : "download";
  if (delivery === "doccle" && !(form.allowDoccle && isDoccleConfigured())) {
    return NextResponse.json({ error: "Envoi Doccle indisponible" }, { status: 400, headers: json });
  }
  if (delivery === "download" && !form.allowDownload) {
    return NextResponse.json({ error: "Téléchargement désactivé" }, { status: 400, headers: json });
  }

  const fields = (form.fields as unknown as PdfFormField[]) || [];

  // Dates auto (`system.today`) : la valeur est imposée par le serveur (date de
  // génération, fuseau Bruxelles) et écrase toute valeur envoyée par le client.
  const incoming = ((body.payload as FormPayload) || {});
  const today = todayISO();
  for (const f of fields) {
    if (f.prefillFrom === "system.today") incoming[f.id] = today;
  }

  const validator = buildValidator(fields, lang);
  const result = validator.safeParse(incoming);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        issues: result.error.issues.map((i) => ({ field: i.path[0], message: i.message })),
      },
      { status: 422, headers: json }
    );
  }
  const validated = result.data as FormPayload;

  const source = await readSourcePdf(form.sourceStoragePath);
  if (!source) {
    return NextResponse.json({ error: "PDF source introuvable" }, { status: 500, headers: json });
  }

  let pdfBytes: Buffer;
  try {
    pdfBytes = (await fillForm(source, fields, validated)).bytes;
  } catch (err) {
    console.error("pdf-forms generate error:", err);
    await logSubmission(form.id, form.version, lang, validated, delivery, false, ip);
    return NextResponse.json({ error: "Échec de génération" }, { status: 500, headers: json });
  }

  // Si le PDF est ouvert dans un dossier (bundle), on persiste le payload
  // validé dans le run pour que les PDFs suivants puissent récupérer les
  // valeurs partagées (NISS, adresse, etc.). Clé = pdfFormId (cuid unique,
  // cohabite avec les templateId de l'ancien module dans le même dict).
  const bundleRunId = typeof body.bundleRunId === "string" ? body.bundleRunId : null;
  if (bundleRunId) {
    try {
      const run = await prisma.bundleRun.findUnique({ where: { id: bundleRunId } });
      if (run && run.status === "in_progress") {
        const currentPayloads = (run.payloads as Record<string, unknown>) || {};
        const currentCompleted = (run.completedTemplateIds as string[]) || [];
        const newPayloads = { ...currentPayloads, [form.id]: validated };
        const newCompleted = currentCompleted.includes(form.id)
          ? currentCompleted
          : [...currentCompleted, form.id];
        await prisma.bundleRun.update({
          where: { id: bundleRunId },
          data: {
            payloads: newPayloads as unknown as Prisma.InputJsonValue,
            completedTemplateIds: newCompleted as unknown as Prisma.InputJsonValue,
          },
        });
      }
    } catch (err) {
      // Non-bloquant : la génération du PDF a déjà réussi ; on log juste.
      console.error("[pdf-generate] BundleRun update failed:", err);
    }
  }

  const filename = renderFilename(form.slug, validated);

  // Livraison Doccle
  if (delivery === "doccle") {
    const recipient = (body.doccleRecipient as { reference?: string; email?: string }) || {};
    if (!recipient.reference) {
      return NextResponse.json({ error: "Destinataire Doccle requis" }, { status: 400, headers: json });
    }
    try {
      const res = await sendToDoccle({
        recipient: { reference: recipient.reference, email: recipient.email },
        filename,
        pdf: pdfBytes,
        title: form.title,
        issuer: form.issuer || undefined,
      });
      await logSubmission(form.id, form.version, lang, validated, "doccle", true, ip);
      return NextResponse.json({ ok: true, delivery: "doccle", documentId: res.documentId, status: res.status }, { headers: json });
    } catch (err) {
      console.error("Doccle send error:", err);
      await logSubmission(form.id, form.version, lang, validated, "doccle", false, ip);
      return NextResponse.json({ error: "Échec de l'envoi via Doccle" }, { status: 502, headers: json });
    }
  }

  // Livraison download (stream, zéro stockage)
  await logSubmission(form.id, form.version, lang, validated, "download", true, ip);
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function logSubmission(
  formId: string,
  formVersion: number,
  locale: string,
  payload: FormPayload,
  delivery: string,
  success: boolean,
  ip: string
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    await prisma.pdfFormSubmissionLog.create({
      data: {
        formId,
        formVersion,
        locale,
        payloadHash: sha256Hex(JSON.stringify(payload)),
        delivery,
        success,
        ipHash: sha256Hex(ip),
        userId: session?.user?.id || null,
      },
    });
  } catch (err) {
    console.error("logSubmission failed (non-blocking):", err);
  }
}
