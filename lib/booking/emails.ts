// Emails transactionnels de booking (Resend). Localisés (FR/NL/EN/DE) via
// lib/booking/i18n selon ctx.locale (défaut FR). Les envois n'échouent jamais
// la requête appelante : erreurs loggées, retour silencieux si Resend absent.

import { Resend } from "resend";
import { frenchDate } from "./dates";
import { icsFilename } from "./ics-adapter";
import {
  bookingEmail,
  fillTemplate,
  localeDate,
  normalizeLocale,
  type BookingLocale,
} from "./i18n";

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

function presenceUrl(token: string): string {
  return `${APP_URL}/api/booking/manage/${token}/confirm-presence`;
}

function verifyUrl(token: string): string {
  return `${APP_URL}/api/booking/manage/${token}/verify`;
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
  locale?: string | null; // fr | nl | en | de (défaut fr)
}

function localeOf(ctx: { locale?: string | null }): BookingLocale {
  return normalizeLocale(ctx.locale);
}

function hello(ctx: BookingEmailCtx): string {
  const e = bookingEmail(localeOf(ctx));
  return ctx.citizenName ? fillTemplate(e.helloName, { name: ctx.citizenName }) : e.hello;
}

function whenWhere(ctx: BookingEmailCtx): string {
  const loc = localeOf(ctx);
  const e = bookingEmail(loc);
  const where = ctx.locationAddress
    ? `${ctx.locationName} — ${ctx.locationAddress}`
    : ctx.locationName;
  return `${fillTemplate(e.when, { date: localeDate(ctx.date, loc), time: ctx.startTime })}\n${where}`;
}

type CtaDef = { label: string; href: string };

function htmlShell(
  ctx: BookingEmailCtx,
  title: string,
  paragraphs: string[],
  cta?: CtaDef | CtaDef[],
): string {
  const accent = ctx.brandColor || "#7C3AED";
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${p}</p>`).join("");
  const ctas = cta ? (Array.isArray(cta) ? cta : [cta]) : [];
  // 1er bouton = principal (fond accent), suivants = secondaires (contour).
  const buttons = ctas.length
    ? `<p style="margin:20px 0">${ctas
        .map((c, i) =>
          i === 0
            ? `<a href="${c.href}" style="background:${accent};color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;display:inline-block;font-weight:600;margin:0 8px 8px 0">${c.label}</a>`
            : `<a href="${c.href}" style="border:1px solid ${accent};color:${accent};text-decoration:none;padding:9px 17px;border-radius:10px;display:inline-block;font-weight:600;margin:0 8px 8px 0">${c.label}</a>`,
        )
        .join("")}</p>`
    : "";
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;font-size:15px;line-height:1.5">
  <h2 style="color:${accent};font-size:18px;margin:0 0 16px">${title}</h2>
  ${body}${buttons}
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
  const loc = localeOf(ctx);
  const e = bookingEmail(loc);
  const subject = fillTemplate(e.receivedSubject, { date: localeDate(ctx.date, loc) });
  const intro = fillTemplate(e.receivedIntro, { tenant: ctx.tenantName });
  const text = `${hello(ctx)}

${intro}

${whenWhere(ctx)}

${e.receivedCta} : ${manageUrl(ctx.token)}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(ctx, e.receivedTitle, [intro, whenWhere(ctx).replace("\n", "<br/>")], {
      label: e.receivedCta,
      href: manageUrl(ctx.token),
    }),
  });
}

/** Rendez-vous confirmé, avec le .ics en pièce jointe. */
export async function sendBookingConfirmed(
  ctx: BookingEmailCtx & { icsContent: string },
): Promise<void> {
  const loc = localeOf(ctx);
  const e = bookingEmail(loc);
  const subject = fillTemplate(e.confirmedSubject, { date: localeDate(ctx.date, loc) });
  const intro = fillTemplate(e.confirmedIntro, { tenant: ctx.tenantName });
  const text = `${hello(ctx)}

${intro}

${whenWhere(ctx)}

${e.confirmedCta} : ${manageUrl(ctx.token)}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(ctx, e.confirmedTitle, [intro, whenWhere(ctx).replace("\n", "<br/>")], {
      label: e.confirmedCta,
      href: manageUrl(ctx.token),
    }),
    attachments: [
      { filename: icsFilename(ctx.date), content: Buffer.from(ctx.icsContent, "utf-8") },
    ],
  });
}

/** Rendez-vous annulé / refusé, avec le motif. */
export async function sendBookingCancelled(
  ctx: BookingEmailCtx & { reason: string; byPartner?: boolean },
): Promise<void> {
  const loc = localeOf(ctx);
  const e = bookingEmail(loc);
  const subject = fillTemplate(e.cancelledSubject, { date: localeDate(ctx.date, loc) });
  const lead = fillTemplate(
    ctx.byPartner ? e.cancelledLeadPartner : e.cancelledLeadCitizen,
    { tenant: ctx.tenantName },
  );
  const motif = fillTemplate(e.cancelledMotif, { reason: ctx.reason });
  const rebook = `${APP_URL}/rendez-vous`;
  const text = `${hello(ctx)}

${lead}

${whenWhere(ctx)}

${motif}

${e.cancelledCta} : ${rebook}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(
      ctx,
      e.cancelledTitle,
      [lead, whenWhere(ctx).replace("\n", "<br/>"), `<strong>${motif}</strong>`],
      { label: e.cancelledCta, href: rebook },
    ),
  });
}

