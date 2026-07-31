import {
  PDFDocument,
  PDFFont,
  PDFForm,
  PDFPage,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import {
  PdfFormField,
  FieldOption,
  FieldValue,
  FieldValueRecord,
  FormPayload,
  AcroFieldRaw,
  isFieldValueRecordArray,
} from "./types";
import { assembleFullName } from "./system-values";
import {
  resolveSignerName,
  signerNameFromSignatureField,
  buildSignatureBlock,
  signatureTimestamp,
} from "./signature";
import { isSignatureField } from "./auto-fields";
import { isFieldVisible } from "./validation";
import { formatDateFR } from "./bindings/format";
import type { CombWidgetSpec } from "./bindings/comb-widgets";

/// Police TTF Unicode embarquée pour réécrire les apparences des champs texte.
///
/// SANS elle, pdf-lib retombe sur Helvetica/WinAnsi, qui ne sait pas encoder
/// les caractères hors Latin-1 : `doc.save()` LÈVE, et la génération renvoie
/// une 500 pour tout nom polonais, turc, tchèque ou roumain (Łukasz, Gökhan,
/// Ștefan…). Le chemin pointait jusqu'au 2026-07-26 sur un fichier
/// `NotoSans-Regular.ttf` jamais déposé dans le dépôt : le repli silencieux
/// était donc TOUJOURS actif, et le bug latent pour tout citoyen concerné.
///
/// `DejaVuSans-Latin.ttf` est versionné et couvre le latin étendu (vérifié
/// glyphe par glyphe : Ł, ğ, ș, ž, é, ç, €).
const UNICODE_FONT_PATH = join(process.cwd(), "public", "fonts", "DejaVuSans-Latin.ttf");

/// Police de REPLI, utilisée uniquement pour les textes que la principale ne
/// sait pas dessiner : grec, cyrillique, vietnamien.
///
/// Elle ne remplace pas `DejaVuSans-Latin.ttf` — elle le complète. Basculer
/// tous les documents sur Noto changerait la typographie de chaque PDF déjà
/// généré, alors que le seul problème à régler était les cases BLANCHES. Un
/// dossier belge courant continue donc de sortir exactement comme avant.
///
/// Noto Sans 2.008, SIL Open Font License 1.1 (licence jointe :
/// `public/fonts/OFL-NotoSans.txt`). Vérifié : sa couverture est un SUR-ensemble
/// stricte de celle de la principale sur U+0020–U+2FFF, donc le repli ne peut
/// jamais échouer là où la principale réussissait.
///
/// Ne couvre PAS l'arabe, l'hébreu ni le chinois — ces écritures demandent des
/// fichiers Noto séparés, et les deux premières un rendu bidirectionnel que
/// pdf-lib ne sait pas faire. Elles restent détectées et journalisées.
const FALLBACK_FONT_PATH = join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");

async function loadFontFile(path: string): Promise<Buffer | null> {
  try {
    if (existsSync(path)) return await readFile(path);
  } catch {
    /* ignore */
  }
  return null;
}

async function loadUnicodeFont(): Promise<Buffer | null> {
  return loadFontFile(UNICODE_FONT_PATH);
}

/// Police cursive (OFL Dancing Script) pour la signature manuscrite « façon
/// Adobe ». Embarquée dans le repo (fonctionne côté serveur Linux, contrairement
/// aux polices système). Absente → repli sur l'oblique standard.
const SIGNATURE_FONT_PATH = join(process.cwd(), "public", "fonts", "SignatureScript.ttf");

async function loadSignatureFont(): Promise<Buffer | null> {
  try {
    if (existsSync(SIGNATURE_FONT_PATH)) return await readFile(SIGNATURE_FONT_PATH);
  } catch {
    /* ignore */
  }
  return null;
}

/// Vrai = case à cocher COCHÉE. Gère le booléen ET les valeurs texte des
/// radios oui/non (une allocation familiale « non » ne doit PAS cocher la
/// case — Oraliks 2026-07-10). Falsy : false, 0, "", "false", "0", "non", "no".
function isTruthy(v: unknown): boolean {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s !== "" && s !== "false" && s !== "0" && s !== "non" && s !== "no";
  }
  return !!v;
}

/// `\n`/`\r` ne sont JAMAIS des glyphes dessinés : un widget multiligne les
/// interprète comme un passage à la ligne (rendu natif pdf-lib), et
/// `lineTargets` (plus bas) les consomme comme séparateurs avant tout dessin
/// — la valeur qui atteint réellement `setText`/`drawText` n'en contient
/// jamais. Les compter comme « caractère manquant » de la police (sonde de
/// couverture ci-dessous) produirait un faux diagnostic
/// `caracteres-non-rendus` sur toute valeur multi-lignes légitime, alors que
/// rien n'est réellement perdu à l'écriture.
function estRetourLigne(c: string): boolean {
  return c === "\n" || c === "\r";
}

/// Récupère un widget checkbox par son nom. Renvoie null si introuvable ou
/// si le widget existe mais n'est pas une PDFCheckBox (le caller décide quoi
/// faire — souvent ignorer silencieusement).
function safeCheckbox(form: ReturnType<PDFDocument["getForm"]>, name: string): PDFCheckBox | null {
  try {
    const f = form.getField(name);
    return f instanceof PDFCheckBox ? f : null;
  } catch {
    return null;
  }
}

/// Ce que la génération n'a PAS réussi à écrire.
///
/// Le remplissage est volontairement « best-effort » : un widget manquant ne
/// doit jamais priver le citoyen de son document. Mais l'échec était jusqu'ici
/// AVALÉ — `getField` qui lève, `catch {}` vide — et une case restait blanche
/// sur un formulaire officiel sans que personne, ni serveur ni admin ni usager,
/// ne puisse le savoir. Les échecs sont désormais collectés et remontés.
export interface FillDiagnostic {
  /// Champ du schéma concerné. Vide pour un stamp de règle serveur, qui cible
  /// un widget sans passer par un champ.
  fieldId: string;
  widget: string;
  kind: "widget-introuvable" | "stamp-refuse" | "caracteres-non-rendus";
  detail?: string;
}

export interface FillResult {
  bytes: Buffer;
  /// true si la police Unicode a été embarquée.
  unicodeFont: boolean;
  /// Vide = tout ce que le schéma prétendait écrire a été écrit.
  diagnostics: FillDiagnostic[];
}

/// Convention pipe-séparée : `pdfFieldName` = "w1|w2|…|wN" pour un champ
/// `radio` à N options, où chaque widget est une checkbox indépendante. La
/// fonction coche le widget correspondant à la valeur sélectionnée et décoche
/// les autres. Renvoie `true` si la convention a été appliquée (handled),
/// `false` sinon (le caller doit retomber sur le stamping scalaire standard).
function stampPipeRadio(
  form: PDFForm,
  pdfFieldName: string,
  type: PdfFormField["type"],
  options: FieldOption[] | undefined,
  value: FieldValue
): boolean {
  if (!pdfFieldName.includes("|") || type !== "radio" || !options) return false;
  // Pas de `filter(Boolean)` : on garde les positions exactes. Une entrée
  // vide signifie « cette option n'a pas de case PDF dédiée ».
  const names = pdfFieldName.split("|").map((s) => s.trim());
  if (names.length !== options.length) return false;
  const strValue = String(value);
  for (let i = 0; i < names.length; i++) {
    if (!names[i]) continue; // option sans widget — rien à faire
    const box = safeCheckbox(form, names[i]);
    if (!box) continue;
    try {
      if (options[i].value === strValue) box.check();
      else box.uncheck();
    } catch {
      /* readonly / incompatible */
    }
  }
  return true;
}

/// Hauteur de boîte que pdf-lib réserve au texte d'un champ, en fraction de la
/// taille de police. MESURÉE, pas déduite d'une spec : un PDF a été généré puis
/// relu (pdfplumber) sur deux cases de hauteurs différentes du C1C, et la
/// position obtenue résout `(hauteur − k × taille) / 2` avec k ≈ 0,73 dans les
/// deux cas (case 12,24 → décalage 2,52 ; case 10,20 → 1,40).
const FRACTION_BOITE_TEXTE = 0.73;

/// Abaissement d'une case pour que sa ligne de base tombe sur le BAS du
/// rectangle — c'est-à-dire, dans ces formulaires, sur le guide imprimé
/// (cf. `alignTextToGuide`). Dépend de la hauteur de la case : un abaissement
/// forfaitaire descendait trop bas les cases courtes (la ligne « à une autre
/// adresse », haute de 10,2 pt, tombait 1,8 pt SOUS son trait).
function abaissementSurGuide(hauteur: number, taille: number): number {
  return Math.max(0, (hauteur - FRACTION_BOITE_TEXTE * taille) / 2);
}

/// Noms des widgets à abaisser pour un champ donné (cf. `alignTextToGuide`).
function widgetsAAbaisser(field: PdfFormField): string[] {
  const consigne = field.alignTextToGuide;
  if (!consigne) return [];
  if (Array.isArray(consigne)) return consigne.filter(Boolean);
  return [
    ...(field.pdfFieldName ?? "").split("|").map((s) => s.trim()).filter(Boolean),
    ...(field.lineTargets ?? []).map((c) => c.pdfFieldName ?? "").filter(Boolean),
  ];
}

/// Descend le rectangle des widgets marqués `alignTextToGuide`. Silencieuse :
/// un widget introuvable ou non-texte est simplement ignoré — c'est un réglage
/// de présentation, jamais une raison de faire échouer une déclaration.
function poserTexteSurGuide(form: PDFForm, fields: readonly PdfFormField[]): void {
  /// Taille retenue par widget : celle du champ qui le revendique, à défaut la
  /// taille uniforme. Une Map (et non un Set) pour ne pas abaisser deux fois un
  /// widget cité par deux champs.
  const tailleParWidget = new Map<string, number>();
  for (const field of fields) {
    if (field.hidden) continue;
    for (const nom of widgetsAAbaisser(field)) {
      tailleParWidget.set(nom, field.fontSize ?? UNIFORM_TEXT_FONT_SIZE);
    }
  }
  for (const [nom, taille] of tailleParWidget) {
    try {
      const champ = form.getField(nom);
      if (!(champ instanceof PDFTextField)) continue;
      for (const widget of champ.acroField.getWidgets()) {
        const r = widget.getRectangle();
        widget.setRectangle({ ...r, y: r.y - abaissementSurGuide(r.height, taille) });
      }
    } catch {
      /* widget absent du template : rien à abaisser */
    }
  }
}

