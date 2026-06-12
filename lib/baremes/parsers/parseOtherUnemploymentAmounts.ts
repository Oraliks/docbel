import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
import { cellRef, makeIssue } from '../types'
import { parseCellNumber } from '../normalize'

interface ParseOtherUnemploymentAmountsOptions {
  validFrom: Date | null
}

// Mapping mot-clé d'en-tête → unité canonique
const UNIT_HEADER_MAP: { keyword: string; unit: string }[] = [
  { keyword: 'uur', unit: 'hourly' },
  { keyword: 'heure', unit: 'hourly' },
  { keyword: 'halve dag', unit: 'half_daily' },
  { keyword: 'demi jour', unit: 'half_daily' },
  { keyword: 'dag', unit: 'daily' },
  { keyword: 'jour', unit: 'daily' },
  { keyword: 'maand', unit: 'monthly' },
  { keyword: 'mois', unit: 'monthly' },
  { keyword: 'jaar', unit: 'yearly' },
  { keyword: 'année', unit: 'yearly' },
  { keyword: 'annee', unit: 'yearly' },
]

/**
 * Parse AndereBedrWLH_AutresMontCHOM (Autres montants chômage).
 *
 * Structure : liste avec colonnes d'unité dédiées.
 *  - Ligne d'en-tête : col B/A = "Artikel - Article", col E = "Uitleg - Explications",
 *    puis colonnes par unité (uur, halve dag, dag, maand, jaar).
 *  - Lignes de données : col B = article, col E = label bilingue,
 *    une ou plusieurs colonnes d'unité contiennent le montant.
 *
 * Pour chaque ligne, on émet UN montant par colonne d'unité remplie.
 * comparisonKey : "other_unemployment_amount:ARTICLE:UNIT".
 */
