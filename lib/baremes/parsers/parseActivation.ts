import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, BaremeIgnoredRow, ParserResult } from '../types'
import { cellRef, makeIssue } from '../types'
import { parseCellNumber } from '../normalize'

interface ParseActivationOptions {
  validFrom: Date | null
}

/**
 * Parse Activering_Activation (allocations d'activation).
 *
 * Structure : DEUX blocs côte à côte, chacun avec sa propre séquence de sections :
 *  - bloc GAUCHE  (col A = code, col B = montant) : SINE ancien régime, SINE nouveau régime
 *  - bloc DROIT   (col I = code, col J = montant) : ACTIVA-WALLONIE, ACTIVA-BRUSSEL
 *
 * ⚠️ Les deux blocs sont DÉSALIGNÉS verticalement : une même ligne peut porter un
 * en-tête de section d'un bloc ET une donnée de l'autre (ex. L13 : A="SINE" +
 * I="WB1"=500 ; L17 : A="CA/#"=500 + I="ACTIVA-BRUSSEL"). L'ancien parser faisait
 * `continue` sur toute la ligne dès qu'un en-tête était vu dans N'IMPORTE quel bloc
 * → perte silencieuse de 2 montants (WB1 et le nouveau régime SINE) et 5 codes
 * ACTIVA-WALLONIE rattachés à tort à "SINE" (état de section global partagé).
 * Corrigé : un état de sous-catégorie PAR BLOC, détection d'en-tête par bloc, et on
 * ne saute que la cellule-code du bloc qui porte l'en-tête (pas la ligne entière).
 *
 * Montant = montant mensuel MAXIMUM. Pour les formules de proratisation
 * ("750,00 X Q/S (max. 500,00)"), c'est la valeur après "max." qui est le plafond
 * réel (500), PAS le préfixe (750) qui n'est que la base de calcul.
 */
export function parseActivation(
  sheet: ParsedSheet,
  options: ParseActivationOptions
): ParserResult {
  const alerts: BaremeAlert[] = []
  const amounts: BaremeAmountDraft[] = []
  const ignoredRows: BaremeIgnoredRow[] = []
  const seenKeys = new Set<string>()

  // État de section INDÉPENDANT par bloc (le partage global était la cause des
  // rattachements faux WA/WB → SINE).
  let leftSubcat: string | null = null
  let rightSubcat: string | null = null

  for (let r = 0; r < sheet.cellData.length; r++) {
    const row = sheet.cellData[r]
    const cellA = (row[0] ?? '').trim()
    const cellI = (row[8] ?? '').trim()

    // Détection d'en-tête de section PAR BLOC.
    const leftHeader = detectSubcategory(cellA)
    const rightHeader = detectSubcategory(cellI)
    if (leftHeader) leftSubcat = leftHeader
    if (rightHeader) rightSubcat = rightHeader

    // Affinage du régime SINE (ancien/nouveau) depuis les lignes de condition,
    // pour que CA/1-CA/2 (ancien) ne soient pas confondus avec CA/# (nouveau).
    const regime = detectRegime(cellA)
    if (regime && leftSubcat && /^sine/i.test(leftSubcat)) {
      leftSubcat = `SINE (${regime} régime)`
    }

    // Bloc gauche : code A / montant B — seulement si A ne porte pas un en-tête.
    if (!leftHeader) {
      addAmountIfValid({
        code: cellA,
        amountCell: row[1] ?? '',
        amountColIndex: 1,
        codeColumnLabel: 'gauche (col A)',
        subcategory: leftSubcat,
        sheet,
        validFrom: options.validFrom,
        row: r,
        amounts,
        ignoredRows,
        seenKeys,
      })
    }

    // Bloc droit : code I / montant J — seulement si I ne porte pas un en-tête.
    if (!rightHeader) {
      addAmountIfValid({
        code: cellI,
        amountCell: row[9] ?? '',
        amountColIndex: 9,
        codeColumnLabel: 'droite (col I)',
        subcategory: rightSubcat,
        sheet,
        validFrom: options.validFrom,
        row: r,
        amounts,
        ignoredRows,
        seenKeys,
      })
    }
  }

  if (amounts.length === 0) {
    alerts.push(
      makeIssue({
        severity: 'warning',
        kind: 'partial_sheet',
        title: "Aucun montant d'activation extrait",
        sheet: sheet.name,
        reason: 'Cette feuille contient beaucoup de formules complexes (ex: "500,00 X U/[Sx4]") que le parser ne convertit pas en montants purs.',
        recommendation: 'Vérifier la grille brute dans le Diagnostic ; les formules sont conservées en rawData.',
      })
    )
  }

  return { amounts, alerts, ignoredRows, unknownCodes: [] }
}

interface AddAmountInput {
  code: string
  amountCell: string
  amountColIndex: number
  codeColumnLabel: string
  subcategory: string | null
  sheet: ParsedSheet
  validFrom: Date | null
  row: number
  amounts: BaremeAmountDraft[]
  ignoredRows: BaremeIgnoredRow[]
  seenKeys: Set<string>
}

