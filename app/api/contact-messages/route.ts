import { NextRequest } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { apiError, apiOk } from "@/lib/api/response";
import { tooManyRequests } from "@/lib/api/rate-limit-response";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIMITS = {
  name: { min: 2, max: 100 },
  email: { min: 5, max: 200 },
  subject: { min: 3, max: 200 },
  message: { min: 10, max: 5000 },
} as const;

// Check the raw value before trimming: CR/LF at either end is invalid too.
// These three fields become email headers; the message may remain multiline.
function headerField(error: string) {
  return z.string({ error: "Tous les champs sont obligatoires" })
    .refine((value) => !/[\r\n]/.test(value), { error })
    .trim()
    .min(1, "Tous les champs sont obligatoires");
}

const contactSchema = z.object({
  name: headerField("Nom invalide")
    .min(LIMITS.name.min, "Nom invalide")
    .max(LIMITS.name.max, "Nom invalide"),
  email: headerField("Email invalide")
    .toLowerCase()
    .max(LIMITS.email.max, "Email invalide")
    .regex(EMAIL_RE, "Email invalide"),
  subject: headerField("Sujet invalide")
    .min(LIMITS.subject.min, "Sujet invalide")
    .max(LIMITS.subject.max, "Sujet invalide"),
  message: z.string({ error: "Tous les champs sont obligatoires" })
    .trim()
    .min(1, "Tous les champs sont obligatoires")
    .min(LIMITS.message.min, "Message invalide")
    .max(LIMITS.message.max, "Message invalide"),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Public contact form endpoint.
 *
 * The submission is forwarded as an email to CONTACT_EMAIL_FROM (typically
 * contact@docbel.be). Reply-To is set to the visitor's address so admin
 * replies via /admin/messagerie or OVH webmail go straight back to them.
 *
 * Nothing is stored in our DB — the OVH mailbox (synced via IMAP) is the
 * single source of truth for messagerie.
 */
export async function POST(request: NextRequest) {
  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  try {
    // Rate-limit anti-spam : 3 messages / 10 min / IP
    const ip = getClientIp(request);
    const rl = await checkRateLimit(`contact-messages:${ip}`, {
      windowMs: 10 * 60_000,
      max: 3,
    });
    if (!rl.ok) {
      return tooManyRequests({
        limit: 3,
        resetAt: rl.resetAt,
        message: "Trop de messages envoyés — réessayez dans quelques minutes",
      });
    }

    const body = await request.json().catch(() => null);
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, body === null || typeof body !== "object" || Array.isArray(body)
        ? "Tous les champs sont obligatoires"
        : parsed.error.issues[0].message);
    }
    const { name, email, subject, message } = parsed.data;

    const apiKey = process.env.RESEND_API_KEY;
    const noreplyFrom = process.env.EMAIL_FROM;
    const contactInbox = process.env.CONTACT_EMAIL_FROM;
    if (!apiKey || !noreplyFrom || !contactInbox) {
      console.error("[contact-form] missing env vars (RESEND_API_KEY/EMAIL_FROM/CONTACT_EMAIL_FROM)");
      return apiError(503, "Service de messagerie indisponible");
    }

    const formattedSubject = `[Formulaire] ${subject}`;
    const text = [
      `Nouveau message via le formulaire de contact`,
      ``,
      `De     : ${name} <${email}>`,
      `Sujet  : ${subject}`,
      ``,
      `--- Message ---`,
      message,
      `---------------`,
      ``,
      `Pour répondre, utilisez simplement Répondre — la réponse sera adressée directement à ${email}.`,
    ].join("\n");

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="margin:0 0 12px;font-size:18px;font-weight:600">Nouveau message via le formulaire de contact</h2>
        <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
          <tr><td style="padding:4px 12px 4px 0;color:#666">De</td><td style="padding:4px 0"><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Sujet</td><td style="padding:4px 0">${escapeHtml(subject)}</td></tr>
        </table>
        <div style="border-left:3px solid #ddd;padding:8px 14px;background:#fafafa;white-space:pre-wrap;font-size:14px;line-height:1.5">${escapeHtml(message)}</div>
        <p style="margin-top:16px;font-size:12px;color:#888">Répondez à cet email pour écrire directement à ${escapeHtml(email)}.</p>
      </div>
    `;

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: `${name} (formulaire) <${noreplyFrom}>`,
      to: contactInbox,
      replyTo: email,
      subject: formattedSubject,
      text,
      html,
    });

    if (result.error) {
      console.error("[contact-form] Resend error:", result.error);
      return apiError(502, "Échec de l'envoi");
    }

    await logActivity(
      "Contact Form",
      "received",
      "message",
      `${name} (${email})`,
      result.data?.id || undefined,
      `Sujet: ${subject}`
    );

    return apiOk({ status: "ok" }, { status: 201 });
  } catch (err) {
    console.error("[contact-form] failed:", err);
    return apiError(500, "Failed to send message");
  }
}
