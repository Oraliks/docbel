import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardFormationOrg, forbidden } from "@/lib/formations/guard";
import { sendEnrollmentEmail } from "@/lib/formations/emails";

const json = { "Content-Type": "application/json; charset=utf-8" };

const schema = z.object({
  action: z.enum(["accept", "refuse", "waitlist", "present", "absent", "completed", "cancel"]),
  note: z.string().trim().max(2000).optional(),
});

const TRANSITION: Record<string, { status: string; stamp?: string }> = {
  accept: { status: "accepted", stamp: "acceptedAt" },
  refuse: { status: "refused", stamp: "refusedAt" },
  waitlist: { status: "waitlisted" },
  present: { status: "present", stamp: "attendanceMarkedAt" },
  absent: { status: "absent", stamp: "attendanceMarkedAt" },
  completed: { status: "completed", stamp: "completedAt" },
  cancel: { status: "cancelled_org", stamp: "cancelledAt" },
};

/** Gestion d'une inscription par l'organisation (accepter/refuser/présence…). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) return auth.error;
  const block = await ensureWriteAllowed();
  if (block) return block;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400, headers: json });
  }

  const enrollment = await prisma.trainingEnrollment.findUnique({ where: { id } });
  if (!enrollment) return NextResponse.json({ error: "Inscription introuvable" }, { status: 404, headers: json });

  const guard = await guardFormationOrg(enrollment.organizationId);
  if (!guard.ok) return guard.response;
  if (!guard.can.manageEnrollments) return forbidden("Gestion des inscriptions non autorisée.");

  const t = TRANSITION[parsed.data.action];
  const data: Record<string, unknown> = { status: t.status };
  if (t.stamp) data[t.stamp] = new Date();
  if (parsed.data.action === "accept") data.approvedById = auth.user.id;
  if (parsed.data.note) data.organizationNote = parsed.data.note;

  await prisma.trainingEnrollment.update({ where: { id }, data });

  // Notification au citoyen pour les transitions visibles.
  if (["accept", "refuse", "cancel"].includes(parsed.data.action) && enrollment.citizenEmail) {
    const training = await prisma.training.findUnique({
      where: { id: enrollment.trainingId },
      select: { title: true, slug: true },
    });
    const org = await prisma.formationOrganization.findUnique({
      where: { id: enrollment.organizationId },
      select: { name: true },
    });
    if (training) {
      await sendEnrollmentEmail({
        to: enrollment.citizenEmail,
        citizenName: enrollment.citizenName,
        trainingTitle: training.title,
        trainingSlug: training.slug,
        orgName: org?.name ?? "Docbel",
        status: t.status,
        note: parsed.data.note ?? null,
      });
    }
  }

  await logActivity(auth.user.id, "updated", "enrollment", enrollment.citizenName ?? "Inscription", id, parsed.data.action);
  return NextResponse.json({ ok: true, status: t.status }, { headers: json });
}