function addAmountIfValid(input: AddAmountInput) {
  const codeRaw = input.code.trim()
  // Garder uniquement les codes qui ressemblent à des codes ONEM (lettres/chiffres/slash/points)
  if (!codeRaw || codeRaw.length < 2 || codeRaw.length > 30) return
  if (!/^[A-Z]/i.test(codeRaw)) return // doit commencer par une lettre
  if (/[éèàùôîç]/i.test(codeRaw)) return // exclu si caractère accentué (probablement texte)
  if (codeRaw.split(' ').length > 4) return // trop long, c'est probablement une phrase

  const amountCell = input.amountCell.trim()
  if (!amountCell) return

  // Le montant à retenir est le montant mensuel MAXIMUM :
  //  1. nombre pur (ex: "433,81")
  //  2. plafond explicite d'une formule : "(max. 500,00)" → 500 (PAS le préfixe)
  //  3. à défaut, préfixe numérique de la formule (ex: "500,00 X U/[Sx4]")
  let amount: number | null = parseCellNumber(amountCell)
  let isFormula = false

  if (amount === null) {
    const maxMatch = amountCell.match(/max\.?\s*([\d.,]+)/i)
    if (maxMatch) {
      amount = parseCellNumber(maxMatch[1])
      isFormula = amount !== null
    }
  }
  if (amount === null) {
    const match = amountCell.match(/^(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?)/)
    if (match) {
      amount = parseCellNumber(match[1])
      isFormula = amount !== null
    }
  }

  if (amount === null) {
    // Code plausible mais aucun montant extractible : tracé (couverture inverse)
    // plutôt que perdu en silence.
    input.ignoredRows.push({
      sheet: input.sheet.name,
      rowIndex: input.row + 1,
      rawValues: [codeRaw.slice(0, 40), amountCell.slice(0, 40)],
      reason: `Code « ${codeRaw} » (${input.codeColumnLabel}) sans montant extractible depuis « ${amountCell.slice(0, 50)} ».`,
    })
    return
  }

  const subcat = input.subcategory ? normalizeKey(input.subcategory) : 'unknown'
  const codeKey = normalizeKey(codeRaw)
  const key = `activation:${subcat}:${codeKey}`
  if (input.seenKeys.has(key)) return

  const amountCellRef = cellRef(input.row, input.amountColIndex)
  // Tous les montants d'activation sont des montants mensuels MAXIMUM (en-tête
  // "maximum maandbedrag - montant mensuel maximum"). Les montants ACTIVA (formules
  // N × U/[Sx4]) sont en plus PRORATISÉS selon les heures prestées (38/38 → plein,
  // sinon moins) — confirmé par Oraliks. Un calculateur NE doit PAS les traiter
  // comme un montant fixe : amountKind='monthly_ceiling' + prorated.
  const labelFr = isFormula
    ? 'Montant mensuel maximum — proratisé selon les heures prestées'
    : 'Montant mensuel maximum'
  input.amounts.push({
    sourceSheet: input.sheet.name,
    category: 'activation',
    allocationCode: codeRaw,
    labelFr,
    amount,
    unit: 'monthly',
    validFrom: input.validFrom,
    comparisonKey: key,
    rawData: {
      subcategory: input.subcategory ?? undefined,
      isFormula,
      amountKind: 'monthly_ceiling',
      prorated: isFormula,
      prorationFormula: isFormula ? amountCell : undefined,
      originalCell: amountCell,
      row: input.row + 1,
    },
    status: isFormula ? 'warning' : 'valid',
    warnings: isFormula
      ? [`Montant mensuel MAXIMUM proratisé (heures prestées) — « ${amountCell.slice(0, 60)} ». Pas un montant fixe.`]
      : [],
    trace: {
      sourceCell: amountCellRef,
      sourceRowIndex: input.row + 1,
      sourceColumnIndex: input.amountColIndex + 1,
      rawValue: amountCell.slice(0, 80),
      normalizedValue: amount,
      mappingKey: codeRaw,
      mappingFile: null,
      transformTemplate: 'activation',
      transformReason:
        `Ce montant provient de la feuille ${input.sheet.name}, cellule ${amountCellRef}` +
        (input.subcategory ? `, section « ${input.subcategory} »` : '') +
        `. Le code « ${codeRaw} » a été lu dans la colonne ${input.codeColumnLabel}.` +
        (isFormula
          ? ` La cellule contient une formule (« ${amountCell.slice(0, 60)} ») : le montant mensuel maximum retenu est ${amount} (plafond « max. » s'il est présent, sinon préfixe) — à vérifier.`
          : ` Le montant mensuel ${amount} a été normalisé depuis la valeur brute « ${amountCell} ».`),
    },
  })
  input.seenKeys.add(key)
}

function detectSubcategory(cell: string): string | null {
  if (/^sine$/i.test(cell)) return 'SINE'
  if (/activa.*wallonie|activa.*wallon/i.test(cell)) return 'ACTIVA-WALLONIE'
  if (/activa.*brussel|activa.*bruxelles/i.test(cell)) return 'ACTIVA-BRUSSEL'
  return null
}

/**
 * Détecte la mention de régime SINE (ancien avant 2004 / nouveau dès 2004) portée
 * par une ligne de condition, pour distinguer CA/1-CA/2 (ancien) de CA/# (nouveau).
 */
function detectRegime(cell: string): 'ancien' | 'nouveau' | null {
  const lower = cell.toLowerCase()
  if (/oude regeling|ancien régime|vóór 2004|avant 2004/.test(lower)) return 'ancien'
  if (/nieuwe regeling|nouveau régime|vanaf 2004|à partir de.*2004/.test(lower)) return 'nouveau'
  return null
}

function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // translittère les accents (régime → regime)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}
