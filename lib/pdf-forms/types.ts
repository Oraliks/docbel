// Types du module PDF Forms (AcroForm only).

/// Locales officielles belges supportées. FR est toujours présent.
export type Locale = "fr" | "nl" | "de";
export const LOCALES: Locale[] = ["fr", "nl", "de"];
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(v: unknown): v is Locale {
  return v === "fr" || v === "nl" || v === "de";
}

/// Contenu localisé. La clé `fr` est la référence ; nl/de sont optionnelles.
export type Localized = Partial<Record<Locale, string>>;

/// Résout un texte localisé avec repli sur la locale par défaut puis FR.
export function loc(
  value: Localized | undefined,
  lang: Locale,
  fallback: Locale = DEFAULT_LOCALE
): string {
  if (!value) return "";
  return value[lang] ?? value[fallback] ?? value.fr ?? "";
}

// ---------------------------------------------------------------------------
// Niveau technique : extraction brute de l'AcroForm (ancre immuable).
// ---------------------------------------------------------------------------

export type AcroFieldType = "text" | "checkbox" | "dropdown" | "radio" | "unknown";

export interface AcroFieldRaw {
  /// Nom exact du champ dans le PDF (clé de remplissage — NE PAS modifier).
  pdfFieldName: string;
  acroType: AcroFieldType;
  /// Tooltip PDF (clé /TU) — souvent un libellé lisible exploitable.
  tooltip?: string;
  /// Longueur max imposée par le PDF (/MaxLen).
  maxLen?: number;
  /// Valeur par défaut du PDF (/DV).
  defaultValue?: string;
  /// Options pour dropdown/radio (/Opt ou valeurs d'export).
  options?: string[];
  readOnly?: boolean;
  required?: boolean;
  multiline?: boolean;
  /// Index de page (0-based) du premier widget rattaché au champ.
  page?: number;
  /// Rectangle du widget [x, y, w, h] en points PDF — utile au regroupement.
  rect?: [number, number, number, number];
}

// ---------------------------------------------------------------------------
// Niveau enrichi : ce que l'admin édite et ce que le front consomme.
// ---------------------------------------------------------------------------

/// Type sémantique d'un champ (validation/UX). Étend les types AcroForm bruts.
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "radio"
  | "fullname"
  | "signature"
  | "niss"
  | "iban"
  | "postal_be"
  | "tva_be"
  | "bce"
  | "phone_be"
  | "email"
  /// Tableau de lignes structurées (ex. grille des cohabitants du C1).
  /// Le champ porte `itemFields: PdfFormField[]` qui décrit le schéma de
  /// chaque ligne. Valeur dans le payload = `FieldValueRecord[]`.
  | "array";

export const SEMANTIC_FIELD_TYPES: FieldType[] = [
  "text", "textarea", "number", "date", "checkbox", "select", "radio",
  "fullname", "signature",
  "niss", "iban", "postal_be", "tva_be", "bce", "phone_be", "email",
  "array",
];

/// Libellés lisibles (FR) pour le sélecteur de type côté admin. Le public ne
/// voit jamais ces libellés (il voit le `label` du champ) — c'est uniquement
/// pour que l'admin reconnaisse chaque type sans connaître l'anglais.
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texte (court)",
  textarea: "Texte (long, multiligne)",
  number: "Nombre",
  date: "Date",
  checkbox: "Case à cocher",
  select: "Liste déroulante",
  radio: "Boutons radio",
  fullname: "Nom complet (Prénom + Nom)",
  signature: "Signature (dessinée à la main)",
  niss: "NISS (registre national)",
  iban: "IBAN (compte bancaire)",
  postal_be: "Code postal (Belgique)",
  tva_be: "Numéro de TVA",
  bce: "Numéro d'entreprise (BCE)",
  phone_be: "Téléphone (Belgique)",
  email: "Adresse e-mail",
  array: "Tableau (lignes répétables)",
};

/// Ordre d'assemblage d'un champ `fullname` (deux sous-champs côté front,
/// un seul champ texte côté PDF).
export type NameOrder = "first-last" | "last-first";

