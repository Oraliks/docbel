import type { ParsedSheet } from '@/lib/baremes-parser'
import type {
  BaremeAlert,
  BaremeAmountDraft,
  BaremeCategory,
  BaremeIgnoredRow,
  BaremeUnknownCode,
  ParserResult,
} from '../types'
import { cellRef, columnLetter, makeIssue } from '../types'
import { parseCellNumber, parseCodeCell } from '../normalize'
import { CODE_MAPPING_FILE, resolveCodeInfo, type CodeInfo } from '../code-mapping'
import { IGNORED_CODES_FILE, isIgnoredCode } from '../ignored-codes'

interface ParseAllocationMatrixOptions {
  /** Catégorie à attribuer aux montants extraits (varie selon la feuille). */
  category: BaremeCategory
  /** Date de validité héritée du fichier. */
  validFrom: Date | null
}

const HEADER_KEYWORD = 'code'
// Tranches salariales légitimes: "MIN", "MAX", ou entier 1..99
const TRANCHE_REGEX = /^(MIN|MAX|\d{1,3})$/i

/**
 * Parse un onglet de type matrice "code allocation × tranche salariale" → montant.
 *
 * Structure attendue (cf. A_N_B_vol_plein, A_N_B_half_demi) :
 *  - Une ligne d'en-tête où la colonne A vaut "Code", et les colonnes
 *    suivantes contiennent les codes d'allocation (AA1, AA2, NB/NX, …).
 *  - En dessous, des lignes dont la colonne A vaut "MIN" ou un entier
 *    (la tranche salariale). À l'intersection ligne × colonne se trouve
 *    le montant d'allocation.
 *  - Les codes peuvent être empilés sur plusieurs lignes dans une seule
 *    cellule (ex: "AB\nAX") — on émet alors un montant par code.
 *  - Les cellules commençant par "#" sont des erreurs de formule et sont ignorées.
 *
 * Chaque montant émis porte une trace complète (cellule, valeur brute, mapping
 * appliqué) ; chaque code non mappé devient une issue 'unknown_code'.
 */
