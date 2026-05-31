/**
 * Moteur d'accès aux outils — passage du modèle "audience" (présentation,
 * hiérarchique, déduit de l'URL) à un modèle d'ENTITLEMENT lié à l'identité.
 *
 * Deux verrous indépendants dans canUseTool() :
 *   (a) APPARTENANCE segment/sous-type — l'exclusivité voulue ("outils que
 *       personne d'autre n'a"). Active dès la beta.
 *   (b) PLAN / BILLING — court-circuité tant que le flag billing_enabled est
 *       "false". C'est le crochet où le payant se branchera (Mollie/Stripe),
 *       sans rien recâbler ailleurs.
 *
 * Principe UX "informatif jamais bloquant" : un outil "citoyen" est PUBLIC →
 * accessible aux visiteurs anonymes, toujours.
 */

import { type AudienceId, isAudienceId } from "@/lib/audience";

/** Sous-types d'un compte partenaire (cf. vision 3-segments). */
export const PARTNER_TYPES = [
  "onem",
  "organisme_paiement",
  "service_public",
  "prive_asbl",
] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export function isPartnerType(value: unknown): value is PartnerType {
  return (
    typeof value === "string" &&
    (PARTNER_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Une règle d'accès d'un outil : un segment, éventuellement restreint à un
 * sous-type partenaire. Sans partnerType = tout le segment.
 */
export interface AccessRule {
  segment: AudienceId;
  partnerType?: PartnerType | null;
}

/**
 * Le "compte" tel que vu par le moteur d'accès. null = visiteur anonyme.
 */
export interface ViewerAccount {
  segment: AudienceId | null;
  partnerType: PartnerType | null;
  role: string; // user | partner | employer | moderator | admin
  /** Seam billing — null/"beta_free" = phase gratuite. */
  plan?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/** Normalise le champ JSON `Tool.access` en AccessRule[] (tolère le JSON brut). */
export function parseAccessRules(raw: unknown): AccessRule[] {
  if (!Array.isArray(raw)) return [];
  const out: AccessRule[] = [];
  for (const entry of raw) {
    const rec = asRecord(entry);
    if (!rec) continue;
    if (!isAudienceId(rec.segment)) continue;
    out.push({
      segment: rec.segment,
      partnerType: isPartnerType(rec.partnerType) ? rec.partnerType : null,
    });
  }
  return out;
}

/**
 * Fallback : convertit l'audience hiérarchique legacy en ensemble de règles,
 * quand `Tool.access` est vide. Reproduit l'ancienne hiérarchie de
 * deriveAudiences() : citoyen = public, employeur ⊂ partenaire.
 */
export function legacyAudienceToRules(audience: AudienceId): AccessRule[] {
  switch (audience) {
    case "citoyen":
      return [{ segment: "citoyen" }];
    case "employeur":
      return [{ segment: "employeur" }, { segment: "partenaire" }];
    case "partenaire":
      return [{ segment: "partenaire" }];
  }
}

type ToolAccessLike = { access?: unknown; audience?: string | null };

/** Règles effectives d'un outil : `access` si non vide, sinon legacy `audience`. */
export function effectiveRules(tool: ToolAccessLike): AccessRule[] {
  const parsed = parseAccessRules(tool.access);
  if (parsed.length > 0) return parsed;
  const audience: AudienceId = isAudienceId(tool.audience)
    ? tool.audience
    : "citoyen";
  return legacyAudienceToRules(audience);
}

/** Un outil est-il public (accessible aux anonymes / citoyens) ? */
export function isPublicTool(tool: ToolAccessLike): boolean {
  return effectiveRules(tool).some((rule) => rule.segment === "citoyen");
}

export interface CanUseOpts {
  /** État du flag global SETTING_KEYS.BILLING_ENABLED (=== "true"). */
  billingEnabled?: boolean;
}

/**
 * Décision d'accès centrale à un outil.
 *
 * @param account  Le compte courant, ou null si anonyme.
 * @param tool     L'outil (avec son `access` JSON et/ou son `audience` legacy).
 */
export function canUseTool(
  account: ViewerAccount | null,
  tool: ToolAccessLike,
  opts: CanUseOpts = {},
): boolean {
  const rules = effectiveRules(tool);

  // Outil public → tout le monde, y compris anonyme. (informatif jamais bloquant)
  if (rules.some((rule) => rule.segment === "citoyen")) return true;

  // Au-delà du public, il faut un compte.
  if (!account) return false;

  // Les admins voient/utilisent tout.
  if (account.role === "admin") return true;

  // (a) Appartenance au segment + sous-type.
  const inSegment = rules.some(
    (rule) =>
      rule.segment === account.segment &&
      (rule.partnerType == null || rule.partnerType === account.partnerType),
  );
  if (!inSegment) return false;

  // (b) Verrou payant. Tant que le billing est désactivé (beta), tout membre du
  // segment a accès. Quand il sera activé, c'est ICI qu'on consultera le plan.
  if (!opts.billingEnabled) return true;
  // TODO(billing): logique de plan réelle (account.plan vs plan requis de l'outil).
  // Défaut sûr tant qu'aucun plan payant n'existe : on n'ouvre pas l'accès.
  return Boolean(account.plan && account.plan !== "beta_free");
}

/**
 * Construit le ViewerAccount à partir d'un user (session ou DB). null si anonyme.
 * Le segment explicite prime ; sinon on le dérive du rôle (rétrocompat avec les
 * comptes créés avant l'introduction de `segment`).
 */
export function toViewerAccount(
  user:
    | {
        role?: string | null;
        segment?: string | null;
        partnerType?: string | null;
        plan?: string | null;
      }
    | null
    | undefined,
): ViewerAccount | null {
  if (!user) return null;
  const role = user.role ?? "user";

  let segment: AudienceId | null = isAudienceId(user.segment)
    ? user.segment
    : null;
  if (!segment) {
    if (role === "partner") segment = "partenaire";
    else if (role === "employer") segment = "employeur";
    else segment = null; // user / admin / moderator : pas de segment métier
  }

  return {
    segment,
    partnerType: isPartnerType(user.partnerType) ? user.partnerType : null,
    role,
    plan: user.plan ?? null,
  };
}
