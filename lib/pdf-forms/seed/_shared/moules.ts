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

/// Guide « __ __ / __ __ / __ __ __ __ » des dates du C1. Les quatre lignes
/// « à partir du » l'impriment à l'identique : huit cases, pas mesuré entre
/// 11,03 et 11,15 pt selon la ligne, écart de groupe entre 5,30 et 5,42 là où
/// le papier dessine « / ». On pose la moyenne : l'écart résiduel est de
/// l'ordre du dixième de point, invisible dans une case de 11 pt.
///
/// Sans ce peigne, « 01/09/2025 » s'imprimait d'un bloc PAR-DESSUS les cases
/// et leurs barres obliques, et les dernières restaient vides à droite — le
/// défaut qu'Oraliks avait signalé sur le C1 le 2026-07-27 et que
/// `combs-vs-guides.test.ts` détecte désormais tout seul.
const DATE_A_PARTIR_DU_COMB: NonNullable<PdfFormField["printAsComb"]> = {
  groups: [2, 2, 4],
  slotWidth: 11.06,
  groupExtra: 5.39,
  startX: 2,
  baselineY: 2,
};

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
    fontSize: 9,
    printAsComb: DATE_A_PARTIR_DU_COMB,
    section: opts.section,
    order: opts.order,
    stepPriority: "optional",
  };
}

/// Le même guide, pour les dates du C1 qui ne passent pas par le moule
/// ci-dessus (la borne « jusqu'au » du congé sans solde, et la case
/// mois/année de la cotisation syndicale, qui n'en a que six).
export const COMB_DATE_C1 = DATE_A_PARTIR_DU_COMB;

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

// ===========================================================================
// EN-TÊTE D'IDENTITÉ ET PIED DE SIGNATURE
// ===========================================================================
//
// Les trois blocs ci-dessous ouvrent et ferment TOUS les documents ONEM. Ils
// étaient recopiés dans chaque seed, et c'est là qu'ils se sont mis à diverger
// en silence : le C46 avait perdu le `prefillFrom: "system.today"` de sa date
// de signature (sa case partait blanche sur chaque document généré) et rangé
// cette date dans la page 1 comme un « tampon de réception ».
//
// Ce qui est FIXE ici l'est parce qu'il est identique partout ; ce qui varie
// (nom du widget, peigne imprimé, rang) est un paramètre. Aucune option n'est
// ouverte « au cas où » : le premier document qui aura besoin d'un libellé
// différent l'ajoutera à ce moment-là.

/// Bloc NISS de l'en-tête. `printAsComb` n'a pas de valeur par défaut : chaque
/// document imprime son propre guide en peigne, et un peigne hérité d'un autre
/// formulaire écrirait à côté des cases.
///
/// `drawAt` sert aux guides qu'AUCUN widget ne peut revendiquer — sur l'Annexe
/// Regis, la case NISS est le second widget du champ AcroForm « NOM », donc
/// inutilisable (les deux widgets d'un champ partagent une valeur, cf.
/// PDF_FORMS_RULES.md). Les deux sont alors écrits positionnellement.
export function champNISS(opts: {
  /// Vide quand la case est écrite positionnellement (voir `drawAt`).
  pdfFieldName?: string;
  drawAt?: PdfFormField["drawAt"];
  printAsComb: NonNullable<PdfFormField["printAsComb"]>;
  section: string;
  order: number;
}): PdfFormField {
  return {
    id: "niss",
    pdfFieldName: opts.pdfFieldName ?? "",
    ...(opts.drawAt ? { drawAt: opts.drawAt } : {}),
    type: "niss",
    required: true,
    label: { fr: "Numéro NISS (registre national)" },
    help: {
      fr: "11 chiffres au dos de votre carte d'identité (eID), au-dessus du code-barres.",
    },
    placeholder: { fr: "00.00.00-000.00" },
    prefillFrom: "profile.niss",
    canonicalKey: "identity.niss",
    // Dans un dossier, le C1 a déjà donné le NISS : le champ devient
    // `autoAnswered` à l'ouverture. Sur l'URL publique, il reste à l'écran.
    inheritedFromDossier: true,
    fontSize: 9,
    printAsComb: opts.printAsComb,
    section: opts.section,
    order: opts.order,
  };
}

/// Date de signature du pied de page. `prefillFrom: "system.today"` est
/// l'invariant à ne jamais perdre — c'est lui qui remplit la case.
export function champDateDeSignature(opts: {
  pdfFieldName: string;
  /// Par défaut « Date de signature » : le libellé de six des huit documents.
  label?: string;
  help?: string;
  fontSize: number;
  printAsComb: NonNullable<PdfFormField["printAsComb"]>;
  order: number;
}): PdfFormField {
  return {
    id: "aujourd_hui",
    pdfFieldName: opts.pdfFieldName,
    type: "date",
    required: true,
    label: { fr: opts.label ?? "Date de signature" },
    help: { fr: opts.help ?? "Pré-remplie automatiquement avec la date du jour." },
    prefillFrom: "system.today",
    fontSize: opts.fontSize,
    printAsComb: opts.printAsComb,
    section: SECTION_SIGNATURE,
    order: opts.order,
  };
}

/// Signature électronique du pied de page. `help` par défaut : l'engagement sur
/// l'honneur, que six des huit documents impriment mot pour mot.
export function champSignature(opts: {
  pdfFieldName: string;
  help?: string;
  order: number;
}): PdfFormField {
  return {
    id: "signature",
    pdfFieldName: opts.pdfFieldName,
    type: "signature",
    required: true,
    label: { fr: "Signature électronique" },
    help: {
      fr:
        opts.help ??
        "En signant, vous affirmez sur l'honneur que votre déclaration est sincère et complète.",
    },
    section: SECTION_SIGNATURE,
    order: opts.order,
  };
}

// ===========================================================================
// DÉCOUPAGE EN ÉTAPES (`stepGroup`)
// ===========================================================================

/// Table « id de champ → étape » d'un document : chaque question est sa propre
/// étape, et les champs qui la complètent la rejoignent.
export function carteDesGroupes(
  questions: readonly string[],
  rattachements: Readonly<Record<string, readonly string[]>>,
): Map<string, string> {
  const parChamp = new Map<string, string>();
  for (const question of questions) parChamp.set(question, question);
  for (const [question, rattaches] of Object.entries(rattachements)) {
    for (const id of rattaches) parChamp.set(id, question);
  }
  return parChamp;
}

/// Pose `stepGroup` sur chaque champ. Les champs des sections d'en-tête
/// tombent dans le groupe d'en-tête ; un champ inconnu des deux tables reste
/// SANS groupe et atterrit dans « Autres informations » de la dernière étape —
/// repli visible, jamais une perte.
///
/// La carte l'emporte sur le repli par section : un champ rattaché à une
/// question la suit même s'il est posé dans une section d'en-tête.
export function appliquerGroupes(
  fields: PdfFormField[],
  opts: {
    parChamp: ReadonlyMap<string, string>;
    groupeEntete: string;
    /// Sections dont les champs se lisent d'un bloc en tête du document.
    sectionsEntete: readonly string[];
  },
): PdfFormField[] {
  return fields.map((f) => {
    const groupe =
      opts.parChamp.get(f.id) ??
      (f.section && opts.sectionsEntete.includes(f.section) ? opts.groupeEntete : undefined);
    return groupe ? { ...f, stepGroup: groupe } : f;
  });
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
    label: { fr: "Aviez-vous déjà déclaré cette situation à votre organisme de paiement ?" },
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
