// Règles de mapping du C1 « changement de situation personnelle ».
//
// Migration déclarative des 6 transforms historiques (client-side) vers un
// tableau évalué CÔTÉ SERVEUR avant `fillForm`. Cf. plan
// docs/superpowers/plans/2026-07-07-pdf-bindings-canonical-ux-plan.md §1.4.
//
// Widgets AcroForm vérifiés sur `private/pdfs/C1_FR.pdf` via
// `scripts/dump-c1.ts`. Chaque libellé est reproduit AU CARACTÈRE PRÈS
// (espaces multiples, apostrophes typographiques, etc.).

import type { MappingRule } from "../types";
import type { FormPayload } from "../../types";
import {
  ibanBelgianSplit,
  ibanForeignRouting,
  horsEeeTripleNon,
  dateHeaderFallback,
} from "../macros";
import { formatDateFR, wrapAcrossLines } from "../format";

// ---------------------------------------------------------------------------
// Widgets ciblés (constantes internes — lisibilité + refactor safe).
// ---------------------------------------------------------------------------

// Motif d'introduction : 4 cases mutuellement exclusives sur le PDF officiel.
const W_MOTIF_MODIFICATION = "je déclare une modification concernant";
const W_MOTIF_TRANSFERT_OP = "je change dorganisme de paiement à partir du 5";

// Chips de nature de modification (4 cases indépendantes cochables si
// motifIntroduction === "modification").
const W_CHIP_ADRESSE = "mon adresse à partir du";
const W_CHIP_FAMILLE = "ma situation personnelle ou celle des membres de mon ménage 7";
const W_CHIP_PERMIS = "mon permis de séjour ou mon permis de travail";
const W_CHIP_COMPTE = "le mode de paiement de mes allocations ou mon numéro de compte6";

// IBAN belge — 4 widgets texte (maxLength connus : 2 + 4 + 4 + 4).
const W_IBAN_CHECK = "B E";
const W_IBAN_PART1 = "undefined_11";
const W_IBAN_PART2 = "undefined_12";
const W_IBAN_PART3 = "undefined_13";

// Compte SEPA non-belge : UN SEUL champ, imprimé sur DEUX lignes (Oraliks
// 2026-07-26 : « c'est un seul champ mais avec deux lignes, au cas où le
// compte est trop long »). On remplit la ligne du haut puis on déborde sur
// celle du bas — avant, tout partait sur la ligne du BAS et celle du haut
// restait vide, ce qui la faisait apparaître comme un widget orphelin.
// Double espace INTENTIONNEL dans le nom du 2e widget (vérifié au dump — ne
// jamais normaliser). Le BIC a son propre widget, à droite de la 2e ligne.
const W_IBAN_ETRANGER_L1 = "IBAN";
const W_IBAN_ETRANGER_L2 = "SEPA étranger IBAN  BIC";
// Largeurs réelles : 223 pt puis 238 pt, soit ≈ 5,8 pt par caractère.
const IBAN_ETRANGER_BUDGET = [34, 40] as const;

// Titulaire + remarque situation familiale.
const W_TITULAIRE = "NomTitulaireSipasOk";

// Les 4 widgets « Remarques » du PDF forment DEUX boîtes de deux lignes :
//   • bloc situation familiale  : « Remarques 1 Haut » puis « Remarques 2 Haut »
//   • bloc libre, bas de page 1 : « Remarques 1_2 Bas » puis « Remarques 2_2 Bas »
// Seule la 1ʳᵉ ligne de la 1ʳᵉ boîte était utilisée ; les trois autres étaient
// orphelines (2026-07-26). Budgets en caractères ≈ largeur du widget / 5,3 pt.
const W_REMARQUE = "Remarques 1 Haut";
const W_REMARQUE_L2 = "Remarques 2 Haut";
const REMARQUE_FAM_BUDGET = [88, 96] as const;

const W_REMARQUE_LIBRE = "Remarques 1_2 Bas";
const W_REMARQUE_LIBRE_L2 = "Remarques 2_2 Bas";
const REMARQUE_LIBRE_BUDGET = [90, 98] as const;