/// Source de pré-remplissage. `itsme.*` = claims OIDC itsme ;
/// `profile.*` = profil utilisateur connecté.
export type PrefillSource =
  | "system.today"
  | "itsme.firstName"
  | "itsme.lastName"
  | "itsme.niss"
  | "itsme.birthDate"
  | "itsme.gender"
  | "itsme.street"
  | "itsme.postalCode"
  | "itsme.city"
  | "profile.firstName"
  | "profile.lastName"
  | "profile.niss"
  | "profile.birthDate"
  | "profile.gender"
  | "profile.email"
  | "profile.phone"
  | "profile.iban"
  | "profile.street"
  | "profile.postalCode"
  | "profile.city";

export type ConditionOp = "equals" | "notEquals" | "in" | "notIn" | "matchesRegex";

export interface VisibleIf {
  fieldId: string;
  op: ConditionOp;
  /// Pour equals/notEquals : valeur scalaire ; pour in/notIn : tableau ;
  /// pour matchesRegex : source d'un RegExp ancré côté validation (le champ
  /// est visible si la valeur DÉPENDANTE, coercée en string, matche la regex ;
  /// utile pour détecter un préfixe pays sur un IBAN par ex.).
  value: string | number | boolean | Array<string | number>;
  /// Conditions SUPPLÉMENTAIRES combinées en ET logique avec la condition
  /// principale : le champ n'est visible que si la condition primaire ET
  /// chacune de celles-ci sont vraies. Sert aux cas multi-champs (ex. C1 :
  /// n'afficher le BIC que si l'IBAN est étranger ET le mode = virement).
  /// Chaque condition est évaluée contre le MÊME payload (cf. isFieldVisible).
  and?: VisibleIf[];
}

export interface FieldOption {
  value: string;
  label: Localized;
}

/// Dérivations de champ disponibles (registre pur dans field-derivations.ts,
/// sans dépendance lourde — safe à importer côté client). Union fermée :
/// chaque nouvelle dérivation (ex. futur code postal → commune) s'y ajoute.
export type FieldDerivation = "niss-birth-date" | "postal-be-country" | "nationalite-hors-eee";

/// Clé du vocabulaire canonique (cf. `lib/pdf-forms/canonical/vocabulary.ts`).
/// Type portable ici (`string`) pour éviter un import croisé : la validation
/// stricte se fait dans le module canonical via `isCanonicalKey`.
export type CanonicalKey = string;

export interface PdfFormField {
  /// Identifiant stable côté schéma enrichi (slug). Distinct de pdfFieldName.
  id: string;
  /// Ancre vers l'AcroForm. Vide si champ purement logique (rare).
  pdfFieldName: string;
  type: FieldType;
  required: boolean;

  // Contenu localisé
  label: Localized;
  /// Version courte du libellé pour l'affichage mobile (< 640px). Absent =
  /// utiliser `label` sur tous les breakpoints. Ne s'applique pas aux
  /// libellés d'options d'un radio (le rendu chip couvre déjà le compact).
  /// Cf. Phase 4 du plan bindings-canonical-ux.
  labelShort?: Localized;
  help?: Localized;
  /// Version courte de l'aide affichée sur mobile. Rarement utile (l'aide
  /// vit dans une InfoTooltip → même longueur affichée), mais gardé comme
  /// pendant symétrique pour permettre un texte tooltip plus terse.
  helpShort?: Localized;
  placeholder?: Localized;
  errorMsg?: Localized;
  options?: FieldOption[];

  // Validation
  presetKey?: string;
  /// Regex appliquée ANCRÉE (^...$) à la validation.
  regex?: string;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;

