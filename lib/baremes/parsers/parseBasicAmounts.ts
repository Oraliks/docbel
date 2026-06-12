import type { ParsedSheet } from '@/lib/baremes-parser'
import type {
  BaremeAlert,
  BaremeAmountDraft,
  BaremeIgnoredRow,
  ParserResult,
} from '../types'
import { cellRef, columnLetter, makeIssue } from '../types'
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
  const ignoredRows: BaremeIgnoredRow[] = []

  const headerInfo = findHeaderRow(sheet)
  if (!headerInfo) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'unknown_column',
        title: "Ligne d'en-tête introuvable",
        sheet: sheet.name,
        reason: 'Aucune ligne contenant les mots-clés attendus (Artikel, Basisbedrag, …) — le template basic_amounts ne reconnaît pas cette feuille.',
        recommendation: 'Vérifier la grille brute ; si la structure ONEM a changé, adapter le parser basic_amounts.',
      })
    )
    return { amounts, alerts, ignoredRows, unknownCodes: [] }
  }

  const { rowIndex: headerRowIndex, articleCol, labelCol, amountCol, unitCol } = headerInfo

  if (articleCol === -1) {
    alerts.push(
      makeIssue({
        severity: 'warning',
        kind: 'unknown_column',
        title: 'Colonne "Artikel" non trouvée',
        sheet: sheet.name,
        row: headerRowIndex + 1,
        reason: 'Les montants seront extraits sans article de loi de référence.',
        recommendation: 'Vérifier la ligne d\'en-tête dans la grille brute.',
      })
    )
  }
  if (amountCol === -1) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'unknown_column',
        title: 'Colonne montant introuvable',
        sheet: sheet.name,
        row: headerRowIndex + 1,
        reason: 'Colonne "Basisbedrag" (montant) introuvable — onglet non parsable.',
        recommendation: 'Vérifier la ligne d\'en-tête dans la grille brute ; adapter HEADER_KEYWORDS du parser basic_amounts si l\'intitulé a changé.',
      })
    )
    return { amounts, alerts, ignoredRows, unknownCodes: [] }
  }

  let lastArticle: string | null = null
  let lastArticleRow: number | null = null

  for (let r = headerRowIndex + 1; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]

    // Article peut être hérité de la ligne précédente (cellule fusionnée visuellement)
    const articleCell = articleCol >= 0 ? (row[articleCol] ?? '').trim() : ''
    if (articleCell) {
      lastArticle = articleCell
      lastArticleRow = r + 1
    }

    const rawAmount = row[amountCol] ?? ''
    const amount = parseCellNumber(rawAmount)
    if (amount === null) {
      // Lignes vides ignorées silencieusement ; signaler seulement si tout le contexte est vide
      const isMostlyEmpty = row.every((c) => !c || !c.trim())
      if (isMostlyEmpty) continue
      // Sinon ligne potentiellement informative mais sans montant
      if (articleCell || (labelCol >= 0 && (row[labelCol] ?? '').trim())) {
        ignoredRows.push({
          sheet: sheet.name,
          rowIndex: r + 1,
          rawValues: row.slice(0, 8).map((v) => truncate(v)),
          reason: rawAmount.trim()
            ? `La cellule montant (${cellRef(r, amountCol)}) contient "${truncate(rawAmount)}" qui n'est pas un nombre — ligne descriptive ou montant manquant.`
            : `Pas de montant en colonne ${columnLetter(amountCol)} — ligne de titre, de section ou descriptive.`,
        })
      }
      continue
    }

    const labelNl = labelCol >= 0 ? cleanLabel(row[labelCol]) : null
    const unit = unitCol >= 0 ? normalizeUnit(row[unitCol]) : null
    const article = lastArticle
    const articleInherited = !articleCell && !!lastArticle

    // Identifiant stable pour comparaison : on préfère article + amount-col-code,
    // sinon on retombe sur le label (moins stable mais utilisable).
    // La colonne C contient souvent un code interne type "D7" — utile comme clé secondaire.
    const internalCode = row[2] ? (row[2] ?? '').trim() : ''
    const keyPart = internalCode || normalizeKeyText(labelNl || `row${r}`)
    const comparisonKey = `basic_amount:${keyPart}`

    const amountCell = cellRef(r, amountCol)
    const explanationParts = [
      `Ce montant provient de la feuille ${sheet.name}, cellule ${amountCell} (ligne ${r + 1}).`,
    ]
    if (article) {
      explanationParts.push(
        articleInherited
          ? `L'article « ${article} » est hérité de la ligne ${lastArticleRow} (cellule fusionnée dans le fichier ONEM).`
          : `Il est rattaché à l'article « ${article} » (colonne ${columnLetter(articleCol)}).`
      )
    }
    if (internalCode) {
      explanationParts.push(`Le code interne ONEM « ${internalCode} » sert de clé de comparaison entre versions.`)
    }
    if (labelNl) explanationParts.push(`Libellé source (NL) : « ${labelNl} ».`)
    explanationParts.push(
      `Le montant ${amount}${unit ? ` (${unit})` : ''} a été normalisé depuis la valeur brute « ${rawAmount.trim()} ».`
    )

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
      status: 'valid',
      warnings: articleInherited
        ? [`Article hérité de la ligne ${lastArticleRow} (cellule fusionnée)`]
        : [],
      trace: {
        sourceCell: amountCell,
        sourceRowIndex: r + 1,
        sourceColumnIndex: amountCol + 1,
        rawValue: truncate(rawAmount),
        normalizedValue: amount,
        mappingKey: internalCode || article || null,
        mappingFile: null,
        transformTemplate: 'basic_amounts',
        transformReason: explanationParts.join(' '),
      },
    })
  }

  if (amounts.length === 0) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'parser_error',
        title: 'Aucun montant de base extrait',
        sheet: sheet.name,
        reason: 'L\'en-tête a été reconnu mais aucune ligne de données n\'a produit de montant.',
        recommendation: 'Vérifier la grille brute dans le Diagnostic.',
      })
    )
  }

  if (ignoredRows.length > 0) {
    alerts.push(
      makeIssue({
        severity: 'info',
        kind: 'ignored_row',
        title: 'Lignes sans montant ignorées',
        sheet: sheet.name,
        reason: `${ignoredRows.length} ligne(s) avec article/libellé mais sans montant numérique ont été ignorées (détail dans le Diagnostic).`,
      })
    )
  }

  return { amounts, alerts, ignoredRows, unknownCodes: [] }
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

function truncate(value: string | undefined | null, max = 80): string {
  if (!value) return ''
  const s = String(value)
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function normalizeKeyText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}
