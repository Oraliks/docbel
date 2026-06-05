import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { normalizeName } from "@/lib/rendez-vous/history";
import { isValidNrn } from "@/lib/booking/form-fields";
import { findRecentBooking } from "@/lib/booking/dedupe";
import { dedupeCheckSchema } from "@/lib/booking/schemas";
import type { CitizenIdentity } from "@/lib/booking/types";

export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Vérification anti-doublon "live" (au remplissage du formulaire), pour bloquer
 * tôt un citoyen ayant déjà un RDV dans la fenêtre. Le verrou définitif reste
 * côté /book.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`booking-dedupe:${ip}`, { windowMs: 60_000, max: 30 }).ok) {
    return NextResponse.json({ blocked: false }, { headers: json });
  }

  const { slug } = await ctx.params;
  const tenant = await prisma.bookingTenant.findFirst({
    where: { slug, active: true },
    select: { id: true, dedupeField: true, dedupeWindowDays: true },
  });
  if (!tenant) {
    return NextResponse.json({ blocked: false }, { headers: json });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ blocked: false }, { headers: json });
  }
  const parsed = dedupeCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ blocked: false }, { headers: json });
  }

  const name = parsed.data.name?.trim() || null;
  const nrnDigits = parsed.data.nrn ? parsed.data.nrn.replace(/\D/g, "") : null;
  const identity: CitizenIdentity = {
    name,
    nameNormalized: name ? normalizeName(name) : null,
    email: parsed.data.email ? parsed.data.email.toLowerCase().trim() : null,
    phone: null,
    nrn: nrnDigits && isValidNrn(nrnDigits) ? nrnDigits : null,
    postalCode: null,
  };

  const recent = await findRecentBooking({
    tenantId: tenant.id,
    field: tenant.dedupeField,
    windowDays: tenant.dedupeWindowDays,
    identity,
  });

  return NextResponse.json(
    { blocked: !!recent, lastBookingDate: recent?.date ?? null },
    { headers: json },
  );
}
