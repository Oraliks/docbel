import { Resend } from "resend";

export interface SendDocumentEmailInput {
  to: string;
  subject: string;
  text: string;
  filename: string;
  attachment: Buffer;
}

export async function sendDocumentEmail(
  input: SendDocumentEmailInput
): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) throw new Error("RESEND_API_KEY non configurée");
  if (!from) throw new Error("EMAIL_FROM non configurée");

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    attachments: [
      {
        filename: input.filename,
        content: input.attachment,
      },
    ],
  });

  if (result.error) {
    throw new Error(result.error.message || "Échec d'envoi de l'email");
  }
  return { id: result.data?.id || "" };
}

export interface AdminNotificationInput {
  templateName: string;
  toolSlug: string;
  generatedId: string;
  isAnonymous: boolean;
  userEmail?: string | null;
  expiresAt: Date;
}

/**
 * Notification email envoyée à l'admin à chaque génération de document.
 * Silencieux (no-op) si ADMIN_NOTIFICATION_EMAIL n'est pas configuré.
 */
export async function notifyAdminOfGeneration(input: AdminNotificationInput): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!adminEmail || !apiKey || !from) return;

  try {
    const resend = new Resend(apiKey);
    const userInfo = input.isAnonymous
      ? "utilisateur anonyme"
      : input.userEmail
      ? `utilisateur connecté : ${input.userEmail}`
      : "utilisateur connecté";
    await resend.emails.send({
      from,
      to: adminEmail,
      subject: `[beldoc] Nouveau document généré — ${input.templateName}`,
      text: [
        `Un document vient d'être généré sur beldoc.`,
        ``,
        `Modèle : ${input.templateName}`,
        `Outil : /outils/${input.toolSlug}`,
        `ID interne : ${input.generatedId}`,
        `Demandeur : ${userInfo}`,
        `Expiration du document : ${input.expiresAt.toLocaleString("fr-BE")}`,
      ].join("\n"),
    });
  } catch (err) {
    // On ne bloque jamais la génération si la notif admin échoue
    console.error("notifyAdminOfGeneration error:", err);
  }
}
