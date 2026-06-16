// Emails transactionnels du module Formations (Resend). Best-effort : n'échouent
// jamais la requête appelante (erreurs loggées, no-op si Resend absent). FR V1.
import "server-only";
import { Resend } from "resend";

const EMAIL_FROM = process.env.EMAIL_FROM || "DocBel <noreply@docbel.be>";
const APP_URL =
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "https://docbel.be";

let client: Resend | null = null;
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export interface EnrollmentEmailCtx {
  to: string;
  citizenName: string | null;
  trainingTitle: string;
  trainingSlug: string;
  orgName: string;
  status: string;
  sessionLabel?: string | null;
  note?: string | null;
}

const SUBJECTS: Record<string, (t: string) => string> = {
  requested: (t) => `Demande d'inscription reçue — ${t}`,
  accepted: (t) => `Inscription confirmée — ${t}`,
  refused: (t) => `Inscription non retenue — ${t}`,
  waitlisted: (t) => `Liste d'attente — ${t}`,
  cancelled_org: (t) => `Session annulée — ${t}`,
};

const MESSAGES: Record<string, string> = {
  requested:
    "Votre demande d'inscription a bien été reçue. L'organisateur va l'examiner et vous tiendra informé.",
  accepted:
    "Bonne nouvelle, votre inscription est confirmée ! Vous recevrez les informations pratiques de l'organisateur.",
  refused:
    "Votre demande d'inscription n'a pas pu être retenue cette fois-ci. N'hésitez pas à explorer d'autres formations sur Docbel.",
  waitlisted:
    "Vous êtes sur la liste d'attente. Nous vous préviendrons dès qu'une place se libère.",
  cancelled_org:
    "L'organisateur a annulé cette session. Nous sommes désolés pour la gêne occasionnée.",
};

function html(ctx: EnrollmentEmailCtx): string {
  const hi = ctx.citizenName ? `Bonjour ${ctx.citizenName},` : "Bonjour,";
  const body = MESSAGES[ctx.status] ?? "Mise à jour de votre inscription.";
  const link = `${APP_URL}/formations/${ctx.trainingSlug}`;
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">
    <p>${hi}</p>
    <p>${body}</p>
    <p style="margin:16px 0;padding:12px 16px;background:#f5f3ff;border-radius:12px">
      <strong>${ctx.trainingTitle}</strong><br/>
      <span style="color:#6b7280">${ctx.orgName}${ctx.sessionLabel ? ` · ${ctx.sessionLabel}` : ""}</span>
    </p>
    ${ctx.note ? `<p style="color:#6b7280"><em>${ctx.note}</em></p>` : ""}
    <p><a href="${link}" style="color:#7c3aed">Voir la formation</a></p>
    <p style="color:#9ca3af;font-size:12px">Docbel — formations</p>
  </div>`;
}

/** Envoie un email d'inscription (best-effort). */
export async function sendEnrollmentEmail(ctx: EnrollmentEmailCtx): Promise<void> {
  const r = resend();
  if (!r || !ctx.to) return;
  const subject = (SUBJECTS[ctx.status] ?? ((t: string) => `Inscription — ${t}`))(ctx.trainingTitle);
  const from = ctx.orgName ? `${ctx.orgName} <${fromAddress()}>` : EMAIL_FROM;
  try {
    await r.emails.send({ from, to: ctx.to, subject, html: html(ctx) });
  } catch (e) {
    console.error("[formations/emails] send failed:", e);
  }
}

function fromAddress(): string {
  const m = EMAIL_FROM.match(/<([^>]+)>/);
  return m ? m[1] : EMAIL_FROM;
}
