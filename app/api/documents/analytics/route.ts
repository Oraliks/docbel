import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";

const VALID_EVENTS = [
  "started",
  "section_completed",
  "field_error",
  "preview",
  "abandoned",
  "submitted",
  "signature_started",
];

export async function POST(req: NextRequest) {
  // Rate limit pour éviter le spam : 60 events/minute par IP
  const ip = getClientIp(req);
  const rl = checkRateLimit(`analytics:${ip}`, { windowMs: 60_000, max: 60 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { templateId, sessionId, eventType, contextKey, metadata } = body || {};
  if (!templateId || !sessionId || !eventType) {
    return NextResponse.json({ ok: false, error: "params manquants" }, { status: 400 });
  }
  if (!VALID_EVENTS.includes(eventType)) {
    return NextResponse.json({ ok: false, error: "eventType invalide" }, { status: 400 });
  }

  // Vérifier que le template existe (pas d'event orphelin)
  const exists = await prisma.documentTemplate.findUnique({
    where: { id: templateId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ ok: false, error: "template inconnu" }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });

  await prisma.formAnalyticsEvent.create({
    data: {
      templateId,
      sessionId: String(sessionId).slice(0, 64),
      userId: session?.user?.id || null,
      eventType,
      contextKey: contextKey ? String(contextKey).slice(0, 200) : null,
      metadata: metadata || undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
