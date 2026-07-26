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

// ===========================================================================
// Lot A — Emails liés aux organismes (inscription, décision, invitations)
// ===========================================================================

/** Échappe le HTML des valeurs interpolées (contenu saisi par l'utilisateur). */
function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(title: string, bodyHtml: string, ctaHref?: string, ctaLabel?: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">
    <h2 style="color:#1f2937;font-size:18px">${esc(title)}</h2>
    ${bodyHtml}
    ${
      ctaHref && ctaLabel
        ? `<p style="margin:20px 0"><a href="${ctaHref}" style="background:#7c3aed;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block">${esc(ctaLabel)}</a></p>`
        : ""
    }
    <p style="color:#9ca3af;font-size:12px">Docbel — Formations</p>
  </div>`;
}

async function send(to: string, subject: string, html: string, fromName?: string | null) {
  const r = resend();
  if (!r || !to) return;
  try {
    await r.emails.send({
      from: fromName ? `${fromName} <${fromAddress()}>` : EMAIL_FROM,
      to,
      subject,
      html,
    });
  } catch (e) {
    console.error("[formations/emails] send failed:", e);
  }
}

/** Accusé de réception d'une demande d'inscription d'organisme. */
export async function sendOrgApplicationReceivedEmail(ctx: {
  to: string;
  orgName: string;
  contactName: string | null;
}): Promise<void> {
  const html = shell(
    "Votre demande a bien été reçue",
    `<p>${ctx.contactName ? `Bonjour ${esc(ctx.contactName)},` : "Bonjour,"}</p>
     <p>Nous avons bien reçu la demande d'inscription de <strong>${esc(ctx.orgName)}</strong>
     sur Docbel Formations.</p>
     <p>Notre équipe vérifie les informations transmises. Vous recevrez un email dès que
     votre organisation sera validée — vous pourrez alors publier vos formations.</p>`,
  );
  await send(ctx.to, `Demande reçue — ${ctx.orgName}`, html);
}

/** Décision admin sur une demande d'organisme. */
export async function sendOrgDecisionEmail(ctx: {
  to: string;
  orgName: string;
  contactName: string | null;
  decision: "approve" | "reject" | "suspend" | "reactivate";
  note?: string | null;
}): Promise<void> {
  const hi = ctx.contactName ? `Bonjour ${esc(ctx.contactName)},` : "Bonjour,";
  const noteHtml = ctx.note ? `<p style="color:#6b7280"><em>${esc(ctx.note)}</em></p>` : "";
  const cfg = {
    approve: {
      subject: `Votre organisation est validée — ${ctx.orgName}`,
      title: "Votre organisation est validée",
      body: `<p>${hi}</p><p><strong>${esc(ctx.orgName)}</strong> est désormais validée sur Docbel
        Formations. Vous pouvez créer et soumettre vos formations.</p>${noteHtml}`,
      cta: `${APP_URL}/organisme/formations`,
      ctaLabel: "Accéder à mon espace",
    },
    reject: {
      subject: `Demande non retenue — ${ctx.orgName}`,
      title: "Votre demande n'a pas été retenue",
      body: `<p>${hi}</p><p>La demande d'inscription de <strong>${esc(ctx.orgName)}</strong>
        n'a pas pu être validée.</p>${noteHtml}<p>Vous pouvez nous répondre pour apporter des
        précisions.</p>`,
      cta: undefined,
      ctaLabel: undefined,
    },
    suspend: {
      subject: `Organisation suspendue — ${ctx.orgName}`,
      title: "Votre organisation est suspendue",
      body: `<p>${hi}</p><p>L'accès de <strong>${esc(ctx.orgName)}</strong> à la publication de
        formations est temporairement suspendu.</p>${noteHtml}`,
      cta: undefined,
      ctaLabel: undefined,
    },
    reactivate: {
      subject: `Organisation réactivée — ${ctx.orgName}`,
      title: "Votre organisation est réactivée",
      body: `<p>${hi}</p><p><strong>${esc(ctx.orgName)}</strong> est de nouveau active sur
        Docbel Formations.</p>${noteHtml}`,
      cta: `${APP_URL}/organisme/formations`,
      ctaLabel: "Accéder à mon espace",
    },
  }[ctx.decision];

  await send(ctx.to, cfg.subject, shell(cfg.title, cfg.body, cfg.cta, cfg.ctaLabel));
}

/** Invitation à rejoindre l'équipe d'une organisation. */
export async function sendOrgInviteEmail(ctx: {
  to: string;
  orgName: string;
  inviterName?: string | null;
  roleLabel: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  const url = `${APP_URL}/organisme/invitation/${ctx.token}`;
  const html = shell(
    `Rejoignez ${ctx.orgName} sur Docbel`,
    `<p>Bonjour,</p>
     <p>${ctx.inviterName ? `${esc(ctx.inviterName)} vous invite` : "Vous êtes invité(e)"} à rejoindre
     l'équipe de <strong>${esc(ctx.orgName)}</strong> sur Docbel Formations, en tant que
     <strong>${esc(ctx.roleLabel)}</strong>.</p>
     <p style="color:#6b7280;font-size:13px">Cette invitation expire le
     ${ctx.expiresAt.toLocaleDateString("fr-BE")}.</p>`,
    url,
    "Accepter l'invitation",
  );
  await send(ctx.to, `Invitation — ${ctx.orgName}`, html, ctx.orgName);
}

/** Notification admin : une nouvelle demande d'organisme attend validation. */
export async function sendAdminNewOrgNotice(ctx: {
  to: string;
  orgName: string;
  orgType: string;
  enterpriseVerified: boolean;
}): Promise<void> {
  const html = shell(
    "Nouvelle demande d'organisme",
    `<p><strong>${esc(ctx.orgName)}</strong> (${esc(ctx.orgType)}) a demandé à rejoindre
     Docbel Formations.</p>
     <p>Vérification BCE : <strong>${ctx.enterpriseVerified ? "OK" : "non vérifiée"}</strong></p>`,
    `${APP_URL}/admin/formations/organismes`,
    "Traiter la demande",
  );
  await send(ctx.to, `À valider — ${ctx.orgName}`, html);
}
