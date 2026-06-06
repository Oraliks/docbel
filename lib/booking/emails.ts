// Emails transactionnels de booking (Resend). Trois moments clés demandés :
// demande reçue (en cours de validation), confirmation (+ .ics), annulation
// (avec motif). Plus un rappel J-1. Les envois n'échouent jamais la requête
// appelante : erreurs loggées, retour silencieux si Resend n'est pas configuré.

import { Resend } from "resend";
import { frenchDate } from "./dates";
import { icsFilename } from "./ics-adapter";

const EMAIL_FROM = process.env.EMAIL_FROM || "DocBel <noreply@docbel.be>";
const APP_URL =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
  process.env.BETTER_AUTH_URL ||
  "https://docbel.be";

function fromAddress(): string {
  const m = EMAIL_FROM.match(/<([^>]+)>/);
  return m ? m[1] : EMAIL_FROM;
}

function brandedFrom(name?: string | null): string {
  return name ? `${name} <${fromAddress()}>` : EMAIL_FROM;
}

export function manageUrl(token: string): string {
  return `${APP_URL}/rendez-vous/gestion/${token}`;
}

export interface BookingEmailCtx {
  to: string;
  citizenName: string | null;
  tenantName: string;
  fromName?: string | null;
  brandColor?: string | null;
  locationName: string;
  locationAddress?: string | null;
  date: string; // "YYYY-MM-DD"
  startTime: string;
  token: string;
}

function hello(name: string | null): string {
  return name ? `Bonjour ${name},` : "Bonjour,";
}

function whenWhere(ctx: BookingEmailCtx): string {
  const where = ctx.locationAddress
    ? `${ctx.locationName} — ${ctx.locationAddress}`
    : ctx.locationName;
  return `Le ${frenchDate(ctx.date)} à ${ctx.startTime}\n${where}`;
}

function htmlShell(ctx: BookingEmailCtx, title: string, paragraphs: string[], cta?: { label: string; href: string }): string {
  const accent = ctx.brandColor || "#7C3AED";
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${p}</p>`).join("");
  const button = cta
    ? `<p style="margin:20px 0"><a href="${cta.href}" style="background:${accent};color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;display:inline-block;font-weight:600">${cta.label}</a></p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;font-size:15px;line-height:1.5">
  <h2 style="color:${accent};font-size:18px;margin:0 0 16px">${title}</h2>
  ${body}${button}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
  <p style="font-size:12px;color:#6b7280;margin:0">${ctx.tenantName} · via DocBel</p>
</div>`;
}

async function send(args: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[booking] RESEND_API_KEY manquant — email non envoyé:", args.subject);
    return;
  }
  try {
    const resend = new Resend(key);
    const res = await resend.emails.send(args);
    if (res.error) console.error("[booking] envoi email échoué:", res.error);
  } catch (e) {
    console.error("[booking] exception envoi email:", e);
  }
}

/** Demande reçue, en cours de validation par l'équipe. */
export async function sendBookingReceived(ctx: BookingEmailCtx): Promise<void> {
  const subject = `Demande de rendez-vous reçue — ${frenchDate(ctx.date)}`;
  const intro = `Votre demande de rendez-vous est bien enregistrée et en cours de validation par ${ctx.tenantName}. Vous recevrez un email dès qu'elle est confirmée.`;
  const text = `${hello(ctx.citizenName)}

${intro}

${whenWhere(ctx)}

Gérer ou annuler votre demande : ${manageUrl(ctx.token)}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(
      ctx,
      "Demande de rendez-vous reçue",
      [intro, whenWhere(ctx).replace("\n", "<br/>")],
      { label: "Gérer ma demande", href: manageUrl(ctx.token) },
    ),
  });
}

/** Rendez-vous confirmé, avec le .ics en pièce jointe. */
export async function sendBookingConfirmed(
  ctx: BookingEmailCtx & { icsContent: string },
): Promise<void> {
  const subject = `Rendez-vous confirmé — ${frenchDate(ctx.date)}`;
  const intro = `Votre rendez-vous avec ${ctx.tenantName} est confirmé. Ajoutez-le à votre agenda grâce à la pièce jointe (.ics).`;
  const text = `${hello(ctx.citizenName)}

${intro}

${whenWhere(ctx)}

Annuler si besoin : ${manageUrl(ctx.token)}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(
      ctx,
      "Rendez-vous confirmé",
      [intro, whenWhere(ctx).replace("\n", "<br/>")],
      { label: "Gérer mon rendez-vous", href: manageUrl(ctx.token) },
    ),
    attachments: [
      { filename: icsFilename(ctx.date), content: Buffer.from(ctx.icsContent, "utf-8") },
    ],
  });
}

