// Signature numérique "façon Adobe" générée à la volée.
//
// Au lieu d'une signature dessinée à la main, on compose un bloc texte
// (nom du signataire + mention "Signé numériquement par …" + horodatage)
// rendu dans le PDF au moment de la génération. Le nom est résolu à partir
// des champs déjà saisis dans le formulaire (champ `fullname`, ou
// prénom/nom via prefill, ou heuristique sur les libellés).
//
// Isomorphe (client pour la prévisualisation, serveur pour le rendu PDF).

import type { FormPayload, NameOrder } from "./types";
import { isFullNameValue } from "./types";
import { assembleFullName } from "./system-values";

interface SignFieldLike {
  id: string;
  type: string;
  prefillFrom?: string;
  nameOrder?: NameOrder;
  label?: { fr?: string; nl?: string; de?: string };
}

function labelText(f: SignFieldLike): string {
  return f.label?.fr || f.label?.nl || f.label?.de || "";
}

/// Résout le nom du signataire à partir du payload + schéma.
/// Ordre de priorité :
///   1. premier champ `fullname` rempli ;
///   2. prénom + nom identifiés via `prefillFrom` (profile/itsme) ;
///   3. heuristique sur l'id / le libellé du champ (prénom / nom).
/// Renvoie "" si rien d'exploitable (→ on ne peut pas signer).
export function resolveSignerName(fields: SignFieldLike[], payload: FormPayload): string {
  // 1. Champ nom complet.
  for (const f of fields) {
    if (f.type === "fullname") {
      const v = payload[f.id];
      if (isFullNameValue(v)) {
        const name = assembleFullName(v, f.nameOrder);
        if (name.trim()) return name.trim();
      }
    }
  }

  // 2. Prénom / nom via prefill.
  let first = "";
  let last = "";
  for (const f of fields) {
    const v = payload[f.id];
    if (typeof v !== "string" || !v.trim()) continue;
    if (!first && (f.prefillFrom === "profile.firstName" || f.prefillFrom === "itsme.firstName")) first = v.trim();
    if (!last && (f.prefillFrom === "profile.lastName" || f.prefillFrom === "itsme.lastName")) last = v.trim();
  }
  if (first || last) return [first, last].filter(Boolean).join(" ");

  // 3. Heuristique sur id + libellé.
  for (const f of fields) {
    const v = payload[f.id];
    if (typeof v !== "string" || !v.trim()) continue;
    const key = `${f.id} ${labelText(f)}`.toLowerCase();
    if (!first && /(pr[eé]nom|first.?name|voornaam)/.test(key)) first = v.trim();
    else if (!last && /(\bnom\b|last.?name|family|achternaam|surname)/.test(key)) last = v.trim();
  }
  if (first || last) return [first, last].filter(Boolean).join(" ");

  return "";
}

/// Horodatage façon Adobe : "2026.05.31 14:30:00" (fuseau Bruxelles).
export function signatureTimestamp(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("fr-BE", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export interface SignatureBlock {
  /// Ligne principale : le nom, rendu en italique (effet "signature").
  name: string;
  /// Mention type Adobe.
  by: string;
  /// Ligne d'horodatage.
  date: string;
}

/// Compose les 3 lignes du bloc de signature numérique.
export function buildSignatureBlock(name: string, date: Date = new Date()): SignatureBlock {
  return {
    name,
    by: `Signé numériquement par ${name}`,
    date: `Date : ${signatureTimestamp(date)}`,
  };
}
