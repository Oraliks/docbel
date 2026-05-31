import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, sha256Hex } from "@/lib/pdf-forms/security";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// Types de champ qu'on accepte de signaler. Aligné sur `FieldType` côté
/// PdfForm — on tolère des valeurs inconnues mais on les normalise vers
/// "other" pour limiter le bruit en base.
const KNOWN_FIELD_TYPES = new Set([
  "text", "textarea", "number", "date", "checkbox", "select", "radio",
  "fullname", "niss", "iban", "postal_be", "tva_be", "bce", "phone_be", "email",
  "required", "format", // pseudo-types pour les erreurs génériques
]);

const MAX_USER_MESSAGE = 1000;
const MAX_REJECTED_VALUE = 500;
const MAX_ERROR_MESSAGE = 500;

interface RequestBody {
  formId?: string;
  formSlug?: string;
  fieldId?: string;
  fieldType?: string;
  rejectedValue?: string;
  errorMessage?: string;
  locale?: string;
  userMessage?: string;
  reporterEmail?: string;
}

/// POST /api/form-validation/report
/// Anonyme, rate-limité 5/h/IP. L'utilisateur a explicitement consenti (case
/// à cocher dans la dialog) à transmettre `rejectedValue` en clair.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`form-report:${ip}`, { windowMs: 60 * 60_000, max: 5 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de signalements depuis cette adresse. Réessayez dans une heure." },
      { status: 429, headers: json }
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }

  // Validation des champs requis.
  if (typeof body.fieldId !== "string" || !body.fieldId.trim()) {
    return NextResponse.json({ error: "fieldId requis" }, { status: 400, headers: json });
  }
  if (typeof body.fieldType !== "string" || !body.fieldType.trim()) {
    return NextResponse.json({ error: "fieldType requis" }, { status: 400, headers: json });
  }
  if (typeof body.rejectedValue !== "string") {
    return NextResponse.json({ error: "rejectedValue requis" }, { status: 400, headers: json });
  }
  if (typeof body.errorMessage !== "string" || !body.errorMessage.trim()) {
    return NextResponse.json({ error: "errorMessage requis" }, { status: 400, headers: json });
  }

  // Email optionnel : validation légère si fourni.
  let reporterEmail: string | null = null;
  if (body.reporterEmail && body.reporterEmail.trim()) {
    const trimmed = body.reporterEmail.trim();
    if (trimmed.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400, headers: json });
    }
    reporterEmail = trimmed;
  }

  // formId : si fourni, on vérifie qu'il existe pour éviter les FK violations.
  let formId: string | null = null;
  if (body.formId && typeof body.formId === "string") {
    const exists = await prisma.pdfForm.findUnique({
      where: { id: body.formId },
      select: { id: true },
    });
    if (exists) formId = body.formId;
  }

  const fieldType = KNOWN_FIELD_TYPES.has(body.fieldType) ? body.fieldType : "other";
  const locale = body.locale === "nl" || body.locale === "de" || body.locale === "fr" ? body.locale : null;

  const report = await prisma.formValidationReport.create({
    data: {
      formId,
      formSlug: body.formSlug?.slice(0, 200) ?? null,
      fieldId: body.fieldId.slice(0, 100),
      fieldType,
      rejectedValue: body.rejectedValue.slice(0, MAX_REJECTED_VALUE),
      errorMessage: body.errorMessage.slice(0, MAX_ERROR_MESSAGE),
      locale,
      userMessage: body.userMessage?.slice(0, MAX_USER_MESSAGE) ?? null,
      reporterEmail,
      ipHash: sha256Hex(ip).slice(0, 16),
      userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: report.id }, { status: 201, headers: json });
}
