import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardFormationOrg, forbidden } from "@/lib/formations/guard";

const json = { "Content-Type": "application/json; charset=utf-8" };
const schema = z.object({
  status: z.enum(["pending", "confirmed", "failed", "refunded"]),
  reference: z.string().trim().max(120).optional(),
});

/** Suivi manuel du paiement d'une inscription (V2 — provider manual). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;
  const block = await ensureWriteAllowed();
  if (block) return block;

  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Statut invalide" }, { status: 400, headers: json });

  const enrollment = await prisma.trainingEnrollment.findUnique({ where: { id } });
  if (!enrollment) return NextResponse.json({ error: "Inscription introuvable" }, { status: 404, headers: json });

  const guard = await guardFormationOrg(enrollment.organizationId);
  if (!guard.ok) return guard.response;
  if (!guard.can.manageEnrollments) return forbidden("Gestion des inscriptions non autorisée.");

  await prisma.trainingEnrollment.update({
    where: { id },
    data: {
      paymentStatus: parsed.data.status,
      paymentReference: parsed.data.reference ?? enrollment.paymentReference ?? `MAN-${nanoid(8)}`,
    },
  });
  await logActivity(auth.user.id, "updated", "enrollment", enrollment.citizenName ?? "Inscription", id, `payment_${parsed.data.status}`);
  return NextResponse.json({ ok: true }, { headers: json });
}