export function parseOtherUnemploymentAmounts(
  sheet: ParsedSheet,
  options: ParseOtherUnemploymentAmountsOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []

  const header = findHeader(sheet)
  if (!header) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'unknown_column',
        title: "Ligne d'en-tête introuvable",
        sheet: sheet.name,
        reason: 'Aucune ligne contenant le mot-clé "Artikel" avec des colonnes d\'unité — le template other_unemployment_amounts ne reconnaît pas cette feuille.',
        recommendation: 'Vérifier la grille brute ; adapter le parser si la structure ONEM a changé.',
      })
    )
    return { amounts, alerts, ignoredRows: [], unknownCodes: [] }
  }

  if (header.unitCols.length === 0) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'unknown_column',
        title: "Aucune colonne d'unité détectée",
        sheet: sheet.name,
        row: header.rowIndex + 1,
        reason: 'Aucune colonne uur/dag/maand/jaar trouvée dans l\'en-tête.',
        recommendation: 'Vérifier la grille brute dans le Diagnostic.',
      })
    )
    return { amounts, alerts, ignoredRows: [], unknownCodes: [] }
  }

  let lastArticle: string | null = null
  let lastArticleRow: number | null = null
  let lastLabel: { nl: string | null; fr: string | null } = { nl: null, fr: null }
  // Un même article peut porter plusieurs montants de même unité (sous-cas) :
  // on suffixe @2, @3… pour qu'ils coexistent. L'ordre des lignes ONEM est stable.
  const keyOccurrences = new Map<string, number>()

  for (let r = header.rowIndex + 1; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]
    const article = (row[header.articleCol] ?? '').trim()
    const labelCell = (row[header.labelCol] ?? '').trim()

    if (article) {
      lastArticle = article
      lastArticleRow = r + 1
    }
    if (labelCell) {
      const parts = labelCell.split(/[\n\r]+/).map((s) => s.trim()).filter(Boolean)
      lastLabel = { nl: parts[0] ?? null, fr: parts[1] ?? null }
    }

    if (!lastArticle) continue // aucun article connu, on n'a rien à rattacher

    for (const { colIndex, unit } of header.unitCols) {
      const rawValue = row[colIndex] ?? ''
      const amount = parseCellNumber(rawValue)
      if (amount === null) continue

      const articleKey = normalizeArticleKey(lastArticle)
      const amountCell = cellRef(r, colIndex)
      const articleInherited = !article && lastArticleRow !== r + 1
      const baseKey = `other_unemployment_amount:${articleKey}:${unit}`
      const occurrence = (keyOccurrences.get(baseKey) ?? 0) + 1
      keyOccurrences.set(baseKey, occurrence)
      amounts.push({
        sourceSheet: sheet.name,
        category: 'other_unemployment_amount',
        article: lastArticle,
        labelNl: lastLabel.nl,
        labelFr: lastLabel.fr,
        unit,
        amount,
        validFrom: options.validFrom,
        comparisonKey: occurrence > 1 ? `${baseKey}@${occurrence}` : baseKey,
        rawData: { row: r + 1 },
        status: 'valid',
        warnings: articleInherited
          ? [`Article « ${lastArticle} » hérité de la ligne ${lastArticleRow} (cellule fusionnée)`]
          : [],
        trace: {
          sourceCell: amountCell,
          sourceRowIndex: r + 1,
          sourceColumnIndex: colIndex + 1,
          rawValue: rawValue.trim(),
          normalizedValue: amount,
          mappingKey: lastArticle,
          mappingFile: null,
          transformTemplate: 'other_unemployment_amounts',
          transformReason:
            `Ce montant provient de la feuille ${sheet.name}, cellule ${amountCell} (colonne d'unité « ${unit} »). ` +
            `Il est rattaché à l'article « ${lastArticle} »` +
            (articleInherited
              ? ` hérité de la ligne ${lastArticleRow} (cellule fusionnée dans le fichier ONEM).`
              : '.') +
            (lastLabel.fr || lastLabel.nl ? ` Libellé source : « ${lastLabel.fr ?? lastLabel.nl} ».` : '') +
            ` Le montant ${amount} a été normalisé depuis la valeur brute « ${rawValue.trim()} ».`,
        },
      })
    }
  }

  if (amounts.length === 0) {
    alerts.push(
      makeIssue({
        severity: 'warning',
        kind: 'partial_sheet',
        title: 'Aucun montant extrait',
        sheet: sheet.name,
        reason: 'L\'en-tête a été reconnu mais aucune ligne article × unité n\'a produit de montant — structure peut-être incompatible.',
        recommendation: 'Vérifier la grille brute dans le Diagnostic.',
      })
    )
  }

  return { amounts, alerts, ignoredRows: [], unknownCodes: [] }
}

interface HeaderInfo {
  rowIndex: number
  articleCol: number
  labelCol: number
  unitCols: { colIndex: number; unit: string }[]
}

function findHeader(sheet: ParsedSheet): HeaderInfo | null {
  for (let r = 0; r < Math.min(sheet.cellData.length, 15); r++) {
    const row = sheet.cellData[r]
    const lowered = row.map((c) => (c ?? '').toLowerCase().trim())

    // Détection de la cellule contenant "artikel"
    const articleCol = lowered.findIndex((c) => /artikel/.test(c))
    if (articleCol === -1) continue

    // Label : prochaine colonne contenant "uitleg" ou "explication"
    let labelCol = lowered.findIndex((c) => /uitleg|explication|libellé|wat/.test(c))
    if (labelCol === -1) labelCol = articleCol + 1

    // Colonnes d'unité
    const unitCols: { colIndex: number; unit: string }[] = []
    for (let c = labelCol + 1; c < lowered.length; c++) {
      const cell = lowered[c]
      if (!cell) continue
      const match = UNIT_HEADER_MAP.find((m) => cell.includes(m.keyword))
      if (match) unitCols.push({ colIndex: c, unit: match.unit })
    }

    if (unitCols.length > 0) {
      return { rowIndex: r, articleCol, labelCol, unitCols }
    }
  }
  return null
}

function normalizeArticleKey(article: string): string {
  return article
    .toLowerCase()
    .replace(/[§°]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}
