// Adapter itsme (prefill via OIDC). STUB : la logique réseau est en place mais
// désactivée tant que les identifiants ne sont pas fournis. Aucune dépendance
// externe ; on parle OpenID Connect standard (itsme = fournisseur OIDC).
//
// Env requis pour activer :
//   ITSME_CLIENT_ID
//   ITSME_CLIENT_SECRET
//   ITSME_REDIRECT_URI
//   ITSME_ISSUER         (ex. https://oidc.prd.itsme.services/oidc  — à confirmer)
//   ITSME_SCOPES         (def. "openid profile email")
//
// Docs : https://belgianmobileid.github.io/doc/  (OpenID Connect / OAuth2)

import { PrefillData } from "../prefill";

export function isItsmeConfigured(): boolean {
  return !!(
    process.env.ITSME_CLIENT_ID &&
    process.env.ITSME_CLIENT_SECRET &&
    process.env.ITSME_REDIRECT_URI &&
    process.env.ITSME_ISSUER
  );
}

export interface ItsmeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer: string;
  scopes: string;
}

function readConfig(): ItsmeConfig {
  if (!isItsmeConfigured()) throw new Error("itsme non configuré");
  return {
    clientId: process.env.ITSME_CLIENT_ID!,
    clientSecret: process.env.ITSME_CLIENT_SECRET!,
    redirectUri: process.env.ITSME_REDIRECT_URI!,
    issuer: process.env.ITSME_ISSUER!,
    scopes: process.env.ITSME_SCOPES || "openid profile email",
  };
}

/// Construit l'URL d'autorisation OIDC vers itsme.
/// `state` et `nonce` sont à générer/vérifier côté appelant (anti-CSRF/replay).
export function buildAuthorizationUrl(params: { state: string; nonce: string }): string {
  const cfg = readConfig();
  const qs = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: cfg.scopes,
    state: params.state,
    nonce: params.nonce,
  });
  return `${cfg.issuer.replace(/\/$/, "")}/authorization?${qs.toString()}`;
}

/// Claims OIDC bruts qu'on attend d'itsme (sous-ensemble).
interface ItsmeClaims {
  given_name?: string;
  family_name?: string;
  birthdate?: string;
  gender?: string;
  email?: string;
  phone_number?: string;
  // national number selon le scope egov (nom de claim à confirmer côté contrat)
  "urn:itsme:claims:nationalNumber"?: string;
  national_number?: string;
  address?: {
    street_address?: string;
    postal_code?: string;
    locality?: string;
  };
}

/// Mappe les claims itsme vers nos données de prefill.
export function mapClaimsToPrefill(claims: ItsmeClaims): PrefillData {
  return {
    firstName: claims.given_name,
    lastName: claims.family_name,
    birthDate: claims.birthdate,
    gender: claims.gender,
    email: claims.email,
    phone: claims.phone_number,
    niss: claims["urn:itsme:claims:nationalNumber"] || claims.national_number,
    street: claims.address?.street_address,
    postalCode: claims.address?.postal_code,
    city: claims.address?.locality,
  };
}

/// Échange le code d'autorisation contre les claims utilisateur.
/// STUB : implémentation réseau à finaliser avec le contrat itsme réel
/// (endpoints token + userinfo, vérif signature ID token).
export async function exchangeCodeForPrefill(_code: string): Promise<PrefillData> {
  if (!isItsmeConfigured()) {
    throw new Error("itsme non configuré — prefill indisponible");
  }
  // TODO(itsme): POST {issuer}/token → access_token → GET {issuer}/userinfo
  //              vérifier l'ID token (nonce, signature JWKS) puis mapClaimsToPrefill.
  throw new Error("itsme: échange de code non encore implémenté (accès en attente)");
}
