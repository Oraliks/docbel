import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
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

const VERIFY_TTL_MS = 24 * 3_600_000; // 24 h

/** Page HTML de confirmation (double opt-in). */
function page(title: string, message: string): NextResponse {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f4fb;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
  <div style="max-width:440px;background:#fff;border-radius:16px;padding:32px;box-shadow:0 8px 30px rgba(80,40,140,.08);text-align:center">
    <h1 style="color:#7C3AED;font-size:20px;margin:0 0 12px">${title}</h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.5;margin:0 0 20px">${message}</p>
    <a href="/" style="color:#7C3AED;font-weight:600;text-decoration:none">Retour à l'accueil</a>
  </div>
</body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function run(token: string): Promise<NextResponse> {
  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: token },
    include: { tenant: true, location: true },
  });
  if (!booking) {
    return page("Lien invalide", "Ce rendez-vous est introuvable. Le lien est peut-être incorrect.");
  }
  if (booking.status !== BookingStatus.pending_verification) {
    return page(
      "Demande déjà confirmée",
      "Votre adresse a déjà été vérifiée — aucune action supplémentaire n'est nécessaire.",
    );
  }
  if (Date.now() - booking.createdAt.getTime() > VERIFY_TTL_MS) {
    return page(
      "Lien expiré",
      "Ce lien de vérification a expiré. Reprenez rendez-vous pour en recevoir un nouveau.",
    );
  }

  // Le créneau est-il toujours disponible ?
  const slot = await findSlot(booking.locationId, booking.date, booking.startTime);
  const count = await prisma.booking.count({
    where: {
      locationId: booking.locationId,
      date: booking.date,
      startTime: booking.startTime,
      status: { in: [BookingStatus.pending_approval, BookingStatus.confirmed] },
      id: { not: booking.id },
    },
  });
  if (!slot || count >= slot.capacity) {
    return page(
      "Créneau complet",
      "Ce créneau n'est malheureusement plus disponible. Vous pouvez reprendre rendez-vous sur un autre créneau.",
    );
  }

  const confirmed = !booking.tenant.requireApproval;
  const newStatus = confirmed ? BookingStatus.confirmed : BookingStatus.pending_approval;
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: newStatus,
      verifiedAt: new Date(),
      confirmedAt: confirmed ? new Date() : null,
    },
  });

  // Notifications (fail-soft : n'empêchent jamais la confirmation).
  if (booking.citizenEmail) {
    const ctxEmail = {
      to: booking.citizenEmail,
      citizenName: booking.citizenName,
      tenantName: booking.tenant.name,
      fromName: booking.tenant.emailFromName ?? booking.tenant.name,
      brandColor: booking.tenant.brandColor,
      locationName: booking.location.name,
      locationAddress: locationAddress(booking.location),
      date: booking.date,
      startTime: booking.startTime,
      token,
    };
    if (confirmed) {
      const ics = icsForBooking(
        { date: booking.date, startTime: booking.startTime, endTime: booking.endTime },
        `${booking.tenant.name} — Rendez-vous`,
      );
      await sendBookingConfirmed({ ...ctxEmail, icsContent: ics });
    } else {
      await sendBookingReceived(ctxEmail);
    }
  }
  if (booking.tenant.notifyEmail) {
    await sendTeamNewBooking({
      to: booking.tenant.notifyEmail,
      tenantId: booking.tenantId,
      tenantName: booking.tenant.name,
      fromName: booking.tenant.emailFromName ?? booking.tenant.name,
      brandColor: booking.tenant.brandColor,
      citizenName: booking.citizenName,
      citizenEmail: booking.citizenEmail,
      locationName: booking.location.name,
      date: booking.date,
      startTime: booking.startTime,
      pending: !confirmed,
    });
  }

  return page(
    "Email vérifié ✓",
    confirmed
      ? "Votre rendez-vous est confirmé. Un email récapitulatif vous a été envoyé."
      : "Votre demande est confirmée et en cours de validation par l'équipe. Vous recevrez un email dès qu'elle est acceptée.",
  );
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return run(token);
}
export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return run(token);
}
