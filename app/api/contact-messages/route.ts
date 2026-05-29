import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { logActivity } from "@/lib/activity-logger";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIMITS = {
  name: { min: 2, max: 100 },
  email: { min: 5, max: 200 },
  subject: { min: 3, max: 200 },
  message: { min: 10, max: 5000 },
} as const;

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
  try {
    // Rate-limit anti-spam : 3 messages / 10 min / IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`contact-messages:${ip}`, {
      windowMs: 10 * 60_000,
      max: 3,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop de messages envoyés — réessayez dans quelques minutes" },
        { status: 429, headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Tous les champs sont obligatoires" },
        { status: 400 }
      );
    }
    if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) {
      return NextResponse.json({ error: "Nom invalide" }, { status: 400 });
    }
    if (email.length > LIMITS.email.max || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }
    if (subject.length < LIMITS.subject.min || subject.length > LIMITS.subject.max) {
      return NextResponse.json({ error: "Sujet invalide" }, { status: 400 });
    }
    if (message.length < LIMITS.message.min || message.length > LIMITS.message.max) {
      return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const noreplyFrom = process.env.EMAIL_FROM;
    const contactInbox = process.env.CONTACT_EMAIL_FROM;
    if (!apiKey || !noreplyFrom || !contactInbox) {
      console.error("[contact-form] missing env vars (RESEND_API_KEY/EMAIL_FROM/CONTACT_EMAIL_FROM)");
      return NextResponse.json(
        { error: "Service de messagerie indisponible" },
        { status: 503 }
      );
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
      return NextResponse.json(
        { error: "Échec de l'envoi" },
        { status: 502 }
      );
    }

    await logActivity(
      "Contact Form",
      "received",
      "message",
      `${name} (${email})`,
      result.data?.id || undefined,
      `Sujet: ${subject}`
    );

    return NextResponse.json({ status: "ok" }, { status: 201 });
  } catch (err) {
    console.error("[contact-form] failed:", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