  // Comportement / UX
  defaultValue?: string | number | boolean;
  visibleIf?: VisibleIf;
  /// Comme `visibleIf`, mais évalué contre le payload du formulaire PARENT
  /// (utile pour un sous-champ d'`itemFields` qui doit se cacher selon un
  /// choix hors-ligne). Le parseur `visibleIf` classique se limite à la
  /// ligne courante pour les sous-champs d'`array` — cette variante donne
  /// accès au reste du formulaire.
  visibleIfParent?: VisibleIf;
  /// Effet de bord déclaratif : quand CE champ prend la valeur `whenValue`
  /// suite à une saisie utilisateur, le runner écrit aussi chaque couple de
  /// `set` dans le payload. Sert aux bascules métier — ex. C1 : cohabite +
  /// « c'est une colocation » ⇒ statutFamilial=isolé + habiteEnColocation=oui
  /// (une colocation est traitée comme isolé + Annexe REGIS côté ONEM).
  /// Appliqué UNIQUEMENT sur saisie utilisateur (jamais au restore de
  /// brouillon) ; les champs ciblés par `set` ne doivent pas eux-mêmes porter
  /// un `onSelectSet` visant ce champ (aucune garde anti-cycle au runtime).
  onSelectSet?: { whenValue: FieldValue; set: { fieldId: string; value: FieldValue }[] };
  prefillFrom?: PrefillSource;
  /// Pour les champs `fullname` : ordre d'assemblage des deux sous-champs.
  /// Défaut "first-last" (Prénom Nom).
  nameOrder?: NameOrder;
  /// Regroupement visuel ("identite", "adresse", "employeur"…).
  section?: string;
  order?: number;
  /// Habillage visuel spécifique (absent = rendu par défaut). "chip" = rendu
  /// en carte de choix cliquable (OptionCard) au lieu du widget standard —
  /// réservé aux champs où un choix visuel fait sens (ex. motif d'un C1).
  /// N'affecte ni la validation ni la valeur stockée.
  renderAs?: "chip";
  /// Champ plus large dans la grille du form runner : occupe 2 colonnes au lieu
  /// d'une (utile pour les valeurs longues, ex. nom de rue). Sans effet sur les
  /// types déjà pleine largeur (textarea, radio, array…).
  wide?: boolean;
  /// Regroupement PRÉSENTATIONNEL en tableau jour × créneau (ex. les deux
  /// grilles horaires du C1A, Q4/Q18, et la rangée de jours sans créneau du
  /// Q22) — aucun effet sur la validation, le stockage ni le tamponnage PDF,
  /// un simple repère de rendu pour le form runner. `row` réunit les champs
  /// d'une même LIGNE du tableau (ex. "lundi") ; les lignes s'affichent dans
  /// l'ordre de PREMIÈRE apparition parmi les champs (déjà celui du document,
  /// cf. PDF_FORMS_RULES). `col` distingue les COLONNES d'une même ligne (ex.
  /// "avant7h") — l'en-tête de colonne reprend le libellé du premier champ qui
  /// la porte, jamais un texte inventé. Absent = la case "jour" de la ligne,
  /// rendue dans sa cellule de tête avec le libellé DU CHAMP LUI-MÊME (ex.
  /// samedi/dimanche, qui n'ont pas de créneau — ou les sept jours du Q22, qui
  /// n'en ont aucun). Détection générique dans `FieldsCluster`
  /// (pdf-form-runner.tsx) : n'importe quel document peut composer un tableau
  /// en posant cette propriété sur ses champs, sans branche par slug.
  scheduleGrid?: { row: string; col?: string };
  /// Champ `date` : refuse une date tombant un samedi ou un dimanche. Pour les
  /// dates d'introduction / d'effet d'un dossier (pas de traitement le week-end —
  /// le citoyen doit se renseigner auprès de son OP). Le calendrier désactive
  /// aussi ces jours. Jamais posé sur une date de naissance.
  noWeekend?: boolean;
  /// Priorité d'affichage de la SECTION de ce champ (tous les champs d'une
  /// même section doivent porter la même valeur). Absent/"core" = toujours
  /// une étape séquentielle obligatoire (comportement actuel). "optional" =
  /// section repliée en fin de parcours, dépliée automatiquement si déjà
  /// répondue (cf. lib/pdf-forms/build-steps.ts).
  stepPriority?: "core" | "optional";
  /// Macro-étape à laquelle appartient ce champ (regroupe plusieurs sections
  /// en un nombre restreint d'étapes, ex. C1 → 5 étapes). Absent = pas de
  /// mode macro (le formulaire garde une étape par section). Piloté en amont
  /// (applyC1Improvements) ; consommé par buildMacroSteps. Prime sur
  /// stepPriority quand présent (mode macro = pas d'optional-collapse).
  stepGroup?: string;
  /// Champ dont la valeur est fixée automatiquement (defaultValue au montage
  /// du formulaire, et/ou dérivée juste avant soumission — cf.
  /// lib/pdf-forms/c1-motif-transfer.ts) : jamais rendu comme contrôle
  /// interactif dans les étapes (cf. `isAutoField`), mais reste sérialisé et
  /// soumis normalement — sa valeur traverse `buildValidator` INTACTE
  /// (préservée par `z.unknown()`), sans être soumise aux contrôles de format
  /// ni à l'exigence « obligatoire » : le champ n'étant pas à l'écran, une
  /// erreur posée dessus serait une impasse. DISTINCT de `hidden`, qui exclut
  /// aussi de la sérialisation publique et de la génération PDF. Utilisé pour
  /// `motifIntroduction` sur le C1 "changement de situation" : le motif
  /// reste réel et requis, mais l'utilisateur ne choisit plus parmi 4
  /// options — il choisit parmi les 5 chips concrets qui pilotent sa valeur.
  autoAnswered?: boolean;
  /// Champ dont la valeur est DÉJÀ DONNÉE par un autre document du dossier
  /// (identité et adresse d'un compagnon, reprises du C1 : « si elle change
  /// sur le C1 elle changera sur le C1A aussi »). Le champ devient
  /// `autoAnswered` — donc invisible — UNIQUEMENT quand le dossier fournit
  /// réellement une valeur non vide ; sinon il reste posé normalement à
  /// l'écran. La bascule est décidée à l'ouverture du formulaire, là où le
  /// pré-remplissage est calculé (cf. `dossier-inheritance.ts`), et jamais
  /// écrite en base : le schéma stocké garde le champ `required`, si bien
  /// qu'une soumission sans identité est REFUSÉE côté serveur au lieu de
  /// produire un document officiel anonyme.
  ///
  /// DISTINCT de `autoAnswered`, qui est inconditionnel : marquer directement
  /// l'identité `autoAnswered` en base la masquerait AUSSI hors dossier —
  /// or les compagnons ont chacun une URL publique (`/document/onem/c1a`) où
  /// aucun C1 n'a été rempli, et la case partirait blanche.
  inheritedFromDossier?: boolean;
  /// Champ dont la valeur se RECALCULE EN DIRECT à partir d'un autre champ du
  /// même formulaire (ex. date de naissance déduite du NISS). Contrairement à
  /// `autoAnswered`, le champ RESTE visible et normalement éditable — il ne se
  /// verrouille (lecture seule, valeur remplacée) que lorsque le champ source
  /// produit ACTUELLEMENT une valeur dérivée valide ; sinon l'utilisateur peut
  /// le remplir à la main (ex. NISS incomplet/absent). Consommé par
  /// `lib/pdf-forms/field-derivations.ts` (registre des fonctions de
  /// dérivation) et par le form-runner (calcul réactif + rendu verrouillé).
  derivedFrom?: { fieldId: string; via: FieldDerivation };
  /// Active l'autocomplete de rue belge (BeStAddress, ~144k rues, via
  /// `/api/lookup/search?tableSlug=code-rue`) sur un champ `text`.
  /// `postalFieldId` = id du champ code postal du MÊME formulaire : les
  /// suggestions dont le code postal correspond remontent en tête ; choisir
  /// une suggestion remplit aussi ce champ code postal en retour (cf.
  /// components/ui/street-autocomplete-input.tsx).
  streetAutocomplete?: { postalFieldId: string };
  /// Force la saisie à correspondre à une entrée de la liste d'autocomplétion
  /// (ex. rue BeStAddress FR/NL). La valeur n'est acceptée que si l'utilisateur
  /// l'a CHOISIE dans les suggestions (vérifiée côté runner) OU s'il coche la
  /// case d'échappement `escapeFieldId` (« ma rue n'est pas dans la liste »).
  /// Vérifié par le runner (pas par Zod : le contrôle « existe en base » est
  /// asynchrone) — cf. lib/pdf-forms/list-match.ts. Absent = texte libre.
  requireListMatch?: {
    escapeFieldId: string;
    message?: Localized;
    /// Si défini : le forçage de la liste ne s'applique QUE pour une adresse
    /// belge (valeur de ce champ vide ou « Belgique »). Pour un pays étranger,
    /// saisie libre autorisée (BeStAddress ne couvre que la Belgique). Ex.
    /// `{ escapeFieldId, countryFieldId: "pays" }`.
    countryFieldId?: string;
  };
  /// Active la recherche de pays (~195 pays du monde, cf.
  /// lib/pdf-forms/world-countries.ts) avec drapeau affiché sur un champ
  /// `text` — ex. taper "maro" propose "Maroc". La valeur stockée reste le
  /// NOM du pays (pas le code ISO), pour rester compatible avec
  /// `derivedFrom: postal-be-country` (qui renvoie "Belgique") et le
  /// stamping PDF existant. Cf. components/ui/country-select-input.tsx.
  countrySelect?: boolean;
  /// Active la résolution de commune depuis un champ code postal belge du
  /// MÊME formulaire (`postalFieldId`). Le composant interroge
  /// `/api/postal-lookup` : 1 commune → champ verrouillé auto-rempli ;
  /// plusieurs → menu déroulant des communes du code ; aucune (code
  /// étranger/inconnu) → texte libre. Cf. components/ui/commune-select-input.tsx.
  communeFrom?: { postalFieldId: string };
  /// Dessin POSITIONNEL sur le PDF (pdf-lib `drawText`) au lieu d'un widget
  /// AcroForm — pour les emplacements imprimés SANS champ remplissable (ex.
  /// la colonne « commune » du C1, présente à l'impression mais sans widget).
  /// Coordonnées en points, origine bas-gauche (repère pdf-lib). `maxWidth`
  /// (optionnel) fait réduire la police pour tenir dans l'espace. Appliqué
  /// APRÈS le mapping widgets, indépendamment de `pdfFieldName`.
  drawAt?: { page: number; x: number; y: number; size?: number; maxWidth?: number };
  /// Répartition d'un `textarea` sur PLUSIEURS lignes physiques du PDF, dans
  /// l'ORDRE déclaré — pour les zones où le papier offre N lignes pointillées
  /// distinctes (widgets numérotés, ou dessins positionnels) pour UNE seule
  /// question en texte libre (ex. les grilles horaires du C1A : « pendant les
  /// périodes suivantes… » ouvre 4 lignes, « irrégulièrement, à savoir » 5).
  /// Le filler reçoit une seule valeur (le contenu du textarea) et la replie
  /// par mots sur ces cibles, une ligne par cible ; un saut de ligne explicite
  /// tapé par le citoyen force le passage à la cible suivante ; s'il reste du
  /// texte au-delà de la dernière cible, elle absorbe le reste et sa police
  /// est réduite pour tenir (cf. `filler.ts`, jamais de perte silencieuse).
  /// Chaque entrée porte SOIT `pdfFieldName` (widget AcroForm existant), SOIT
  /// `drawAt` (ligne imprimée sans widget) — jamais les deux à la fois.
  ///
  /// Serveur uniquement : PAS exposé dans `PublicField` (le client n'a besoin
  /// que du `type: "textarea"` — la répartition sur les lignes physiques du
  /// PDF est un détail de génération, invisible à l'écran). Absent = champ
  /// non concerné (comportement actuel, inchangé).
  lineTargets?: Array<{ pdfFieldName?: string; drawAt?: PdfFormField["drawAt"] }>;
  /// Champ `iban` dont le compte n'est PAS forcément belge : utilise le
  /// validateur ISO 13616 générique (32 pays, cf. isValidInternationalIBAN)
  /// au lieu du validateur belge strict par défaut (BE + 14 chiffres).
  internationalIban?: boolean;
  /// Contrainte de groupe : « au moins un des champs partageant cette même
  /// clé (parmi les champs VISIBLES) doit être rempli/coché ». Aucun d'eux
  /// n'est individuellement `required` — utilisé quand la question porte sur
  /// un ENSEMBLE de choix plutôt qu'un champ unique (ex. les 5 chips
  /// "situation" du C1 : aucune n'est obligatoire seule, mais il en faut au
  /// moins une). L'erreur s'attache au premier champ visible du groupe.
  requiredGroup?: string;
  /// Clé du vocabulaire canonique (`lib/pdf-forms/canonical/vocabulary.ts`)
  /// que ce champ REPRÉSENTE dans son formulaire. Sert au pré-remplissage
  /// croisé quand un dossier enchaîne plusieurs PDFs (C1 → C1A → C47 → …) :
  /// la valeur est extraite d'un formulaire A pour être injectée dans les
  /// champs équivalents d'un formulaire B qui portent la MÊME clé.
  ///
  /// Absent = ce champ n'est pas partageable (spécifique à ce document).
  canonicalKey?: CanonicalKey;