export function parseAllocationMatrix(
  sheet: ParsedSheet,
  options: ParseAllocationMatrixOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []
  const ignoredRows: BaremeIgnoredRow[] = []
  const unknownCodes: BaremeUnknownCode[] = []

  const headerRowIndex = findHeaderRow(sheet)
  if (headerRowIndex === -1) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'unknown_column',
        title: "Ligne d'en-tête introuvable",
        sheet: sheet.name,
        reason: `Aucune cellule "Code" trouvée en colonne A — le template allocation_matrix ne reconnaît pas la structure de cette feuille.`,
        recommendation:
          'Vérifier la grille brute dans le Diagnostic ; si la structure ONEM a changé, adapter le template (sheet-templates.ts ou mapping DB).',
      })
    )
    return { amounts, alerts, ignoredRows, unknownCodes }
  }

  // Extraire (colIndex, code) à partir de la ligne d'en-tête
  const headerRow = sheet.cellData[headerRowIndex]
  const codeColumns: {
    colIndex: number
    code: string
    info: CodeInfo | null
    occurrence: number
    rate: number | null
  }[] = []
  const seenUnknown = new Set<string>()
  const occurrenceByCode = new Map<string, number>()
  // Ligne de taux éventuelle juste sous l'en-tête (0.65 / 0.60) : différencie
  // les blocs quand un même code apparaît dans plusieurs colonnes (TW-CT, SpecCat).
  const rateRow = sheet.cellData[headerRowIndex + 1] ?? []
  for (let c = 1; c < headerRow.length; c++) {
    const rawHeaderCell = headerRow[c]
    const codes = parseCodeCell(rawHeaderCell)
    const rateCandidate = parseCellNumber(rateRow[c])
    const rate = rateCandidate !== null && rateCandidate > 0 && rateCandidate < 1 ? rateCandidate : null
    for (const code of codes) {
      const ignored = isIgnoredCode(code, options.category)
      if (ignored) {
        ignoredRows.push({
          sheet: sheet.name,
          rowIndex: headerRowIndex + 1,
          rawValues: [code],
          reason: `Code "${code}" volontairement ignoré (${IGNORED_CODES_FILE}) : ${ignored.reason}`,
        })
        continue
      }
      const info = resolveCodeInfo(code, options.category)
      if (!info && !seenUnknown.has(code)) {
        seenUnknown.add(code)
        const cell = cellRef(headerRowIndex, c)
        unknownCodes.push({
          sheet: sheet.name,
          cell,
          code,
          category: options.category,
          recommendation: `Ajouter "${code}" dans ${CODE_MAPPING_FILE} (glossaire) ou le déclarer dans ${IGNORED_CODES_FILE} avec une raison explicite.`,
        })
        alerts.push(
          makeIssue({
            severity: 'warning',
            kind: 'unknown_code',
            title: 'Code ONEM non mappé',
            sheet: sheet.name,
            cell,
            row: headerRowIndex + 1,
            column: columnLetter(c),
            rawValue: rawHeaderCell?.trim() || code,
            reason: `Le code "${code}" n'est ni mappé dans le glossaire ni déclaré comme ignoré. Les montants de cette colonne sont extraits mais marqués "à vérifier".`,
            recommendation: `Ajouter "${code}" dans ${CODE_MAPPING_FILE} ou dans ${IGNORED_CODES_FILE} avec une raison explicite.`,
          })
        )
      }
      const occurrence = (occurrenceByCode.get(code) ?? 0) + 1
      occurrenceByCode.set(code, occurrence)
      codeColumns.push({ colIndex: c, code, info, occurrence, rate })
    }
  }

  // Codes présents dans plusieurs colonnes (blocs entière/demi × taux) :
  // les occurrences ≥ 2 sont suffixées @N dans la clé de comparaison pour que
  // les montants coexistent au lieu de s'écraser. L'ordre des colonnes ONEM
  // est stable d'un trimestre à l'autre → le diff reste fiable.
  const duplicatedCodes = [...occurrenceByCode.entries()].filter(([, n]) => n > 1)
  if (duplicatedCodes.length > 0) {
    alerts.push(
      makeIssue({
        severity: 'info',
        kind: 'duplicate',
        title: 'Codes multi-colonnes désambiguïsés',
        sheet: sheet.name,
        row: headerRowIndex + 1,
        reason: `${duplicatedCodes.length} code(s) apparaissent dans plusieurs colonnes (${duplicatedCodes
          .slice(0, 4)
          .map(([code, n]) => `"${code}" ×${n}`)
          .join(', ')}${duplicatedCodes.length > 4 ? '…' : ''}) — typique des feuilles à blocs allocation entière/demi. Les occurrences suivantes sont suffixées @2, @3… dans la clé de comparaison ; le taux de chaque colonne est indiqué dans la trace.`,
        recommendation:
          'Vérifier dans la preview que chaque occurrence porte le bon taux (0.65 / 0.60) via le popover de provenance.',
      })
    )
  }

  if (codeColumns.length === 0) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'unknown_column',
        title: "Aucun code d'allocation détecté",
        sheet: sheet.name,
        row: headerRowIndex + 1,
        reason: `La ligne d'en-tête (ligne ${headerRowIndex + 1}) ne contient aucun code d'allocation exploitable.`,
        recommendation: 'Vérifier la grille brute — la structure de la feuille a probablement changé.',
      })
    )
    return { amounts, alerts, ignoredRows, unknownCodes }
  }

  // Parcourir les lignes de données (après l'en-tête)
  let extracted = 0
  let skippedErrorCells = 0
  for (let r = headerRowIndex + 1; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]
    const tranche = (row[0] ?? '').trim()
    if (!tranche) continue
    if (!TRANCHE_REGEX.test(tranche)) {
      // Pas une ligne de tranche → on s'arrête (le bas de feuille peut contenir des notes)
      // Sauf si c'est une ligne complètement vide entre deux blocs : on continue silencieusement
      const isEmptyRow = row.every((c) => !c || !c.trim())
      if (isEmptyRow) continue
      ignoredRows.push({
        sheet: sheet.name,
        rowIndex: r + 1,
        rawValues: row.slice(0, 8).map((v) => truncate(v)),
        reason: `Colonne A = "${truncate(tranche)}" : pas une tranche salariale (MIN/MAX/entier) — fin des données, le reste de la feuille (notes de bas de page) est ignoré.`,
      })
      break
    }

    const salaryCode = tranche.toUpperCase()

    for (const { colIndex, code, info, occurrence, rate } of codeColumns) {
      const cellValue = row[colIndex]
      const cell = cellRef(r, colIndex)
      if (cellValue && cellValue.startsWith('#')) {
        skippedErrorCells++
        continue
      }
      const amount = parseCellNumber(cellValue)
      if (amount === null) {
        // Cellule non vide mais non numérique → montant invalide à signaler
        if (cellValue && cellValue.trim()) {
          alerts.push(
            makeIssue({
              severity: 'warning',
              kind: 'invalid_amount',
              title: 'Montant illisible',
              sheet: sheet.name,
              cell,
              row: r + 1,
              column: columnLetter(colIndex),
              rawValue: truncate(cellValue),
              reason: `La cellule ${cell} (code ${code}, tranche ${salaryCode}) contient "${truncate(cellValue)}" qui n'est pas un nombre exploitable. Ligne sautée pour ce code.`,
              recommendation:
                'Vérifier la cellule dans le fichier source ONEM — formule cassée ou format inattendu.',
            })
          )
        }
        continue
      }

      const keyCode = occurrence > 1 ? `${code}@${occurrence}` : code
      const comparisonKey = `${options.category}:${keyCode}:${salaryCode}`
      const isKnown = info !== null
      const explanation = buildExplanation({
        sheet: sheet.name,
        cell,
        code,
        info,
        salaryCode,
        amount,
        rawValue: cellValue ?? '',
        occurrence,
        rate,
      })

      amounts.push({
        sourceSheet: sheet.name,
        category: options.category,
        allocationCode: code,
        salaryCode,
        labelFr: info?.labelFr && !info.labelFr.startsWith('TODO') ? info.labelFr : null,
        labelNl: info?.labelNl ?? null,
        amount,
        validFrom: options.validFrom,
        unit: 'daily', // les allocations chômage sont quotidiennes
        comparisonKey,
        status: isKnown ? 'valid' : 'unknown',
        warnings: isKnown
          ? []
          : [`Code "${code}" non mappé — sémantique inconnue, montant à vérifier`],
        trace: {
          sourceCell: cell,
          sourceRowIndex: r + 1,
          sourceColumnIndex: colIndex + 1,
          rawValue: truncate(cellValue ?? ''),
          normalizedValue: amount,
          mappingKey: code,
          mappingFile: isKnown ? CODE_MAPPING_FILE : null,
          transformTemplate: 'allocation_matrix',
          transformReason: explanation,
          // Taux lu sous le code dans l'en-tête (0.65 / 0.60). Permet de libeller
          // les colonnes à variantes (@2/@3) des feuilles temporaire/spéciale.
          rate: rate ?? (info?.rate ?? null),
        },
      })
      extracted++
    }
  }

  if (extracted === 0) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'parser_error',
        title: 'Aucun montant extrait',
        sheet: sheet.name,
        reason: `${codeColumns.length} codes détectés dans l'en-tête mais aucune ligne de tranche salariale valide n'a produit de montant.`,
        recommendation: 'Vérifier la grille brute — la zone de données a probablement bougé.',
      })
    )
  }

  if (skippedErrorCells > 0) {
    alerts.push(
      makeIssue({
        severity: 'info',
        kind: 'invalid_amount',
        title: 'Cellules en erreur Excel ignorées',
        sheet: sheet.name,
        reason: `${skippedErrorCells} cellule(s) contenant une erreur de formule Excel (#REF!, #N/A, …) ont été ignorées. C'est habituel dans les fichiers ONEM (colonnes non applicables).`,
      })
    )
  }

  return { amounts, alerts, ignoredRows, unknownCodes }
}

