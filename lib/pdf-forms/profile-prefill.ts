/// Pré-remplissage des PDFs depuis le profil unique de l'utilisateur connecté.
///
/// **Principe** : on réutilise le mécanisme « valeurs partagées » des bundles
/// (cf. lib/bundles/shared-values.ts). Un `UserProfile` est projeté sur une map
/// `SharedBundleValues` indexée par `PrefillSource` (ex. "profile.niss"), puis
/// `applySharedValuesToForm` mappe ces sources sur les champs du PDF qui portent
/// le `prefillFrom` correspondant. Zéro nouveau chemin de résolution : la même
/// fonction sert au prefill profil et au prefill cross-document.
///
/// Les champs `date` (NISS, naissance…) restent des chaînes ISO (AAAA-MM-JJ),
/// cohérent avec le reste de la chaîne de prefill.

import type { PrefillSource } from "./types";
import type { SharedBundleValues } from "@/lib/bundles/shared-values";
import { applySharedValuesToForm } from "@/lib/bundles/shared-values";
import type { PublicField } from "./public-serializer";

/// Sous-ensemble du `UserProfile` Prisma exploitable pour le prefill. Toutes
/// optionnelles ; `birthDate` accepte un `Date` (Prisma) ou une chaîne ISO.
export interface ProfilePrefillInput {
  firstName?: string | null;
  lastName?: string | null;
  niss?: string | null;
  birthDate?: Date | string | null;
  gender?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  iban?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
}

/// Normalise une date (Date Prisma ou chaîne) en ISO court AAAA-MM-JJ.
function toIsoDate(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // Chaîne : on tronque à la partie date si c'est un ISO complet.
  return value.slice(0, 10);
}

/// Ajoute une entrée seulement si la valeur est une chaîne non vide.
function put(out: SharedBundleValues, key: PrefillSource, value: string | null | undefined) {
  const v = (value ?? "").trim();
  if (v) out[key] = v;
}

/// Projette un profil sur une map `PrefillSource → valeur`, prête à être passée
/// à `applySharedValuesToForm`. On alimente AUSSI les clés `itsme.*` quand le
/// champ canonique correspondant n'a qu'une source itsme (ex. la date de
/// naissance, mappée sur `itsme.birthDate` dans le catalogue) : le profil sert
/// alors de repli pour ces champs sans dupliquer de schéma.
export function profileToSharedValues(profile: ProfilePrefillInput): SharedBundleValues {
  const out: SharedBundleValues = {};

  put(out, "profile.firstName", profile.firstName);
  put(out, "profile.lastName", profile.lastName);
  put(out, "profile.niss", profile.niss);
  put(out, "profile.street", profile.street);
  put(out, "profile.postalCode", profile.postalCode);
  put(out, "profile.city", profile.city);
  put(out, "profile.iban", profile.iban);
  put(out, "profile.gender", profile.gender);

  // Téléphone : on privilégie le GSM (plus joignable) puis le fixe.
  put(out, "profile.phone", profile.mobilePhone || profile.phone);

  // Date de naissance : repli profil → sources itsme.birthDate ET profile.birthDate
  // (un champ peut porter l'une ou l'autre selon le catalogue / le formulaire).
  const birth = toIsoDate(profile.birthDate);
  if (birth) {
    out["profile.birthDate"] = birth;
    out["itsme.birthDate"] = birth;
  }

  return out;
}

/// Construit la map `fieldId → valeur` de pré-remplissage d'un PDF à partir du
/// profil. Ne renvoie que les champs effectivement résolus (cf.
/// `applySharedValuesToForm`).
export function buildProfilePrefill(
  fields: PublicField[],
  profile: ProfilePrefillInput
): Record<string, string> {
  return applySharedValuesToForm(fields, profileToSharedValues(profile));
}
