// Helpers de bindings partagés entre formulaires.
//
// On partage la SÉMANTIQUE (identité citoyenne, adresse, banque), PAS les
// noms de widgets — chaque document AcroForm a ses propres pdfFieldName.
// L'appelant fournit la table de mapping widget-par-champ ; le helper
// fabrique les `MappingRule` correspondantes via `bind()`.

import { bind } from "./engine";
import type { MappingRule } from "./types";
import type { FormPayload } from "../types";

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

/// Ordre d'assemblage d'un widget composite « nom + prénom ».
///   • "prenom-nom" : « Marie Dupont » (défaut sur les compagnons ONEM
///     dont le libellé est « Prénom et nom »).
///   • "nom-prenom" : « Dupont Marie » (utilisé quand le libellé du widget
///     est « Nom et prénom »).
export type FullnameOrder = "prenom-nom" | "nom-prenom";

/// Fabrique une règle qui stampe un widget UNIQUE avec le nom composite du
/// citoyen. Pattern PDF fréquent (C1A, C1B, C1C, C46, C47, C1-Partenaire)
/// où l'AcroForm expose un seul slot texte pour « Nom et prénom » alors que
/// le formulaire de saisie garde `nom` et `pr_nom` séparés. Le mécanisme
/// standard `pdfFieldName` du schéma ne peut pas stamper la concaténation
/// tout seul — d'où cette règle.
///
/// Sources par défaut : ids `pr_nom` et `nom` du schéma (convention seed
/// C1). L'appelant peut surcharger via `fromFields` pour les documents qui
/// utilisent d'autres ids (ex. `niss_ch_meur` / `nom_ch_meur`).
export function fullnameBinding(opts: {
  widget: string;
  order?: FullnameOrder;
  fromFields?: { prenom: string; nom: string };
}): MappingRule {
  const order = opts.order ?? "prenom-nom";
  const source = opts.fromFields ?? { prenom: "pr_nom", nom: "nom" };
  return {
    name: `fullname:${opts.widget}`,
    stampFn: (payload: FormPayload) => {
      const prenom =
        typeof payload[source.prenom] === "string"
          ? (payload[source.prenom] as string).trim()
          : "";
      const nom =
        typeof payload[source.nom] === "string"
          ? (payload[source.nom] as string).trim()
          : "";
      const parts =
        order === "nom-prenom" ? [nom, prenom] : [prenom, nom];
      const full = parts.filter(Boolean).join(" ");
      if (!full) return [];
      return [{ widget: opts.widget, value: full }];
    },
    declaredWidgets: [opts.widget],
  };
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