function buildExplanation(input: {
  sheet: string
  cell: string
  code: string
  info: CodeInfo | null
  salaryCode: string
  amount: number
  rawValue: string
  occurrence: number
  rate: number | null
}): string {
  const parts: string[] = []
  parts.push(`Cette ligne provient de la feuille ${input.sheet}, cellule ${input.cell}.`)
  if (input.occurrence > 1 || input.rate !== null) {
    const bits: string[] = []
    if (input.occurrence > 1) bits.push(`${input.occurrence}ᵉ colonne portant le code ${input.code}`)
    if (input.rate !== null) bits.push(`taux affiché ${Math.round(input.rate * 100)} %`)
    parts.push(`(${bits.join(', ')}.)`)
  }
  if (input.info) {
    parts.push(`Le code ONEM ${input.code} a été reconnu via ${CODE_MAPPING_FILE}.`)
    const semantics: string[] = []
    if (input.info.situationLabelFr) semantics.push(`la situation « ${input.info.situationLabelFr} »`)
    if (input.info.period === 1) {
      semantics.push(
        `la 1ère période d'indemnisation${input.info.phase ? ` (phase ${input.info.phase}${input.info.rate ? `, taux ${Math.round(input.info.rate * 100)} %` : ''})` : ''}`
      )
    } else if (input.info.period === 2) {
      semantics.push('la 2ème période d\'indemnisation (forfait)')
    }
    if (semantics.length > 0) {
      parts.push(`Il correspond à ${semantics.join(' et à ')}.`)
    } else if (input.info.labelFr && !input.info.labelFr.startsWith('TODO')) {
      parts.push(`Il correspond à : ${input.info.labelFr}.`)
    } else {
      parts.push('Sa sémantique précise est encore à documenter dans le glossaire.')
    }
  } else {
    parts.push(
      `Le code ONEM ${input.code} n'est PAS mappé (absent de ${CODE_MAPPING_FILE} et de ${IGNORED_CODES_FILE}) — montant extrait mais à vérifier.`
    )
  }
  parts.push(
    input.salaryCode === 'MIN' || input.salaryCode === 'MAX'
      ? `La tranche ${input.salaryCode} a été détectée dans la colonne de gauche.`
      : `La tranche salariale ${input.salaryCode} a été détectée dans la colonne de gauche.`
  )
  parts.push(
    `Le montant journalier ${input.amount} a été normalisé depuis la valeur Excel brute « ${input.rawValue.trim()} ».`
  )
  return parts.join(' ')
}

function truncate(value: string | undefined | null, max = 80): string {
  if (!value) return ''
  const s = String(value)
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function findHeaderRow(sheet: ParsedSheet): number {
  for (let r = 0; r < sheet.cellData.length; r++) {
    const cellA = (sheet.cellData[r][0] ?? '').trim().toLowerCase()
    if (cellA === HEADER_KEYWORD) return r
  }
  return -1
}
