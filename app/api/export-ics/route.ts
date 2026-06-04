import { NextResponse, type NextRequest } from "next/server";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import {
  AppointmentParseError,
  appointmentsFilename,
  generateICS,
  parseAppointments,
} from "@/lib/rendez-vous/ics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

/**
 * POST /api/export-ics
 *
 * Body : `{ "content": "<texte collé>" }`
 * Réponse OK : `text/calendar` en pièce jointe `RDV_JJ_MM_AAAA.ics`.
 *
 * Accès réservé aux PARTENAIRES (dont la FGTB) et aux ADMINS — l'outil n'est
 * pas public. La garde renvoie elle-même la réponse 401/403 adéquate.
 */
export async function POST(req: NextRequest) {
  const authResult = await requirePartnerOrAdminAuth();
  if (!authResult.isAuthorized) {
    return authResult.error;
  }

  let content: unknown;
  try {
    const body = (await req.json()) as { content?: unknown } | null;
    content = body?.content;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête JSON invalide.", code: "BAD_REQUEST" },
      { status: 400, headers: jsonHeaders },
    );
  }

  if (typeof content !== "string" || content.trim() === "") {
    return NextResponse.json(
      {
        error: "Aucun texte fourni. Collez la liste des rendez-vous.",
        code: "NO_APPOINTMENTS",
      },
      { status: 400, headers: jsonHeaders },
    );
  }

  try {
    const appointments = parseAppointments(content);
    const ics = generateICS(appointments);
    const filename = appointmentsFilename(appointments);

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Appointment-Count": String(appointments.length),
      },
    });
  } catch (err) {
    if (err instanceof AppointmentParseError) {
      return NextResponse.json(
        { error: err.message, code: err.code, line: err.line ?? null },
        { status: 400, headers: jsonHeaders },
      );
    }
    console.error("[export-ics] erreur inattendue", err);
    return NextResponse.json(
      {
        error: "Erreur interne lors de la génération du fichier.",
        code: "INTERNAL",
      },
      { status: 500, headers: jsonHeaders },
    );
  }
}
