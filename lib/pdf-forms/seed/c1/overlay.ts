// Application du schéma enrichi sur les champs déjà en base.
//
// C'est ici que vit la complexité du C1 : quels champs inférés survivent,
// quel profil de motif s'applique, quelle section va dans quelle étape.
// Le reste du dossier n'est que de la donnée.

import type { AcroFieldRaw, PdfFormField } from "../../types";
import { C1_QUESTIONS } from "./questions";
import {
  SECTION_IDENTITE,
  SECTION_DEMANDE,
  SECTION_SITUATION_FAMILIALE,
  SECTION_ACTIVITES,
  SECTION_REVENUS,
  SECTION_PAIEMENT,
  SECTION_COTISATION,
  SECTION_NON_EEE,
  SECTION_DIVERS,
  SECTION_AFFIRMATIONS,
  SECTION_ANNEXES,
  SECTION_SIGNATURE,
} from "./helpers";


/// Set des `pdfFieldName` (côté positif ET côté négatif) couverts par les
/// nouveaux champs radio. Sert à supprimer les anciens champs checkboxes
/// individuels (oui_2, non_2, …) que le parser AcroForm avait inférés.
function coveredCheckboxNames(): Set<string> {
  const set = new Set<string>();
  for (const q of C1_QUESTIONS) {
    if (!q.pdfFieldName.includes("|")) continue;
    for (const name of q.pdfFieldName.split("|")) set.add(name.trim());
  }
  return set;
}

/// Set des `pdfFieldName` NON pipe-séparés utilisés par C1_QUESTIONS. Sans
/// cette couverture, les champs enrichis dont l'`id` est friendly (camelCase
/// : `modificationAdresse`, `titulaireCompteNom`…) mais dont le pdfFieldName
/// est la version verbeuse du PDF (« mon adresse à partir du », « Nom du
/// titulaire »…) se dédoublonnent avec leurs jumeaux inférés uniquement par
/// l'ID — or `makeId(pdfFieldName)` produit un slug DIFFÉRENT du camelCase,
/// donc `newIds.has(...)` rate le doublon et l'inféré survit (bug remonté par
/// Oraliks 2026-07-07 : chips `modificationAdresse` / `modificationCompte`
/// réapparaissant hors du step Motif avec leur libellé PDF brut).
function coveredSingleNames(): Set<string> {
  const set = new Set<string>();
  for (const q of C1_QUESTIONS) {
    if (!q.pdfFieldName || q.pdfFieldName.includes("|")) continue;
    set.add(q.pdfFieldName);
  }
  return set;
}

/// Widgets PDF « en-tête de page 2 » qui dupliquent des données déjà saisies
/// en page 1 (Nom + Prénom + date de DA) mais que le parser AcroForm remonte
/// comme des champs indépendants. Aucune case à ajouter en formulaire — juste
/// à masquer visuellement pour ne pas polluer la section Identité.
const HIDDEN_INFERRED_PDF_NAMES = new Set<string>([
  "Nom et prénom",
  // « Date de DA » n'est plus dans la hide-list — désormais stampée par la
  // règle serveur `date-header-p2` (dateModificationEffective ?? dateDemande).
]);