  // Méta technique (non exposée au public)
  /// Note interne admin — JAMAIS exposée côté public.
  internalNote?: string;
  acroType?: AcroFieldType;
  readOnly?: boolean;
  /// Force la taille de police AUTO (`/DA` size 0 → le lecteur PDF réduit le
  /// texte pour tenir dans le widget) au lieu de `UNIFORM_TEXT_FONT_SIZE`
  /// (filler.ts). Réservé aux widgets dont le template source impose déjà une
  /// taille fixe trop grande pour leur rectangle (ex. NISS/Date de naissance
  /// du C1 : `/Helvetica 12 Tf` imprimé sur une case de ~11pt de haut,
  /// superposée à un guide en peigne imprimé — tout débordement y est très
  /// visible, contrairement aux champs texte libres sans grille imprimée).
  autoSizeFont?: boolean;
  /// Taille de police imposée pour CE champ, à la place de la taille uniforme
  /// du filler. Le texte est quand même réduit s'il ne tient pas dans la case.
  ///
  /// À réserver aux widgets superposés à un GUIDE IMPRIMÉ dont la taille n'est
  /// pas négociable — le peigne du NISS et de la date de naissance du C1
  /// (« __ __ __ __ __ __ / __ __ __ - __ __ ») est dessiné pour du 12 pt, et
  /// la saisie y paraît rabougrie à la taille uniforme de 10 pt. Partout
  /// ailleurs, laisser le filler décider : c'est ce qui garantit l'homogénéité
  /// demandée par Oraliks (« tous les champs remplis avec le même caractère »).
  fontSize?: number;
  /// Imprime la valeur en PEIGNE : separateurs retires, caracteres espaces.
  ///
  /// Pour les widgets poses sur un guide imprime en cases
  /// (« __ __ __ __ __ __ / __ __ __ - __ __ » du NISS sur le C1) : les
  /// points et tirets sont DEJA dessines sur le formulaire officiel, les
  /// reimprimer les doublait, et les chiffres colles ne tombaient sur
  /// aucune barre.
  /// Groupes du peigne et largeur des ecarts, en NOMBRE D'ESPACES.
  /// `{ groups: [6, 3, 2] }` = « 8 5 0 6 1 2  3 4 5  6 7 », calque sur
  /// « __ __ __ __ __ __ / __ __ __ - __ __ » : ecart simple entre chiffres
  /// d'un meme groupe, double la ou le formulaire imprime « / » et « - ».
  ///
  /// L'unite est l'espace de la police (3,81 pt a 12 pt) : c'est la seule
  /// disponible, DejaVuSans-Latin n'ayant ni espace fine ni espace chiffre.
  /// Le reglage est donc granuleux — pour un alignement au dixieme de
  /// millimetre il faudrait dessiner chaque caractere a une position
  /// calculee, ce que ce mecanisme ne fait pas.
  ///
  /// DEUX sources de geometrie possibles pour le mode POSITIONNEL
  /// (`slotWidth` renseigne) : un widget AcroForm (via `pdfFieldName`), ou —
  /// quand aucun widget ne peut porter la valeur (ex. n° BCE du C1A, Q2/Q16 :
  /// le seul widget imprime, "TVA", est PARTAGE entre deux pages, cf.
  /// PDF_FORMS_RULES.md) — les coordonnees `drawAt` du meme champ. `filler.ts`
  /// (`placerPeigne`) factorise le coeur du placement pour les deux ; seule
  /// l'origine (bx, by) et le defaut de `baselineY` different : coin bas-
  /// gauche du rectangle widget (+3 par defaut) contre `drawAt.x`/`drawAt.y`,
  /// deja la ligne de base exacte par convention (+0 par defaut).
  printAsComb?: {
    groups: number[];
    /// Mode ESPACES (par defaut) : ecarts exprimes en espaces de la police.
    gap?: number;
    groupGap?: number;
    /// Mode POSITIONNEL : renseigner `slotWidth` l'active. Chaque caractere
    /// est alors dessine a une abscisse calculee, hors du champ — donc sans
    /// etre borne par son rectangle, contrairement au texte d'un widget. Le
    /// guide imprime du C1 se poursuit au-dela de la case : c'est la seule
    /// facon d'atteindre ses dernieres barres.
    /// Pas entre deux barres, en points PDF.
    slotWidth?: number;
    /// Abscisse du 1er caractere. Depuis le bord GAUCHE du widget si le champ
    /// a un `pdfFieldName` reel ; depuis `drawAt.x` sinon (0 = le 1er
    /// caractere part exactement de `drawAt.x`, cf. `placerPeigne`).
    startX?: number;
    /// Ligne de base. Depuis le bord BAS du widget si le champ a un
    /// `pdfFieldName` reel ; depuis `drawAt.y` sinon (0 = la ligne de base
    /// est exactement `drawAt.y`, cf. `placerPeigne`).
    baselineY?: number;
    /// Avance supplementaire a chaque rupture de groupe (« / » et « - »).
    groupExtra?: number;
  };
  /// Table de correspondance valeur interne → texte imprimé sur le PDF, pour un
  /// champ `select` mappé sur un widget TEXTE (pas un dropdown). Ex. le `lien`
  /// de parenté du C1 : `pere` → « Père », `enfant` → « Enfant », mais `FAC`/
  /// `NFAC` (absents de la table) restent stampés tels quels (codes officiels).
  /// Une valeur absente de la table est imprimée brute.
  stampMap?: Record<string, string>;
  /// Champ MASQUÉ du formulaire citoyen : jamais rendu (filtré au sérialiseur
  /// public) ni auto-injecté (date/signature) à la génération → reste BLANC
  /// dans le PDF. Pour les formulaires complétés en partie par un tiers (ex.
  /// C109/36-DIPLÔME, complété par l'école). Distinct de `readOnly` (grisé).
  hidden?: boolean;

