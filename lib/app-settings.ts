import { prisma } from "@/lib/prisma";

/** Clés des settings stockés en BDD. */
export const SETTING_KEYS = {
  RGPD_GENERAL: "rgpd_general",
  EMAIL_SUBJECT: "email_subject",
  EMAIL_BODY: "email_body",
  COMMISSIONS_LAST_UPDATED: "commissions_last_updated",
  U1_INSTITUTIONS_LAST_UPDATED: "u1_institutions_last_updated",
  PARTNER_INVITE_SUBJECT: "partner_invite_subject",
  PARTNER_INVITE_BODY: "partner_invite_body",
  CONTACT_SIGNATURE: "contact_signature",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

const DEFAULTS: Record<SettingKey, string> = {
  commissions_last_updated: "2026-04-26",
  u1_institutions_last_updated: "2026-04-26",
  rgpd_general: `Conditions générales d'utilisation et politique de confidentialité

En utilisant ce service, vous acceptez les conditions suivantes :

1. Traitement des données
Les données saisies dans les formulaires servent uniquement à générer le document demandé. Elles ne sont pas conservées en clair sur nos serveurs au-delà du temps nécessaire à la génération.

2. Documents générés
Les documents générés sont conservés temporairement pour vous permettre de les télécharger. Ils sont supprimés automatiquement après le délai indiqué (par défaut 30 jours).

3. Droits RGPD
Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits, contactez-nous.

4. Sécurité
Vos données sont transmises en HTTPS. Les hash de vos saisies sont conservés à des fins d'audit, sans contenu lisible.

5. Cookies et traceurs
Ce site utilise uniquement des cookies techniques nécessaires au fonctionnement (session de connexion). Aucun cookie de pistage tiers.

6. Responsabilité
Les documents générés reprennent les valeurs que vous saisissez. Il vous appartient de vérifier leur exactitude avant transmission aux administrations.`,
  email_subject: "Votre document : {{filename}}",
  email_body: `Bonjour,

Veuillez trouver en pièce jointe le document généré sur beldoc.

Ce document est aussi accessible via le lien de téléchargement reçu lors de la génération, jusqu'au {{expiresAt}}.

Cordialement,
L'équipe beldoc`,
  partner_invite_subject: "Confirmez votre inscription partenaire DocBel",
  partner_invite_body: `Bonjour {{name}},

Merci de votre demande d'inscription à l'espace partenaire DocBel pour {{organizationName}}.

Pour activer votre compte, cliquez sur le lien ci-dessous (valide 24 heures) :

{{confirmationLink}}

Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.

Cordialement,
L'équipe DocBel`,
  contact_signature: "",
};

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row?.value !== undefined && row.value !== null) return row.value;
  return DEFAULTS[key];
}

export async function setSetting(
  key: SettingKey,
  value: string,
  updatedBy: string | null = null
): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value, updatedBy },
    update: { value, updatedBy },
  });
}

export async function getAllSettings(): Promise<Record<SettingKey, string>> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<SettingKey, string>;
  for (const k of Object.values(SETTING_KEYS)) {
    out[k] = map.get(k) ?? DEFAULTS[k];
  }
  return out;
}

export function getDefault(key: SettingKey): string {
  return DEFAULTS[key];
}