/** Rendez-vous annulé / refusé, avec le motif. */
export async function sendBookingCancelled(
  ctx: BookingEmailCtx & { reason: string; byPartner?: boolean },
): Promise<void> {
  const subject = `Rendez-vous annulé — ${frenchDate(ctx.date)}`;
  const lead = ctx.byPartner
    ? `Votre rendez-vous avec ${ctx.tenantName} a été annulé.`
    : `Votre demande de rendez-vous avec ${ctx.tenantName} n'a pas pu être retenue.`;
  const motif = `Motif : ${ctx.reason}`;
  const text = `${hello(ctx.citizenName)}

${lead}

${whenWhere(ctx)}

${motif}

Vous pouvez reprendre rendez-vous : ${APP_URL}/rendez-vous`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(
      ctx,
      "Rendez-vous annulé",
      [lead, whenWhere(ctx).replace("\n", "<br/>"), `<strong>${motif}</strong>`],
      { label: "Reprendre rendez-vous", href: `${APP_URL}/rendez-vous` },
    ),
  });
}

/** Rappel la veille du rendez-vous. */
export async function sendBookingReminder(ctx: BookingEmailCtx): Promise<void> {
  const subject = `Rappel : rendez-vous demain — ${ctx.startTime}`;
  const intro = `Petit rappel : vous avez rendez-vous avec ${ctx.tenantName} demain.`;
  const text = `${hello(ctx.citizenName)}

${intro}

${whenWhere(ctx)}

Annuler si empêchement : ${manageUrl(ctx.token)}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(
      ctx,
      "Rappel de rendez-vous",
      [intro, whenWhere(ctx).replace("\n", "<br/>")],
      { label: "Gérer mon rendez-vous", href: manageUrl(ctx.token) },
    ),
  });
}

/** Notifie l'équipe (notifyEmail du guichet) d'une nouvelle demande. */
export async function sendTeamNewBooking(ctx: {
  to: string;
  tenantId: string;
  tenantName: string;
  fromName?: string | null;
  brandColor?: string | null;
  citizenName: string | null;
  citizenEmail: string | null;
  locationName: string;
  date: string;
  startTime: string;
  pending: boolean;
}): Promise<void> {
  const who = ctx.citizenName ?? ctx.citizenEmail ?? "Un citoyen";
  const agendaUrl = `${APP_URL}/partenaire/booking/${ctx.tenantId}/agenda`;
  const accent = ctx.brandColor || "#7C3AED";
  const lines = [
    `${who} a demandé un rendez-vous chez ${ctx.tenantName}.`,
    `Le ${frenchDate(ctx.date)} à ${ctx.startTime} — ${ctx.locationName}.`,
    ctx.pending
      ? "Cette demande est en attente de validation."
      : "Elle a été confirmée automatiquement.",
    ctx.citizenEmail ? `Contact : ${ctx.citizenEmail}` : "",
  ].filter(Boolean);
  const subject = `Nouvelle demande de RDV — ${frenchDate(ctx.date)} ${ctx.startTime}`;
  const text = `${lines.join("\n")}\n\nVoir l'agenda : ${agendaUrl}`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;font-size:15px;line-height:1.5">
  <h2 style="color:${accent};font-size:18px;margin:0 0 16px">Nouvelle demande de rendez-vous</h2>
  ${lines.map((l) => `<p style="margin:0 0 10px">${l}</p>`).join("")}
  <p style="margin:20px 0"><a href="${agendaUrl}" style="background:${accent};color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;display:inline-block;font-weight:600">Voir l'agenda</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
  <p style="font-size:12px;color:#6b7280;margin:0">${ctx.tenantName} · via DocBel</p>
</div>`;
  await send({ from: brandedFrom(ctx.fromName), to: ctx.to, subject, text, html });
}
