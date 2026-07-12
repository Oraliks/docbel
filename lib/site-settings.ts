import { z } from "zod";

/**
 * Paramètres globaux du site (identité, SEO, maintenance, annonces, légal).
 *
 * ── Module PUR (client-safe) ──────────────────────────────────────────────
 * Schéma Zod = source de vérité, défauts, parse résilient et dérivés. AUCUN
 * accès prisma / next-cache ici, pour pouvoir être importé côté client
 * (header, footer, provider). Les lectures/écritures DB vivent dans
 * `lib/site-settings.server.ts` (`server-only`). Même découpage que
 * `formations/module-types.ts` (pur) vs `formations/module.ts` (serveur).
 *
 * Stockés sous UNE clé `AppSetting` (`site_settings`) contenant un objet JSON
 * validé Zod → zéro migration, défauts sûrs en code.
 *
 * ⚠️ JAMAIS de secret ici (clés API, mots de passe). Les secrets restent en
 * variables d'environnement ; l'admin n'affiche que leur *statut*.
 */

export const SITE_SETTINGS_KEY = "site_settings";
/** Clé du micro-cache in-process (cf. lib/memo-cache.ts). */
export const SITE_SETTINGS_CACHE_KEY = "site_settings";

// ---------------------------------------------------------------------------
// Schéma Zod
// ---------------------------------------------------------------------------

const urlOrEmpty = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), {
    message: "URL invalide (doit commencer par http:// ou https://)",
  });

const announcementLevel = z.enum(["info", "success", "warning", "critical"]);
export type AnnouncementLevel = z.infer<typeof announcementLevel>;

const audienceSegment = z.enum(["public", "citizen", "partner", "employer"]);
export type AudienceSegment = z.infer<typeof audienceSegment>;

const identitySchema = z.object({
  /** Nom du site (onglet navigateur, header, emails, SEO). */
  name: z.string().trim().min(1).max(120),
  /** Slogan / baseline courte. */
  tagline: z.string().trim().max(200),
  /** URL canonique publique (sans slash final). Sert de `metadataBase`. */
  url: urlOrEmpty,
  /** Email de contact public affiché (footer / mentions). */
  contactEmail: z.string().trim().max(200),
  /** Téléphone de contact affiché. */
  contactPhone: z.string().trim().max(60),
  /** Liens réseaux sociaux (vide = masqué). */
  socials: z.object({
    facebook: urlOrEmpty,
    linkedin: urlOrEmpty,
    instagram: urlOrEmpty,
    x: urlOrEmpty,
    youtube: urlOrEmpty,
  }),
});

const seoSchema = z.object({
  /** Template de titre. `%s` = titre de la page. */
  titleTemplate: z.string().trim().max(200),
  /** Meta description par défaut. */
  defaultDescription: z.string().trim().max(500),
  /** Image OG par défaut (URL absolue ou chemin /public). */
  ogImageUrl: z.string().trim().max(2048),
  /** Désindexation globale (préprod / maintenance). */
  noindex: z.boolean(),
  /** Balises de vérification moteurs (contenu de la meta, pas le HTML). */
  verification: z.object({
    google: z.string().trim().max(200),
    bing: z.string().trim().max(200),
  }),
});

const maintenanceSchema = z.object({
  /** Coupe l'accès public. Ne bloque JAMAIS /admin, /login ni /api/auth. */
  enabled: z.boolean(),
  /** Message affiché aux visiteurs pendant la maintenance. */
  message: z.string().trim().max(2000),
  /** Un admin connecté peut continuer à naviguer malgré la maintenance. */
  allowAdminBypass: z.boolean(),
});

const announcementSchema = z.object({
  enabled: z.boolean(),
  level: announcementLevel,
  message: z.string().trim().max(2000),
  /** Lien optionnel « En savoir plus ». */
  linkHref: z.string().trim().max(2048),
  linkLabel: z.string().trim().max(120),
  /** Autorise le visiteur à masquer la bannière (croix, le temps de la session). */
  dismissible: z.boolean(),
  /** Segments ciblés (vide = tous). */
  segments: z.array(audienceSegment),
});

