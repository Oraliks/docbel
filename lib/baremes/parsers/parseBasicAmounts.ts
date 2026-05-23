import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
import { normalizeUnit, parseCellNumber } from '../normalize'

interface ParseBasicAmountsOptions {
  validFrom: Date | null
}

const HEADER_KEYWORDS = {
  article: ['artikel', 'article'],
  label: ['wat', 'libellé', 'libelle', 'description'],
  amount: ['basisbedrag', 'montant', 'bedrag'],
  unit: ['freq', 'fréq', 'frequentie', 'eenheid', 'unité', 'unite'],
}

/**
 * Parse l'onglet Basisbedragen (montants de base par article de loi).
 *
 * Structure :
 *  - Une ligne d'en-tête contenant "Artikel", "Wat", "Basisbedrag", "Freq bedrag"
 *  - En dessous, des lignes avec : article (col A), label NL (col B),
 *    code interne D-XX (col C), montant (col D), unité (col E), référence (col F)
 *
 * On accepte un décalage de colonnes : les en-têtes sont détectées par mot-clé
 * (NL ou FR), puis on lit les données aux positions correspondantes.
 */
export function parseBasicAmounts(
  sheet: ParsedSheet,
  options: ParseBasicAmountsOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []

  const headerInfo = findHeaderRow(sheet)
  if (!headerInfo) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: `Ligne d'en-tête introuvable (mots-clés attendus: Artikel, Basisbedrag, …)`,
    })
    return { amounts, alerts }
  }

  const { rowIndex: headerRowIndex, articleCol, labelCol, amountCol, unitCol } = headerInfo

  if (articleCol === -1) {
    alerts.push({
      level: 'warn',
      sheet: sheet.name,
      message: `Colonne "Artikel" non trouvée — les montants seront sans article de référence`,
    })
  }
  if (amountCol === -1) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: `Colonne "Basisbedrag" (montant) introuvable — onglet non parsable`,
    })
    return { amounts, alerts }
  }

  let lastArticle: string | null = null
  let skippedEmptyAmount = 0

  for (let r = headerRowIndex + 1; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]

    // Article peut être hérité de la ligne précédente (cellule fusionnée visuellement)
    const articleCell = articleCol >= 0 ? (row[articleCol] ?? '').trim() : ''
    if (articleCell) lastArticle = articleCell

    const amount = parseCellNumber(row[amountCol])
    if (amount === null) {
      // Lignes vides ignorées silencieusement ; signaler seulement si tout le contexte est vide
      const isMostlyEmpty = row.every((c) => !c || !c.trim())
      if (isMostlyEmpty) continue
      // Sinon ligne potentiellement informative mais sans montant
      if (articleCell || (labelCol >= 0 && (row[labelCol] ?? '').trim())) {
        skippedEmptyAmount++
      }
      continue
    }

    const labelNl = labelCol >= 0 ? cleanLabel(row[labelCol]) : null
    const unit = unitCol >= 0 ? normalizeUnit(row[unitCol]) : null
    const article = lastArticle

    // Identifiant stable pour comparaison : on préfère article + amount-col-code,
    // sinon on retombe sur le label (moins stable mais utilisable).
    // La colonne C contient souvent un code interne type "D7" — utile comme clé secondaire.
    const internalCode = row[2] ? (row[2] ?? '').trim() : ''
    const keyPart = internalCode || normalizeKeyText(labelNl || `row${r}`)
    const comparisonKey = `basic_amount:${keyPart}`

    amounts.push({
      sourceSheet: sheet.name,
      category: 'basic_amount',
      article,
      labelNl,
      labelFr: null, // pas de label FR dans cette feuille
      unit,
      amount,
      validFrom: options.validFrom,
      comparisonKey,
      rawData: {
        row: r + 1,
        internalCode: internalCode || undefined,
        reference: row[5] ? row[5].trim() : undefined,
      },
    })
  }

  if (amounts.length === 0) {
    alerts.push({
      level: 'error',
      sheet: sheet.name,
      message: 'Aucun montant de base extrait',
    })
  }

  if (skippedEmptyAmount > 0) {
    alerts.push({
      level: 'info',
      sheet: sheet.name,
      message: `${skippedEmptyAmount} lignes ignorées (sans montant)`,
    })
  }

  return { amounts, alerts }
}

interface HeaderInfo {
  rowIndex: number
  articleCol: number
  labelCol: number
  amountCol: number
  unitCol: number
}

function findHeaderRow(sheet: ParsedSheet): HeaderInfo | null {
  for (let r = 0; r < Math.min(sheet.cellData.length, 20); r++) {
    const row = sheet.cellData[r]
    const lowered = row.map((c) => (c ?? '').toLowerCase().trim())

    const articleCol = lowered.findIndex((c) => HEADER_KEYWORDS.article.some((k) => c === k))
    const amountCol = lowered.findIndex((c) =>
      HEADER_KEYWORDS.amount.some((k) => c.startsWith(k))
    )

    if (articleCol >= 0 && amountCol >= 0) {
      const labelCol = lowered.findIndex((c) => HEADER_KEYWORDS.label.some((k) => c === k))
      const unitCol = lowered.findIndex((c) => HEADER_KEYWORDS.unit.some((k) => c.startsWith(k)))
      return { rowIndex: r, articleCol, labelCol, amountCol, unitCol }
    }
  }
  return null
}

function cleanLabel(value: string | undefined | null): string | null {
  if (value == null) return null
  const cleaned = String(value).trim()
  return cleaned || null
}

function normalizeKeyText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}