/// Taille de police uniforme appliquée à TOUS les widgets texte du PDF
/// généré (Oraliks 2026-07-07 : « j'aimerais que tous les champs remplis
/// aient le même caractère de taille comme ça je change ou adapte c'est pour
/// tous »). Sans ça, chaque widget hérite de sa font-size par défaut définie
/// dans le template PDF — variable d'un widget à l'autre (ex. « Place
/// Dailly » en 12pt vs « test » en 9pt sur le C1). Une seule constante ici
/// = un seul point d'ajustement pour toute la famille.
const UNIFORM_TEXT_FONT_SIZE = 10;

/// Plancher de réduction. En dessous, le texte devient illisible — mieux vaut
/// alors laisser déborder (et le voir) que produire une ligne microscopique.
const MIN_TEXT_FONT_SIZE = 5;

/// Marge intérieure d'un widget AcroForm, de chaque côté. Les lecteurs PDF
/// insèrent ~2 pt ; sans la retirer, un texte calculé « juste à la limite »
/// est quand même rogné à l'affichage.
const TEXT_WIDGET_PADDING = 2;

/// Taille de police qui fait TENIR `text` dans la boîte du widget.
///
/// Sans ça, un texte plus large que sa case n'est PAS réduit : pdf-lib pose une
/// clôture de découpe et le coupe en plein glyphe, sans avertissement. Ce
/// n'était pas un cas limite — à 10 pt, TOUTE date `DD/MM/YYYY` (58 pt) déborde
/// des colonnes « date de naissance » de la grille cohabitants (51 pt), et
/// « Époux/se » (46 pt) déborde de la colonne « lien de parenté » (39 pt). Le
/// lien le plus fréquent, sur la déclaration la plus courante.
///
/// Ne s'applique pas aux widgets multilignes (le texte y est replié, pas
/// tronqué : réduire la police n'aurait aucun sens) ni aux champs marqués
/// `autoSizeFont`, qui délèguent l'ajustement au lecteur PDF.
function fitFontSize(
  font: PDFFont,
  text: string,
  field: PDFTextField | PDFDropdown,
  /// Taille souhaitee avant reduction. Par defaut la taille uniforme ; un champ
  /// peut imposer la sienne via `PdfFormField.fontSize` (cf. le peigne imprime
  /// du NISS, dessine pour du 12 pt).
  preferred: number = UNIFORM_TEXT_FONT_SIZE
): number {
  if (!text) return preferred;
  let usable = Infinity;
  try {
    if (field instanceof PDFTextField && field.isMultiline()) return preferred;
    // Un champ peut porter plusieurs widgets (même valeur répétée sur
    // plusieurs pages) : on vise le plus étroit, pour tenir partout.
    for (const w of field.acroField.getWidgets()) {
      const width = w.getRectangle().width;
      if (width > 0) usable = Math.min(usable, width - 2 * TEXT_WIDGET_PADDING);
    }
  } catch {
    return preferred;
  }
  if (!Number.isFinite(usable) || usable <= 0) return preferred;
  let size = preferred;
  while (size > MIN_TEXT_FONT_SIZE && font.widthOfTextAtSize(text, size) > usable) {
    size -= 0.5;
  }
  return size;
}

/// Le texte déborde-t-il encore de la case, à la taille retenue ? Vrai quand
/// `fitFontSize` a touché son plancher sans réussir à le faire tenir : pdf-lib
/// coupe alors le texte à la limite du rectangle, en plein glyphe.
function depasse(
  font: PDFFont,
  text: string,
  field: PDFTextField | PDFDropdown,
  taille: number
): boolean {
  if (!text) return false;
  try {
    if (field instanceof PDFTextField && field.isMultiline()) return false;
    let usable = Infinity;
    for (const w of field.acroField.getWidgets()) {
      const width = w.getRectangle().width;
      if (width > 0) usable = Math.min(usable, width - 2 * TEXT_WIDGET_PADDING);
    }
    if (!Number.isFinite(usable) || usable <= 0) return false;
    return font.widthOfTextAtSize(text, taille) > usable;
  } catch {
    return false;
  }
}

/// Pose la taille de police d'un widget — en RÉPARANT au passage les widgets
/// dépourvus de `/DA` propre.
///
/// `pdf-lib` refuse `setFontSize` sur un champ sans `/DA` (« No /DA (default
/// appearance) entry found »), alors même que l'AcroForm en porte un GLOBAL
/// (`/Helv 0 Tf 0 g` sur les quinze PDF de `private/pdfs/`) dont la spec dit
/// qu'il s'hérite. L'échec était avalé : la taille uniforme n'était pas
/// appliquée, et `updateAppearances` retombait sur l'auto-dimensionnement de
/// pdf-lib. Résultat mesuré sur le C46 : « Commission du travail des arts »
/// imprimé en **5 pt** entre deux voisins en 10 pt.
///
/// Quatre widgets de la famille sont dans ce cas, un par document : `métier`
/// (C1-Partenaire), `lorganismes suivants` (C46), la ligne « compétences
/// professionnelles » (C1C) et « Décrivez ci-après la raison de la
/// limitation » (C1). Tous les quatre s'imprimaient à une taille arbitraire,
/// contre la règle « même caractère partout » (Oraliks 2026-07-07).
///
/// La réparation recopie le `/DA` global, dont la police (`/Helv`) est bien
/// présente dans le `/DR` de tous ces documents.
function appliquerTaillePolice(field: PDFTextField | PDFDropdown, taille: number): void {
  try {
    field.setFontSize(taille);
    return;
  } catch {
    // Seul cas connu : pas de `/DA` propre. On en pose un, puis on réessaie.
  }
  try {
    field.acroField.setDefaultAppearance(`/Helv ${taille} Tf 0 g`);
  } catch {
    /* champ verrouillé ou structure inattendue — la taille du gabarit reste */
  }
}

/// Réplique le texte d'un `textarea` unique sur une séquence ORDONNÉE de
/// lignes physiques (`PdfFormField.lineTargets`), chacune avec sa largeur
/// utile en points, à la taille de police PRÉVUE (`mesurer` la calcule — pas
/// encore réduite : la réduction reste au dessin, cf. `fitFontSize`).
///
/// Repli par mots : une ligne accumule des mots tant qu'ils tiennent dans la
/// largeur de sa cible ; un saut de ligne explicite (`\n`, saisi par le
/// citoyen) clôt la ligne courante MÊME s'il restait de la place — la mise en
/// forme volontaire du citoyen prime sur le remplissage optimal.
///
/// Le tableau renvoyé a TOUJOURS `largeurs.length` entrées, une par cible :
/// `""` pour une cible inutilisée (reste vide sur le PDF, comme aujourd'hui).
/// S'il reste des mots une fois la DERNIÈRE cible atteinte, ils sont fondus
/// dans sa ligne (séparés d'un espace, `\n` compris — il ne peut plus se voir
/// au-delà de la dernière ligne physique) plutôt que perdus : c'est à
/// l'appelant de réduire la police de cette ligne pour la faire tenir (même
/// logique que `fitFontSize` / le repli déjà en place sur `drawAt`).
function distribuerLignes(
  valeur: string,
  largeurs: number[],
  mesurer: (texte: string) => number
): string[] {
  const nombreCibles = largeurs.length;
  if (nombreCibles <= 0) return [];
  // Au-delà de la dernière cible connue, on continue de replier à SA largeur
  // (faute de mieux) : les lignes en surplus sont de toute façon fondues en
  // une seule ci-dessous, le point de coupure exact entre elles ne change pas
  // le résultat final.
  const largeurPour = (index: number) => largeurs[Math.min(index, nombreCibles - 1)];

  const lignes: string[] = [];
  let ligne = "";
  const clore = () => {
    lignes.push(ligne);
    ligne = "";
  };

  valeur
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((paragraphe, i) => {
      if (i > 0) clore(); // le \n précédent force une nouvelle cible
      for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
        const essai = ligne ? `${ligne} ${mot}` : mot;
        if (ligne && mesurer(essai) > largeurPour(lignes.length)) {
          clore();
          ligne = mot;
        } else {
          ligne = essai;
        }
        // Mot SEUL plus large que sa ligne : il n'y a pas d'espace où couper,
        // et le laisser entier revenait à tout écraser sur une seule ligne —
        // `fitFontSize` réduisait alors la police jusqu'à l'illisible pendant
        // que les lignes suivantes du papier restaient vides (retour Oraliks,
        // 2026-07-30 : une saisie d'un seul long mot tenait sur la 1re ligne
        // en minuscule). On coupe donc au CARACTÈRE, en dernier recours.
        //
        // Garde-fou de COÛT : une ligne qui contient un espace a été bâtie mot
        // à mot, chacun ajouté seulement s'il tenait — elle ne peut donc pas
        // déborder, et il est inutile de la mesurer. Sans ce test, le repli
        // mesurait la ligne entière à chaque mot, et l'appelant refait tout le
        // repli pour chaque taille de police candidate : les deux tests
        // `filler-*` sur vrais PDF partaient en timeout.
        if (ligne.includes(" ")) continue;
        while (ligne.length > 1 && mesurer(ligne) > largeurPour(lignes.length)) {
          // Dichotomie sur le plus long préfixe qui tient — la descente
          // caractère par caractère coûtait une mesure par caractère, et
          // `widthOfTextAtSize` parcourt tout le texte à chaque appel.
          const largeur = largeurPour(lignes.length);
          let bas = 1;
          let haut = ligne.length - 1;
          let coupe = 1;
          while (bas <= haut) {
            const milieu = (bas + haut) >> 1;
            if (mesurer(ligne.slice(0, milieu)) <= largeur) {
              coupe = milieu;
              bas = milieu + 1;
            } else {
              haut = milieu - 1;
            }
          }
          const reste = ligne.slice(coupe);
          ligne = ligne.slice(0, coupe);
          clore();
          ligne = reste;
        }
      }
    });
  clore();

  if (lignes.length <= nombreCibles) {
    const resultat = lignes.slice();
    while (resultat.length < nombreCibles) resultat.push("");
    return resultat;
  }

  // Débordement : la DERNIÈRE cible absorbe tout le reste, mots rejoints par
  // un espace — jamais de ligne supplémentaire perdue en silence.
  const resultat = lignes.slice(0, nombreCibles - 1);
  resultat.push(lignes.slice(nombreCibles - 1).filter(Boolean).join(" "));
  return resultat;
}

