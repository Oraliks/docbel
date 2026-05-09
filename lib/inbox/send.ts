import { Resend } from "resend";
import { nanoid } from "nanoid";
import { appendToSent } from "@/lib/inbox/imap";

export interface SendReplyInput {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
  /** Override the From address (defaults to CONTACT_EMAIL_FROM) */
  fromAddress?: string;
  /** Override the From display name */
  fromName?: string | null;
  /** Override Reply-To (defaults to From) */
  replyTo?: string;
}

export interface SendReplyResult {
  resendId: string;
  imapAppended: boolean;
}

/**
 * Encode a header value containing non-ASCII characters using RFC 2047
 * encoded-word syntax with Base64. Pure-ASCII values are returned unchanged.
 */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function buildAddressHeader(address: string, name: string | null | undefined): string {
  if (!name) return address;
  return `${encodeHeader(name)} <${address}>`;
}

/**
 * Build a minimal RFC 5322 message suitable for IMAP APPEND.
 * Plain text body only — base64-encoded so any UTF-8 content is safe.
 */
function buildRfc822(opts: {
  fromAddress: string;
  fromName?: string | null;
  toAddress: string;
  toName?: string | null;
  replyTo?: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
}): { rfc822: string; messageId: string } {
  const messageId = `<${nanoid(24)}@docbel.be>`;
  const date = new Date().toUTCString().replace("GMT", "+0000");
  const bodyB64 = Buffer.from(opts.text, "utf-8").toString("base64");
  const wrappedBody = bodyB64.match(/.{1,76}/g)?.join("\r\n") || "";

  const lines: string[] = [
    `From: ${buildAddressHeader(opts.fromAddress, opts.fromName)}`,
    `To: ${buildAddressHeader(opts.toAddress, opts.toName)}`,
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : null,
    `Subject: ${encodeHeader(opts.subject)}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
    opts.references ? `References: ${opts.references}` : null,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    wrappedBody,
  ].filter((l): l is string => l !== null);

  return { rfc822: lines.join("\r\n"), messageId };
}

/**
 * Send a reply through Resend AND append a copy to the OVH IMAP Sent folder
 * so that the message appears in both /admin/messagerie SENT tab and OVH webmail.
 *
 * IMAP APPEND failure does not fail the send — Resend already delivered the email.
 */
export async function sendContactReply(input: SendReplyInput): Promise<SendReplyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const defaultFrom = process.env.CONTACT_EMAIL_FROM;
  if (!apiKey) throw new Error("RESEND_API_KEY non configurée");
  if (!defaultFrom) throw new Error("CONTACT_EMAIL_FROM non configurée");

  const fromAddress = input.fromAddress || defaultFrom;
  const fromName = input.fromName ?? null;
  const fromHeader = fromName ? `${fromName} <${fromAddress}>` : fromAddress;

  const headers: Record<string, string> = {};
  if (input.inReplyTo) headers["In-Reply-To"] = input.inReplyTo;
  if (input.references) headers["References"] = input.references;
  if (input.replyTo) headers["Reply-To"] = input.replyTo;

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: fromHeader,
    to: input.toName ? `${input.toName} <${input.to}>` : input.to,
    subject: input.subject,
    text: input.text,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (result.error) {
    throw new Error(result.error.message || "Échec d'envoi de l'email");
  }
  const resendId = result.data?.id || "";

  // Best-effort: copy to IMAP Sent so the email appears in OVH webmail too.
  let imapAppended = false;
  try {
    const { rfc822 } = buildRfc822({
      fromAddress,
      fromName,
      toAddress: input.to,
      toName: input.toName,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      inReplyTo: input.inReplyTo,
      references: input.references,
    });
    await appendToSent(rfc822);
    imapAppended = true;
  } catch (err) {
    console.error("[inbox/send] APPEND to Sent failed:", err);
  }

  return { resendId, imapAppended };
}
