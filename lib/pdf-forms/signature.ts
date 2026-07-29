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
  canonicalKey?: string;
  nameOrder?: NameOrder;
  label?: { fr?: string; nl?: string; de?: string };
}

function labelText(f: SignFieldLike): string {
  return f.label?.fr || f.label?.nl || f.label?.de || "";
}

const PREFILL_PRENOM = new Set(["profile.firstName", "itsme.firstName"]);
const PREFILL_NOM = new Set(["profile.lastName", "itsme.lastName"]);

/// Valeur déposée dans un champ `signature` pour dire « le citoyen a coché la
/// case », par `applyServerAutoFields` côté serveur et par le runner au submit.
/// Ce n'est PAS un nom — cf. `signerNameFromSignatureField`.
export const SIGNATURE_CONFIRMEE = "confirmed";

/// Certains schémas font TAPER son nom au citoyen dans le champ de signature
/// lui-même : le filler s'en sert alors comme repli quand `resolveSignerName`
/// ne trouve rien. Mais la sentinelle de confirmation n'est pas une saisie —
/// la laisser passer imprimait « Signé numériquement par confirmed » sur un
/// document officiel dès que la résolution du nom échouait.
export function signerNameFromSignatureField(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  return v === "" || v === SIGNATURE_CONFIRMEE ? "" : v;
}

/// Le formulaire DÉSIGNE-T-IL lui-même où lire le nom du déclarant ?
///
/// Un champ `fullname`, une clé canonique `identity.nom`/`identity.prenom`, un
/// `prefillFrom` d'identité : chacun est une déclaration explicite du schéma.
/// Quand il y en a une, elle EST la réponse — vide comprise.
function declareSaSourceDeNom(fields: readonly SignFieldLike[]): boolean {
  return fields.some(
    (f) =>
      f.type === "fullname" ||
      f.canonicalKey === "identity.nom" ||
      f.canonicalKey === "identity.prenom" ||
      (f.prefillFrom !== undefined &&
        (PREFILL_PRENOM.has(f.prefillFrom) || PREFILL_NOM.has(f.prefillFrom)))
  );
}

/// Résout le nom du signataire à partir du payload + schéma.
/// Ordre de priorité :
///   1. premier champ `fullname` rempli ;
///   2. prénom + nom portant les clés canoniques `identity.prenom`/`.nom` ;
///   3. prénom + nom identifiés via `prefillFrom` (profile/itsme) ;
///   4. heuristique sur l'id / le libellé du champ (prénom / nom) — et
///      SEULEMENT si le schéma ne désigne aucune source explicite.
/// Renvoie "" si rien d'exploitable (→ on ne peut pas signer).
///
/// ⚠ Le garde posé sur l'étape 4 n'est pas cosmétique. L'heuristique lit
/// N'IMPORTE QUEL champ dont le libellé contient « nom » — y compris le nom
/// d'un TIERS. Sur le C1A, `independantNom` (« 2. Nom de l'indépendant que tu
/// aides ») la satisfait : avec un `nomEtPrenom` vide, `resolveSignerName`
/// renvoyait « Vandenberghe », et le filler apposait « Signé numériquement par
/// Vandenberghe » sur la déclaration d'un autre citoyen (vérifié le 2026-07-29
/// sur le schéma réel du C1A). Le même piège attend `employeurNom`,
/// `independantTitulaireNom`, et tout champ nommant un tiers sur un futur
/// formulaire.
///
/// Quand le schéma désigne sa source, deviner ne peut donc RIEN apporter et
/// peut tout casser : la bonne valeur y est déjà, ou elle n'existe pas. Ne rien
/// renvoyer est alors la seule réponse honnête — et elle est sans conséquence
/// pratique sur les huit formulaires publiés, dont aucun ne peut atteindre le
/// filler sans identité (elle y est `required` et validée serveur).
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

  // 2. Prénom / nom par clé canonique — la désignation la plus explicite qui
  //    soit, et la seule qui ne puisse pas désigner un tiers : le vocabulaire
  //    canonique ne décrit que le déclarant (cf. canonical/vocabulary.ts).
  let first = "";
  let last = "";
  for (const f of fields) {
    const v = payload[f.id];
    if (typeof v !== "string" || !v.trim()) continue;
    if (!first && f.canonicalKey === "identity.prenom") first = v.trim();
    if (!last && f.canonicalKey === "identity.nom") last = v.trim();
  }
  if (first || last) return [first, last].filter(Boolean).join(" ");

  // 3. Prénom / nom via prefill.
  for (const f of fields) {
    const v = payload[f.id];
    if (typeof v !== "string" || !v.trim()) continue;
    if (!first && f.prefillFrom !== undefined && PREFILL_PRENOM.has(f.prefillFrom)) first = v.trim();
    if (!last && f.prefillFrom !== undefined && PREFILL_NOM.has(f.prefillFrom)) last = v.trim();
  }
  if (first || last) return [first, last].filter(Boolean).join(" ");

  // 4. Heuristique sur id + libellé — repli des formulaires anciens, dont le
  //    schéma inféré ne porte aucun marqueur. Interdite dès que le schéma en
  //    porte un : cf. le commentaire ci-dessus.
  if (declareSaSourceDeNom(fields)) return "";
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
