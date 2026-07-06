import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getClientIp } from "@/lib/pdf-forms/security";
import { createReport } from "@/lib/reports/engine";

const json = { "Content-Type": "application/json; charset=utf-8" };

interface Body {
  type?: string;
  targetId?: string;
  message?: string;
  payload?: unknown;
  reporterEmail?: string;
}

/// POST /api/reports — point d'entrée unique pour tous les signalements
/// (remplace bureaux/form-validation/formations/translation-suggestions).
/// Anonyme si pas de session (email optionnel, rate-limité) ; identité
/// auto-remplie si connecté (partenaire/employeur/admin), jamais limité.
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }

  if (typeof body.type !== "string" || !body.type) {
    return NextResponse.json({ error: "type requis" }, { status: 400, headers: json });
  }

  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  const result = await createReport({
    type: body.type,
    targetId: typeof body.targetId === "string" ? body.targetId : undefined,
    message: typeof body.message === "string" ? body.message : undefined,
    payload: body.payload ?? {},
    reporterEmail: typeof body.reporterEmail === "string" ? body.reporterEmail : undefined,
    session: session?.user
      ? {
          id: session.user.id,
          email: session.user.email,
          partnerOrganization: (session.user as { partnerOrganization?: string | null }).partnerOrganization ?? null,
          segment: (session.user as { segment?: string | null }).segment ?? null,
          vatNumber: (session.user as { vatNumber?: string | null }).vatNumber ?? null,
        }
      : null,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status, headers: json });
  }
  return NextResponse.json({ ok: true, id: result.id }, { status: 201, headers: json });
}
