import {
  PDFDocument,
  PDFFont,
  PDFForm,
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
import { resolveSignerName, buildSignatureBlock, signatureTimestamp } from "./signature";
import { isSignatureField } from "./auto-fields";
import { isFieldVisible } from "./validation";
import { formatDateFR } from "./bindings/format";

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
  field: PDFTextField | PDFDropdown
): number {
  if (!text) return UNIFORM_TEXT_FONT_SIZE;
  let usable = Infinity;
  try {
    if (field instanceof PDFTextField && field.isMultiline()) return UNIFORM_TEXT_FONT_SIZE;
    // Un champ peut porter plusieurs widgets (même valeur répétée sur
    // plusieurs pages) : on vise le plus étroit, pour tenir partout.
    for (const w of field.acroField.getWidgets()) {
      const width = w.getRectangle().width;
      if (width > 0) usable = Math.min(usable, width - 2 * TEXT_WIDGET_PADDING);
    }
  } catch {
    return UNIFORM_TEXT_FONT_SIZE;
  }
  if (!Number.isFinite(usable) || usable <= 0) return UNIFORM_TEXT_FONT_SIZE;
  let size = UNIFORM_TEXT_FONT_SIZE;
  while (size > MIN_TEXT_FONT_SIZE && font.widthOfTextAtSize(text, size) > usable) {
    size -= 0.5;
  }
  return size;
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
  stampMap?: Record<string, string>
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
    pdfField.setText(text);
    // Le choix se fait sur le texte FINAL (date reformatee, libelle du
    // stampMap, IBAN deshabille de son « BE »), pas sur la valeur brute.
    const { font, fallback } = fonts.pick(text);
    if (fallback) fonts.reapply.push({ field: pdfField, font });
    // Taille uniforme partout (cf. UNIFORM_TEXT_FONT_SIZE), réduite si le
    // texte ne tient pas dans la case (cf. fitFontSize), sauf `autoSizeFont`
    // (0 = auto-fit lecteur PDF, cf. PdfFormField.autoSizeFont).
    try {
      pdfField.setFontSize(autoSizeFont ? 0 : fitFontSize(font, text, pdfField));
    } catch {
      /* certains widgets rejettent setFontSize — on garde la taille par défaut */
    }
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
        stampScalarWidget(pdfField, subValue as FieldValue, fonts, unicodeFont, sub.type, sub.autoSizeFont, sub.options, sub.stampMap);
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
      stampScalarWidget(pdfField, subValue as FieldValue, fonts, unicodeFont, sub.type, sub.autoSizeFont, sub.options, sub.stampMap);
    } catch {
      /* readonly / incompatible */
    }
  }
}

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
        [...text].filter((c) => !probe.hasGlyphForCodePoint(c.codePointAt(0) ?? 0)).join("");
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
        [...text].filter((c) => !probe.hasGlyphForCodePoint(c.codePointAt(0) ?? 0)).join("");
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

        const signerName = resolveSignerName(fields, payload) || (typeof value === "string" ? value : "");
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

      stampScalarWidget(pdfField, value, fonts, unicodeFont, field.type, field.autoSizeFont, field.options, field.stampMap);
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
          widget.setText(value);
          const { font: wFont, fallback } = fonts.pick(value);
          if (fallback) fonts.reapply.push({ field: widget, font: wFont });
          try {
            // Même ajustement que la boucle schéma : les règles serveur n'ont
            // pas d'équivalent de `autoSizeFont`, et « NomPrenom » (121 pt) ne
            // tient pas un nom composé à 10 pt (« Jean-Baptiste Vandenberghe »
            // = 128 pt).
            widget.setFontSize(fitFontSize(wFont, value, widget));
          } catch {
            /* certains widgets rejettent setFontSize — on garde la taille par défaut */
          }
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
    const { page: pageIdx, x, y, size, maxWidth } = field.drawAt;
    const pIdx = Math.max(0, Math.min(doc.getPageCount() - 1, pageIdx));
    const page = doc.getPage(pIdx);
    const { font: drawFont } = fonts.pick(text);
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