// Champs issus d'anciennes inférences du C1. Ils sont maintenant couverts par
// les bindings serveur : les conserver crée une écriture double ou référence
// un widget qui n'existe plus dans le PDF actuellement importé.
const LEGACY_C1_WORKAROUND_FIELD_IDS = new Set<string>([
  "dateHeaderP2",
  "nom_et_pr_nom",
  "ibanCheckDigits",
  "ibanPart1",
  "ibanPart2",
  "ibanPart3",
  "sepa_tranger_iban_bic",
  "titulaireCompteNomStamp",
  // Fusionné dans `statutJugementPensionAlimentaire` (2026-07-26) : les deux
  // cases officielles « je joins une copie » / « j'ai déjà introduit une
  // copie » y sont désormais mappées par la convention pipe. Sans cette
  // entrée, l'ancien champ resté en base survivrait à l'overlay (son
  // pdfFieldName pipe complet n'est pas dans `coveredCheckboxNames`) et se
  // battrait avec le nouveau pour les MÊMES widgets.
  "pensionAlimentaireDejaDeclare",
  // Inféré à l'import sur le widget « NomTitulaireSipasOk » — la case « nom du
  // titulaire SI le compte n'est pas à votre nom ». L'inférence l'a typé `iban`
  // parce que l'infobulle ONEM de ce widget est trompeuse (/TU = « Le n° IBAN
  // se trouve sur vos extraits de compte »), et ce libellé devenait la question
  // posée au citoyen. Deux conséquences mesurées : une SECONDE question IBAN
  // facultative à l'écran, et surtout l'IBAN écrit dans la case réservée au NOM
  // du titulaire (« 68539007547034 » constaté sur le PDF généré).
  //
  // Le dédoublonnage habituel ne l'attrapait pas : il ne retire un inféré que si
  // son widget est déjà couvert par un champ du seed, or `titulaireCompteNom`
  // est purement UI (`pdfFieldName` vide) — le widget est stampé côté serveur
  // par la règle `titulaire-autre`, qui reste la seule source légitime.
  "nomtitulairesipasok",
  // Inféré sur le widget fusionné « CodePostal et Commune », recompose par la
  // règle `code-postal-commune`. Le seed pose déjà `code_postal` et `commune`
  // avec un `pdfFieldName` VIDE, justement pour laisser la règle assembler les
  // deux — mais cette absence d'ancre empêche le dédoublonnage de reconnaître
  // le doublon, et l'inféré revenait poser une 3ᵉ question « code postal ».
  "codepostal_et_commune",
]);

export interface ApplyC1ImprovementsOptions {
  /// Valeur par défaut à appliquer sur `motifIntroduction` pour CETTE cible
  /// uniquement (ne mute jamais le tableau partagé `C1_QUESTIONS`). Utilisé
  /// par les dossiers dont le motif d'entrée est implicite (ex.
  /// "changement-situation-personnelle" → "modification").
  defaultMotif?: string;
  /// Restreint le motif d'introduction à 5 situations concrètes (Oraliks,
  /// 2026-07-06) pour le dossier "changement de situation personnelle" :
  ///   - masque `modificationCotisationSyndicale` (hors périmètre de ce
  ///     dossier — la retenue syndicale se gère via la section Cotisation) ;
  ///   - relabelle + réordonne les 4 chips de modification restants
  ///     (adresse / situation familiale / permis / compte) selon le phrasé
  ///     dicté par Oraliks ;
  ///   - ajoute un 5e chip virtuel `transfereOrganismePaiement` (case à
  ///     cocher, aucune case PDF propre) qui révèle `dateChangementOrganisme`.
  /// `motifIntroduction` reste défaulté sur "modification" et n'est PLUS
  /// montré comme sélecteur — mais "je transfère vers un autre organisme" est
  /// une case PDF DIFFÉRENTE et mutuellement exclusive de "modification" sur
  /// le formulaire officiel (mêmes 4 cases radio qu'aujourd'hui). Il ne faut
  /// donc JAMAIS soumettre "modification" quand ce 5e chip est coché : la
  /// bascule se fait via `applyMotifTransferOverride`, appelée juste avant
  /// l'envoi du payload (cf. `submit()` dans pdf-form-runner.tsx) — jamais en
  /// mutant le state React live, pour ne pas faire disparaître les 4 chips
  /// (gatés sur motifIntroduction === "modification", qui doit rester stable
  /// pendant toute la saisie).
  restrictMotifTo5Situations?: boolean;
  /// Inventaire des widgets réellement présents dans le PDF importé. Il
  /// permet de retirer les anciens champs cachés qui pointent vers un widget
  /// disparu sans affecter les champs visibles du FormRunner.
  technicalSchema?: readonly AcroFieldRaw[];
}

/// Clé de groupe partagée par les 5 chips "situation" : aucune n'est
/// individuellement requise, mais il en faut AU MOINS UNE (cf. `requiredGroup`
/// dans types.ts) — sinon l'étape "Motif" pouvait être passée sans rien
/// déclarer du tout (trouvé par Oraliks, 2026-07-07).
const MOTIF_SITUATION_GROUP = "motifSituation";

