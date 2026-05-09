import { Resend } from "resend";
import { nanoid } from "nanoid";
import { appendToSent } from "@/lib/inbox/imap";

export interface SendReplyInput {
  to: string;
  toName?: string | null;
  subject: string;
  /** Plain-text version (always required, used as text/plain alternative) */
  text: string;
  /** Optional HTML version. When provided, the email is sent multipart/alternative. */
  html?: string;
  inReplyTo?: string | null;
  references?: string | null;
  fromAddress?: string;
  fromName?: string | null;
  replyTo?: string;
}

export interface SendReplyResult {
  resendId: string;
  imapAppended: boolean;
}

function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function buildAddressHeader(address: string, name: string | null | undefined): string {
  if (!name) return address;
  return `${encodeHeader(name)} <${address}>`;
}

function base64Wrapped(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64").match(/.{1,76}/g)?.join("\r\n") || "";
}

interface BuildMessageOpts {
  fromAddress: string;
  fromName?: string | null;
  toAddress: string;
  toName?: string | null;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string | null;
  references?: string | null;
}

/**
 * Build an RFC 5322 message. If html is provided, structure as
 * multipart/alternative so receiving clients can display the best version.
 * Otherwise, single-part text/plain.
 */
function buildRfc822(opts: BuildMessageOpts): { rfc822: string; messageId: string } {
  const messageId = `<${nanoid(24)}@docbel.be>`;
  const date = new Date().toUTCString().replace("GMT", "+0000");

  const headerLines: string[] = [
    `From: ${buildAddressHeader(opts.fromAddress, opts.fromName)}`,
    `To: ${buildAddressHeader(opts.toAddress, opts.toName)}`,
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : null,
    `Subject: ${encodeHeader(opts.subject)}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
    opts.references ? `References: ${opts.references}` : null,
    `MIME-Version: 1.0`,
  ].filter((l): l is string => l !== null);

  if (opts.html) {
    const boundary = `alt-${nanoid(16)}`;
    const body = [
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: base64`,
      "",
      base64Wrapped(opts.text),
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: base64`,
      "",
      base64Wrapped(opts.html),
      `--${boundary}--`,
    ].join("\r\n");

    const rfc822 = [
      ...headerLines,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      body,
    ].join("\r\n");
    return { rfc822, messageId };
  }

  // Plain text only
  const rfc822 = [
    ...headerLines,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    base64Wrapped(opts.text),
  ].join("\r\n");
  return { rfc822, messageId };
}

/**
 * Send via Resend (multipart if html is given) AND append a copy to the
 * OVH IMAP Sent folder so the message appears in OVH webmail too.
 *
 * IMAP APPEND failure does not fail the send — Resend already delivered.
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
  const sendPayload: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    headers?: Record<string, string>;
  } = {
    from: fromHeader,
    to: input.toName ? `${input.toName} <${input.to}>` : input.to,
    subject: input.subject,
    text: input.text,
  };
  if (input.html) sendPayload.html = input.html;
  if (Object.keys(headers).length > 0) sendPayload.headers = headers;

  const result = await resend.emails.send(sendPayload);

  if (result.error) {
    throw new Error(result.error.message || "Échec d'envoi de l'email");
  }
  const resendId = result.data?.id || "";

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
      html: input.html,
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