// En-tête page 2, libellé imprimé « date DA / modification » (widget `DateDeDA`,
// ex-`DateDeModification`). Reçoit la date du changement déclaré, IDENTIQUE à la
// date du motif (Oraliks 2026-07-10 : « la date du motif = la date DA /
// modification en haut de la page 2 »). Fallback : modif → transfert → demande.
const W_DATE_HEADER_P2 = "DateDeDA";

// En-tête page 2 : le PDF officiel duplique l'identité dans un unique widget
// `NomPrenom`. Le champ `nom_et_pr_nom` qui le cible est `hidden` (jamais saisi)
// et le citoyen ne remplit que `pr_nom` (Prénom) + `nom` séparément (page 1) →
// on compose « Prénom Nom » ici (règle `nom-prenom-header-p2`).
const W_NOM_PRENOM_P2 = "NomPrenom";

// Dates « à partir du » par ligne de motif. Oraliks a scindé le champ unique
// `DateModification` (1 champ / 5 widgets) en 5 widgets distincts le 2026-07-10
// (« dates identiques sauf pour transfert ») → on date UNIQUEMENT la ligne du
// motif coché. Les 3 modifications partagent `dateModificationEffective` ; le
// transfert d'organisme porte sa propre date (`dateChangementOrganisme`).
const W_DATE_ADRESSE = "DateAdresse";
const W_DATE_SITUATION = "DatePersonnelleOuMenage";
const W_DATE_BANQUE = "DateBanque";
const W_DATE_TRANSFERT = "DateDeTransfert";

// Widget fusionné code postal + commune (nouvel AcroForm) : on y écrit
// « 1000 Bruxelles » (cf. règle `code-postal-commune`).
const W_CODE_POSTAL_COMMUNE = "CodePostal et Commune";

// Rubrique HORS-EEE : les 3 cases « non » à cocher pour un citoyen EEE
// (statut réfugié, apatride, ressortissant hors EEE).
const W_NON_REFUGIE = "non_17";
const W_NON_APATRIDE = "non_18";
const W_NON_HORS_EEE = "non_19";

// ---------------------------------------------------------------------------
// Helpers spécifiques à ces règles. La logique IBAN belge / étranger et
// date-header vit maintenant dans `bindings/macros/` — cf. les usages plus
// bas dans `C1_CHANGEMENT_RULES`.
// ---------------------------------------------------------------------------

/// Concatène les fragments de remarque à partir des choix de situation
/// familiale. Ordre stable — reproduit la logique de
/// c1-remarque-derivation.ts pour parité comportementale.
function buildRemarqueFragments(payload: FormPayload): string[] {
  const parts: string[] = [];
  if (payload.statutFamilial === "isole" && payload.habiteEnColocation === "oui") {
    parts.push("cohousing");
  }
  // « en cours » et « pas encore reçu » disaient la même chose : les deux
  // options ont fusionné en `en-cours` (Oraliks 2026-07-26). `pas-encore-recu`
  // reste accepté pour les brouillons enregistrés avant la fusion.
  // Les deux autres statuts (`en-main`, `deja-introduit`) cochent une case
  // officielle du PDF et n'ont donc rien à dire en remarque.
  const jugement = payload.statutJugementPensionAlimentaire;
  if (jugement === "en-cours" || jugement === "pas-encore-recu") {
    parts.push("jugement en cours, pas encore en ma possession");
  }
  // Remarques saisies par ligne de cohabitant (grille « Personnes avec qui je
  // cohabite ») : le sous-champ `remarque` n'a AUCUN widget PDF propre
  // (pdfFieldName vide, pas de template) — sans cette agrégation il tombe dans
  // le vide. On les déverse dans la zone « Remarques » globale du bas de page,
  // préfixées du nom pour rester lisibles quand il y a plusieurs cohabitants.
  const cohabitants = Array.isArray(payload.cohabitants) ? payload.cohabitants : [];
  for (const c of cohabitants) {
    if (!c || typeof c !== "object") continue;
    const row = c as Record<string, unknown>;
    const remarque = typeof row.remarque === "string" ? row.remarque.trim() : "";
    if (!remarque) continue;
    const prenom = typeof row.prenom === "string" ? row.prenom.trim() : "";
    const nom = typeof row.nom === "string" ? row.nom.trim() : "";
    const who = [prenom, nom].filter(Boolean).join(" ");
    parts.push(who ? `${who} : ${remarque}` : remarque);
  }
  return parts;
}

