import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, ParserResult } from '../types'
import { parseCellNumber } from '../normalize'

interface ParseOtherAllocationsOptions {
  validFrom: Date | null
}

/**
 * Parse AndereUitk_AutresAlloc (autres allocations).
 *
 * Structure : plusieurs sous-sections distinctes :
 *   - Wisselkoerstoeslag (suppl. taux de change) : matrice salaire → supplément
 *   - Opvanguitkering (alloc. d'accueil) : Vol/Half → montant
 *   - Leefloon (revenu d'intégration) : 3 catégories familiales × (mensuel, annuel)
 *
 * Approche : on identifie chaque section par mot-clé puis on applique l'extraction
 * spécifique. Best-effort — les sections non reconnues sont signalées en alerte.
 */
export function parseOtherAllocations(
  sheet: ParsedSheet,
  options: ParseOtherAllocationsOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []

  // Repérer les positions des sections
  const sectionRows = locateSections(sheet)

  // Opvanguitkering : 2 lignes Vol/Half avec montant en col D
  if (sectionRows.opvang !== null) {
    extractOpvang(sheet, sectionRows.opvang, options.validFrom, amounts)
  } else {
    alerts.push({
      level: 'info',
      sheet: sheet.name,
      message: 'Section "Opvanguitkering / allocation d\'accueil" non détectée',
    })
  }

  // Leefloon : 3 lignes (gezinshoofd, alleenstaande, samenwonende) avec montants mensuel + annuel
  if (sectionRows.leefloon !== null) {
    extractLeefloon(sheet, sectionRows.leefloon, options.validFrom, amounts)
  } else {
    alerts.push({
      level: 'info',
      sheet: sheet.name,
      message: 'Section "Leefloon / revenu d\'intégration" non détectée',
    })
  }

  // Wisselkoerstoeslag : ignorée en V1 (matrice complexe avec conditions)
  if (sectionRows.wissel !== null) {
    alerts.push({
      level: 'info',
      sheet: sheet.name,
      message: 'Section "Wisselkoerstoeslag" détectée mais non parsée (V2)',
    })
  }

  if (amounts.length === 0) {
    alerts.push({
      level: 'warn',
      sheet: sheet.name,
      message: 'Aucune autre allocation extraite',
    })
  }

  return { amounts, alerts }
}

interface SectionLocations {
  wissel: number | null
  opvang: number | null
  leefloon: number | null
}

function locateSections(sheet: ParsedSheet): SectionLocations {
  let wissel: number | null = null
  let opvang: number | null = null
  let leefloon: number | null = null
  for (let r = 0; r < sheet.cellData.length; r++) {
    const text = sheet.cellData[r].join(' ').toLowerCase()
    if (wissel === null && /wisselkoers|taux de change/.test(text)) wissel = r
    if (opvang === null && /opvanguitkering|allocation d'accueil|alloc.*accueil/.test(text)) opvang = r
    if (leefloon === null && /leefloon|revenu d'int.gration|revenu d.int.gration/.test(text)) leefloon = r
  }
  return { wissel, opvang, leefloon }
}

function extractOpvang(
  sheet: ParsedSheet,
  startRow: number,
  validFrom: Date | null,
  amounts: BaremeAmountDraft[]
) {
  // Chercher dans les ~10 lignes suivantes des lignes "Vol/Plein" et "Half/Demi"
  for (let r = startRow; r < Math.min(startRow + 10, sheet.cellData.length); r++) {
    const row = sheet.cellData[r]
    const labelCell = (row[1] ?? '').trim().toLowerCase()
    if (!labelCell) continue

    let salaryCode: 'full' | 'half' | null = null
    if (/vol|plein/.test(labelCell)) salaryCode = 'full'
    else if (/half|demi/.test(labelCell)) salaryCode = 'half'
    if (!salaryCode) continue

    // Le montant peut être en col C, D ou E selon la version
    let amount: number | null = null
    for (let c = 2; c <= 5 && c < row.length; c++) {
      const candidate = parseCellNumber(row[c])
      if (candidate !== null) {
        amount = candidate
        break
      }
    }
    if (amount === null) continue

    amounts.push({
      sourceSheet: sheet.name,
      category: 'other_allocation',
      allocationCode: 'opvang',
      salaryCode,
      labelNl: row[1]?.split(/[\n\r]+/)[0] ?? null,
      labelFr: row[1]?.split(/[\n\r]+/)[1] ?? null,
      amount,
      unit: 'daily',
      validFrom,
      comparisonKey: `other_allocation:opvanguitkering:${salaryCode}`,
      rawData: { row: r + 1 },
    })
  }
}

function extractLeefloon(
  sheet: ParsedSheet,
  startRow: number,
  validFrom: Date | null,
  amounts: BaremeAmountDraft[]
) {
  // Repérer la ligne d'en-tête "mois / année"
  let unitsRowIndex = -1
  for (let r = startRow; r < Math.min(startRow + 5, sheet.cellData.length); r++) {
    const text = sheet.cellData[r].join(' ').toLowerCase()
    if (/maand.*jaar|mois.*ann/.test(text) || /\bmois\b/.test(text)) {
      unitsRowIndex = r
      break
    }
  }
  if (unitsRowIndex === -1) return

  // Repérer les colonnes des unités
  let monthlyCol = -1
  let yearlyCol = -1
  const unitsRow = sheet.cellData[unitsRowIndex]
  for (let c = 0; c < unitsRow.length; c++) {
    const cell = (unitsRow[c] ?? '').toLowerCase()
    if (monthlyCol === -1 && /maand|mois/.test(cell)) monthlyCol = c
    if (yearlyCol === -1 && /jaar|ann/.test(cell)) yearlyCol = c
  }
  if (monthlyCol === -1) return

  // Catégories : gezinshoofd, alleenstaande, samenwonende
  for (let r = unitsRowIndex + 1; r < Math.min(unitsRowIndex + 8, sheet.cellData.length); r++) {
    const row = sheet.cellData[r]
    const label = (row[1] ?? '').trim()
    if (!label) continue

    let situation: string | null = null
    const lower = label.toLowerCase()
    if (/gezinshoofd|chef de m/.test(lower)) situation = 'gezinshoofd'
    else if (/alleenstaande|isol/.test(lower)) situation = 'alleenstaande'
    else if (/samenwonende|cohabit/.test(lower)) situation = 'samenwonende'
    if (!situation) continue

    const monthly = parseCellNumber(row[monthlyCol])
    if (monthly !== null) {
      const parts = label.split(/[\n\r]+/)
      amounts.push({
        sourceSheet: sheet.name,
        category: 'other_allocation',
        allocationCode: 'leefloon',
        salaryCode: situation,
        labelNl: parts[0] ?? null,
        labelFr: parts[1] ?? null,
        amount: monthly,
        unit: 'monthly',
        validFrom,
        comparisonKey: `other_allocation:leefloon:${situation}:monthly`,
        rawData: { row: r + 1 },
      })
    }
    if (yearlyCol >= 0) {
      const yearly = parseCellNumber(row[yearlyCol])
      if (yearly !== null) {
        amounts.push({
          sourceSheet: sheet.name,
          category: 'other_allocation',
          allocationCode: 'leefloon',
          salaryCode: situation,
          amount: yearly,
          unit: 'yearly',
          validFrom,
          comparisonKey: `other_allocation:leefloon:${situation}:yearly`,
          rawData: { row: r + 1 },
        })
      }
    }
  }
}
