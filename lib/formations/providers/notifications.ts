/**
 * Provider de notifications du module Formations. Abstraction au-dessus de
 * l'email (Resend best-effort) + un journal en base (TrainingNotificationLog)
 * qui sert d'historique "in-app". Aucune API requise : sans Resend, on logge en
 * base (channel inapp) sans casser le flux. Gated par le flag `notifications`.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { isFlagEnabled } from "@/lib/formations/module";
import { sendEnrollmentEmail } from "@/lib/formations/emails";

export interface NotifyEnrollmentCtx {
  /** Type d'événement (enrollment_requested, enrollment_accepted, …). */
  type: string;
  /** Statut d'inscription pour le template email (requested|accepted|refused|waitlisted|cancelled_org). */
  emailStatus: string;
  recipientId?: string | null;
  recipientEmail?: string | null;
  organizationId?: string | null;
  trainingId?: string | null;
  sessionId?: string | null;
  enrollmentId?: string | null;
  citizenName?: string | null;
  trainingTitle: string;
  trainingSlug: string;
  orgName?: string | null;
  sessionLabel?: string | null;
  note?: string | null;
}

function emailProviderName(): string {
  if (process.env.RESEND_API_KEY) return "resend";
  return "database"; // pas d'envoi réel — journalisé seulement
}

/** Notifie le citoyen d'un changement d'inscription : journal in-app + email. */
export async function notifyEnrollment(ctx: NotifyEnrollmentCtx): Promise<void> {
  if (!(await isFlagEnabled("notifications"))) return;

  // 1) Journal in-app (toujours).
  await prisma.trainingNotificationLog
    .create({
      data: {
        type: ctx.type,
        recipientId: ctx.recipientId ?? null,
        recipientEmail: ctx.recipientEmail ?? null,
        organizationId: ctx.organizationId ?? null,
        trainingId: ctx.trainingId ?? null,
        sessionId: ctx.sessionId ?? null,
        enrollmentId: ctx.enrollmentId ?? null,
        channel: "inapp",
        status: "sent",
        provider: "database",
        payloadJson: {
          trainingTitle: ctx.trainingTitle,
          orgName: ctx.orgName ?? null,
          note: ctx.note ?? null,
        },
        sentAt: new Date(),
      },
    })
    .catch((e) => console.error("[formations/notify] inapp log failed:", e));

  // 2) Email (best-effort, journalisé).
  if (ctx.recipientEmail) {
    const provider = emailProviderName();
    let status = "skipped";
    let error: string | null = null;
    if (provider === "resend") {
      try {
        await sendEnrollmentEmail({
          to: ctx.recipientEmail,
          citizenName: ctx.citizenName ?? null,
          trainingTitle: ctx.trainingTitle,
          trainingSlug: ctx.trainingSlug,
          orgName: ctx.orgName ?? "Docbel",
          status: ctx.emailStatus,
          sessionLabel: ctx.sessionLabel ?? null,
          note: ctx.note ?? null,
        });
        status = "sent";
      } catch (e) {
        status = "failed";
        error = e instanceof Error ? e.message : String(e);
      }
    }
    await prisma.trainingNotificationLog
      .create({
        data: {
          type: ctx.type,
          recipientId: ctx.recipientId ?? null,
          recipientEmail: ctx.recipientEmail,
          organizationId: ctx.organizationId ?? null,
          trainingId: ctx.trainingId ?? null,
          sessionId: ctx.sessionId ?? null,
          enrollmentId: ctx.enrollmentId ?? null,
          channel: "email",
          status,
          provider,
          payloadJson: { emailStatus: ctx.emailStatus },
          error,
          sentAt: status === "sent" ? new Date() : null,
        },
      })
      .catch((e) => console.error("[formations/notify] email log failed:", e));
  }
}
