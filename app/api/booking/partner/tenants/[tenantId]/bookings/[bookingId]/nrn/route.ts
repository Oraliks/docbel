import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { guardTenant } from "@/lib/booking/partner-guard";
import { decryptNrn, formatNrn } from "@/lib/booking/crypto-nrn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Déchiffre et renvoie le NRN complet d'une réservation, à la demande, pour un
 * agent autorisé du guichet (vérification du dossier). Le NRN n'est jamais
 * exposé en masse : il faut ouvrir le détail d'un RDV précis.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ tenantId: string; bookingId: string }> },
) {
  const { tenantId, bookingId } = await ctx.params;
  const guard = await guardTenant(tenantId, "approve");
  if (!guard.ok) return guard.response;

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    select: { citizenNrnEnc: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Réservation introuvable" }, { status: 404, headers: json });
  }

  const nrn = decryptNrn(booking.citizenNrnEnc);
  return NextResponse.json(
    { nrn, formatted: nrn ? formatNrn(nrn) : null },
    { headers: json },
  );
}