const legalSchema = z.object({
  /** Durée de conservation des documents générés (jours). */
  retentionDays: z.number().int().min(1).max(3650),
  /** Version du consentement. L'incrémenter redemande l'accord. */
  consentVersion: z.number().int().min(1).max(100000),
});

export const siteSettingsSchema = z.object({
  identity: identitySchema,
  seo: seoSchema,
  maintenance: maintenanceSchema,
  announcement: announcementSchema,
  legal: legalSchema,
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type SiteIdentity = SiteSettings["identity"];
export type SiteAnnouncement = SiteSettings["announcement"];
export type SiteMaintenance = SiteSettings["maintenance"];

/** Tranche exposée au client (sans SEO/vérifications, sans secret). */
export type PublicSiteSettings = {
  identity: SiteIdentity;
  maintenance: SiteMaintenance;
  announcement: SiteAnnouncement;
  consentVersion: number;
};

// ---------------------------------------------------------------------------
// Défauts — source de vérité des valeurs actuelles du site
// ---------------------------------------------------------------------------

export const SITE_SETTINGS_DEFAULTS: SiteSettings = {
  identity: {
    name: "Docbel",
    tagline: "Documents administratifs belges",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://docbel.be",
    contactEmail: "contact@docbel.be",
    contactPhone: "",
    socials: { facebook: "", linkedin: "", instagram: "", x: "", youtube: "" },
  },
  seo: {
    titleTemplate: "%s — Docbel",
    defaultDescription:
      "Portail officieux des documents administratifs belges (chômage)",
    ogImageUrl: "",
    noindex: false,
    verification: { google: "", bing: "" },
  },
  maintenance: {
    enabled: false,
    message:
      "Le site est en maintenance. Nous revenons très vite. Merci de votre patience.",
    allowAdminBypass: true,
  },
  announcement: {
    enabled: false,
    level: "info",
    message: "",
    linkHref: "",
    linkLabel: "",
    dismissible: true,
    segments: [],
  },
  legal: {
    retentionDays: 30,
    consentVersion: 1,
  },
};

// ---------------------------------------------------------------------------
// Merge + parse (résilient : un JSON partiel/corrompu retombe sur les défauts)
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge de `patch` sur `base` (objets simples uniquement ; arrays remplacés). */
export function deepMergeSettings<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? base : (patch as T);
  }
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (k in base && isPlainObject((base as Record<string, unknown>)[k])) {
      out[k] = deepMergeSettings((base as Record<string, unknown>)[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

/**
 * Fusionne un objet arbitraire sur les défauts puis valide. Retourne toujours
 * un `SiteSettings` complet : les champs manquants viennent des défauts, une
 * structure invalide retombe intégralement sur les défauts.
 */
export function parseSiteSettings(raw: unknown): SiteSettings {
  const merged = deepMergeSettings(SITE_SETTINGS_DEFAULTS, raw);
  const result = siteSettingsSchema.safeParse(merged);
  if (result.success) return result.data;
  return SITE_SETTINGS_DEFAULTS;
}

// ---------------------------------------------------------------------------
// Dérivés pratiques
// ---------------------------------------------------------------------------

/** Réduit un `SiteSettings` complet à la tranche exposée au client. */
export function toPublicSiteSettings(s: SiteSettings): PublicSiteSettings {
  return {
    identity: s.identity,
    maintenance: s.maintenance,
    announcement: s.announcement,
    consentVersion: s.legal.consentVersion,
  };
}

/** URL canonique normalisée (sans slash final). */
export function canonicalUrl(settings: Pick<SiteSettings, "identity">): string {
  const raw = settings.identity.url.trim() || "https://docbel.be";
  return raw.replace(/\/+$/, "");
}

/**
 * L'annonce est-elle active (activée + message non vide) ?
 * Le ciblage par segment est appliqué séparément côté rendu.
 */
export function isAnnouncementLive(a: SiteAnnouncement): boolean {
  return a.enabled && a.message.trim().length > 0;
}

/** L'annonce cible-t-elle ce segment ? (liste vide = tous). */
export function announcementTargets(
  a: SiteAnnouncement,
  segment: AudienceSegment
): boolean {
  return a.segments.length === 0 || a.segments.includes(segment);
}