  // ---- Champ `array` (lignes répétables) ----
  /// Schéma des champs d'une ligne. Seulement utilisé quand `type === "array"`.
  /// Les sous-champs ne supportent pas eux-mêmes le type "array" (1 seul niveau).
  itemFields?: PdfFormField[];
  /// Libellé affiché sur le bouton « + Ajouter ».
  addRowLabel?: Localized;
  /// Nombre minimum / maximum de lignes acceptées. Défaut : 0 / illimité.
  minRows?: number;
  maxRows?: number;
  /// Stamping positionnel d'un sous-champ de `array` : template du nom de
  /// widget AcroForm avec le placeholder `{index}` substitué par l'index de
  /// ligne 1-based. Exemple : `"{index} 1"` → `"1 1"` pour la 1ʳᵉ ligne,
  /// `"2 1"` pour la 2ᵉ, etc. Seuls les sous-champs qui portent ce template
  /// sont stampés ; les autres restent virtuels (capturés dans le payload
  /// mais sans cible PDF). Concrètement utilisé pour la grille des
  /// cohabitants du C1, qui expose 5 slots positionnels.
  pdfFieldNameTemplate?: string;
  /// Stamping « first-match » sur un champ `array` : la PREMIÈRE ligne qui
  /// satisfait `where` voit ses sous-champs déversés sur des widgets PDF
  /// uniques (typiquement les widgets « partenaire » du C1 qui n'existent
  /// qu'une fois sur le PDF mais dérivent de la ligne FAC du tableau).
  /// `fields` : map subFieldId → pdfFieldName.
  firstMatchMapping?: ArrayFirstMatchMapping;
}