/** Rappel la veille du rendez-vous, avec confirmation de présence en 1 clic. */
export async function sendBookingReminder(ctx: BookingEmailCtx): Promise<void> {
  const e = bookingEmail(localeOf(ctx));
  const subject = fillTemplate(e.reminderSubject, { time: ctx.startTime });
  const intro = fillTemplate(e.reminderIntro, { tenant: ctx.tenantName });
  const text = `${hello(ctx)}

${intro}

${whenWhere(ctx)}

${e.reminderAsk}

${e.reminderConfirm} : ${presenceUrl(ctx.token)}
${e.reminderManage} : ${manageUrl(ctx.token)}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(
      ctx,
      e.reminderTitle,
      [intro, whenWhere(ctx).replace("\n", "<br/>"), e.reminderAsk],
      [
        { label: e.reminderConfirm, href: presenceUrl(ctx.token) },
        { label: e.reminderManage, href: manageUrl(ctx.token) },
      ],
    ),
  });
}

/** Relance après une absence (no-show) : invite à reprendre rendez-vous. */
export async function sendNoShowFollowUp(ctx: BookingEmailCtx): Promise<void> {
  const loc = localeOf(ctx);
  const e = bookingEmail(loc);
  const subject = fillTemplate(e.noShowSubject, { tenant: ctx.tenantName });
  const intro = fillTemplate(e.noShowIntro, {
    tenant: ctx.tenantName,
    date: localeDate(ctx.date, loc),
  });
  const rebook = `${APP_URL}/rendez-vous`;
  const text = `${hello(ctx)}

${intro}

${e.noShowCta} : ${rebook}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(ctx, e.noShowTitle, [intro], { label: e.noShowCta, href: rebook }),
  });
}

/** Une place s'est libérée pour un citoyen en liste d'attente (C). */
export async function sendWaitlistOpening(ctx: {
  to: string;
  citizenName: string | null;
  tenantName: string;
  fromName?: string | null;
  brandColor?: string | null;
  locationName: string;
  locationAddress?: string | null;
  slug: string;
  date: string;
  startTime: string;
  locale?: string | null;
}): Promise<void> {
  const shell: BookingEmailCtx = {
    to: ctx.to,
    citizenName: ctx.citizenName,
    tenantName: ctx.tenantName,
    fromName: ctx.fromName,
    brandColor: ctx.brandColor,
    locationName: ctx.locationName,
    locationAddress: ctx.locationAddress,
    date: ctx.date,
    startTime: ctx.startTime,
    token: "",
    locale: ctx.locale,
  };
  const loc = localeOf(shell);
  const e = bookingEmail(loc);
  const href = `${APP_URL}/${ctx.slug}/rendez-vous`;
  const subject = fillTemplate(e.waitlistSubject, { date: localeDate(ctx.date, loc) });
  const intro = fillTemplate(e.waitlistIntro, { tenant: ctx.tenantName });
  const text = `${hello(shell)}

${intro}

${whenWhere(shell)}

${e.waitlistCta} : ${href}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(shell, e.waitlistTitle, [intro, whenWhere(shell).replace("\n", "<br/>")], {
      label: e.waitlistCta,
      href,
    }),
  });
}

/** Double opt-in : vérifier l'adresse email avant prise en compte (F). */
export async function sendBookingVerify(ctx: BookingEmailCtx): Promise<void> {
  const e = bookingEmail(localeOf(ctx));
  const subject = fillTemplate(e.verifySubject, { tenant: ctx.tenantName });
  const intro = fillTemplate(e.verifyIntro, { tenant: ctx.tenantName });
  const text = `${hello(ctx)}

${intro}

${whenWhere(ctx)}

${e.verifyCta} : ${verifyUrl(ctx.token)}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(ctx, e.verifyTitle, [intro, whenWhere(ctx).replace("\n", "<br/>")], {
      label: e.verifyCta,
      href: verifyUrl(ctx.token),
    }),
  });
}

/** Renvoi du lien de gestion (déplacer/annuler) à l'adresse enregistrée. */
export async function sendManagementLink(ctx: BookingEmailCtx): Promise<void> {
  const e = bookingEmail(localeOf(ctx));
  const subject = fillTemplate(e.managementSubject, { tenant: ctx.tenantName });
  const intro = fillTemplate(e.managementIntro, { tenant: ctx.tenantName });
  const text = `${hello(ctx)}

${intro}

${whenWhere(ctx)}

${e.managementCta} : ${manageUrl(ctx.token)}`;
  await send({
    from: brandedFrom(ctx.fromName),
    to: ctx.to,
    subject,
    text,
    html: htmlShell(ctx, e.managementTitle, [intro, whenWhere(ctx).replace("\n", "<br/>")], {
      label: e.managementCta,
      href: manageUrl(ctx.token),
    }),
  });
}

/** Notifie l'équipe (notifyEmail du guichet) d'une nouvelle demande. En FR
 *  (destinataire = personnel du guichet, pas le citoyen). */
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