/// Libellés relabelés (phrasé "je/mon", Oraliks 2026-07-06) + nouvel ordre
/// d'affichage pour les 4 chips de modification existants, appliqués
/// uniquement quand `restrictMotifTo5Situations` est actif. `labelShort`
/// = version mobile compacte (< 640px) — Phase 4 du plan
/// bindings-canonical-ux ; laissé absent quand le label desktop tient déjà
/// sur mobile sans wrapping problématique.
const RESTRICTED_MOTIF_OVERRIDES: Record<
  string,
  { label: string; labelShort?: string; order: number }
> = {
  modificationAdresse: { label: "J'ai changé d'adresse", order: 5 },
  modificationSituationFamiliale: {
    label: "Ma situation personnelle ou celle des membres de mon ménage a changé",
    labelShort: "Ma situation de ménage a changé",
    order: 6,
  },
  modificationPermisSejour: {
    label: "Mon permis de séjour ou mon permis de travail a changé",
    labelShort: "Mon permis a changé",
    order: 7,
  },
  modificationCompte: { label: "Mon n° de compte bancaire a changé", order: 8 },
};

/// 5e situation : transfert vers un autre organisme de paiement. Virtuel
/// (aucune case PDF propre) — pilote uniquement la visibilité de
/// `dateChangementOrganisme` et, à la soumission, la valeur réelle de
/// `motifIntroduction` (cf. `applyMotifTransferOverride`).
const TRANSFERE_ORGANISME_FIELD: PdfFormField = {
  id: "transfereOrganismePaiement",
  pdfFieldName: "",
  type: "checkbox",
  required: false,
  label: { fr: "Je transfère mon dossier vers un autre organisme de paiement" },
  labelShort: { fr: "Je change d'organisme de paiement" },
  section: SECTION_DEMANDE,
  order: 8.5,
  renderAs: "chip",
  requiredGroup: MOTIF_SITUATION_GROUP,
};

// La dérivation de soumission (`transfereOrganismePaiement` → override de
// `motifIntroduction`) vit dans lib/pdf-forms/c1-motif-transfer.ts, PAS ici :
// ce fichier seed/ n'est importé que côté serveur (scripts, routes admin) —
// le runner (composant client partagé par tous les dossiers) ne doit jamais
// importer ce module (C1_QUESTIONS + tout le schéma C1) pour éviter de
// gonfler le bundle client de CHAQUE formulaire avec ~150 définitions de
// champs qui ne le concernent pas.

/// Regroupement des 12 sections en 5 macro-étapes (cf. spec
/// 2026-07-06-form-runner-5-macro-steps) via `stepGroup`, consommé par
/// `buildMacroSteps`. Sections inférées non enrichies (`adresse`, `banque`)
/// → identité ; champs sans section → pas de groupe → accordéon « Autres
/// informations » en fin d'étape 5.
const SECTION_TO_STEP_GROUP: Record<string, string> = {
  [SECTION_DEMANDE]: "motif",
  [SECTION_IDENTITE]: "identite",
  adresse: "identite",
  banque: "identite",
  [SECTION_PAIEMENT]: "identite",
  [SECTION_ACTIVITES]: "activites-revenus",
  [SECTION_REVENUS]: "activites-revenus",
  [SECTION_SITUATION_FAMILIALE]: "famille",
  [SECTION_COTISATION]: "final",
  [SECTION_NON_EEE]: "final",
  [SECTION_DIVERS]: "final",
  [SECTION_AFFIRMATIONS]: "final",
  [SECTION_ANNEXES]: "final",
  // La section signature (dateSignature + signature) doit vivre dans
  // l'étape finale — sans ça, les 2 champs tombent hors stepper et deviennent
  // invisibles ; leur prefill (system.today, signerName) s'applique mais si
  // pour une raison quelconque le prefill rate, l'utilisateur est bloqué au
  // submit avec un message générique et aucun champ visible à corriger.
  [SECTION_SIGNATURE]: "final",
};

function withStepGroup(f: PdfFormField): PdfFormField {
  const group = f.section ? SECTION_TO_STEP_GROUP[f.section] : undefined;
  return group ? { ...f, stepGroup: group } : f;
}

