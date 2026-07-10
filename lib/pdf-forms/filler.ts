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
import { resolveSignerName, buildSignatureBlock } from "./signature";
import { isSignatureField } from "./auto-fields";
import { isFieldVisible } from "./validation";
import { formatDateFR } from "./bindings/format";

/// Chemin d'une police TTF Unicode optionnelle. Si présente, elle est
/// embarquée et utilisée pour réécrire les apparences des champs → support
/// complet des caractères hors Latin-1 (ł, ğ, ž, ș…) dans les noms étrangers.
/// Déposer p.ex. public/fonts/NotoSans-Regular.ttf.
const UNICODE_FONT_PATH = join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");

async function loadUnicodeFont(): Promise<Buffer | null> {
  try {
    if (existsSync(UNICODE_FONT_PATH)) return await readFile(UNICODE_FONT_PATH);
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

export interface FillResult {
  bytes: Buffer;
  /// true si la police Unicode a été embarquée.
  unicodeFont: boolean;
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

/// Stampe une valeur scalaire sur un widget AcroForm résolu, en dispatchant
/// sur son type (texte / checkbox / dropdown / radio group). Centralise la
/// logique pour la réutiliser depuis le stamping de lignes d'`array`.
function stampScalarWidget(
  pdfField: unknown,
  value: FieldValue,
  font: PDFFont,
  unicodeFont: boolean,
  fieldType?: string,
  autoSizeFont?: boolean,
  options?: FieldOption[]
): void {
  if (pdfField instanceof PDFTextField) {
    const raw = value === false ? "" : String(value);
    // Reformatage des dates ISO → FR au stamping : le form runner stocke en
    // ISO côté state (format standard <input type="date">), l'usager veut
    // du DD/MM/YYYY sur le PDF final.
    let text = raw;
    if (fieldType === "date") text = formatDateFR(raw);
    // IBAN belge : le template C1 imprime « B E » statiquement en amont du
    // numéro (widget « B E » du dump AcroForm). Sans strip, on verrait
    // « B E BE68 5390... » doublement préfixé. Le strip est PDF-only —
    // la valeur en state garde « BE68... » complet pour la validation Zod
    // (Oraliks 2026-07-07). Sur le widget « SEPA étranger IBAN BIC » le
    // préfixe est étranger (FR, DE, …) → pas de strip.
    if (fieldType === "iban") text = raw.replace(/^\s*[Bb][Ee]\s*/, "").trim();
    pdfField.setText(text);
    // Taille uniforme partout (cf. UNIFORM_TEXT_FONT_SIZE), sauf
    // `autoSizeFont` (0 = auto-fit lecteur PDF, cf. PdfFormField.autoSizeFont).
    try {
      pdfField.setFontSize(autoSizeFont ? 0 : UNIFORM_TEXT_FONT_SIZE);
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
    const opt = options?.find((o) => o.value === String(value));
    const s = opt ? (opt.label.fr || opt.label.nl || opt.label.de || String(value)) : String(value);
    if (s !== "" && s !== "false") {
      // Certains dropdowns du template n'ont PAS d'options prédéfinies (ex.
      // grille cohabitants du C1 remaniée par Oraliks : « Personne1_Allocations
      // Familiales »… créés vides). `select` exige la valeur dans les options →
      // on l'ajoute d'abord si nécessaire, puis on sélectionne. No-op sur
      // valeur vide (dropdown laissé neutre).
      try {
        if (!pdfField.getOptions().includes(s)) pdfField.addOptions([s]);
        pdfField.select(s);
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
function stampArrayField(
  form: PDFForm,
  font: PDFFont,
  unicodeFont: boolean,
  field: PdfFormField,
  rows: FieldValueRecord[]
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
        continue;
      }
      try {
        stampScalarWidget(pdfField, subValue as FieldValue, font, unicodeFont, sub.type, sub.autoSizeFont, sub.options);
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
      continue;
    }
    try {
      stampScalarWidget(pdfField, subValue as FieldValue, font, unicodeFont, sub.type, sub.autoSizeFont, sub.options);
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

  // Police : Unicode embarquée si dispo, sinon Helvetica standard.
  let unicodeFont = false;
  let font;
  const ttf = await loadUnicodeFont();
  if (ttf) {
    try {
      const fontkit = (await import("@pdf-lib/fontkit")).default;
      doc.registerFontkit(fontkit);
      font = await doc.embedFont(ttf, { subset: true });
      unicodeFont = true;
    } catch {
      font = await doc.embedFont(StandardFonts.Helvetica);
    }
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica);
  }

  // Police oblique pour la ligne "nom" du bloc de signature (effet manuscrit).
  const obliqueFont = await doc.embedFont(StandardFonts.HelveticaOblique);

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
      stampArrayField(form, font, unicodeFont, field, rows);
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

        // Cadre léger.
        page.drawRectangle({
          x: bx,
          y: by,
          width: bw,
          height: bh,
          color: rgb(0.96, 0.95, 1),
          opacity: 0.5,
          borderColor: rgb(0.42, 0.4, 0.62),
          borderWidth: 0.5,
        });

        const nameSize = Math.min(13, Math.max(8, bh / 3.2));
        const small = Math.max(5.5, Math.min(7.5, bh / 6));
        let cy = by + bh - pad - nameSize;
        page.drawText(block.name, { x: bx + pad, y: cy, size: nameSize, font: obliqueFont, color: rgb(0.1, 0.1, 0.3) });
        cy -= small + 4;
        page.drawText(block.by, { x: bx + pad, y: cy, size: small, font, color: rgb(0.32, 0.32, 0.42) });
        cy -= small + 2;
        page.drawText(block.date, { x: bx + pad, y: cy, size: small, font, color: rgb(0.32, 0.32, 0.42) });
        continue;
      }

      stampScalarWidget(pdfField, value, font, unicodeFont, field.type, field.autoSizeFont, field.options);
    } catch {
      // champ readonly / incompatible — on ignore sans casser la génération
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
          try {
            widget.setFontSize(UNIFORM_TEXT_FONT_SIZE);
          } catch {
            /* certains widgets rejettent setFontSize — on garde la taille par défaut */
          }
          if (unicodeFont) widget.updateAppearances(font);
        }
      } catch (err) {
        // Cas typique : `setText` au-delà du maxLength du widget → pdf-lib
        // throw. Sans warn on ne verrait qu'une case vide sans indice.
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
    let fontSize = size ?? UNIFORM_TEXT_FONT_SIZE;
    if (maxWidth && maxWidth > 0) {
      while (fontSize > 5 && font.widthOfTextAtSize(text, fontSize) > maxWidth) fontSize -= 0.5;
    }
    try {
      page.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
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
  }

  if (flatten) {
    try {
      form.flatten();
    } catch {
      /* certains PDF refusent le flatten */
    }
  }

  const out = await doc.save();
  return { bytes: Buffer.from(out), unicodeFont };
}
