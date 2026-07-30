// Champs hérités du dossier : masquer ce qui est déjà connu, SANS jamais
// masquer ce qui est vide.
//
// Un compagnon (C1A, C1B, C47…) rouvre en page 1 l'identité et l'adresse que le
// citoyen vient d'écrire sur son C1. Les redemander est une corvée, et pire :
// deux saisies de la même donnée peuvent diverger. La demande d'Oraliks est
// donc « retirer l'étape identité du C1A, on l'a déjà via le C1 ».
//
// Deux façons de la satisfaire, et une seule qui tienne :
//
//   • `hidden: true` — exclu. Un champ `hidden` est retiré du payload public
//     (`public-serializer.ts`) ET sauté par le filler (`filler.ts`) : la case
//     officielle partirait BLANCHE.
//   • `autoAnswered: true` posé en base — exclu aussi, mais pour une autre
//     raison. Il fait exactement ce qu'il faut DANS un dossier (champ non
//     rendu, valeur préservée par `buildValidator` et stampée). Seulement les
//     compagnons ont chacun une URL publique — `/document/onem/c1a` est
//     `published`, `active`, sans verrou hors dossier — où il n'y a AUCUN
//     pré-remplissage. L'identité y serait invisible, vide, non exigée
//     (`autoAnswered` neutralise `required`), et le PDF partirait sans nom.
//
// D'où la règle d'ici : un champ marqué `inheritedFromDossier` ne devient
// `autoAnswered` qu'à l'ouverture, et seulement si le dossier a réellement
// fourni sa valeur. Sinon il reste à l'écran, obligatoire, saisissable.
//
// Deux propriétés en découlent, et ce sont elles qui rendent le masquage sûr :
//
//   1. « masqué ⟹ rempli » est vrai PAR CONSTRUCTION, pas par vigilance : la
//      décision lit `buildInitialValues`, la fonction même dont le runner tire
//      son état de départ. Il n'y a pas deux règles à tenir d'accord.
//   2. Le schéma STOCKÉ n'est pas touché : `required` y reste. Une soumission
//      sans identité est donc refusée par `buildValidator` côté serveur (422)
//      au lieu de produire un document officiel anonyme. Le jour où ce module
//      se tromperait, la panne serait bruyante.
//
// Générique par construction : rien ici ne connaît le C1A. Les six autres
// compagnons ont le même besoin et n'auront qu'à marquer leurs champs.

import type { FormPayload } from "./types";
import type { PublicField } from "./public-serializer";
import type { PrefillMap } from "./canonical/extract";
import { buildInitialValues, sanitizeStoredPayload } from "./initial-values";

/// Une valeur est-elle exploitable, c'est-à-dire de quoi remplir la case du
/// PDF sans que personne n'ait à la relire ?
///
/// Un `fullname` exige ses DEUX parties. `canonicalToPrefill` compose
/// `{ first: identity.prenom ?? "", last: identity.nom ?? "" }` dès qu'UNE
/// des deux clés existe : un dossier qui n'aurait transmis que le prénom
/// produirait sinon un champ masqué, et une déclaration officielle signée
/// « Marie » sans nom de famille.
export function isUsableInheritedValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return true;
  if (typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("first" in o || "last" in o) {
      const first = typeof o.first === "string" ? o.first.trim() : "";
      const last = typeof o.last === "string" ? o.last.trim() : "";
      return first !== "" && last !== "";
    }
  }
  return false;
}

/// Transforme la liste de champs servie au runner : chaque champ
/// `inheritedFromDossier` réellement pourvu par le dossier devient
/// `autoAnswered` (donc absent des étapes, cf. `isAutoField`), les autres
/// passent inchangés. Ne mute rien — les champs modifiés sont des copies.
///
/// @param dossierPrefill  valeurs héritées des AUTRES documents du dossier
///   (`applySharedValuesToForm` + `canonicalToPrefill`). `undefined` hors
///   dossier : aucun champ n'est alors masqué. Le pré-remplissage PROFIL n'a
///   délibérément pas sa place ici : il peut être ancien, et masquer un champ
///   sur sa foi priverait le citoyen du seul endroit où le corriger — alors
///   qu'une valeur venue du dossier vient du C1 qu'il vient d'écrire et reste
///   corrigeable à sa source.
/// @param draftValues  réponses déjà enregistrées pour CE formulaire, que le
///   runner applique par-dessus le pré-remplissage. Un brouillon plus ancien
///   que le C1 peut y écraser la valeur héritée par du vide : le champ doit
///   alors rester à l'écran, sans quoi le citoyen serait bloqué sur une erreur
///   « obligatoire » posée sur un champ qu'il ne voit pas.
export function applyDossierInheritance<F extends PublicField>(
  fields: readonly F[],
  dossierPrefill: PrefillMap | undefined,
  draftValues?: FormPayload
): F[] {
  if (!dossierPrefill || Object.keys(dossierPrefill).length === 0) return fields.slice();
  if (!fields.some((f) => f.inheritedFromDossier)) return fields.slice();

  // Exactement l'état de départ du runner : défauts + pré-remplissage, puis le
  // brouillon par-dessus (cf. `PdfFormRunner`, `useState` initial).
  //
  // `sanitizeStoredPayload` (pas un simple `draftValues ?? {}`) : `draftValues`
  // est un payload ENREGISTRÉ, potentiellement écrit sous un ancien schéma —
  // sans ce filtre, une valeur de mauvaise forme (ex. un tableau hérité d'un
  // champ devenu `textarea`) rendrait ce champ faussement « rempli » ici, et
  // masquerait à tort un champ hérité que le citoyen ne peut plus corriger
  // (cf. `lib/pdf-forms/initial-values.ts`).
  const initial: FormPayload = {
    ...buildInitialValues(fields, dossierPrefill),
    ...sanitizeStoredPayload(fields, draftValues),
  };

  return fields.map((f) => {
    if (!f.inheritedFromDossier) return f;
    // Deux conditions, pas une : le dossier doit fournir la valeur (sinon on
    // masquerait un champ sur la foi d'un défaut de schéma), ET la valeur que
    // le runner tiendra vraiment doit être exploitable (sinon un brouillon
    // vide la vide en silence).
    if (!isUsableInheritedValue(dossierPrefill[f.id])) return f;
    if (!isUsableInheritedValue(initial[f.id])) return f;
    return { ...f, autoAnswered: true } as F;
  });
}
