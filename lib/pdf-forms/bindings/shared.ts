// Helpers de bindings partagés entre formulaires.
//
// On partage la SÉMANTIQUE (identité citoyenne, adresse, banque), PAS les
// noms de widgets — chaque document AcroForm a ses propres pdfFieldName.
// L'appelant fournit la table de mapping widget-par-champ ; le helper
// fabrique les `MappingRule` correspondantes via `bind()`.

import { bind } from "./engine";
import type { MappingRule } from "./types";

/// Widgets d'identité citoyenne. Champs `id` sur le formulaire enrichi
/// (côté schéma `PdfFormField.id`) attendus :
///   - nom            : "nom"
///   - prenom         : "pr_nom"
///   - niss           : "niss"
///   - dateNaissance  : "date_de_naissance"     (optionnel — ID côté schéma)
///   - nationalite    : "nationalit_3"          (optionnel)
export interface IdentityWidgets {
  nom: string;
  prenom: string;
  niss: string;
  dateNaissance?: string;
  nationalite?: string;
}

/// Bindings identité. Ne stampe QUE les widgets fournis (les propriétés
/// absentes → aucune règle générée), et ne stampe rien si la valeur du
/// champ source est vide (`bind()` renvoie une entrée vide).
export function identityBindings(w: IdentityWidgets): MappingRule[] {
  const rules: MappingRule[] = [
    bind("nom", w.nom),
    bind("pr_nom", w.prenom),
    bind("niss", w.niss),
  ];
  if (w.dateNaissance) rules.push(bind("date_de_naissance", w.dateNaissance, "date-fr"));
  if (w.nationalite) rules.push(bind("nationalit_3", w.nationalite));
  return rules;
}

export interface AddressWidgets {
  rue: string;
  numero: string;
  boite?: string;
  codePostal: string;
  pays?: string;
}

/// Bindings adresse. Mêmes règles : widgets absents → pas de bind ; valeurs
/// vides → pas de stamp.
export function addressBindings(w: AddressWidgets): MappingRule[] {
  const rules: MappingRule[] = [
    bind("adresse_rue", w.rue),
    bind("num_ro", w.numero),
    bind("code_postal", w.codePostal),
  ];
  if (w.boite) rules.push(bind("num_ro_de_bo_te", w.boite));
  if (w.pays) rules.push(bind("pays", w.pays));
  return rules;
}