/// Choix de police TEXTE PAR TEXTE.
///
/// pdf-lib n'a pas de chaîne de repli : une police par apparence, et un glyphe
/// absent ne lève pas — il s'écrit en vide. On choisit donc explicitement, pour
/// chaque valeur, la police capable de la dessiner.
interface FontKit {
  /// Principale si elle suffit, repli sinon. Ne renvoie jamais rien : quand
  /// aucune des deux ne convient, elle rend la principale et le diagnostic
  /// `caracteres-non-rendus` a déjà été émis au moment du pré-contrôle.
  pick(text: string): { font: PDFFont; fallback: boolean };
  /// Champs habillés avec le repli. Le passage global d'apparences en fin de
  /// génération les réécrirait avec la principale — donc en blanc, ce qui est
  /// exactement le bug qu'on corrige. On les ré-habille après lui.
  reapply: Array<{ field: PDFTextField | PDFDropdown; font: PDFFont }>;
}

/// Séparateur décimal belge : la virgule.
///
/// `String(2450.75)` produit « 2450.75 » — un point, convention anglo-saxonne,
/// qui n'a rien à faire sur un formulaire officiel belge. L'aide du champ écrit
/// d'ailleurs elle-même « 999999,99 € ».
///
/// Volontairement minimal : PAS de séparateur de milliers (ni le formulaire
/// ONEM ni l'aide n'en mettent, et un point de milliers serait lu comme un
/// décimal par un lecteur francophone), et PAS de complétion des décimales — un
/// citoyen qui déclare « 1610 » doit voir « 1610 », pas « 1610,00 ».
///
/// Ne transforme QUE ce qui est un nombre décimal simple : tout le reste passe
/// intact, pour qu'une valeur inattendue ne soit jamais réécrite à l'aveugle.
function decimalesFR(raw: string): string {
  const t = raw.trim();
  return /^-?\d+\.\d+$/.test(t) ? t.replace(".", ",") : raw;
}

/// Montant d'argent : separateur de milliers ET au moins deux decimales.
///
/// « 12345 » devient « 12 345,00 » (demande Oraliks 2026-07-30, sur relecture
/// d'un C1A genere : un revenu annuel a cinq chiffres colles est illisible sur
/// la ligne du formulaire).
///
/// Ne s'applique QU'AUX champs marques `numberFormat: "money"` : les autres
/// nombres du document comptent des choses, pas des euros — « Je joins 3
/// annexe(s) » ne doit pas devenir « Je joins 3,00 annexe(s) ».
///
/// Les decimales existantes sont CONSERVEES au-dela de deux : le C1A demande
/// jusqu'a 4 chiffres apres la virgule pour un revenu horaire (« par heure »,
/// Q19). On complete a deux, on ne tronque jamais.
///
/// Espace insecable fine EXCLUE au profit de l'espace ordinaire : la police
/// embarquee ne garantit pas le glyphe, et un caractere non rendu vaudrait un
/// montant tronque sur une declaration officielle.
function montantFR(raw: string): string {
  const t = raw.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return raw;
  const negatif = t.startsWith("-");
  const [entier, decimales = ""] = t.replace("-", "").split(".");
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = decimales.length >= 2 ? decimales : decimales.padEnd(2, "0");
  return `${negatif ? "-" : ""}${groupes},${frac}`;
}

/// Repartit les caracteres sur le guide imprime : separateurs retires,
/// ecart simple a l'interieur d'un groupe, ecart double entre les groupes —
/// la ou le formulaire dessine « / » et « - ». Les caracteres au-dela des
/// groupes declares suivent l'ecart simple, pour ne jamais perdre de saisie.
function texteEnPeigne(
  raw: string,
  opt: NonNullable<PdfFormField["printAsComb"]>
): string {
  const chars = raw.replace(/[^0-9A-Za-z]/g, "").split("");
  const ecart = " ".repeat(Math.max(1, opt.gap ?? 1));
  const ecartGroupe = " ".repeat(Math.max(1, opt.groupGap ?? 2));
  const groupes: string[] = [];
  let i = 0;
  for (const taille of opt.groups) {
    if (i >= chars.length) break;
    groupes.push(chars.slice(i, i + taille).join(ecart));
    i += taille;
  }
  if (i < chars.length) groupes.push(chars.slice(i).join(ecart));
  return groupes.join(ecartGroupe);
}

