import { randomBytes, randomUUID } from "node:crypto";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";

const TOKEN_TTL_HOURS = 24;
const VERIFICATION_PREFIX = "partner-confirm:";

function applyTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createPartnerConfirmationToken(
  email: string,
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.verification.create({
    data: {
      id: `pcf_${randomUUID()}`,
      identifier: VERIFICATION_PREFIX + email.trim().toLowerCase(),
      value: token,
      expiresAt,
    },
  });

  return token;
}

export async function consumePartnerConfirmationToken(
  token: string,
): Promise<{ email: string } | null> {
  const record = await prisma.verification.findFirst({
    where: {
      value: token,
      identifier: { startsWith: VERIFICATION_PREFIX },
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) return null;

  await prisma.verification.delete({ where: { id: record.id } });

  const email = record.identifier.slice(VERIFICATION_PREFIX.length);
  return { email };
}

export interface SendPartnerConfirmationInput {
  to: string;
  recipientName: string;
  organizationName: string;
  confirmationUrl: string;
}

export async function sendPartnerConfirmationEmail(
  input: SendPartnerConfirmationInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error(
      "RESEND_API_KEY ou EMAIL_FROM non configures — impossible d'envoyer l'email",
    );
  }

  const [subjectTpl, bodyTpl] = await Promise.all([
    getSetting(SETTING_KEYS.PARTNER_INVITE_SUBJECT),
    getSetting(SETTING_KEYS.PARTNER_INVITE_BODY),
  ]);

  const vars = {
    name: input.recipientName,
    organizationName: input.organizationName,
    confirmationLink: input.confirmationUrl,
  };

  const subject = applyTemplate(subjectTpl, vars);
  const text = applyTemplate(bodyTpl, vars);

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: input.to,
    subject,
    text,
  });

  if (result.error) {
    throw new Error(result.error.message || "Echec d'envoi de l'email");
  }
}
