import { Resend } from "resend";

export interface SendReplyInput {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string | null;
  references?: string | null;
}

export interface SendReplyResult {
  id: string;
}

/**
 * Send an email from contact@docbel.be via Resend.
 * Used for both:
 *   - replying to /admin/messages (contact form submissions)
 *   - replying to /admin/inbox (real IMAP emails)
 *
 * The From: header is CONTACT_EMAIL_FROM. Replies from the recipient go back
 * to that same address (it's a real mailbox), which we read via IMAP.
 */
export async function sendContactReply(input: SendReplyInput): Promise<SendReplyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_EMAIL_FROM;
  if (!apiKey) throw new Error("RESEND_API_KEY non configurée");
  if (!from) throw new Error("CONTACT_EMAIL_FROM non configurée");

  const resend = new Resend(apiKey);

  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references) headers["References"] = input.references;

  const result = await resend.emails.send({
    from,
    to: input.toName ? `${input.toName} <${input.to}>` : input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (result.error) {
    throw new Error(result.error.message || "Échec d'envoi de l'email");
  }
  return { id: result.data?.id || "" };
}