/// Coeur du placement en peigne POSITIONNEL : avance de gauche a droite
/// depuis un point de depart (bx, by), un caractere par case, en ajoutant
/// `groupExtra` aux ruptures de groupe declarees.
///
/// Independant de la SOURCE de geometrie : appele avec le rectangle d'un
/// widget AcroForm (cf. `dessinerPeigne` plus bas -- guide partage entre
/// plusieurs cases imprimees, ex. TVA/Montant/voir 19/1_3 du C1A) ou avec les
/// coordonnees `drawAt` d'un champ purement positionnel, sans widget du tout
/// (cf. les n° BCE du C1A, Q2/Q16 : le guide en dix cases 4-3-3 existe bien
/// sur le papier, mais aucun widget dedie ne le porte -- le seul champ
/// AcroForm present, "TVA", partage sa valeur entre les deux pages et est
/// donc inutilisable, cf. PDF_FORMS_RULES.md).
///
/// `baselineParDefaut` absorbe la difference entre les deux sources : le
/// rectangle d'un widget donne le coin BAS-GAUCHE de sa case, d'ou +3 par
/// defaut pour remonter a la ligne de base (cf. `dessinerPeigne`) ; des
/// coordonnees `drawAt`, elles, SONT deja par convention la ligne de base
/// exacte (comme partout ailleurs dans ce fichier), d'ou +0 dans ce cas.
function placerPeigne(
  page: PDFPage,
  bx: number,
  by: number,
  baselineParDefaut: number,
  valeur: string,
  comb: NonNullable<PdfFormField["printAsComb"]>,
  taillePolice: number,
  policeCaractere: PDFFont,
  fieldId: string,
  widgetName: string,
  diags: FillDiagnostic[]
): void {
  // Garde redondante avec celle des 3 appelants (widget introuvable / champ
  // sans `slotWidth`) : ils verifient dans LEUR propre scope, ce qui ne
  // narrowait pas `comb.slotWidth` ici une fois passe en parametre. Rend
  // aussi la fonction sure par elle-meme si un futur appelant l'oublie.
  if (!comb.slotWidth) return;
  const caracteres = valeur.replace(/[^0-9A-Za-z]/g, "").split("");

  const ruptures = new Set<number>();
  let cumul = 0;
  for (const taille of comb.groups) {
    cumul += taille;
    ruptures.add(cumul);
  }

  let x = bx + (comb.startX ?? 0);
  const y = by + (comb.baselineY ?? baselineParDefaut);
  for (let i = 0; i < caracteres.length; i++) {
    if (ruptures.has(i)) x += comb.groupExtra ?? 0;
    try {
      page.drawText(caracteres[i], { x, y, size: taillePolice, font: policeCaractere, color: rgb(0, 0, 0) });
    } catch (err) {
      diags.push({
        fieldId,
        widget: widgetName,
        kind: "stamp-refuse",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    x += comb.slotWidth;
  }
}

/// Stampe une valeur scalaire sur un widget AcroForm résolu, en dispatchant
/// sur son type (texte / checkbox / dropdown / radio group). Centralise la
/// logique pour la réutiliser depuis le stamping de lignes d'`array`.
function stampScalarWidget(
  pdfField: unknown,
  value: FieldValue,
  fonts: FontKit,
  unicodeFont: boolean,
  fieldType?: string,
  autoSizeFont?: boolean,
  options?: FieldOption[],
  stampMap?: Record<string, string>,
  fontSize?: number,
  printAsComb?: PdfFormField["printAsComb"],
  numberFormat?: PdfFormField["numberFormat"]
): void {
  if (pdfField instanceof PDFTextField) {
    // `stampMap` : correspondance valeur interne → libellé imprimé (ex. lien de
    // parenté `pere` → « Père »). Une valeur absente de la table est stampée
    // brute (ex. codes officiels `FAC`/`NFAC`). Court-circuite date/iban.
    const mapped = stampMap ? stampMap[String(value)] : undefined;
    // Un booléen sur un widget TEXTE s'imprime « X », jamais le mot « true ».
    // Le C1C en est la preuve : `affirmationSincereEtComplete` est déclaré
    // `checkbox` dans le seed, mais le widget visé est un champ texte dans le
    // PDF réel (vérifié) — chaque C1C généré portait donc le mot « true » au
    // milieu de la phrase d'affirmation sur l'honneur. Le garde est ici, et
    // pas seulement dans le seed, pour qu'aucune erreur de type future ne
    // puisse réimprimer un littéral de programmation sur un document officiel.
    const raw = typeof value === "boolean" ? (value ? "X" : "") : String(value);
    // Reformatage des dates ISO → FR au stamping : le form runner stocke en
    // ISO côté state (format standard <input type="date">), l'usager veut
    // du DD/MM/YYYY sur le PDF final.
    let text = mapped !== undefined ? mapped : raw;
    if (stampMap === undefined && fieldType === "date") text = formatDateFR(raw);
    // IBAN belge : le template C1 imprime « B E » statiquement en amont du
    // numéro (widget « B E » du dump AcroForm). Sans strip, on verrait
    // « B E BE68 5390... » doublement préfixé. Le strip est PDF-only —
    // la valeur en state garde « BE68... » complet pour la validation Zod
    // (Oraliks 2026-07-07). Sur le widget « SEPA étranger IBAN BIC » le
    // préfixe est étranger (FR, DE, …) → pas de strip.
    if (stampMap === undefined && fieldType === "iban") text = raw.replace(/^\s*[Bb][Ee]\s*/, "").trim();
    if (stampMap === undefined && fieldType === "number")
      text = numberFormat === "money" ? montantFR(raw) : decimalesFR(raw);
    // Peigne : le guide imprime porte deja ses separateurs, et les chiffres
    // colles ne tombaient sur aucune barre.
    // Mode positionnel : le dessin se fait plus bas, hors du widget. On vide
    // le champ pour ne pas imprimer la valeur deux fois.
    if (printAsComb?.slotWidth) text = "";
    else if (printAsComb) text = texteEnPeigne(text, printAsComb);
    pdfField.setText(text);
    // Le choix se fait sur le texte FINAL (date reformatee, libelle du
    // stampMap, IBAN deshabille de son « BE »), pas sur la valeur brute.
    const { font, fallback } = fonts.pick(text);
    if (fallback) fonts.reapply.push({ field: pdfField, font });
    // Taille uniforme partout (cf. UNIFORM_TEXT_FONT_SIZE), réduite si le
    // texte ne tient pas dans la case (cf. fitFontSize), sauf `autoSizeFont`
    // (0 = auto-fit lecteur PDF, cf. PdfFormField.autoSizeFont).
    appliquerTaillePolice(pdfField, autoSizeFont ? 0 : fitFontSize(font, text, pdfField, fontSize));
    if (unicodeFont) pdfField.updateAppearances(font);
  } else if (pdfField instanceof PDFCheckBox) {
    if (isTruthy(value)) pdfField.check();
    else pdfField.uncheck();
  } else if (pdfField instanceof PDFDropdown) {
    // Affiche le LIBELLÉ humain, pas le code interne : un select « Employé »
    // (value "salarie-employe") doit apparaître « Employé » sur le PDF, pas
    // « salarie-employe » (Oraliks 2026-07-10). On résout via `options` ; à
    // défaut on garde la valeur brute.
    // `stampMap` a la priorité, comme sur un widget texte : il existe justement
    // pour imprimer autre chose que le libellé de l'écran. Sans cette ligne, il
    // était ignoré dès que le widget était une liste déroulante — un piège
    // silencieux, puisque poser un stampMap semblait alors sans effet.
    const opt = options?.find((o) => o.value === String(value));
    const court = stampMap?.[String(value)];
    const s =
      court !== undefined
        ? court
        : opt
          ? opt.label.fr || opt.label.nl || opt.label.de || String(value)
          : String(value);
    if (s !== "" && s !== "false") {
      // Certains dropdowns du template n'ont PAS d'options prédéfinies (ex.
      // grille cohabitants du C1 remaniée par Oraliks : « Personne1_Allocations
      // Familiales »… créés vides). `select` exige la valeur dans les options →
      // on l'ajoute d'abord si nécessaire, puis on sélectionne. No-op sur
      // valeur vide (dropdown laissé neutre).
      try {
        if (!pdfField.getOptions().includes(s)) pdfField.addOptions([s]);
        pdfField.select(s);
        const { font, fallback } = fonts.pick(s);
        if (fallback) fonts.reapply.push({ field: pdfField, font });
        // Meme ajustement que les champs texte. Les listes deroulantes en
        // avaient encore plus besoin : elles gardaient la taille du gabarit
        // (12 pt sur la grille cohabitants), et « Employe » demandait 52 pt
        // dans une colonne qui en offre 43.
        try {
          pdfField.setFontSize(fitFontSize(font, s, pdfField));
        } catch {
          /* certains widgets rejettent setFontSize */
        }
        if (unicodeFont) pdfField.updateAppearances(font);
      } catch {
        /* dropdown readonly / incompatible — on ignore */
      }
    }
  } else if (pdfField instanceof PDFRadioGroup) {
    const s = String(value);
    if (pdfField.getOptions().includes(s)) pdfField.select(s);
  }
}

/// Stamping d'un champ `array` : deux mécanismes complémentaires.
///   1. PAR LIGNE : pour chaque sous-champ porteur de `pdfFieldNameTemplate`,
///      on substitue `{index}` (1-based) et on stampe la valeur du
///      sous-champ. Sub-fields sans template = ignorés silencieusement.
///   2. FIRST-MATCH : si `firstMatchMapping` est défini, on cherche la PREMIÈRE
///      ligne qui satisfait `where` et on déverse ses sous-champs sur les
///      widgets uniques listés dans `fields`. Convention :
///        - un nom de widget standard → stamping scalaire
///        - un nom pipe-séparé "w1|w2" sur un sous-champ `radio` → convention
///          ONEM (paire oui/non ou N options).
/// Un sous-champ de grille suit les MÊMES règles de visibilité qu'à l'écran
/// (cf. `array-field.tsx`) : `visibleIfParent` s'évalue contre le payload du
/// formulaire, `visibleIf` contre la LIGNE courante — pas contre le payload.
///
/// La boucle principale du filler applique cette règle depuis le bug « grille
/// cohabitants stampée en mode isolé », mais `stampArrayField` ne l'avait
/// jamais reçue. Conséquence : un cohabitant passé de « Employé / 1500 » à
/// « Aucun » repartait sur le PDF avec un montant de 1500 € en face d'une
/// activité déclarée inexistante — une déclaration officielle qui se
/// contredit elle-même. Aggravant, les lignes ne traversent aucun contrôle
/// Zod (`z.array(z.any())`), donc rien d'autre ne rattrapait ça.
function isSubFieldVisible(
  sub: PdfFormField,
  row: FieldValueRecord,
  payload: FormPayload
): boolean {
  if (sub.visibleIfParent && !isFieldVisible(sub.visibleIfParent, payload)) return false;
  if (sub.visibleIf && !isFieldVisible(sub.visibleIf, row as FormPayload)) return false;
  return true;
}

function stampArrayField(
  form: PDFForm,
  fonts: FontKit,
  unicodeFont: boolean,
  field: PdfFormField,
  rows: FieldValueRecord[],
  payload: FormPayload,
  diags: FillDiagnostic[]
): void {
  const subFields = field.itemFields ?? [];
  if (subFields.length === 0) return;
  // Tronque silencieusement au maxRows annoncé pour ne jamais stamper hors grille.
  const cap = typeof field.maxRows === "number" ? Math.max(0, field.maxRows) : rows.length;
  const effectiveRows = rows.slice(0, cap);

  // (1) Stamping par ligne sur les widgets positionnels.
  for (let i = 0; i < effectiveRows.length; i++) {
    const row = effectiveRows[i];
    const oneBased = String(i + 1);
    for (const sub of subFields) {
      if (!sub.pdfFieldNameTemplate) continue;
      if (!isSubFieldVisible(sub, row, payload)) continue;
      const subValue = row[sub.id];
      if (subValue === null || subValue === undefined) continue;
      const widgetName = sub.pdfFieldNameTemplate.replace(/\{index\}/g, oneBased);
      // Sous-champ radio + pipe → convention multi-options.
      if (
        stampPipeRadio(form, widgetName, sub.type, sub.options, subValue as FieldValue)
      ) {
        continue;
      }
      let pdfField;
      try {
        pdfField = form.getField(widgetName);
      } catch {
        diags.push({ fieldId: `${field.id}[${oneBased}].${sub.id}`, widget: widgetName, kind: "widget-introuvable" });
        continue;
      }
      try {
        stampScalarWidget(pdfField, subValue as FieldValue, fonts, unicodeFont, sub.type, sub.autoSizeFont, sub.options, sub.stampMap, sub.fontSize, sub.printAsComb, sub.numberFormat);
      } catch {
        /* readonly / incompatible */
      }
    }
  }

  // (2) Stamping first-match sur les widgets uniques (ex. bloc « partenaire »).
  const fm = field.firstMatchMapping;
  if (!fm) return;
  const match = effectiveRows.find((row) => row[fm.where.fieldId] === fm.where.value);
  if (!match) return;
  for (const [subId, widgetName] of Object.entries(fm.fields)) {
    if (!widgetName) continue;
    const sub = subFields.find((s) => s.id === subId);
    if (!sub) continue;
    if (!isSubFieldVisible(sub, match, payload)) continue;
    const subValue = match[subId];
    if (subValue === null || subValue === undefined) continue;
    if (
      stampPipeRadio(form, widgetName, sub.type, sub.options, subValue as FieldValue)
    ) {
      continue;
    }
    let pdfField;
    try {
      pdfField = form.getField(widgetName);
    } catch {
      diags.push({ fieldId: `${field.id}.${sub.id}`, widget: widgetName, kind: "widget-introuvable" });
      continue;
    }
    try {
      stampScalarWidget(pdfField, subValue as FieldValue, fonts, unicodeFont, sub.type, sub.autoSizeFont, sub.options, sub.stampMap, sub.fontSize, sub.printAsComb, sub.numberFormat);
    } catch {
      /* readonly / incompatible */
    }
  }
}

/// Calage d'un stamp POSITIONNEL adressé par une règle serveur
/// (`lib/pdf-forms/bindings/per-form/*`) via une clé SENTINELLE dans
/// `extraStamps`, plutôt que par un widget AcroForm réel.
///
/// Nécessaire quand AUCUN widget exploitable n'existe pour l'emplacement
/// imprimé — typiquement un widget PARTAGÉ entre plusieurs cases (ex. "1_3"
/// du C1A : une case de Q18 ET les deux cases de rappel d'identité de
/// l'en-tête page 2, cf. PDF_FORMS_RULES.md « un champ AcroForm peut porter
/// PLUSIEURS widgets »). Stamper ce widget imprimerait la même valeur à TOUS
/// ses emplacements — inutilisable dès que deux emplacements attendent des
/// valeurs différentes.
///
/// `StampEntry.widget` (bindings/types.ts) reste un simple `string` — on
/// n'étend PAS ce type pour un unique format de cible : une règle qui vise
/// une clé présente ici dessine hors widget (cf. `dessinerStampPositionnel`
/// plus bas) ; une règle qui vise un vrai nom AcroForm continue de passer par
/// `form.getField` comme avant (comportement par défaut inchangé).
interface PositionalStampSpec {
  page: number;
  x: number;
  y: number;
  size?: number;
  maxWidth?: number;
  printAsComb?: NonNullable<PdfFormField["printAsComb"]>;
}

/// Cibles connues, par clé sentinelle (convention `"<slug>:<id>"`).
///
/// Coordonnées MESURÉES sur `private/pdfs/C1A_FR.pdf` (pdfplumber, seuil
/// strict sur les pixels — cf. rapport
/// `.superpowers/sdd/signature-entete-p2-report.md`), jamais approchées à
/// l'œil : ce sont des déclarations officielles. `y` calé sur le bord HAUT du
/// guide imprimé mesuré (tick NISS : 800.06–800.48 ; pointillé Nom :
/// 799.1–800.0),+ arrondi à l'entier le plus proche — même relation que
/// celle vérifiée sur les n° BCE déjà en place (`drawAt.y` = guide arrondi).
const POSITIONAL_EXTRA_STAMPS: Record<string, PositionalStampSpec> = {
  // En-tête page 2 « Suite C1A | NISS … | Nom … » : rappel de l'identité déjà
  // saisie en page 1 (champs `nomEtPrenom`/`niss`), rien n'est redemandé au
  // citoyen. Cf. bindings/per-form/c1a.ts, règles "header-p2-nom"/"-niss".
  "c1a:header-p2-nom": { page: 1, x: 295, y: 801, size: 9, maxWidth: 260 },
  "c1a:header-p2-niss": {
    page: 1,
    x: 110.28,
    y: 801,
    size: 9,
    maxWidth: 156,
    // Guide en peigne (11 traits SymbolMT, groupés 9+2 — mesuré, pas le
    // découpage 6-3-2 habituel du NISS) : même pas que les n° BCE du même
    // document (slotWidth/groupExtra identiques, même police/taille).
    printAsComb: { groups: [9, 2], slotWidth: 13.02, groupExtra: 6.06 },
  },

  // C47 — les TROIS cases « votre demande ». Aucune n'est cochée par son champ
  // AcroForm : celui de « jeune travailleur » porte deux widgets (la case de
  // son propre cadre ET la case « art. 114 » de l'autre cadre), donc cocher
  // l'un cochait les deux. Les trois croix sont dessinées ici, à la même
  // taille et de la même façon, pour qu'elles se ressemblent sur le papier.
  // Cf. `bindings/per-form/c47.ts` et le commentaire de `cadreDemande`.
  //
  // Coordonnées = rectangle du widget ❑ mesuré (pypdf), recentré pour un « X »
  // Helvetica 8 pt (largeur 5,34, hauteur de capitale 5,74, dans une case de
  // 6,7 × 6,7).
  "c47:case-art114": { page: 0, x: 228.18, y: 395.08, size: 8 },
  "c47:case-jeune-travailleur": { page: 0, x: 210.58, y: 275.38, size: 8 },
  "c47:case-chomeur-indemnise": { page: 0, x: 210.78, y: 238.48, size: 8 },
};

/// Remplit un PDF AcroForm à partir du schéma enrichi et d'un payload validé.
/// - Mappe chaque champ via `pdfFieldName` (ancre).
/// - Embarque une police Unicode si disponible (fontkit requis).
/// - Aplatit le formulaire par défaut (PDF non ré-éditable).
/// - Pour les champs `signature` : embarque l'image PNG (data URL) à l'endroit
///   du widget AcroForm correspondant. Nécessite `technicalSchema` pour
///   retrouver le rectangle + la page du widget.
export async function fillForm(
  source: Buffer,
  fields: PdfFormField[],
  payload: FormPayload,
  opts: {
    flatten?: boolean;
    technicalSchema?: AcroFieldRaw[];
    /// Stamps additionnels produits par le moteur de bindings serveur
    /// (`lib/pdf-forms/bindings/`) — appliqués APRÈS la boucle sur `fields`,
    /// donc gagnent en cas de collision avec le mapping schéma. Convention
    /// `dernier gagnant par widget` (une seule valeur par entrée de Map).
    /// Une entrée boolean cible une PDFCheckBox, string un PDFTextField.
    extraStamps?: Map<string, string | boolean>;
    /// Calage du peigne imprime, par nom de widget. Pour les widgets ecrits
    /// par une REGLE serveur et non par un champ (cf. bindings/comb-widgets).
    combWidgets?: Record<string, CombWidgetSpec>;
  } = {}
): Promise<FillResult> {
  const flatten = opts.flatten !== false;
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  const form = doc.getForm();

  const diags: FillDiagnostic[] = [];

  // Police : Unicode embarquée si dispo, sinon Helvetica standard.
  let unicodeFont = false;
  let font;
  /// Caractères de `text` que la police embarquée ne sait PAS dessiner.
  let missingGlyphs: (text: string) => string = () => "";
  const ttf = await loadUnicodeFont();
  if (ttf) {
    try {
      const fontkit = (await import("@pdf-lib/fontkit")).default;
      doc.registerFontkit(fontkit);
      font = await doc.embedFont(ttf, { subset: true });
      unicodeFont = true;
      // Sonde de couverture. Indispensable : quand un caractère manque,
      // fontkit ne lève PAS — il le mappe sur le glyphe 0, dont le contour est
      // vide dans cette police. Le texte est donc écrit en « rien », et après
      // aplatissement l'apparence devient le seul contenu du champ : la case
      // part BLANCHE à l'ONEM, sans exception ni avertissement, avec
      // `unicodeFont === true` pour signaler que tout va bien.
      // `DejaVuSans-Latin.ttf` couvre le latin étendu (Łukasz, Gökhan,
      // Ștefan…) mais NI le cyrillique, NI le grec, NI l'arabe, NI le chinois,
      // ni même le vietnamien « ễ ».
      const probe = fontkit.create(ttf);
      missingGlyphs = (text: string) =>
        [...text]
          .filter((c) => !estRetourLigne(c) && !probe.hasGlyphForCodePoint(c.codePointAt(0) ?? 0))
          .join("");
    } catch {
      font = await doc.embedFont(StandardFonts.Helvetica);
    }
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica);
  }

  // Contrôle de rendabilité sur le payload entier, en amont du tamponnage :
  // toute valeur imprimable en vient, donc une seule passe suffit à décider
  // quelle police il faudra, et à repérer ce que le document ne pourra pas
  // montrer. Les lignes de grille sont incluses — un cohabitant a un nom, lui
  // aussi, et il peut être grec ou bulgare tout autant que le titulaire.
  const textes: Array<[string, string]> = [];
  for (const [id, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      if (value) textes.push([id, value]);
    } else if (isFieldValueRecordArray(value)) {
      value.forEach((row, i) => {
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === "string" && v) textes.push([`${id}[${i + 1}].${k}`, v]);
        }
      });
    }
  }

  // Police de repli : chargée seulement si un texte en a besoin. `embedFont`
  // ajoute la police au document même inutilisée — on ne la paie donc que
  // quand elle sert vraiment.
  const fallbackTtf = unicodeFont ? await loadFontFile(FALLBACK_FONT_PATH) : null;
  let missingFallback: (text: string) => string = (t) => t;
  if (fallbackTtf) {
    try {
      const probe = (await import("@pdf-lib/fontkit")).default.create(fallbackTtf);
      missingFallback = (text: string) =>
        [...text]
          .filter((c) => !estRetourLigne(c) && !probe.hasGlyphForCodePoint(c.codePointAt(0) ?? 0))
          .join("");
    } catch {
      /* repli illisible : on garde le comportement sans repli */
    }
  }

  const aBesoinDuRepli = new Set<string>();
  for (const [id, texte] of textes) {
    if (!missingGlyphs(texte)) continue;
    const restant = missingFallback(texte);
    if (!restant) {
      aBesoinDuRepli.add(texte);
      continue;
    }
    // Ni l'une ni l'autre : arabe, hébreu, chinois. La case sortira blanche —
    // au moins la trace existe.
    diags.push({ fieldId: id, widget: "", kind: "caracteres-non-rendus", detail: restant });
  }

  let fallbackFont: PDFFont | null = null;
  if (fallbackTtf && aBesoinDuRepli.size > 0) {
    try {
      fallbackFont = await doc.embedFont(fallbackTtf, { subset: true });
    } catch {
      /* embarquement impossible : on retombe sur la principale, cases blanches */
    }
  }

  const fonts: FontKit = {
    pick: (text: string) =>
      fallbackFont && aBesoinDuRepli.has(text)
        ? { font: fallbackFont, fallback: true }
        : { font, fallback: false },
    reapply: [],
  };

  // Police oblique (repli) pour la ligne "nom" du bloc de signature.
  const obliqueFont = await doc.embedFont(StandardFonts.HelveticaOblique);
  // Police cursive Dancing Script pour la signature manuscrite « façon Adobe ».
  // Repli sur l'oblique si absente / non embarquable.
  let cursiveFont = obliqueFont;
  const sigTtf = await loadSignatureFont();
  if (sigTtf) {
    try {
      const fk = (await import("@pdf-lib/fontkit")).default;
      doc.registerFontkit(fk);
      cursiveFont = await doc.embedFont(sigTtf, { subset: true });
    } catch {
      cursiveFont = obliqueFont;
    }
  }

  // Pré-passe `alignTextToGuide` : ABAISSE le rectangle des widgets concernés
  // AVANT tout tamponnage, pour que le texte tombe sur la ligne pointillée
  // imprimée au lieu de flotter au-dessus (cf. `PdfFormField.alignTextToGuide`).
  // Doit précéder les DEUX écritures — la boucle des champs ci-dessous et les
  // `extraStamps` des règles serveur — d'où sa position ici : elle déplace la
  // case, pas la valeur, et ne se soucie donc pas de qui l'écrira.
  poserTexteSurGuide(form, fields);

  for (const field of fields) {
    // Champ marqué `hidden` par le schéma : jamais rendu à l'utilisateur ET
    // jamais stampé sur le PDF — leur valeur (souvent `false` par défaut sur
    // un checkbox inféré) écraserait l'apparence du template alors que
    // l'utilisateur n'a JAMAIS eu la possibilité de la modifier. Oraliks
    // 2026-07-07 : la checkbox « je demande des allocations à partir du »
    // apparaissait cochée sur le PDF généré alors qu'elle n'existait plus
    // dans le form runner (hidden en mode restrictMotifTo5Situations).
    if (field.hidden) continue;
    // Champ NON visible selon `visibleIf` sur le payload courant : ne pas
    // stamper (Oraliks 2026-07-07 : la grille cohabitants était stampée avec
    // la date de naissance de l'identité en 5 rangées, alors que l'usager
    // avait choisi « isolé ». Cause : brouillon avec cohabitants populé avant
    // le switch vers isolé — les rows persistaient dans le state même après
    // que le champ soit devenu invisible). Un champ auto-answered (ex.
    // motifIntroduction) n'a pas de visibleIf → non affecté.
    if (field.visibleIf && !isFieldVisible(field.visibleIf, payload)) continue;

    // Branche dédiée aux champs `array` : stamping positionnel par ligne
    // (template `pdfFieldNameTemplate` sur chaque sous-champ) + stamping
    // « first-match » sur des widgets uniques (cf. firstMatchMapping). Ces
    // deux mécanismes sont indépendants — un schéma peut n'en utiliser qu'un.
    if (field.type === "array") {
      const rows = payload[field.id];
      if (!isFieldValueRecordArray(rows)) continue;
      stampArrayField(form, fonts, unicodeFont, field, rows, payload, diags);
      continue;
    }

    if (!field.pdfFieldName) continue;
    const raw = payload[field.id];
    if (raw === null || raw === undefined) continue;
    // Champ composite : deux sous-champs front → une seule chaîne dans le PDF.
    const value = field.type === "fullname" ? assembleFullName(raw, field.nameOrder) : raw;

    // Radio dont la valeur sélectionne UNE case parmi N : la convention
    // `pdfFieldName` est un pipe-séparateur listant les noms des widgets
    // dans le même ordre que `options`. Le widget correspondant à l'option
    // sélectionnée est coché, les autres décochés. Cas typique sur les
    // formulaires ONEM : chaque modalité a sa propre case (pas un
    // PDFRadioGroup). La paire oui/non est juste le sous-cas N=2.
    if (
      stampPipeRadio(form, field.pdfFieldName, field.type, field.options, value)
    ) {
      continue;
    }

    let pdfField;
    try {
      pdfField = form.getField(field.pdfFieldName);
    } catch {
      // Cas typique : l'ONEM republie le formulaire en renommant un widget.
      // Le schema pointe alors dans le vide et la case sort blanche.
      diags.push({ fieldId: field.id, widget: field.pdfFieldName, kind: "widget-introuvable" });
      continue;
    }

    try {
      // Signature numérique "façon Adobe" : si le champ est confirmé (valeur
      // non vide), on dessine un bloc texte (nom + mention + horodatage) à la
      // position du widget AcroForm. Le nom est résolu depuis le payload.
      if (isSignatureField(field)) {
        const confirmed = typeof value === "string" && value.trim() !== "";
        if (!confirmed) continue;
        const tech = (opts.technicalSchema ?? []).find((t) => t.pdfFieldName === field.pdfFieldName);
        if (!tech?.rect) continue;
        if (pdfField instanceof PDFTextField) pdfField.setText("");

        // Repli : certains schémas font TAPER son nom au citoyen dans le champ
        // de signature lui-même. La sentinelle de confirmation, elle, n'est pas
        // un nom (cf. `signerNameFromSignatureField`).
        const signerName = resolveSignerName(fields, payload) || signerNameFromSignatureField(value);
        if (!signerName) continue;
        const block = buildSignatureBlock(signerName);

        const pageIdx = Math.max(0, Math.min(doc.getPageCount() - 1, tech.page ?? 0));
        const page = doc.getPage(pageIdx);
        const [bx, by, bw, bh] = tech.rect;
        const pad = 4;

        // Nom en cursive Dancing Script, auto-ajusté à la largeur ET à la
        // hauteur utile du widget (au-dessus de la ligne d'horodatage). Sans
        // cadre : la signature se pose sur la ligne « Signature » imprimée.
        const smallSize = Math.max(4.5, Math.min(6.5, bh / 5.5));
        const targetW = Math.max(10, bw - 2 * pad);
        const nameAreaH = Math.max(8, bh - smallSize - 2.5 * pad);
        // La signature porte le nom du citoyen : elle a le même problème de
        // couverture que les champs texte. Dancing Script est une police
        // d'affichage, plus étroite encore que la principale — si celle-ci ne
        // sait déjà pas dessiner le nom, la cursive ne le saura pas non plus.
        // On bascule alors sur la police choisie pour ce texte, quitte à perdre
        // le rendu manuscrit : une signature lisible vaut mieux qu'une absente.
        const nameFont = missingGlyphs(block.name) ? fonts.pick(block.name).font : cursiveFont;
        const widthAt1 = Math.max(0.01, nameFont.widthOfTextAtSize(block.name, 1));
        const heightAt1 = Math.max(0.5, nameFont.heightAtSize(1));
        let nameSize = Math.min(targetW / widthAt1, nameAreaH / heightAt1);
        nameSize = Math.max(9, Math.min(28, nameSize));
        const nameW = nameFont.widthOfTextAtSize(block.name, nameSize);
        const nameX = bx + pad + Math.max(0, (targetW - nameW) / 2);
        page.drawText(block.name, {
          x: nameX,
          y: by + smallSize + 1.5 * pad,
          size: nameSize,
          font: nameFont,
          color: rgb(0.06, 0.08, 0.36),
        });

        // Trait de signature + ligne d'authenticité horodatée (façon Adobe).
        page.drawLine({
          start: { x: bx + pad, y: by + smallSize + pad },
          end: { x: bx + bw - pad, y: by + smallSize + pad },
          thickness: 0.4,
          color: rgb(0.55, 0.55, 0.62),
        });
        // Ligne d'authenticité discrète : mention « Docbel.be » (accent violet
        // léger, façon marque) + horodatage Bruxelles. Rendue en 3 segments
        // pour colorer seulement la marque.
        const authY = by + pad - 1.5;
        const segPrefix = "Signé via ";
        const segBrand = "Docbel.be";
        const segSuffix = ` · ${signatureTimestamp()}`;
        const wOf = (t: string) => font.widthOfTextAtSize(t, smallSize);
        const gris = rgb(0.45, 0.45, 0.55);
        page.drawText(segPrefix, { x: bx + pad, y: authY, size: smallSize, font, color: gris });
        page.drawText(segBrand, { x: bx + pad + wOf(segPrefix), y: authY, size: smallSize, font, color: rgb(0.42, 0.35, 0.62) });
        page.drawText(segSuffix, { x: bx + pad + wOf(segPrefix) + wOf(segBrand), y: authY, size: smallSize, font, color: gris });
        continue;
      }

      stampScalarWidget(pdfField, value, fonts, unicodeFont, field.type, field.autoSizeFont, field.options, field.stampMap, field.fontSize, field.printAsComb, field.numberFormat);
    } catch (err) {
      // Champ readonly / incompatible : on n'interrompt pas la generation,
      // mais on ne fait plus semblant que la valeur est partie.
      diags.push({
        fieldId: field.id,
        widget: field.pdfFieldName,
        kind: "stamp-refuse",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }


  /// Dessine une valeur en peigne sur le widget nomme. Chaque ligne de grille a
  /// son propre rectangle, donc sa propre ordonnee : le calage se recalcule par
  /// widget, jamais une fois pour toutes.
  const dessinerPeigne = (
    fieldId: string,
    widgetName: string,
    valeur: string,
    comb: NonNullable<PdfFormField["printAsComb"]>,
    taillePolice: number
  ): void => {
    const tech = (opts.technicalSchema ?? []).find((t) => t.pdfFieldName === widgetName);
    if (!tech?.rect || !comb.slotWidth) return;
    const [bx, by] = tech.rect;
    const page = doc.getPage(Math.max(0, Math.min(doc.getPageCount() - 1, tech.page ?? 0)));
    const { font: policeCaractere } = fonts.pick(valeur);
    placerPeigne(page, bx, by, 3, valeur, comb, taillePolice, policeCaractere, fieldId, widgetName, diags);
  };

  /// Stamps positionnels en attente : ils sont dessinés APRÈS `form.flatten()`,
  /// pas au fil de la boucle `extraStamps`.
  ///
  /// La raison est une propriété d'`flatten()` : pdf-lib recopie alors dans le
  /// flux de la page l'apparence de CHAQUE widget, par-dessus tout ce qu'on y a
  /// déjà dessiné. Or l'apparence « décochée » d'une case ONEM commence par
  /// `1 g / 0 0 6.7 6.7 re / f` — un carré BLANC OPAQUE. Une croix posée dans
  /// une case à cocher disparaissait donc à l'aplatissement, sans le moindre
  /// signal : le PDF contenait bien le caractère (les sondes d'encre le
  /// voyaient), il était simplement recouvert. C'est exactement le cas des trois
  /// cases du C47, dont aucune n'est cochable par son champ AcroForm.
  ///
  /// Différer est sûr par construction : une clé de `POSITIONAL_EXTRA_STAMPS`
  /// signifie « aucun widget ne revendique cet emplacement ». Rien de ce que
  /// `flatten` recopie n'a donc à passer par-dessus.
  const stampsPositionnelsDifferes: Array<() => void> = [];

  /// Dessine un stamp de `POSITIONAL_EXTRA_STAMPS` (aucun widget AcroForm
  /// cible). Même cœur de placement que la boucle `drawAt` du champ de
  /// schéma plus bas (peigne si `printAsComb`, sinon texte auto-réduit sur
  /// `maxWidth`) — dédoublé ici car cette clé vient d'`extraStamps` (une
  /// règle serveur), pas d'un `PdfFormField.drawAt`.
  const dessinerStampPositionnel = (
    widgetName: string,
    valeur: string,
    spec: PositionalStampSpec
  ): void => {
    const pageIdx = Math.max(0, Math.min(doc.getPageCount() - 1, spec.page));
    const page = doc.getPage(pageIdx);
    const { font: drawFont } = fonts.pick(valeur);
    if (spec.printAsComb?.slotWidth) {
      placerPeigne(
        page,
        spec.x,
        spec.y,
        0,
        valeur,
        spec.printAsComb,
        spec.size ?? UNIFORM_TEXT_FONT_SIZE,
        drawFont,
        widgetName,
        widgetName,
        diags
      );
      return;
    }
    let fontSize = spec.size ?? UNIFORM_TEXT_FONT_SIZE;
    if (spec.maxWidth && spec.maxWidth > 0) {
      while (fontSize > 5 && drawFont.widthOfTextAtSize(valeur, fontSize) > spec.maxWidth) fontSize -= 0.5;
    }
    try {
      page.drawText(valeur, { x: spec.x, y: spec.y, size: fontSize, font: drawFont, color: rgb(0, 0, 0) });
    } catch (err) {
      diags.push({
        fieldId: "",
        widget: widgetName,
        kind: "stamp-refuse",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Bindings serveur : `extraStamps` provient du registry par slug
  // (`lib/pdf-forms/bindings/`) évalué par la route generate avant appel.
  // Appliqué APRÈS la boucle fields → une règle qui cible le même widget
  // qu'un champ schéma gagne. On logge (console.warn) les échecs par widget
  // au lieu de les avaler silencieusement — les rules émettent souvent des
  // stamps texte contraints par un maxLength (« B E » = 2, undefined_11 = 4)
  // et une erreur silencieuse ferait apparaître une case blanche sans
  // signal.
  if (opts.extraStamps && opts.extraStamps.size > 0) {
    for (const [widgetName, value] of opts.extraStamps) {
      if (!widgetName) continue;

      // Stamp POSITIONNEL (cf. POSITIONAL_EXTRA_STAMPS ci-dessus) : aucun
      // widget AcroForm à résoudre, on dessine directement sur la page — mais
      // APRÈS l'aplatissement, d'où la mise en attente (cf.
      // `stampsPositionnelsDifferes`). `form.getField` échouerait de toute
      // façon sur une clé sentinelle, on passe donc à la clé suivante.
      const positional = POSITIONAL_EXTRA_STAMPS[widgetName];
      if (positional) {
        if (typeof value === "string" && value.trim() !== "") {
          stampsPositionnelsDifferes.push(() =>
            dessinerStampPositionnel(widgetName, value, positional)
          );
        }
        continue;
      }

      let widget;
      try {
        widget = form.getField(widgetName);
      } catch {
        console.warn(`[pdf-forms] extraStamp: widget introuvable "${widgetName}"`);
        diags.push({ fieldId: "", widget: widgetName, kind: "widget-introuvable" });
        continue;
      }
      try {
        if (typeof value === "boolean") {
          if (!(widget instanceof PDFCheckBox)) {
            console.warn(
              `[pdf-forms] extraStamp: widget "${widgetName}" attendu checkbox pour booléen`
            );
            continue;
          }
          if (value) widget.check();
          else widget.uncheck();
        } else {
          if (!(widget instanceof PDFTextField)) {
            console.warn(
              `[pdf-forms] extraStamp: widget "${widgetName}" attendu texte pour string`
            );
            continue;
          }
          // Widget pose sur un guide imprime : on dessine caractere par
          // caractere hors du champ, et on le laisse vide pour ne pas
          // imprimer la valeur deux fois.
          const combSpec = opts.combWidgets?.[widgetName];
          if (combSpec?.slotWidth) {
            widget.setText("");
            dessinerPeigne("", widgetName, value, combSpec, combSpec.fontSize ?? UNIFORM_TEXT_FONT_SIZE);
            continue;
          }
          widget.setText(value);
          const { font: wFont, fallback } = fonts.pick(value);
          if (fallback) fonts.reapply.push({ field: widget, font: wFont });
          // Même ajustement que la boucle schéma : les règles serveur n'ont
          // pas d'équivalent de `autoSizeFont`, et « NomPrenom » (121 pt) ne
          // tient pas un nom composé à 10 pt (« Jean-Baptiste Vandenberghe »
          // = 128 pt).
          appliquerTaillePolice(widget, fitFontSize(wFont, value, widget));
          if (unicodeFont) widget.updateAppearances(wFont);
        }
      } catch (err) {
        // Cas typique : `setText` au-delà du maxLength du widget → pdf-lib
        // throw. Sans warn on ne verrait qu'une case vide sans indice.
        diags.push({
          fieldId: "",
          widget: widgetName,
          kind: "stamp-refuse",
          detail: err instanceof Error ? err.message : String(err),
        });
        console.warn(
          `[pdf-forms] extraStamp: échec sur "${widgetName}" (` +
            (err instanceof Error ? err.message : String(err)) +
            ")"
        );
      }
    }
  }

  // Peigne POSITIONNEL : un caractere par barre du guide imprime.
  //
  // Le texte d'un widget est borne par son rectangle, alors que le guide du C1
  // se poursuit au-dela — aucun espacement interne ne pouvait donc atteindre
  // ses dernieres barres. On dessine ici directement dans le flux de la page,
  // comme `drawAt`, ce qui affranchit de cette limite et survit au flatten.

  for (const field of fields) {
    if (field.hidden) continue;
    if (field.visibleIf && !isFieldVisible(field.visibleIf, payload)) continue;

    // Grille : une valeur par ligne, chacune sur son propre widget.
    if (field.type === "array") {
      const rows = payload[field.id];
      if (!isFieldValueRecordArray(rows)) continue;
      const cap = typeof field.maxRows === "number" ? Math.max(0, field.maxRows) : rows.length;
      rows.slice(0, cap).forEach((row, idx) => {
        for (const sub of field.itemFields ?? []) {
          const combSub = sub.printAsComb;
          if (!combSub?.slotWidth || !sub.pdfFieldNameTemplate) continue;
          if (!isSubFieldVisible(sub, row, payload)) continue;
          const v = row[sub.id];
          if (v === null || v === undefined || v === "") continue;
          const texte = sub.type === "date" ? formatDateFR(String(v)) : String(v);
          dessinerPeigne(
            `${field.id}[${idx + 1}].${sub.id}`,
            sub.pdfFieldNameTemplate.replace(/\{index\}/g, String(idx + 1)),
            texte,
            combSub,
            sub.fontSize ?? UNIFORM_TEXT_FONT_SIZE
          );
        }
      });
      continue;
    }

    const comb = field.printAsComb;
    if (!comb?.slotWidth) continue;
    const brut = payload[field.id];
    if (typeof brut !== "string" || !brut.trim()) continue;
    // Formatage FR AVANT le peigne, comme dans la branche grille : sans lui, la
    // date ISO du state partait telle quelle et « 1985-06-12 » s'imprimait
    // « 19 85 0612 » — l'annee d'abord, sur un guide jour/mois/annee.
    const valeurChamp = field.type === "date" ? formatDateFR(brut) : brut;
    const taille = field.fontSize ?? UNIFORM_TEXT_FONT_SIZE;
    // Meme coeur de placement que la branche grille ci-dessus : `dessinerPeigne`
    // resout le widget par nom (technicalSchema) et delegue a `placerPeigne` --
    // plus de recherche de rectangle, de calcul de rupture ni de boucle de
    // dessin dupliques ici (avant ce lot, ce bloc reimplementait la meme
    // logique caractere par caractere que `dessinerPeigne` un peu plus haut).
    dessinerPeigne(field.id, field.pdfFieldName, valeurChamp, comb, taille);
  }

  // Dessin POSITIONNEL `drawAt` : champs sans widget AcroForm dont la valeur
  // doit apparaître à un emplacement IMPRIMÉ du PDF (ex. la colonne
  // « commune » du C1, présente à l'impression mais sans champ remplissable).
  // Indépendant des widgets — écrit directement dans le flux de la page, donc
  // survit au flatten. Auto-réduit la police pour tenir dans `maxWidth`.
  for (const field of fields) {
    if (!field.drawAt || field.hidden) continue;
    if (field.visibleIf && !isFieldVisible(field.visibleIf, payload)) continue;
    const raw = payload[field.id];
    if (raw === null || raw === undefined || raw === "" || raw === false) continue;
    let text = String(raw);
    if (field.type === "date") text = formatDateFR(text);
    if (field.type === "number")
      text = field.numberFormat === "money" ? montantFR(text) : decimalesFR(text);
    const { page: pageIdx, x, y, size, maxWidth } = field.drawAt;
    const pIdx = Math.max(0, Math.min(doc.getPageCount() - 1, pageIdx));
    const page = doc.getPage(pIdx);
    const { font: drawFont } = fonts.pick(text);

    // Peigne SANS widget : un champ qui porte a la fois `drawAt` et
    // `printAsComb` (ex. les n° BCE du C1A, Q2/Q16 -- le widget AcroForm
    // "TVA" existe bien mais partage sa valeur entre les deux pages, donc
    // inutilisable pour du texte case-par-case, cf. PDF_FORMS_RULES.md et le
    // commentaire du seed sur ces deux champs). Meme coeur de placement que
    // le peigne pilote par widget (`placerPeigne`, appele par `dessinerPeigne`
    // plus haut) : seule la source de geometrie change -- `drawAt.x`/`y` au
    // lieu du rectangle d'un widget. `baselineParDefaut` = 0 (pas 3, cf.
    // `placerPeigne`) : `drawAt.y` EST deja la ligne de base exacte, comme
    // pour tous les autres champs `drawAt` de cette boucle -- pas le coin bas
    // d'une case a partir duquel remonter. `maxWidth` (reduction de police)
    // ne s'applique pas ici : chaque caractere avance d'un pas fixe
    // (`comb.slotWidth`), le texte ne peut pas "deborder" au sens ou l'entend
    // la reduction ci-dessous.
    const comb = field.printAsComb;
    if (comb?.slotWidth) {
      placerPeigne(page, x, y, 0, text, comb, size ?? UNIFORM_TEXT_FONT_SIZE, drawFont, field.id, field.pdfFieldName, diags);
      continue;
    }

    let fontSize = size ?? UNIFORM_TEXT_FONT_SIZE;
    if (maxWidth && maxWidth > 0) {
      while (fontSize > 5 && drawFont.widthOfTextAtSize(text, fontSize) > maxWidth) fontSize -= 0.5;
    }
    try {
      page.drawText(text, { x, y, size: fontSize, font: drawFont, color: rgb(0, 0, 0) });
    } catch (err) {
      console.warn(
        `[pdf-forms] drawAt: échec sur "${field.id}" (` +
          (err instanceof Error ? err.message : String(err)) +
          ")"
      );
    }
  }

  // Répartition MULTI-LIGNES `lineTargets` : un `textarea` unique dont le
  // texte est réparti sur plusieurs lignes PHYSIQUES du PDF (widgets ou
  // dessins positionnels), dans l'ordre déclaré — ex. les grilles horaires du
  // C1A, où « pendant les périodes suivantes » et « irrégulièrement, à
  // savoir » ouvraient jusqu'ici plusieurs champs numérotés (Période 1, 2,
  // 3…) au lieu d'un seul textarea libre. Ces champs n'ont pas de
  // `pdfFieldName` propre (`""`), donc la boucle principale ci-dessus les a
  // ignorés — indépendant du reste, comme le dessin positionnel `drawAt`.
  for (const field of fields) {
    if (!field.lineTargets || field.lineTargets.length === 0) continue;
    if (field.hidden) continue;
    if (field.visibleIf && !isFieldVisible(field.visibleIf, payload)) continue;
    const raw = payload[field.id];
    if (typeof raw !== "string" || !raw.trim()) continue;

    const taillePreferee = field.fontSize ?? UNIFORM_TEXT_FONT_SIZE;
    // Police choisie UNE FOIS sur le texte COMPLET, comme le pré-contrôle de
    // rendabilité en tête de fonction (qui scanne `payload[field.id]` tel
    // quel) : une ligne repliée est une SOUS-CHAINE, jamais présente telle
    // quelle dans `aBesoinDuRepli` — la choisir ligne par ligne manquerait
    // donc toujours le repli cyrillique/grec/vietnamien que le pré-contrôle a
    // pourtant détecté sur la valeur d'origine.
    const { font: texteFont, fallback: texteFallback } = fonts.pick(raw);

    // Largeur utile de chaque cible, dans l'ordre — via `technicalSchema`
    // pour un widget (rect PDF, marge intérieure retirée comme `fitFontSize`),
    // via `maxWidth` pour un dessin positionnel. Inconnue → pas de repli pour
    // cette cible (mieux vaut tout écrire, quitte à déborder, que deviner une
    // largeur fausse et couper du texte à tort).
    const largeurs = field.lineTargets.map((cible) => {
      if (cible.pdfFieldName) {
        const tech = (opts.technicalSchema ?? []).find((t) => t.pdfFieldName === cible.pdfFieldName);
        const w = tech?.rect?.[2];
        return w && w > 0 ? w - 2 * TEXT_WIDGET_PADDING : Number.POSITIVE_INFINITY;
      }
      return cible.drawAt?.maxWidth && cible.drawAt.maxWidth > 0
        ? cible.drawAt.maxWidth
        : Number.POSITIVE_INFINITY;
    });

    // UNE SEULE TAILLE POUR TOUT LE GROUPE (Oraliks 2026-07-30 : « la taille du
    // texte c'est pas partout la même »). Elle était calculée LIGNE PAR LIGNE :
    // les premières tenaient à la taille normale, la dernière absorbait le
    // débordement et rétrécissait seule — trois lignes d'un même paragraphe
    // s'affichaient dans deux corps différents.
    //
    // On cherche donc la plus grande taille à laquelle le texte tient DANS LE
    // NOMBRE DE LIGNES DISPONIBLES, et on l'applique partout. Réduire la police
    // fait tenir plus de caractères par ligne : la recherche converge, et le
    // texte remplit les lignes du papier au lieu d'en écraser une seule.
    const cibleCompte = field.lineTargets.length;

    // Largeur MÉMORISÉE à une taille de référence, puis mise à l'échelle : la
    // largeur d'un texte est proportionnelle au corps, et `widthOfTextAtSize`
    // reparcourt toute la chaîne à chaque appel (coûteux sur une police TTF
    // embarquée). Sans ce cache, essayer plusieurs tailles faisait expirer les
    // tests de repli sur vrais PDF.
    const TAILLE_REF = 100;
    const largeurRef = new Map<string, number>();
    const largeurA = (texte: string, taille: number) => {
      let w = largeurRef.get(texte);
      if (w === undefined) {
        w = texteFont.widthOfTextAtSize(texte, TAILLE_REF);
        largeurRef.set(texte, w);
      }
      return (w * taille) / TAILLE_REF;
    };
    const replier = (taille: number) =>
      distribuerLignes(raw, largeurs, (texte) => largeurA(texte, taille));
    /// Vrai si, à cette taille, une ligne dépasse encore la largeur qui lui est
    /// offerte — c'est le cas de la dernière quand elle a absorbé le surplus.
    const deborde = (lignes: string[], taille: number) =>
      lignes.some((ligne, i) => {
        const largeur = largeurs[Math.min(i, cibleCompte - 1)];
        return Number.isFinite(largeur) && largeurA(ligne, taille) > largeur;
      });

    // Tailles candidates, de la plus grande à la plus petite. Réduire le corps
    // ne peut que faire tenir DAVANTAGE de texte : la propriété est monotone,
    // donc une dichotomie trouve la plus grande taille qui tient — en ~4 essais
    // au lieu de onze.
    const candidates: number[] = [];
    for (let t = taillePreferee; t >= MIN_TEXT_FONT_SIZE; t -= 0.5) candidates.push(t);

    let tailleGroupe = candidates[0] ?? taillePreferee;
    let lignes = replier(tailleGroupe);
    if (deborde(lignes, tailleGroupe)) {
      let bas = 1;
      let haut = candidates.length - 1;
      let choisi = candidates.length - 1;
      while (bas <= haut) {
        const milieu = (bas + haut) >> 1;
        if (!deborde(replier(candidates[milieu]), candidates[milieu])) {
          choisi = milieu;
          haut = milieu - 1;
        } else {
          bas = milieu + 1;
        }
      }
      tailleGroupe = candidates[choisi];
      lignes = replier(tailleGroupe);
    }

    field.lineTargets.forEach((cible, i) => {
      const texte = lignes[i];
      if (!texte) return;

      if (cible.pdfFieldName) {
        let widget;
        try {
          widget = form.getField(cible.pdfFieldName);
        } catch {
          diags.push({ fieldId: field.id, widget: cible.pdfFieldName, kind: "widget-introuvable" });
          return;
        }
        if (!(widget instanceof PDFTextField)) {
          diags.push({
            fieldId: field.id,
            widget: cible.pdfFieldName,
            kind: "stamp-refuse",
            detail: "lineTargets attend un widget texte",
          });
          return;
        }
        try {
          widget.setText(texte);
          if (texteFallback) fonts.reapply.push({ field: widget, font: texteFont });
          // Taille du GROUPE, pas de la ligne : toutes les lignes d'un même
          // paragraphe s'impriment dans le même corps. `fitFontSize` reste le
          // filet de sécurité (rectangle RÉEL du widget, au cas où la largeur
          // tirée du `technicalSchema` diverge) mais ne peut que RÉDUIRE — d'où
          // le `min`, qui l'empêche de faire remonter une ligne au-dessus de la
          // taille commune et de rouvrir l'écart qu'on vient de fermer.
          const taillePosee = Math.min(
            tailleGroupe,
            fitFontSize(texteFont, texte, widget, tailleGroupe)
          );
          appliquerTaillePolice(widget, taillePosee);
          // `fitFontSize` ne descend pas sous MIN_TEXT_FONT_SIZE : au plancher,
          // un texte trop long RESTE trop long, et pdf-lib le coupe en plein
          // glyphe à la limite du rectangle. La valeur est bien dans le PDF,
          // mais invisible — exactement la « perte silencieuse » que cette
          // répartition promet d'éviter. Vu sur le C1B : la description
          // « autre, à savoir » d'une annexe s'arrêtait sur « 12 janvier 20 ».
          if (depasse(texteFont, texte, widget, taillePosee)) {
            diags.push({
              fieldId: field.id,
              widget: cible.pdfFieldName,
              kind: "caracteres-non-rendus",
              detail: `texte trop long pour la case même à ${taillePosee} pt — la fin est coupée`,
            });
          }
          if (unicodeFont) widget.updateAppearances(texteFont);
        } catch (err) {
          diags.push({
            fieldId: field.id,
            widget: cible.pdfFieldName,
            kind: "stamp-refuse",
            detail: err instanceof Error ? err.message : String(err),
          });
        }
        return;
      }

      if (cible.drawAt) {
        const pIdx = Math.max(0, Math.min(doc.getPageCount() - 1, cible.drawAt.page));
        const page = doc.getPage(pIdx);
        // Idem côté positionnel : la taille du groupe fait foi. `drawAt.size`
        // reste prioritaire quand la cible en impose une (calage sur un guide
        // précis) ; sinon la boucle ne fait plus que garantir le non-débordement
        // d'une cible plus étroite que les autres.
        let taille = cible.drawAt.size ?? tailleGroupe;
        const maxWidth = cible.drawAt.maxWidth;
        if (maxWidth && maxWidth > 0) {
          while (taille > MIN_TEXT_FONT_SIZE && texteFont.widthOfTextAtSize(texte, taille) > maxWidth) {
            taille -= 0.5;
          }
        }
        try {
          page.drawText(texte, { x: cible.drawAt.x, y: cible.drawAt.y, size: taille, font: texteFont, color: rgb(0, 0, 0) });
        } catch (err) {
          console.warn(
            `[pdf-forms] lineTargets: échec sur "${field.id}" (` +
              (err instanceof Error ? err.message : String(err)) +
              ")"
          );
        }
      }
    });
  }

  // Réécrit les apparences globales avec la police Unicode avant flatten.
  if (unicodeFont) {
    try {
      form.updateFieldAppearances(font);
    } catch {
      /* best-effort */
    }
    // …puis ré-habille les champs rendus avec le repli : le passage global
    // vient de les réécrire avec la principale, qui ne sait pas les dessiner.
    // Sans cette reprise, le correctif serait annulé à la dernière ligne.
    for (const { field, font: f } of fonts.reapply) {
      try {
        field.updateAppearances(f);
      } catch {
        /* best-effort */
      }
    }
  }

  if (flatten) {
    try {
      form.flatten();
    } catch (error) {
      // Le flatten échoue surtout sur les widgets sans apparence normale — les
      // PDF ONEM en comptent jusqu'à 11 par formulaire. L'échec était avalé en
      // silence : on livrait alors un PDF NON APLATI, donc encore éditable,
      // sans que personne ne le sache. Le document reste servi (mieux vaut un
      // PDF rééditable qu'aucun PDF), mais la trace existe désormais.
      console.warn(
        `[pdf-forms] flatten impossible — le PDF servi reste éditable : ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Stamps positionnels, maintenant que plus aucune apparence de widget ne
  // viendra les recouvrir (cf. `stampsPositionnelsDifferes`).
  for (const dessiner of stampsPositionnelsDifferes) dessiner();

  if (diags.length > 0) {
    // Une ligne par generation, pas une par champ : l'appelant (route
    // /generate, regeneration zip/mail) a le slug et peut journaliser mieux.
    console.warn(
      `[pdf-forms] ${diags.length} valeur(s) non ecrite(s) : ` +
        diags.map((d) => `${d.fieldId || d.widget} (${d.kind})`).join(", ")
    );
  }

  const out = await doc.save();
  return { bytes: Buffer.from(out), unicodeFont, diagnostics: diags };
}