/// « je déclare une modification concernant » est cochée dès qu'AU MOINS UN
/// motif de modification l'est (adresse / situation familiale / permis /
/// compte). Indépendant du transfert d'organisme (Oraliks 2026-07-18). La
/// cotisation syndicale est `hidden` dans ce dossier (gérée ailleurs) → elle
/// n'entre pas dans ce signal.
function hasModificationMotif(payload: FormPayload): boolean {
  return (
    payload.modificationAdresse === true ||
    payload.modificationSituationFamiliale === true ||
    payload.modificationPermisSejour === true ||
    payload.modificationCompte === true
  );
}

/// Date d'effet d'une ligne de motif : ne stampe le widget QUE si le champ
/// source (date saisie) est non vide, après formatage FR (DD/MM/YYYY). Renvoie
/// un tableau vide sinon → la ligne du motif non renseigné reste vierge.
function motifDateStamp(payload: FormPayload, widget: string, source: string) {
  const v = payload[source];
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return [];
  return [{ widget, value: formatDateFR(raw) }];
}

// ---------------------------------------------------------------------------
// Règles.
// ---------------------------------------------------------------------------

export const C1_CHANGEMENT_RULES: MappingRule[] = [
  // -------- Motif d'introduction : 2 cases INDÉPENDANTES --------
  //
  // « je déclare une modification concernant » ⇔ au moins un motif de
  // modification coché (adresse / situation / permis / compte). « je change
  // d'organisme de paiement » ⇔ le chip transfert coché. Les DEUX sont
  // INDÉPENDANTES (Oraliks 2026-07-18) : cocher le transfert ne décoche PLUS
  // la case modification, et inversement — on peut déclarer une modification
  // ET un transfert dans la même déclaration. Chaque case ne dépend QUE de son
  // propre signal.
  //
  // ⚠ Le signal n'est JAMAIS `motifIntroduction` : on lit les vrais
  // checkboxes cochés par le citoyen. Historiquement c'était une CONTRAINTE
  // (`autoAnswered` → `buildValidator` l'excluait du schéma Zod, et `z.object`
  // le strippait du payload validé : il valait `undefined` côté serveur) ;
  // depuis le correctif de `buildValidator` la valeur survit, mais on garde
  // les checkboxes comme source — c'est le geste réel du citoyen, alors que
  // `motifIntroduction` n'est qu'un reflet calculé. Chaque case est stampée
  // explicitement (true/false) pour un rendu déterministe quel que soit
  // l'état du template.
  {
    name: "motif-modification",
    stampFn: (p) => [{ widget: W_MOTIF_MODIFICATION, value: hasModificationMotif(p) }],
    declaredWidgets: [W_MOTIF_MODIFICATION],
  },
  {
    name: "motif-transfert-op",
    stampFn: (p) => [{ widget: W_MOTIF_TRANSFERT_OP, value: p.transfereOrganismePaiement === true }],
    declaredWidgets: [W_MOTIF_TRANSFERT_OP],
  },

  // -------- Chips « nature de modification » (4 cases indépendantes) -------
  //
  // Ces 4 champs sont déjà `type: "checkbox"` avec `pdfFieldName` renseigné
  // côté schéma → le mapping historique les stampe correctement. Les règles
  // sont doublées ici pour deux raisons :
  //   1. En Phase 7, on retirera le `pdfFieldName` du schéma pour supprimer
  //      complètement les "workaround" — les règles doivent alors être
  //      autosuffisantes.
  //   2. Dernier gagnant : si un jour on veut décocher une case en fonction
  //      d'un autre choix (ex. mutuellement exclusive), il suffit d'ajouter
  //      une règle plus bas dans le tableau.
  //
  // La règle stampe UNIQUEMENT `true` quand la case est cochée — pas
  // `false` explicite quand elle ne l'est pas (le PDF template est déjà
  // décoché par défaut ; sur-cocher pour décocher ferait apparaître ces
  // widgets dans la Map même quand aucun changement d'état n'est requis).
  {
    name: "chip-adresse",
    when: { modificationAdresse: true },
    stamp: [{ widget: W_CHIP_ADRESSE, value: true }],
  },
  {
    name: "chip-famille",
    when: { modificationSituationFamiliale: true },
    stamp: [{ widget: W_CHIP_FAMILLE, value: true }],
  },
  {
    name: "chip-permis",
    when: { modificationPermisSejour: true },
    stamp: [{ widget: W_CHIP_PERMIS, value: true }],
  },
  {
    name: "chip-compte",
    when: { modificationCompte: true },
    stamp: [{ widget: W_CHIP_COMPTE, value: true }],
  },

  // -------- IBAN belge → split en 4 groupes (via macro) --------
  //
  // Le template C1 imprime « B E · __ __ · __ __ __ __ · __ __ __ __ ·
  // __ __ __ __ ». Widget « B E » = 2 chiffres de contrôle,
  // undefined_11/12/13 = 3 groupes de 4 chiffres. Macro réutilisable pour
  // tout document ONEM avec le même pattern IBAN visuel.
  ibanBelgianSplit({
    sourceField: "iban",
    widgets: {
      checkDigits: W_IBAN_CHECK,
      part1: W_IBAN_PART1,
      part2: W_IBAN_PART2,
      part3: W_IBAN_PART3,
    },
  }),

  // -------- IBAN étranger → widget SEPA (via macro) --------
  //
  // Pour un IBAN non-BE, on stampe la valeur SAISIE (avec espaces
  // d'origine — l'ONEM la lit telle quelle) sur le widget « SEPA étranger
  // IBAN BIC ». Le filler standard n'écrase pas le widget belge car son
  // pdfFieldName côté `iban` est vide.
  ibanForeignRouting({
    sourceField: "iban",
    widgets: [W_IBAN_ETRANGER_L1, W_IBAN_ETRANGER_L2],
    maxCharsPerLine: IBAN_ETRANGER_BUDGET,
  }),

  // -------- Titulaire du compte --------
  //
  // Le widget « NomTitulaireSipasOk » (= nom du titulaire SI le compte n'est
  // PAS au nom du citoyen) ne doit être rempli QUE pour « autre-nom » (Oraliks
  // 2026-07-10 : « si c'est à mon nom, ne mets pas le nom de la personne »).
  // Sur "mon-nom", aucun stamp → le compte est présumé au nom du citoyen. Plus
  // de règle `titulaire-mon-nom` (elle stampait à tort le nom du citoyen).
  {
    name: "titulaire-autre",
    when: { modePaiement: "virement", titulaireCompte: "autre-nom" },
    stampFn: (payload) => {
      const explicit =
        typeof payload.titulaireCompteNom === "string"
          ? payload.titulaireCompteNom.trim()
          : "";
      if (!explicit) return [];
      return [{ widget: W_TITULAIRE, value: explicit }];
    },
    declaredWidgets: [W_TITULAIRE],
  },

  // -------- Remarque situation familiale (parité applyRemarqueSituationFamiliale)
  //
  // Le PDF a un widget texte « Remarques 1 » sur lequel on déverse une
  // synthèse des cas particuliers non capturables par les cases officielles
  // (cohousing = isolé + colocation ; jugement pas encore en possession).
  // Concaténation par « ; » comme dans le transform d'origine.
  {
    name: "remarque-fam",
    whenFn: (payload) => buildRemarqueFragments(payload).length > 0,
    stampFn: (payload) => {
      const parts = buildRemarqueFragments(payload);
      if (parts.length === 0) return [];
      // La boîte compte deux lignes : on déborde sur la seconde plutôt que de
      // laisser la fin de la remarque hors du cadre.
      const widgets = [W_REMARQUE, W_REMARQUE_L2];
      return wrapAcrossLines(parts.join(" ; "), REMARQUE_FAM_BUDGET).map((value, i) => ({
        widget: widgets[i],
        value,
      }));
    },
    declaredWidgets: [W_REMARQUE, W_REMARQUE_L2],
  },

  // -------- Remarque libre à l'attention de l'ONEM (bas de page 1) --------
  //
  // Champ facultatif saisi par le citoyen (ou par l'expert qui l'accompagne) :
  // c'est là qu'on écrit ce qu'aucune case ne permet de dire, par exemple
  // « Application de l'article 60B ». Le champ n'a pas de `pdfFieldName` — ce
  // sont ces deux lignes qui le portent.
  {
    name: "remarque-libre",
    whenFn: (payload) =>
      typeof payload.remarqueLibreOnem === "string" && payload.remarqueLibreOnem.trim() !== "",
    stampFn: (payload) => {
      const raw = typeof payload.remarqueLibreOnem === "string" ? payload.remarqueLibreOnem.trim() : "";
      if (!raw) return [];
      const widgets = [W_REMARQUE_LIBRE, W_REMARQUE_LIBRE_L2];
      return wrapAcrossLines(raw, REMARQUE_LIBRE_BUDGET).map((value, i) => ({
        widget: widgets[i],
        value,
      }));
    },
    declaredWidgets: [W_REMARQUE_LIBRE, W_REMARQUE_LIBRE_L2],
  },

  // -------- Dates « à partir du » par ligne de motif (widgets scindés) --------
  //
  // Oraliks a scindé le champ unique `DateModification` (1 champ / 5 widgets)
  // en 5 widgets distincts le 2026-07-10 (« des dates différentes à l'AcroForm
  // mais identiques sauf pour transfert »). On date UNIQUEMENT la ligne du
  // motif COCHÉ : les 3 modifications (adresse / situation / compte) partagent
  // la date de changement (`dateModificationEffective`) ; le transfert
  // d'organisme porte la sienne (`dateChangementOrganisme`). Ligne non cochée =
  // widget laissé vide (motifDateStamp renvoie []).
  {
    name: "date-adresse",
    when: { modificationAdresse: true },
    stampFn: (p) => motifDateStamp(p, W_DATE_ADRESSE, "dateModificationEffective"),
    declaredWidgets: [W_DATE_ADRESSE],
  },
  {
    name: "date-situation",
    when: { modificationSituationFamiliale: true },
    stampFn: (p) => motifDateStamp(p, W_DATE_SITUATION, "dateModificationEffective"),
    declaredWidgets: [W_DATE_SITUATION],
  },
  {
    name: "date-banque",
    when: { modificationCompte: true },
    stampFn: (p) => motifDateStamp(p, W_DATE_BANQUE, "dateModificationEffective"),
    declaredWidgets: [W_DATE_BANQUE],
  },
  {
    name: "date-transfert",
    when: { transfereOrganismePaiement: true },
    stampFn: (p) => motifDateStamp(p, W_DATE_TRANSFERT, "dateChangementOrganisme"),
    declaredWidgets: [W_DATE_TRANSFERT],
  },

  // -------- En-tête « date DA / modification » page 2 (via macro) --------
  //
  // L'en-tête porte la date de la DEMANDE / MODIFICATION, jamais la date de
  // transfert (Oraliks 2026-07-27). Un transfert d'organisme pur garde donc en
  // en-tête la date de changement déclarée par le citoyen, tandis que la date
  // de prise d'effet du transfert reste sur sa propre ligne (`DateDeTransfert`,
  // règle `date-transfert`) — les deux diffèrent légitimement, le transfert
  // prenant effet le mois suivant.
  //
  // `dateChangementOrganisme` a donc été RETIRÉE des sources le 2026-07-27.
  // Elle n'avait jamais gagné en pratique — `dateModificationEffective` est
  // `required` et sans `visibleIf` dans ce dossier, donc toujours remplie — mais
  // sa présence disait le contraire de la règle métier, et un futur changement
  // de profil aurait suffi à faire remonter la date de transfert dans l'en-tête.
  //
  // `dateDemande` reste en dernier recours : les payloads déjà stockés sont
  // rejoués tels quels par `regenerate-pdfs` (zip, e-mail, retéléchargement),
  // sans repasser par la validation — certains sont antérieurs au passage de
  // `dateModificationEffective` en `required`.
  //
  // Widget `DateDeDA` (ex-`DateDeModification`).
  dateHeaderFallback({
    widget: W_DATE_HEADER_P2,
    sources: ["dateModificationEffective", "dateDemande"],
    name: "date-header-p2",
  }),

  // -------- Nom + prénom en-tête page 2 (widget `NomPrenom`) --------
  //
  // Le citoyen saisit `pr_nom` (Prénom) et `nom` séparément (page 1, widgets
  // `Prenom`/`Nom`). L'en-tête de page 2 a un widget unique `NomPrenom` dont le
  // champ cible (`nom_et_pr_nom`) est `hidden` → jamais alimenté. On compose
  // « Prénom Nom » ici pour que l'identité apparaisse aussi en page 2.
  {
    name: "nom-prenom-header-p2",
    whenFn: (payload) => {
      const p = typeof payload.pr_nom === "string" ? payload.pr_nom.trim() : "";
      const n = typeof payload.nom === "string" ? payload.nom.trim() : "";
      return p !== "" || n !== "";
    },
    stampFn: (payload) => {
      const p = typeof payload.pr_nom === "string" ? payload.pr_nom.trim() : "";
      const n = typeof payload.nom === "string" ? payload.nom.trim() : "";
      const value = [p, n].filter(Boolean).join(" ");
      return value ? [{ widget: W_NOM_PRENOM_P2, value }] : [];
    },
    declaredWidgets: [W_NOM_PRENOM_P2],
  },

  // -------- Code postal + commune (widget fusionné) --------
  //
  // Le nouvel AcroForm remplace les champs séparés « code postal » / « commune »
  // (cette dernière sans widget) par un unique « CodePostal et Commune ». On y
  // écrit « <code postal> <commune> » (ex. « 1000 Bruxelles ») ; la commune est
  // résolue à l'écran depuis le code postal (cf. commune-select-input.tsx).
  {
    name: "code-postal-commune",
    whenFn: (payload) => typeof payload.code_postal === "string" && payload.code_postal.trim() !== "",
    stampFn: (payload) => {
      const cp = typeof payload.code_postal === "string" ? payload.code_postal.trim() : "";
      const commune = typeof payload.commune === "string" ? payload.commune.trim() : "";
      const value = [cp, commune].filter(Boolean).join(" ");
      return value ? [{ widget: W_CODE_POSTAL_COMMUNE, value }] : [];
    },
    declaredWidgets: [W_CODE_POSTAL_COMMUNE],
  },

  // -------- Rubrique HORS-EEE : cas standard "non" (via macro) --------
  //
  // Se déclenche sur la question EXPLICITE `nationaliteHorsEEE === "non"`
  // (JAMAIS sur le texte libre `nationalit_3` — décision confirmée par
  // Oraliks pendant la session de conception du plan).
  horsEeeTripleNon({
    sourceField: "nationaliteHorsEEE",
    matchValue: "non",
    widgets: {
      nonRefugie: W_NON_REFUGIE,
      nonApatride: W_NON_APATRIDE,
      nonHorsEee: W_NON_HORS_EEE,
    },
  }),

  // NOTE — `niss-header-p2` mentionné dans le plan §1.4 est intentionnellement
  // OMIS : le header NISS de la page 2 n'a pas de widget AcroForm dédié
  // (vérifié au dump). L'inférence actuelle stampe le NISS via un champ
  // masqué (`Nom et prénom` marqué `hidden`) — laisser en l'état pour ne
  // rien casser. À rouvrir en Phase 7 quand on aura un vrai widget cible.
];
