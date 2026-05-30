import { PdfFormField, FormPayload, PrefillSource } from "./types";
import { todayISO } from "./system-values";

/// Données disponibles pour le pré-remplissage. Toutes optionnelles.
export interface PrefillData {
  firstName?: string;
  lastName?: string;
  niss?: string;
  birthDate?: string; // ISO
  gender?: string;
  email?: string;
  phone?: string;
  iban?: string;
  street?: string;
  postalCode?: string;
  city?: string;
}

/// Mappe une source de prefill vers la donnée correspondante.
function resolve(source: PrefillSource, data: PrefillData): string | undefined {
  switch (source) {
    case "system.today":
      // Indépendant des données utilisateur : date de génération (Bruxelles).
      return todayISO();
    case "itsme.firstName":
    case "profile.firstName":
      return data.firstName;
    case "itsme.lastName":
    case "profile.lastName":
      return data.lastName;
    case "itsme.niss":
    case "profile.niss":
      return data.niss;
    case "itsme.birthDate":
      return data.birthDate;
    case "itsme.gender":
      return data.gender;
    case "profile.email":
      return data.email;
    case "profile.phone":
      return data.phone;
    case "profile.iban":
      return data.iban;
    case "itsme.street":
    case "profile.street":
      return data.street;
    case "itsme.postalCode":
    case "profile.postalCode":
      return data.postalCode;
    case "itsme.city":
    case "profile.city":
      return data.city;
    default:
      return undefined;
  }
}

/// Construit un payload de pré-remplissage pour un formulaire à partir des
/// données disponibles (itsme/profil). Ne renvoie que les champs résolus.
export function buildPrefillPayload(fields: PdfFormField[], data: PrefillData): FormPayload {
  const payload: FormPayload = {};
  for (const f of fields) {
    if (!f.prefillFrom) continue;
    const v = resolve(f.prefillFrom, data);
    if (v !== undefined && v !== "") payload[f.id] = v;
  }
  return payload;
}