/// Dates d'INTRODUCTION / D'EFFET d'un dossier — refusent le week-end (#7b,
/// Oraliks 2026-07-11 : « impossible de faire un dossier le samedi/dimanche »).
/// Exclut les dates de naissance et les dates automatiques (création/signature,
/// system.today) qui ne sont pas des choix utilisateur.
const NO_WEEKEND_DATE_IDS = new Set<string>([
  "dateDemande",
  "dateChangementOrganisme",
  "dateModificationEffective",
  "etudesPleinExerciceDate",
  "apprentissageAlternanceDate",
  "formationStageSyntraDate",
  "congeSansSoldeDate",
]);

function withNoWeekend(f: PdfFormField): PdfFormField {
  return NO_WEEKEND_DATE_IDS.has(f.id) ? { ...f, noWeekend: true } : f;
}

// ---------------------------------------------------------------------------
// Curation des widgets bruts non sectionnés (le « long-tail » inféré du PDF).
// Principe SÛR : on ne masque un champ que si son `pdfFieldName` est DÉJÀ
// rempli ailleurs (champ enrichi, ou array cohabitants via templates /
// firstMatchMapping), OU s'il s'agit d'un widget auto (date de génération,
// signature) ou cryptique. Jamais un widget unique porteur de donnée → aucune
// case officielle laissée blanche.
// ---------------------------------------------------------------------------

/// Étend un template positionnel "{index} 1" en "1 1","2 1",…,"N 1".
function expandTemplate(tpl: string, maxRows: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= maxRows; i++) out.push(tpl.replace("{index}", String(i)));
  return out;
}

/// Ensemble des pdfFieldName « déjà remplis » par les champs enrichis : nom
/// direct, parts pipe-séparées, templates d'array et cibles firstMatchMapping.
function collectCoveredPdfNames(fields: PdfFormField[]): Set<string> {
  const covered = new Set<string>();
  const add = (name?: string) => {
    if (!name) return;
    for (const part of name.split("|")) if (part) covered.add(part);
  };
  for (const f of fields) {
    add(f.pdfFieldName);
    if (f.type === "array") {
      const maxRows = f.maxRows ?? 5;
      for (const it of f.itemFields ?? []) {
        if (it.pdfFieldNameTemplate) for (const n of expandTemplate(it.pdfFieldNameTemplate, maxRows)) add(n);
        add(it.pdfFieldName);
      }
      if (f.firstMatchMapping) for (const v of Object.values(f.firstMatchMapping.fields)) add(v);
    }
  }
  return covered;
}

/// Widgets cryptiques / sans libellé exploitable (junk PDF).
const JUNK_PDF_RE = /^(undefined_\d+|Texte\d+|B E|Mois \+ Année|Remarques.*|Signature\d*)$/;
/// Cellules positionnelles de la grille cohabitants ("1", "1 1", "1_2"…) :
/// widgets de tableau sans libellé, remplis (colonnes 1/2) par l'array ou
/// laissés virtuels (colonne nom) — jamais saisis directement par l'usager.
const POSITIONAL_PDF_RE = /^\d+( \d+|_\d+)?$/;

/// Masque un champ NON sectionné s'il est un doublon couvert, un widget auto,
/// une cellule de grille positionnelle, ou du junk. Renvoie le champ inchangé
/// sinon (reste dans « Autres informations »). Ne touche jamais un sectionné.
function curatePreserved(f: PdfFormField, covered: Set<string>): PdfFormField {
  const name = f.pdfFieldName || "";
  // Contrairement aux autres règles de curation (limitées aux champs
  // NON sectionnés), la hide-list explicite des en-têtes de page 2
  // (« Nom et prénom », « Date de DA ») doit s'appliquer AUSSI aux champs
  // que field-inference a sectionnés à tort en `identite` — sinon ils
  // réapparaissent en bas de la section Identité (bug remonté par Oraliks
  // 2026-07-07 : « Nom Et PréNom » orphelin en fin d'identité).
  if (HIDDEN_INFERRED_PDF_NAMES.has(name)) return { ...f, hidden: true };
  if (f.section) return f;
  const isDuplicate = covered.has(name);
  const isAutoWidget = f.type === "signature" || /^Date\d+_af_date$/i.test(name);
  const isJunk =
    JUNK_PDF_RE.test(name) || POSITIONAL_PDF_RE.test(name) || (f.label?.fr ?? "") === "undefined";
  return isDuplicate || isAutoWidget || isJunk ? { ...f, hidden: true } : f;
}

