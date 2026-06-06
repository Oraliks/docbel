import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { getServerAuthSession } from "@/lib/auth-session";
import { publicBookSchema } from "@/lib/booking/schemas";
import {
  extractIdentity,
  parseFormFields,
  redactSensitiveFormData,
  validateFormFields,
} from "@/lib/booking/form-fields";
import { findRecentBooking, hashNrn, nrnLast4 } from "@/lib/booking/dedupe";
import { encryptNrn } from "@/lib/booking/crypto-nrn";
import { findSlot } from "@/lib/booking/availability-data";
import { icsForBooking } from "@/lib/booking/ics-adapter";
import { locationAddress } from "@/lib/booking/route-bureau";
import {
  sendBookingConfirmed,
  sendBookingReceived,
  sendTeamNewBooking,
} from "@/lib/booking/emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`booking-book:${ip}`, { windowMs: 60 * 60_000, max: 12 }).ok) {
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
      {
        error: Object.values(validation.errors)[0] ?? "Formulaire invalide",
        fieldErrors: validation.errors,
      },
      { status: 400, headers: json },
    );
  }
  const identity = extractIdentity(fields, validation.data);

  // Session (pré-remplissage + détection du propriétaire du RDV existant).
  const session = await getServerAuthSession().catch(() => null);
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  // Anti-doublon (1 RDV par fenêtre) — re-vérifié côté serveur.
  const recent = await findRecentBooking({
    tenantId: tenant.id,
    field: tenant.dedupeField,
    windowDays: tenant.dedupeWindowDays,
    identity,
  });
  if (recent) {
    // Le propriétaire connecté reçoit le token pour gérer/déplacer en direct ;
    // sinon le lien de gestion s'envoie par email (anti-énumération).
    const owner = !!userId && recent.userId === userId;
    return NextResponse.json(
      {
        blocked: true,
        lastBookingDate: recent.date,
        ...(owner ? { manageToken: recent.confirmationToken } : {}),
      },
      { status: 409, headers: json },
    );
  }

  // Créneau valide ?
  const slot = await findSlot(locationId, date, startTime);
  if (!slot) {
    return NextResponse.json({ error: "Créneau indisponible" }, { status: 400, headers: json });
  }

  // Commune (best-effort, pour stats/routage).
  let communeId: string | null = null;
  if (identity.postalCode) {
    const pc = await prisma.postalCode.findUnique({
      where: { code: identity.postalCode },
      select: { communeId: true },
    });
    communeId = pc?.communeId ?? null;
  }

  const token = randomBytes(32).toString("base64url");
  const confirmed = !tenant.requireApproval;
  const status = confirmed ? BookingStatus.confirmed : BookingStatus.pending_approval;

  // RGPD : ne jamais persister le NRN en clair dans formData — il est conservé
  // haché (citizenNrnHash) + 4 derniers chiffres (citizenNrnLast4).
  const safeFormData = redactSensitiveFormData(fields, validation.data);

  let createdId: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.booking.count({
        where: {
          locationId,
          date,
          startTime,
          status: { in: [BookingStatus.pending_approval, BookingStatus.confirmed] },
        },
      });
      if (count >= slot.capacity) return null;
      return tx.booking.create({
        data: {
          tenantId: tenant.id,
          locationId,
          date,
          startTime,
          endTime: slot.endTime,
          serviceCode: slot.serviceCode ?? null,
          formData: safeFormData as object,
          citizenName: identity.name,
          citizenNameNormalized: identity.nameNormalized,
          citizenEmail: identity.email,
          citizenPhone: identity.phone,
          citizenNrnHash: identity.nrn ? hashNrn(identity.nrn) : null,
          citizenNrnLast4: identity.nrn ? nrnLast4(identity.nrn) : null,
          citizenNrnEnc: identity.nrn ? encryptNrn(identity.nrn) : null,
          citizenPostalCode: identity.postalCode,
          citizenCommuneId: communeId,
          userId,
          status,
          confirmationToken: token,
          confirmedAt: confirmed ? new Date() : null,
        },
        select: { id: true },
      });
    });
    if (!created) {
      return NextResponse.json(
        {
          error: "Ce créneau vient d'être complété — choisissez-en un autre",
          slotFull: true,
        },
        { status: 409, headers: json },
      );
    }
    createdId = created.id;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Vous avez déjà réservé ce créneau" },
        { status: 409, headers: json },
      );
    }
    console.error("[booking] création échouée:", e);
    return NextResponse.json({ error: "Erreur lors de la réservation" }, { status: 500, headers: json });
  }

  // Notifications (n'échouent jamais la requête).
  if (identity.email) {
    const ctxEmail = {
      to: identity.email,
      citizenName: identity.name,
      tenantName: tenant.name,
      fromName: tenant.emailFromName ?? tenant.name,
      brandColor: tenant.brandColor,
      locationName: location.name,
      locationAddress: locationAddress({
        id: location.id,
        name: location.name,
        street: location.street,
        postalCode: location.postalCode,
        city: location.city,
        lat: location.lat,
        lng: location.lng,
      }),
      date,
      startTime,
      token,
    };
    if (confirmed) {
      const ics = icsForBooking(
        { date, startTime, endTime: slot.endTime },
        `${tenant.name} — Rendez-vous`,
      );
      await sendBookingConfirmed({ ...ctxEmail, icsContent: ics });
    } else {
      await sendBookingReceived(ctxEmail);
    }
  }

  // Notif équipe (n'échoue jamais la requête).
  if (tenant.notifyEmail) {
    await sendTeamNewBooking({
      to: tenant.notifyEmail,
      tenantId: tenant.id,
      tenantName: tenant.name,
      fromName: tenant.emailFromName ?? tenant.name,
      brandColor: tenant.brandColor,
      citizenName: identity.name,
      citizenEmail: identity.email,
      locationName: location.name,
      date,
      startTime,
      pending: !confirmed,
    });
  }

  await logActivity(
    tenant.name,
    "created",
    "booking",
    identity.name ?? identity.email ?? "Citoyen",
    createdId,
    `RDV ${date} ${startTime} — ${confirmed ? "confirmé" : "en attente"}`,
  );

  return NextResponse.json({ ok: true, token, confirmed }, { status: 201, headers: json });
}
