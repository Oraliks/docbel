// Constantes de section et fabriques de champs du C1.
//
// Regroupées ici pour que les modules thématiques (identite, motif,
// famille…) partagent EXACTEMENT les mêmes moules : c'est la seule
// garantie qu'une question ajoutée demain se comportera comme ses voisines.

import type { PdfFormField } from "../../types";

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

/// Question officielle oui/non du C1 — le moule le plus répandu du formulaire :
/// une paire de cases `oui_N`/`non_N` sur le PDF, deux options, « Non » en
/// valeur de départ.
///
/// `defaultValue: "non"` : la majorité des C1 servent à déclarer un AUTRE
/// motif ; partir de « Non » évite de faire cocher quinze réponses négatives à
/// quelqu'un qui vient simplement changer d'adresse. Toujours modifiable.
///
/// `stepPriority: "optional"` : ces déclarations vivent dans l'accordéon
/// « Autres informations », pas dans le flux principal.
export function ouiNon(opts: {
  id: string;
  /// Paire de widgets, dans l'ordre des options : "oui_N|non_N".
  pdfFieldName: string;
  label: string;
  help?: string;
  section: string;
  order: number;
}): PdfFormField {
  return {
    id: opts.id,
    pdfFieldName: opts.pdfFieldName,
    type: "radio",
    required: true,
    label: { fr: opts.label },
    ...(opts.help ? { help: { fr: opts.help } } : {}),
    options: YN,
    defaultValue: "non",
    section: opts.section,
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

/// Schéma enrichi pour les 15 questions oui/non + 5 follow-ups
/// "déjà déclaré ?". Chaque question est typée `radio` avec options [oui, non]
/// et pointe vers la paire de checkboxes correspondante sur le PDF.
///
/// Note : seules ces questions sont définies ici. Les autres champs du C1
/// (identité, adresse, mode de paiement, situation familiale…) conservent
/// leur définition existante — voir applyC1Improvements() pour l'overlay.
