import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
import { cellRef, makeIssue } from '../types'
import { parseCellNumber } from '../normalize'

interface ParseEmploymentBonusOptions {
  validFrom: Date | null
}

/**
 * Parse Bonus (Werkbonus / Bonus à l'emploi).
 *
 * Structure : 2 catégories (employé privé, ouvrier privé). Pour chacune, 3 lignes
 * de tranches salariales (referent salary S) → bonus de base R :
 *  - "< X"          → bonus = montant (col G)
 *  - "> X en < Y"   → bonus dégressif (formule), montant de base en col G
 *  - "> Y"          → bonus = 0
 *
 * On extrait pour chaque catégorie : la borne basse du palier max et le bonus de base.
 * comparisonKey: "employment_bonus:CATEGORY:tier_NAME".
 */
export function parseEmploymentBonus(
  sheet: ParsedSheet,
  options: ParseEmploymentBonusOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []

  // Détecter les positions des 2 sections (Employé / Ouvrier).
  // Un intitulé de section est une cellule qui COMMENCE par le mot-clé — une
  // simple mention au fil d'une note (ex: "… s'il s'agit d'un ouvrier" en L10)
  // ne doit pas déclencher la section.
  let employeeStart = -1
  let workerStart = -1
  for (let r = 0; r < sheet.cellData.length; r++) {
    const cells = sheet.cellData[r].map((c) => (c ?? '').trim().toLowerCase())
    if (employeeStart === -1 && cells.some((c) => /^(employ.|bediende)/.test(c))) {
      employeeStart = r
    }
    if (workerStart === -1 && cells.some((c) => /^(ouvrier|arbeider)/.test(c))) {
      workerStart = r
    }
  }

  // Bornes : chaque section s'arrête là où commence l'autre (sinon les
  // fenêtres de scan se chevauchent et les tranches sont comptées deux fois).
  const employeeEnd =
    workerStart > employeeStart && employeeStart >= 0 ? workerStart : employeeStart + 15
  const workerEnd =
    employeeStart > workerStart && workerStart >= 0 ? employeeStart : workerStart + 15

  if (employeeStart >= 0) {
    extractTier(sheet, employeeStart, employeeEnd, 'employee', options.validFrom, amounts)
  } else {
    alerts.push(
      makeIssue({
        severity: 'warning',
        kind: 'partial_sheet',
        title: 'Section non détectée',
        sheet: sheet.name,
        reason: 'Section "Employé / Bediende" non détectée — les bonus de cette catégorie ne sont pas extraits.',
        recommendation: 'Vérifier la grille brute dans le Diagnostic.',
      })
    )
  }

  if (workerStart >= 0) {
    extractTier(sheet, workerStart, workerEnd, 'worker', options.validFrom, amounts)
  } else {
    alerts.push(
      makeIssue({
        severity: 'warning',
        kind: 'partial_sheet',
        title: 'Section non détectée',
        sheet: sheet.name,
        reason: 'Section "Ouvrier / Arbeider" non détectée — les bonus de cette catégorie ne sont pas extraits.',
        recommendation: 'Vérifier la grille brute dans le Diagnostic.',
      })
    )
  }

  if (amounts.length === 0) {
    alerts.push(
      makeIssue({
        severity: 'error',
        kind: 'parser_error',
        title: 'Aucun bonus extrait',
        sheet: sheet.name,
        reason: 'Aucune tranche de bonus à l\'emploi n\'a été extraite — structure inattendue.',
        recommendation: 'Vérifier la grille brute ; adapter le parser employment_bonus si la mise en page a changé.',
      })
    )
  }

  return { amounts, alerts, ignoredRows: [], unknownCodes: [] }
}

function extractTier(
  sheet: ParsedSheet,
  startRow: number,
  endRow: number,
  category: 'employee' | 'worker',
  validFrom: Date | null,
  amounts: BaremeAmountDraft[]
) {
  // Chercher dans la fenêtre de la section les tranches : opérateur en col B, seuil en C
  for (let r = startRow; r < Math.min(endRow, sheet.cellData.length); r++) {
    const row = sheet.cellData[r]
    const op = (row[1] ?? '').trim() // col B : "<", ">", etc.
    const threshold = parseCellNumber(row[2]) // col C
    const bonus = parseCellNumber(row[6]) // col G

    if (!op || threshold === null) continue
    if (bonus === null) continue

    // Tier name : low / mid / zero — dérivé de l'opérateur
    let tier: string
    if (op === '<') {
      tier = `low_lt_${formatThreshold(threshold)}`
    } else if (op === '>') {
      const upperBound = parseCellNumber(row[4]) // col E (si plage)
      tier = upperBound !== null
        ? `mid_${formatThreshold(threshold)}_${formatThreshold(upperBound)}`
        : `high_gt_${formatThreshold(threshold)}`
    } else {
      continue
    }

    const bonusCellRef = cellRef(r, 6)
    const categoryFr = category === 'employee' ? 'employé du secteur privé' : 'ouvrier du secteur privé'
    amounts.push({
      sourceSheet: sheet.name,
      category: 'employment_bonus',
      allocationCode: category,
      salaryCode: tier,
      amount: bonus,
      unit: 'monthly',
      minDailySalary: op === '>' ? threshold : null,
      maxDailySalary:
        op === '>' && parseCellNumber(row[4]) !== null
          ? parseCellNumber(row[4])
          : op === '<'
            ? threshold
            : null,
      validFrom,
      comparisonKey: `employment_bonus:${category}:${tier}`,
      rawData: {
        operator: op,
        threshold,
        upperBound: parseCellNumber(row[4]) ?? undefined,
        row: r + 1,
      },
      status: 'valid',
      warnings: [],
      trace: {
        sourceCell: bonusCellRef,
        sourceRowIndex: r + 1,
        sourceColumnIndex: 7,
        rawValue: (row[6] ?? '').trim(),
        normalizedValue: bonus,
        mappingKey: `${category}:${tier}`,
        mappingFile: null,
        transformTemplate: 'employment_bonus',
        transformReason:
          `Ce bonus provient de la feuille ${sheet.name}, cellule ${bonusCellRef} (ligne ${r + 1}). ` +
          `Catégorie « ${categoryFr} », tranche salariale « ${op} ${threshold} »` +
          (parseCellNumber(row[4]) !== null ? ` jusqu'à ${parseCellNumber(row[4])}` : '') +
          `. Le montant mensuel ${bonus} a été normalisé depuis la valeur brute « ${(row[6] ?? '').trim()} ».`,
      },
    })
  }
}

function formatThreshold(n: number): string {
  return String(Math.round(n))
}
