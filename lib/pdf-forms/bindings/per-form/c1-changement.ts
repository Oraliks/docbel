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

// IBAN étranger (compte SEPA non-belge). Double espace INTENTIONNEL dans le
// nom du widget (vérifié au dump — ne pas normaliser).
const W_IBAN_ETRANGER = "SEPA étranger IBAN  BIC";

// Titulaire, remarque, dates page 2.
// AcroForm remanié par Oraliks (2026-07-10) : noms de widgets rendus
// sémantiques. « Date de DA » (4 widgets) a été scindé en `DateDeModification`
// (en-tête haut) + `DateDA` (3 widgets) — on stampe la MÊME date dans les deux
// (parité avec l'ancien comportement, cf. les 2 règles date-header plus bas).
const W_TITULAIRE = "NomTitulaireSipasOk";
const W_REMARQUE = "Remarques 1";
const W_DATE_HEADER_P2 = "DateDeModification";
const W_DATE_DA_P2 = "DateDA";

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
  const jugement = payload.statutJugementPensionAlimentaire;
  if (jugement === "en-cours") parts.push("jugement en cours");
  else if (jugement === "pas-encore-recu") parts.push("je n'ai pas encore reçu mon jugement");
  return parts;
}

/// « Prénom Nom » propres (trim + join espace unique). Renvoie "" si les
/// deux champs sont vides.
function buildFullName(payload: FormPayload): string {
  const prenom = typeof payload.pr_nom === "string" ? payload.pr_nom.trim() : "";
  const nom = typeof payload.nom === "string" ? payload.nom.trim() : "";
  return [prenom, nom].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Règles.
// ---------------------------------------------------------------------------

export const C1_CHANGEMENT_RULES: MappingRule[] = [
  // -------- Motif d'introduction (parité avec applyMotifTransferOverride) --
  //
  // Deux cases mutuellement exclusives sur le PDF officiel : « je déclare
  // une modification concernant » vs « je change d'organisme de paiement ».
  // Si l'utilisateur a coché le chip transfert OP (5e chip UI, virtuel), on
  // stampe la case transfert ET on DÉCOCHE la case modification, quels que
  // soient les 4 chips de modification cochés en parallèle (la case
  // modification est mutuellement exclusive — cocher les deux romprait le
  // PDF officiel).
  {
    name: "motif-modification",
    when: {
      motifIntroduction: "modification",
      transfereOrganismePaiement: { not: true },
    },
    stamp: [{ widget: W_MOTIF_MODIFICATION, value: true }],
  },
  {
    name: "motif-transfert-op",
    when: { transfereOrganismePaiement: true },
    stamp: [
      { widget: W_MOTIF_TRANSFERT_OP, value: true },
      { widget: W_MOTIF_MODIFICATION, value: false },
    ],
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
    widget: W_IBAN_ETRANGER,
  }),

  // -------- Titulaire du compte (parité applyTitulaireCompteNomDerivation) -
  //
  // Sur virement, le widget « Nom du titulaire » doit être rempli DÈS QU'un
  // compte est saisi — même quand le compte est au nom du citoyen (auquel
  // cas le champ UI `titulaireCompteNom` reste caché pour ne pas afficher
  // un input redondant). On distingue les deux branches :
  //   - "mon-nom" → « Prénom Nom » du citoyen ;
  //   - "autre-nom" → valeur saisie manuellement.
  {
    name: "titulaire-mon-nom",
    when: { modePaiement: "virement", titulaireCompte: "mon-nom" },
    stampFn: (payload) => {
      const fullName = buildFullName(payload);
      if (!fullName) return [];
      return [{ widget: W_TITULAIRE, value: fullName }];
    },
    declaredWidgets: [W_TITULAIRE],
  },
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
  // (cohousing = isolé + colocation ; jugement en cours ; jugement pas
  // encore reçu). Concaténation par « ; » comme dans le transform d'origine.
  {
    name: "remarque-fam",
    whenFn: (payload) => buildRemarqueFragments(payload).length > 0,
    stampFn: (payload) => {
      const parts = buildRemarqueFragments(payload);
      if (parts.length === 0) return [];
      return [{ widget: W_REMARQUE, value: parts.join(" ; ") }];
    },
    declaredWidgets: [W_REMARQUE],
  },

  // -------- Dates page 2 (via macro) --------
  //
  // Priorité à la date de changement (`dateModificationEffective`), fallback
  // sur la date de demande initiale (`dateDemande`). Formatage FR (DD/MM/YYYY).
  // Deux widgets depuis le remaniement AcroForm : l'en-tête `DateDeModification`
  // ET les 3 champs `DateDA` reçoivent la MÊME date (Oraliks 2026-07-10).
  dateHeaderFallback({
    widget: W_DATE_HEADER_P2,
    sources: ["dateModificationEffective", "dateDemande"],
    name: "date-header-p2",
  }),
  dateHeaderFallback({
    widget: W_DATE_DA_P2,
    sources: ["dateModificationEffective", "dateDemande"],
    name: "date-da-p2",
  }),

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
