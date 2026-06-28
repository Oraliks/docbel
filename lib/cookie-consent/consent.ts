// Moteur PUR du consentement cookies (RGPD_QUEUE §1).
// Aucun import React / next : réutilisable côté serveur (lecture du cookie dans
// app/layout.tsx) ET côté client (provider). Ne dépend que de l'API standard.

/** Nom du cookie de consentement (lisible serveur + client). */
export const CONSENT_COOKIE = "docbel-consent";

/** Version du schéma de consentement. Incrémenter quand on ajoute/retire une
 *  catégorie → re-sollicite automatiquement le consentement (cf. hasDecision). */
export const CONSENT_VERSION = 1;

/** Durée de vie du consentement : 6 mois (reco CNIL/APD). En secondes. */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 182;

/** Catégories pilotables. `necessary` est implicite (toujours vrai) et n'est
 *  donc PAS un toggle ; on ne stocke que les catégories opt-in. */
export type ConsentCategory = "analytics";

/** Liste ordonnée des catégories opt-in (hors « nécessaires »). */
export const OPTIN_CATEGORIES: readonly ConsentCategory[] = ["analytics"] as const;

/** État de consentement décodé depuis le cookie. */
export type ConsentState = {
  v: number;
  /** Mesure d'audience : Vercel Analytics + beacon first-party page-views. */
  analytics: boolean;
  /** Horodatage ISO de la décision (preuve de consentement). */
  ts: string;
};

/** Tout refuser (hors nécessaires). */
export function makeRejectAll(ts: string): ConsentState {
  return { v: CONSENT_VERSION, analytics: false, ts };
}

/** Tout accepter. */
export function makeAcceptAll(ts: string): ConsentState {
  return { v: CONSENT_VERSION, analytics: true, ts };
}

/**
 * Parse la valeur brute du cookie. Renvoie `null` si absent, illisible, ou
 * d'une version obsolète → l'appelant traite ça comme « pas de décision » et
 * (ré)affiche la bannière sans activer aucun traceur.
 */
export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const obj = JSON.parse(decoded) as Partial<ConsentState>;
    if (!obj || typeof obj !== "object") return null;
    if (obj.v !== CONSENT_VERSION) return null; // schéma obsolète → re-consent
    return {
      v: CONSENT_VERSION,
      analytics: obj.analytics === true,
      ts: typeof obj.ts === "string" ? obj.ts : "",
    };
  } catch {
    return null;
  }
}

/** Sérialise l'état pour stockage cookie (valeur URL-encodée). */
export function serializeConsent(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state));
}

/** Une décision valide existe-t-elle ? (sinon → afficher la bannière). */
export function hasDecision(state: ConsentState | null): state is ConsentState {
  return state !== null && state.v === CONSENT_VERSION;
}

/** Attributs du cookie côté client (document.cookie). */
export function consentCookieString(state: ConsentState): string {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  return [
    `${CONSENT_COOKIE}=${serializeConsent(state)}`,
    "Path=/",
    `Max-Age=${CONSENT_MAX_AGE}`,
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
