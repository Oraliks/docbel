import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { getServerAuthSession } from "@/lib/auth-session";
import { publicBookSchema } from "@/lib/booking/schemas";
import {
  extractIdentity,
  parseFormFields,
  validateFormFields,
} from "@/lib/booking/form-fields";
import { hashNrn, nrnLast4 } from "@/lib/booking/dedupe";
import { findSlot } from "@/lib/booking/availability-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** Inscription en liste d'attente sur un créneau complet (C). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`booking-waitlist:${ip}`, { windowMs: 60 * 60_000, max: 20 }).ok) {
    return NextResponse.json(
      { error: "Trop de demandes — réessayez plus tard" },
      { status: 429, headers: json },
    );
  }

  const { slug } = await ctx.params;
  const tenant = await prisma.bookingTenant.findFirst({ where: { slug, active: true } });
  if (!tenant) {
    return NextResponse.json({ error: "Organisation introuvable" }, { status: 404, headers: json });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400, headers: json });
  }
  const parsed = publicBookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Requête invalide" },
      { status: 400, headers: json },
    );
  }
  const { locationId, date, startTime, formData } = parsed.data;

  const location = await prisma.bookingLocation.findFirst({
    where: { id: locationId, tenantId: tenant.id, active: true },
  });
  if (!location) {
    return NextResponse.json({ error: "Antenne invalide" }, { status: 400, headers: json });
  }

  const fields = parseFormFields(tenant.formFields);
  const validation = validateFormFields(fields, formData);
  if (!validation.ok) {
    return NextResponse.json(
      { error: Object.values(validation.errors)[0] ?? "Formulaire invalide", fieldErrors: validation.errors },
      { status: 400, headers: json },
    );
  }
  const identity = extractIdentity(fields, validation.data);
  if (!identity.email) {
    return NextResponse.json(
      { error: "Un email est nécessaire pour la liste d'attente" },
      { status: 400, headers: json },
    );
  }

  // Si le créneau a (re)trouvé de la place, inutile de s'inscrire.
  const slot = await findSlot(locationId, date, startTime);
  if (slot) {
    const count = await prisma.booking.count({
      where: {
        locationId,
        date,
        startTime,
        status: { in: [BookingStatus.pending_approval, BookingStatus.confirmed] },
      },
    });
    if (count < slot.capacity) {
      return NextResponse.json({ available: true }, { headers: json });
    }
  }

  // Déjà inscrit sur ce créneau ?
  const existing = await prisma.bookingWaitlist.findFirst({
    where: {
      locationId,
      date,
      startTime,
      citizenEmail: identity.email,
      status: { in: ["waiting", "notified"] },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, already: true }, { headers: json });
  }

  const session = await getServerAuthSession().catch(() => null);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  await prisma.bookingWaitlist.create({
    data: {
      tenantId: tenant.id,
      locationId,
      date,
      startTime,
      citizenName: identity.name,
      citizenNameNormalized: identity.nameNormalized,
      citizenEmail: identity.email,
      citizenPhone: identity.phone,
      citizenNrnHash: identity.nrn ? hashNrn(identity.nrn) : null,
      citizenNrnLast4: identity.nrn ? nrnLast4(identity.nrn) : null,
      citizenPostalCode: identity.postalCode,
      userId,
      status: "waiting",
    },
  });

  return NextResponse.json({ ok: true }, { status: 201, headers: json });
}
