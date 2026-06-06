import { NextRequest, NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confirmation de présence en 1 clic depuis l'email de rappel (B).
 * GET idempotent (lien cliquable dans un email) → rend une page de confirmation.
 */
function page(title: string, message: string): NextResponse {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f4fb;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
  <div style="max-width:420px;background:#fff;border-radius:16px;padding:32px;box-shadow:0 8px 30px rgba(80,40,140,.08);text-align:center">
    <h1 style="color:#7C3AED;font-size:20px;margin:0 0 12px">${title}</h1>
    <p style="color:#4b5563;font-size:15px;line-height:1.5;margin:0 0 20px">${message}</p>
    <a href="/" style="color:#7C3AED;font-weight:600;text-decoration:none">Retour à l'accueil</a>
  </div>
</body></html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function run(token: string): Promise<NextResponse> {
  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: token },
    select: { id: true, status: true, presenceConfirmedAt: true },
  });
  if (!booking) {
    return page("Lien invalide", "Ce rendez-vous est introuvable. Le lien est peut-être expiré.");
  }
  if (booking.status !== BookingStatus.confirmed) {
    return page(
      "Présence non confirmable",
      "Ce rendez-vous n'est pas (ou plus) confirmé. Consultez votre email de confirmation.",
    );
  }
  if (!booking.presenceConfirmedAt) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { presenceConfirmedAt: new Date() },
    });
  }
  return page("Présence confirmée ✓", "Merci ! Votre présence est bien enregistrée. À bientôt.");
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return run(token);
}
export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return run(token);
}