/// Cf. `PdfFormField.firstMatchMapping`. La ligne qui satisfait `where` est
/// stampée sur les widgets désignés. Les checkboxes en pipe-séparateur
/// (`"oui_widget|non_widget"`) sont supportées pour les sous-champs `radio`.
export interface ArrayFirstMatchMapping {
  where: { fieldId: string; value: string | number | boolean };
  fields: Record<string, string>;
}

/// Valeur d'un champ `fullname` : deux sous-parties éditées côté front,
/// fusionnées en une seule chaîne au remplissage du PDF.
export interface FullNameValue {
  first?: string;
  last?: string;
}

/// Valeur d'une ligne d'un champ `array` — sous-payload.
export type FieldValueRecord = Record<string, FieldValueScalar>;
type FieldValueScalar = string | number | boolean | null | FullNameValue;
export type FieldValue = FieldValueScalar | FieldValueRecord[];
export type FormPayload = Record<string, FieldValue>;

/// Garde de type pour distinguer une valeur composite `fullname`.
export function isFullNameValue(v: unknown): v is FullNameValue {
  return typeof v === "object" && v !== null && !Array.isArray(v) && ("first" in v || "last" in v);
}

/// Garde de type pour distinguer une valeur composite `array`.
export function isFieldValueRecordArray(v: unknown): v is FieldValueRecord[] {
  return Array.isArray(v) && v.every((row) => typeof row === "object" && row !== null && !Array.isArray(row));
}

