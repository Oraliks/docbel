/**
 * Constantes + helpers partagés par la table admin /outils (tools-table,
 * tool-row, filters-bar, workspace). Centralise :
 *   - les libellés FR des segments et sous-types partenaire
 *   - les helpers PURS de manipulation du modèle d'accès set-based
 *     (AccessRule[]) — extraits de l'ancien tool-card pour réutilisation
 *   - le mapping `type` technique → libellé court + variante de badge
 *
 * Aucune dépendance React : pur TS, testable et importable côté serveur.
 */

import type { AudienceId } from "@/lib/audience";
import {
  type AccessRule,
  type PartnerType,
  parseAccessRules,
} from "@/lib/entitlements";

/** Ordre d'affichage des segments (citoyen → partenaire). */
export const SEGMENTS: readonly AudienceId[] = [
  "citoyen",
  "employeur",
  "partenaire",
];

export const SEGMENT_LABEL: Record<AudienceId, string> = {
  citoyen: "Citoyen",
  employeur: "Employeur",
  partenaire: "Partenaire",
};

export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  onem: "ONEM",
  organisme_paiement: "Organisme de paiement",
  service_public: "Service public",
  prive_asbl: "Privé-ASBL",
};

/* ------------------------------------------------------------------ */
/*  Helpers PURS — manipulation d'AccessRule[]                         */
/* ------------------------------------------------------------------ */

export function hasSegment(rules: AccessRule[], segment: AudienceId): boolean {
  return rules.some((r) => r.segment === segment);
}

/** Sous-types partenaire sélectionnés (non-null) dans un AccessRule[]. */
export function selectedPartnerTypes(rules: AccessRule[]): PartnerType[] {
  return rules
    .filter((r) => r.segment === "partenaire" && r.partnerType)
    .map((r) => r.partnerType as PartnerType);
}

/** Ajoute/retire un segment "simple" (citoyen / employeur) sans toucher au reste. */
export function toggleSimpleSegment(
  rules: AccessRule[],
  segment: Extract<AudienceId, "citoyen" | "employeur">,
): AccessRule[] {
  const present = rules.some((r) => r.segment === segment);
  if (present) return rules.filter((r) => r.segment !== segment);
  return [...rules, { segment }];
}

/**
 * Active/désactive tout le segment partenaire. On = règle "tout le segment"
 * ({ segment: "partenaire" } sans partnerType). Off = retire toute règle
 * partenaire (sous-types inclus).
 */
export function togglePartnerSegment(rules: AccessRule[]): AccessRule[] {
  const present = rules.some((r) => r.segment === "partenaire");
  const others = rules.filter((r) => r.segment !== "partenaire");
  if (present) return others;
  return [...others, { segment: "partenaire" }];
}

/**
 * Active/désactive un sous-type partenaire. Cocher un premier sous-type
 * remplace la règle "tout le segment" par des règles ciblées ; décocher le
 * dernier sous-type retombe sur "tout le segment".
 */
export function togglePartnerType(
  rules: AccessRule[],
  type: PartnerType,
): AccessRule[] {
  const others = rules.filter((r) => r.segment !== "partenaire");
  const current = selectedPartnerTypes(rules);
  const next = current.includes(type)
    ? current.filter((t) => t !== type)
    : [...current, type];
  if (next.length === 0) {
    return [...others, { segment: "partenaire" }];
  }
  return [
    ...others,
    ...next.map((t) => ({ segment: "partenaire" as const, partnerType: t })),
  ];
}

/** Toggle générique d'un segment depuis une colonne de la table. */
export function toggleSegment(
  rules: AccessRule[],
  segment: AudienceId,
): AccessRule[] {
  if (segment === "partenaire") return togglePartnerSegment(rules);
  return toggleSimpleSegment(rules, segment);
}

/** Re-export pratique pour les composants (évite un import direct entitlements). */
export { parseAccessRules };

/* ------------------------------------------------------------------ */
/*  Libellés + variantes de badge pour le champ `type` technique       */
/* ------------------------------------------------------------------ */

/**
 * Libellé court affiché dans la colonne "Type". On regroupe tous les
 * `calc_*` sous "Calculateur" (le modèle ne distingue pas finement les
 * variantes — on ne sur-étiquette pas ce qu'on n'a pas).
 */
export function typeLabel(type: string): string {
  if (type.startsWith("calc_")) return "Calculateur";
  switch (type) {
    case "locator":
      return "Localisateur";
    case "lookup":
      return "Recherche";
    case "info":
      return "Référentiel";
    case "links":
      return "Liens";
    case "tutorial":
      return "Tutoriel";
    case "form":
      return "Formulaire";
    case "doc_generator":
      return "Générateur";
    default:
      return type;
  }
}

export type TypeBadgeVariant =
  | "info"
  | "warning"
  | "success"
  | "secondary"
  | "outline";

/** Variante de badge (couleur) par famille de type, pour la lecture rapide. */
export function typeBadgeVariant(type: string): TypeBadgeVariant {
  if (type.startsWith("calc_")) return "info";
  switch (type) {
    case "locator":
      return "warning";
    case "lookup":
    case "info":
      return "secondary";
    case "form":
    case "doc_generator":
      return "success";
    default:
      return "outline";
  }
}
