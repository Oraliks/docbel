/**
 * Helpers to convert between plain text, HTML, and quoted replies for the
 * messagerie editor. Pure functions — usable in both client and server.
 */

import type { EmailListItem, EmailFull, ThreadEmail } from "./types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert plain text to HTML preserving paragraph structure:
 *  - Blank lines split paragraphs
 *  - Single newlines become <br>
 */
export function plainToHtml(text: string): string {
  if (!text) return "";
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs
    .map((p) => {
      const escaped = escapeHtml(p).replace(/\n/g, "<br>");
      return `<p>${escaped || "<br>"}</p>`;
    })
    .join("");
}

/**
 * Strip HTML to a reasonable plain-text approximation. Used to derive the
 * `text/plain` part of outgoing multipart emails (what clients without HTML
 * support will see). Not perfect, just good enough.
 */
export function htmlToPlain(html: string): string {
  if (!html) return "";
  return html
    // Block elements → newlines
    .replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Lists: prepend bullets/numbers
    .replace(/<li[^>]*>/gi, "• ")
    // Strip remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse 3+ newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Initial editor content for replying — places the cursor area at top, then
 * signature, then a blockquote of the original.
 */
export function buildReplyInitialHtml(
  email: EmailListItem | EmailFull | ThreadEmail,
  signature: string,
  withQuote: boolean
): string {
  const sigHtml = signature ? plainToHtml(signature) : "";
  const blank = "<p></p>";
  if (!withQuote) {
    return `${blank}${sigHtml}`;
  }

  const date = new Date(email.receivedAt).toLocaleString("fr-FR");
  const sender = email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;
  const htmlBody = "htmlBody" in email ? email.htmlBody : null;
  const originalAsHtml = htmlBody?.trim()
    ? `<div>${htmlBody}</div>`
    : plainToHtml(email.textBody || "");

  return `${blank}${sigHtml}<p>Le ${escapeHtml(date)}, ${escapeHtml(sender)} a écrit&nbsp;:</p><blockquote>${originalAsHtml}</blockquote>`;
}

/**
 * Initial content when forwarding — keeps signature on top, then the
 * "Message transféré" delimiter and the original body.
 */
export function buildForwardInitialHtml(
  email: EmailListItem | EmailFull,
  signature: string
): string {
  const sigHtml = signature ? plainToHtml(signature) : "";
  const blank = "<p></p>";
  const date = new Date(email.receivedAt).toLocaleString("fr-FR");
  const sender = email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;
  const subject = email.subject || "(sans objet)";

  const originalAsHtml = (email as EmailFull).htmlBody?.trim()
    ? `<div>${(email as EmailFull).htmlBody}</div>`
    : plainToHtml(email.textBody || "");

  return `${blank}${sigHtml}<p>---------- Message transféré ----------</p><p><strong>De</strong> : ${escapeHtml(sender)}<br><strong>Date</strong> : ${escapeHtml(date)}<br><strong>Sujet</strong> : ${escapeHtml(subject)}</p>${originalAsHtml}`;
}

/**
 * Initial content for compose — just signature.
 */
export function buildComposeInitialHtml(signature: string): string {
  const sigHtml = signature ? plainToHtml(signature) : "";
  return `<p></p>${sigHtml}`;
}

/**
 * Test if rich text content is "empty" — no visible text after stripping.
 * Used to guard against sending blank emails when the editor has only `<p></p>`.
 */
export function isEditorEmpty(html: string): boolean {
  const stripped = htmlToPlain(html).trim();
  return stripped.length === 0;
}