export interface ParsedPdf {
  fields: AcroFieldRaw[];
  pageCount: number;
  /// true si le PDF a au moins un champ AcroForm.
  hasAcroForm: boolean;
}

/// Déclencheur de sous-formulaire — porté par un PdfForm. Quand le payload
/// satisfait la règle, le PdfForm cible (identifié par `requiresFormSlug`) est
/// ajouté au parcours utilisateur dynamiquement.
///
/// Exemple (C1) :
/// ```
/// {
///   whenFieldId: "tremplinIndependants", whenValue: "oui",
///   unlessFieldId: "tremplinIndependantsDejaDeclare", unlessValue: "oui",
///   requiresFormSlug: "c1c",
///   reason: { fr: "Tremplin-indépendants à déclarer" }
/// }
/// ```
export interface PdfFormTrigger {
  /// Identifiant stable du champ déclencheur côté schéma enrichi.
  whenFieldId: string;
  /// Valeur attendue pour déclencher (comparaison stricte ===).
  whenValue: string | number | boolean;
  /// Champ d'exclusion : si défini ET égal à `unlessValue`, le trigger ne
  /// se déclenche pas. Typiquement le follow-up "déjà déclaré ?".
  unlessFieldId?: string;
  unlessValue?: string | number | boolean;
  /// Slug du PdfForm à ajouter au parcours (référence par slug, pas par id,
  /// pour rester stable à travers les ré-imports).
  requiresFormSlug: string;
  /// Explication pédagogique affichée à l'utilisateur (« Tu dois aussi… »).
  reason?: Localized;
}
