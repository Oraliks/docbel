import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
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
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: 'Ligne d\'en-tête introuvable (mot-clé "Artikel" attendu)',
    })
    return { amounts, alerts }
  }

  if (header.unitCols.length === 0) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: 'Aucune colonne d\'unité détectée (uur/dag/maand/jaar)',
    })
    return { amounts, alerts }
  }

  let lastArticle: string | null = null
  let lastLabel: { nl: string | null; fr: string | null } = { nl: null, fr: null }

  for (let r = header.rowIndex + 1; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]
    const article = (row[header.articleCol] ?? '').trim()
    const labelCell = (row[header.labelCol] ?? '').trim()

    if (article) lastArticle = article
    if (labelCell) {
      const parts = labelCell.split(/[\n\r]+/).map((s) => s.trim()).filter(Boolean)
      lastLabel = { nl: parts[0] ?? null, fr: parts[1] ?? null }
    }

    if (!lastArticle) continue // aucun article connu, on n'a rien à rattacher

    for (const { colIndex, unit } of header.unitCols) {
      const amount = parseCellNumber(row[colIndex])
      if (amount === null) continue

      const articleKey = normalizeArticleKey(lastArticle)
      amounts.push({
        sourceSheet: sheet.name,
        category: 'other_unemployment_amount',
        article: lastArticle,
        labelNl: lastLabel.nl,
        labelFr: lastLabel.fr,
        unit,
        amount,
        validFrom: options.validFrom,
        comparisonKey: `other_unemployment_amount:${articleKey}:${unit}`,
        rawData: { row: r + 1 },
      })
    }
  }

  if (amounts.length === 0) {
    alerts.push({
      level: 'warn',
      sheet: sheet.name,
      message: 'Aucun montant extrait — structure peut-être incompatible',
    })
  }

  return { amounts, alerts }
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