// ---------------------------------------------------------------------------
// Étape 1 — élaguer ce que le schéma enrichi rend caduc.
// ---------------------------------------------------------------------------

/// Retire des champs déjà en base tout ce que `C1_QUESTIONS` remplace :
/// anciennes checkboxes couvertes par un radio, jumeaux inférés portant le même
/// widget sous un `id` différent, workarounds legacy, et champs cachés pointant
/// vers un widget absent du PDF importé. Ne garde que ce qui n'a pas d'équivalent
/// enrichi — ce résidu sera curé à l'étape 3.
function dropSupersededFields(
  fields: PdfFormField[],
  technicalSchema?: readonly AcroFieldRaw[]
): PdfFormField[] {
  const covered = coveredCheckboxNames();
  const coveredSingle = coveredSingleNames();
  const newIds = new Set(C1_QUESTIONS.map((q) => q.id));
  const technicalNames = technicalSchema
    ? new Set(technicalSchema.map((field) => field.pdfFieldName))
    : null;

  return fields.filter((f) => {
    if (LEGACY_C1_WORKAROUND_FIELD_IDS.has(f.id)) return false;
    // Retire les anciens checkboxes individuels désormais couverts par radio.
    if (covered.has(f.pdfFieldName)) return false;
    // Retire aussi les champs simples (non pipe-séparés) déjà couverts par un
    // champ enrichi de C1_QUESTIONS — protège contre les inférés qui portent
    // le même pdfFieldName mais un `id` slugifié différent du camelCase (cf.
    // `coveredSingleNames`).
    if (coveredSingle.has(f.pdfFieldName)) return false;
    // Retire aussi un éventuel ancien champ portant un id qu'on redéfinit.
    if (newIds.has(f.id)) return false;
    // Les champs cachés inférés d'un ancien PDF ne font pas partie du Runner.
    // Si leur widget a disparu du PDF courant, les conserver ne peut produire
    // qu'une erreur de publication sans aucun bénéfice pour l'utilisateur.
    if (
      f.hidden &&
      technicalNames &&
      f.pdfFieldName &&
      f.pdfFieldName
        .split("|")
        .map((name) => name.trim())
        .filter(Boolean)
        .some((name) => !technicalNames.has(name))
    ) {
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Étape 2 — le profil « changement de situation personnelle ».
// ---------------------------------------------------------------------------

/// Transforme le schéma nominal en variante restreinte aux 5 situations
/// (cf. `restrictMotifTo5Situations`) : relabelle et réordonne les 4 chips de
/// modification, masque ce qui sort du périmètre, raccourcit les libellés du
/// panneau bancaire, et ajoute le 5e chip virtuel `transfereOrganismePaiement`.
/// Pure : ne mute jamais le tableau reçu.
function applyRestrictedMotifProfile(questions: PdfFormField[]): PdfFormField[] {
  return questions
    .map((q) => {
      const override = RESTRICTED_MOTIF_OVERRIDES[q.id];
      if (override) {
        return {
          ...q,
          label: { ...q.label, fr: override.label },
          labelShort: override.labelShort
            ? { ...(q.labelShort ?? {}), fr: override.labelShort }
            : q.labelShort,
          order: override.order,
          requiredGroup: MOTIF_SITUATION_GROUP,
          // Retire l'ancien visibleIf sur motifIntroduction === "modification" :
          // motifIntroduction est autoAnswered, donc ABSENT du schéma Zod
          // scindé par étape (validateStepFields) — son isFieldVisible()
          // y voit toujours `undefined` et exclut ces 4 champs du groupe,
          // laissant SEULE transfereOrganismePaiement pouvoir satisfaire
          // "au moins une situation" → blocage bloquant à tort l'avancée
          // d'étape (bug remonté par Oraliks, 2026-07-07). Dans ce flux
          // restreint motifIntroduction vaut "modification" tout du long
          // (sauf override au submit), donc ce gate était de toute façon
          // toujours vrai : plus rien à conditionner.
          visibleIf: undefined,
          // Message custom sur l'ANCRE (1ʳᵉ des 5, order=5) uniquement —
          // les 4 autres membres du groupe n'ont pas besoin du leur, seul
          // le 1er visible reçoit l'erreur (cf. buildValidator).
          ...(q.id === "modificationAdresse"
            ? {
                errorMsg: {
                  fr: "Choisissez au moins une situation parmi les 5 ci-dessus.",
                },
              }
            : {}),
        };
      }
      if (q.id === "modificationCotisationSyndicale") return { ...q, hidden: true };
      if (q.id === "dateChangementOrganisme") {
        return {
          ...q,
          label: { ...q.label, fr: "Transférer mon dossier à partir du" },
          visibleIf: { fieldId: "transfereOrganismePaiement", op: "equals" as const, value: true },
        };
      }
      // Retirée du form runner pour ce type de dossier (Oraliks 2026-07-10 :
      // « c'est pas une option pour ce type de dossier autant le retirer »).
      // `hidden` = ni rendue à l'écran, ni stampée (les 2 cases oui/non
      // restent neutres sur le PDF).
      if (q.id === "chomeurTemporaireAlternance") return { ...q, hidden: true };
      // Libellés courts du panneau bancaire dédié au parcours de
      // changement de situation. Les valeurs métier et le mapping PDF ne
      // changent pas, seul le phrasé visible est rapproché de la maquette.
      if (q.id === "modePaiement") {
        return {
          ...q,
          label: { ...q.label, fr: "Réception des allocations" },
          options: q.options?.map((option) => ({
            ...option,
            label: {
              ...option.label,
              fr: option.value === "virement"
                ? "Virement bancaire"
                : "Chèque circulaire envoyé à mon adresse",
            },
          })),
        };
      }
      if (q.id === "titulaireCompte") {
        return {
          ...q,
          label: { ...q.label, fr: "Titulaire du compte" },
          options: q.options?.map((option) => ({
            ...option,
            label: {
              ...option.label,
              fr: option.value === "mon-nom"
                ? "À mon nom"
                : "Au nom d'une autre personne",
            },
          })),
        };
      }
      // Libellé/aide raccourcis pour l'étape Motif. La date de changement
      // (saisie ici) est stampée par BINDINGS (c1-changement.ts) sur la ligne
      // « à partir du » du/des motif(s) COCHÉ(s) uniquement. Oraliks a scindé
      // le champ unique `DateModification` (1 champ / 5 widgets) en 5 widgets
      // distincts le 2026-07-10 : « dates identiques sauf pour transfert ».
      // → DateAdresse / DatePersonnelleOuMenage / DateBanque reçoivent CETTE
      // date ; le transfert porte la sienne (dateChangementOrganisme →
      // DateDeTransfert). Le champ garde donc `pdfFieldName: ""` (pas de
      // stamp direct 1↔1, tout passe par les règles conditionnelles).
      if (q.id === "dateModificationEffective") {
        return {
          ...q,
          required: true,
          // Dans ce parcours, motifIntroduction est toujours répondu
          // automatiquement à "modification" puis retiré du schéma Zod
          // de l'étape. Garder ce visibleIf ferait donc considérer la date
          // comme invisible pendant validateStepFields et permettrait de
          // continuer malgré required=true.
          visibleIf: undefined,
          label: { ...q.label, fr: "Date de changement" },
          help: {
            ...q.help,
            fr: "Date de la demande de changement. Une seule date pour l'adresse, la situation personnelle/du ménage et le compte bancaire. Si vos changements n'ont pas tous la même date d'effet, faites une déclaration séparée pour chaque date différente. Ne concerne pas la cotisation syndicale ni le permis de séjour (pas de date sur le formulaire officiel).",
          },
        };
      }
      // « Je demande des allocations à partir du » ne s'applique PAS à un
      // dossier de changement de situation → on n'imprime pas sa date (elle
      // vaut aujourd'hui par défaut, prefill system.today). Reste validée/auto
      // en interne, juste non stampée (widget DateAllocation laissé vide).
      if (q.id === "dateDemande") return { ...q, pdfFieldName: "" };
      // Reste réel/requis/soumis (nécessaire au filler + à la validation),
      // mais n'est plus montré comme sélecteur : les 5 chips pilotent sa
      // valeur (defaultValue "modification", ou "changement-op" via
      // applyMotifTransferOverride au submit). Cf. doc de
      // `autoAnswered` dans types.ts.
      if (q.id === "motifIntroduction") return { ...q, autoAnswered: true };
      return q;
    })
    .concat(TRANSFERE_ORGANISME_FIELD);
}

// ---------------------------------------------------------------------------
// Étape 3 — assembler, grouper en macro-étapes, curer le résidu.
// ---------------------------------------------------------------------------

/// Fusionne le résidu préservé et les questions enrichies, pose `stepGroup` et
/// `noWeekend`, puis masque les widgets bruts non sectionnés qui sont des
/// doublons, des widgets auto ou du junk.
///
/// `hideRemainingRawWidgets` ferme le filet : dans le dossier restreint, tout ce
/// qui reste sans section est masqué pour supprimer l'accordéon « Autres
/// informations » de l'étape finale. C'est la règle la plus brutale du fichier —
/// un champ enrichi qui oublierait sa `section` disparaîtrait ici en silence.
function curateAndGroup(
  preserved: PdfFormField[],
  questions: PdfFormField[],
  hideRemainingRawWidgets: boolean
): PdfFormField[] {
  const coveredNames = collectCoveredPdfNames(questions);
  const curated = [...preserved, ...questions]
    .map(withStepGroup)
    .map(withNoWeekend)
    .map((f) => curatePreserved(f, coveredNames));

  // Dossier restreint (changement-situation-personnelle) : nos questions
  // enrichies couvrent tout ce qui est necessaire pour ce cas d'usage. Les
  // widgets bruts non sectionnes qui subsistent ("je demande des allocations
  // a partir du", "oui allez a la rubrique suivante", cases isolees "non_17"
  // / "non_18", flow markers C1A, etc.) sont des DOUBLONS ou des marqueurs
  // de flux qu'on a deja traites — Oraliks 2026-07-07 : « cette partie n'est
  // pas necessaire en soit puisqu'on y repond deja par le form runner ».
  // On les cache pour retirer l'accordeon « Autres informations » du step
  // final. Ils restent dans le payload et peuvent etre stampes au submit si
  // besoin (mais non-required, non-obligatoires).
  if (hideRemainingRawWidgets) {
    return curated.map((f) => (f.section || f.hidden ? f : { ...f, hidden: true }));
  }
  return curated;
}

// ---------------------------------------------------------------------------
// Orchestration.
// ---------------------------------------------------------------------------

/// Applique les améliorations du schéma C1 sur la liste de champs existante
/// (typiquement issue de l'inférence automatique au moment de l'import), en
/// trois temps : élaguer ce qui est remplacé, choisir le profil de motif,
/// assembler et curer.
///
/// Les champs non couverts par le schéma enrichi (identité, adresse, mode de
/// paiement, situation familiale…) traversent intacts.
///
/// Idempotent : ré-exécutable sans dupliquer (compare les `id`).
export function applyC1Improvements(
  fields: PdfFormField[],
  opts?: ApplyC1ImprovementsOptions
): PdfFormField[] {
  const preserved = dropSupersededFields(fields, opts?.technicalSchema);

  // Le motif d'entrée peut être imposé par le dossier appelant — sur une COPIE,
  // jamais en mutant le tableau partagé `C1_QUESTIONS`.
  const base = opts?.defaultMotif
    ? C1_QUESTIONS.map((q) =>
        q.id === "motifIntroduction" ? { ...q, defaultValue: opts.defaultMotif } : q
      )
    : C1_QUESTIONS;

  const restricted = opts?.restrictMotifTo5Situations === true;
  const questions = restricted ? applyRestrictedMotifProfile(base) : base;

  return curateAndGroup(preserved, questions, restricted);
}
