// Moules de champs partagés par tous les formulaires ONEM.
//
// Ils vivaient dans `seed/c1/helpers.ts`, où le C1 en était propriétaire. Les
// sept compagnons en réimplémentaient chacun une copie locale — avec des
// divergences silencieuses (leur `YN` est monolingue là où celui du C1 est
// trilingue). Un seul exemplaire ici, et le C1 en devient un consommateur.

import type { PdfFormField } from "../../types";

// Sections du C1
export const SECTION_IDENTITE = "identite";
export const SECTION_DEMANDE = "demande";
export const SECTION_SITUATION_FAMILIALE = "situation-familiale";
export const SECTION_ACTIVITES = "mes-activites";
export const SECTION_REVENUS = "mes-revenus";
export const SECTION_PAIEMENT = "mode-paiement";
export const SECTION_COTISATION = "cotisation-syndicale";
export const SECTION_NON_EEE = "non-eee";
export const SECTION_DIVERS = "divers";
export const SECTION_AFFIRMATIONS = "affirmations";
export const SECTION_ANNEXES = "annexes";
export const SECTION_SIGNATURE = "signature";

// Sections propres aux compagnons
export const SECTION_ADRESSE = "adresse";
export const SECTION_EMPLOYEUR = "employeur";
export const SECTION_AIDE_INDEPENDANT = "aide-independant";
export const SECTION_ACTIVITES_ANTERIEURES = "activites-anterieures";
export const SECTION_MANDAT_CULTUREL = "mandat-culturel";
export const SECTION_PARTENAIRE = "partenaire";
export const SECTION_GRILLE_DIFFERENCES = "grille-differences";

/// Options communes oui/non. Premier élément = mappé à la case "oui_N",
/// second élément = mappé à la case "non_N".
export const YN = [
  { value: "oui", label: { fr: "Oui", nl: "Ja", de: "Ja" } },
  { value: "non", label: { fr: "Non", nl: "Nee", de: "Nein" } },
];

/// Options du follow-up "déjà déclaré à l'organisme de paiement ?".
export const YN_DECLARE = [
  { value: "oui", label: { fr: "Oui, déjà déclaré à l'organisme de paiement" } },
  { value: "non", label: { fr: "Non, à compléter maintenant" } },
];

/// Question officielle oui/non — une paire de cases `oui_N`/`non_N` sur le PDF.
///
/// Les trois réglages du C1 (`required`, `defaultValue`, `stepPriority`) sont
/// PARAMÉTRABLES, ses valeurs actuelles restant les valeurs par défaut : les
/// compagnons ont des questions volontairement facultatives, et hériter des
/// réglages du C1 pré-cocherait « non » chez eux et déplacerait leurs questions
/// dans l'accordéon « Autres informations ».
export function ouiNon(opts: {
  id: string;
  /// Paire de widgets, dans l'ordre des options : "oui_N|non_N".
  pdfFieldName: string;
  label: string;
  help?: string;
  section: string;
  order: number;
  required?: boolean;
  defaultValue?: string | null;
  stepPriority?: PdfFormField["stepPriority"] | null;
}): PdfFormField {
  return {
    id: opts.id,
    pdfFieldName: opts.pdfFieldName,
    type: "radio",
    required: opts.required ?? true,
    label: { fr: opts.label },
    ...(opts.help ? { help: { fr: opts.help } } : {}),
    options: YN,
    ...(opts.defaultValue === null ? {} : { defaultValue: opts.defaultValue ?? "non" }),
    section: opts.section,
    order: opts.order,
    ...(opts.stepPriority === null ? {} : { stepPriority: opts.stepPriority ?? "optional" }),
  };
}

/// Date « À partir du » adossée à une question oui/non : elle n'apparaît que
/// si la déclaration parente vaut « oui ». Quatre lignes du C1 suivent ce
/// moule (études, apprentissage, formation Syntra, congé sans solde), chacune
/// avec son propre widget de date sur le PDF.
export function dateAPartirDu(opts: {
  id: string;
  pdfFieldName: string;
  parentId: string;
  section: string;
  order: number;
}): PdfFormField {
  return {
    id: opts.id,
    pdfFieldName: opts.pdfFieldName,
    type: "date",
    required: false,
    label: { fr: "À partir du" },
    visibleIf: { fieldId: opts.parentId, op: "equals", value: "oui" },
    section: opts.section,
    order: opts.order,
    stepPriority: "optional",
  };
}

/// Case « J'ai joint … » de la rubrique Annexes. Le libellé se déduit du nom
/// du document : le PDF officiel nomme son widget d'après le document lui-même
/// (« une copie de l'extrait de la pension »), et la case imprimée se lit
/// « j'ai joint <document> ».
export function annexeJointe(opts: {
  id: string;
  /// Nom EXACT du widget, qui sert aussi de complément au libellé.
  pdfFieldName: string;
  /// À fournir quand le libellé ne se déduit pas du nom du widget.
  label?: string;
  order: number;
}): PdfFormField {
  return {
    id: opts.id,
    pdfFieldName: opts.pdfFieldName,
    type: "checkbox",
    required: false,
    label: { fr: opts.label ?? `J'ai joint ${opts.pdfFieldName}` },
    section: SECTION_ANNEXES,
    order: opts.order,
    stepPriority: "optional",
  };
}

/// Construit un champ radio "déjà déclaré ?" virtuel par défaut (pas de widget
/// PDF correspondant). Si `pdfFieldName` est fourni (paire dejaDeclareWidget|
/// declareWidget), on stamp les deux cases : "oui = déjà déclaré" coche la 1ʳᵉ,
/// "non = à compléter" coche la 2ᵉ.
export function dejaDeclare(opts: {
  id: string;
  parentId: string;
  helpText: string;
  section: string;
  order: number;
  pdfFieldName?: string;
  /// Repousse la question dans l'accordéon « Autres informations ». Portée par
  /// le helper (et non par un spread chez l'appelant) : 7 des 8 usages en
  /// avaient besoin, et chacun devait ré-emballer le résultat.
  stepPriority?: PdfFormField["stepPriority"];
}): PdfFormField {
  return {
    id: opts.id,
    pdfFieldName: opts.pdfFieldName ?? "",
    type: "radio",
    // La question n'existe que si la déclaration principale vaut « oui » ;
    // dans ce cas, le citoyen doit choisir explicitement entre « déjà
    // déclaré » et « première fois ». Ne jamais déduire ce choix à sa place.
    required: true,
    label: { fr: "Avais-tu déjà déclaré cette situation à ton organisme de paiement ?" },
    help: { fr: opts.helpText },
    options: YN_DECLARE,
    visibleIf: { fieldId: opts.parentId, op: "equals", value: "oui" },
    section: opts.section,
    order: opts.order,
    // Placé EN DERNIER, à la position qu'occupait le spread des appelants :
    // le schéma sérialisé en base reste octet pour octet identique.
    ...(opts.stepPriority ? { stepPriority: opts.stepPriority } : {}),
  };
}
