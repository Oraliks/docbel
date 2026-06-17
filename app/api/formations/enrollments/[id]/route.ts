import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { guardFormationOrg, forbidden } from "@/lib/formations/guard";
import { notifyEnrollment } from "@/lib/formations/providers/notifications";
import { issueCertificateForEnrollment } from "@/lib/formations/certificates/service";

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

  // Émission d'attestation à la fin (statut → certificate_available si succès).
  let certificateIssued = false;
  if (parsed.data.action === "completed") {
    const cert = await issueCertificateForEnrollment(id).catch(() => null);
    certificateIssued = !!cert;
  }

  // Notification au citoyen pour les transitions visibles + attestation.
  const notifyActions = ["accept", "refuse", "cancel"];
  if ((notifyActions.includes(parsed.data.action) || certificateIssued) && enrollment.citizenEmail) {
    const training = await prisma.training.findUnique({
      where: { id: enrollment.trainingId },
      select: { title: true, slug: true },
    });
    const org = await prisma.formationOrganization.findUnique({
      where: { id: enrollment.organizationId },
      select: { name: true },
    });
    if (training) {
      await notifyEnrollment({
        type: certificateIssued ? "certificate_available" : `enrollment_${t.status}`,
        emailStatus: certificateIssued ? "accepted" : t.status,
        recipientId: enrollment.userId,
        recipientEmail: enrollment.citizenEmail,
        organizationId: enrollment.organizationId,
        trainingId: enrollment.trainingId,
        sessionId: enrollment.sessionId,
        enrollmentId: id,
        citizenName: enrollment.citizenName,
        trainingTitle: training.title,
        trainingSlug: training.slug,
        orgName: org?.name ?? "Docbel",
        note: certificateIssued ? "Votre attestation est disponible." : parsed.data.note ?? null,
      });
    }
  }

  await logActivity(auth.user.id, "updated", "enrollment", enrollment.citizenName ?? "Inscription", id, parsed.data.action);
  return NextResponse.json({ ok: true, status: certificateIssued ? "certificate_available" : t.status }, { headers: json });
}
