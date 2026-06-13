import type { ParsedSheet } from '@/lib/baremes-parser'
import type { BaremeAlert, BaremeAmountDraft, BaremeCategory } from './types'
import { makeIssue } from './types'

/**
 * Contrat de structure d'une feuille ONEM connue.
 *
 * But : détecter au prochain import trimestriel une dérive de structure (feuille
 * renommée/disparue, catégorie ré-routée, perte/excès de montants, code-clé
 * disparu) AVANT qu'elle ne corrompe silencieusement les données. Les valeurs
 * sont ancrées sur l'exécution réelle du parser (parse propre du fichier courant).
 *
 * Philosophie : informatif jamais bloquant SAUF effondrement (feuille absente,
 * 0 montant, perte massive). Un simple écart de compte = revue admin (peut être
 * une vraie évolution du barème ONEM, pas forcément un bug).
 */
export interface SheetContract {
  /** Nom canonique (comparé en trimmé — l'onglet "W " a un espace final). */
  sheetName: string
  category: BaremeCategory
  /** Montants attendus (parse propre courant). Écart → revue. */
  expectedCount: number
  /** Plancher dur : en-dessous = perte massive probable (erreur bloquante). */
  minCount: number
  /**
   * Codes (allocation ou tranche) qui DOIVENT rester présents — ancres stables.
   * Un code requis absent = dérive structurelle (warning), même si le compte total
   * est masqué par une compensation ailleurs.
   */
  requiredCodes?: string[]
  notes?: string
}

// floor(expected × 0.6) : feuilles irrégulières (tolère une évolution ONEM modérée).
const floor = (n: number) => Math.max(1, Math.floor(n * 0.6))
// floor(expected × 0.95) : matrices rigides (codes × tranches) — une perte > 5 %
// (typiquement une colonne d'allocation entière) devient une ERREUR bloquante.
const denseFloor = (n: number) => Math.floor(n * 0.95)

export const BAREME_CONTRACTS: SheetContract[] = [
  {
    sheetName: 'A_N_B_vol_plein',
    category: 'full_unemployment',
    expectedCount: 1500,
    minCount: denseFloor(1500),
    requiredCodes: ['AA1', 'AA2', 'AA3', 'AB', 'AX', 'NA1', 'NA2', 'NA3', 'NB', 'NX', 'BA1', 'BA2', 'BA3', 'BX', 'BB'],
    notes: '15 codes × (MIN + tranches 1..99). Colonne AFoud = #REF! (0 montant attendu).',
  },
  {
    sheetName: 'A_N_B_half_demi',
    category: 'half_unemployment',
    expectedCount: 1501,
    minCount: denseFloor(1501),
    requiredCodes: ['AA1', 'AA2', 'AA3', 'AB', 'AX', 'NA1', 'NA2', 'NA3', 'NB', 'NX', 'BA1', 'BA2', 'BA3', 'BX', 'BB'],
    notes: '= vol_plein/2. +1 vs plein : half:AFoud:MIN=0 (résidu colonne #REF!).',
  },
  {
    sheetName: 'TW-CT_JS',
    category: 'temporary_unemployment_full',
    expectedCount: 1000,
    minCount: denseFloor(1000),
    requiredCodes: ['A0 N0 B0', 'A0H', 'J/S'],
    notes: '3 codes de base, 10 colonnes (variantes plein/demi × taux 65/60) × 100 tranches.',
  },
  {
    sheetName: 'SpecCat',
    category: 'special_category_full',
    expectedCount: 1468,
    minCount: denseFloor(1468),
    requiredCodes: ['A6', 'A7', 'E', 'FA', 'FB', 'FN', 'GB', 'GN', 'AA', 'AN', 'AB'],
    notes: 'Codes empilés (E\\nFA, AN\\nAB) + colonnes SWT à 64 tranches.',
  },
  {
    sheetName: 'Loonschijven_Tranches salariale',
    category: 'salary_bracket',
    expectedCount: 99,
    minCount: denseFloor(99),
    requiredCodes: ['1', '28', '29', '98', '99'],
    notes: '2 échelles : gauche indexée (29-99), droite base (1-99). 1-28 converties ×ratio ; 99 = tranche ouverte.',
  },
  {
    sheetName: 'Uurlonen_Salaires horaires',
    category: 'hourly_wage',
    expectedCount: 781,
    minCount: denseFloor(781),
    requiredCodes: ['29', '99'],
    notes: '71 codes (29-99) × 11 régimes horaires (35-40 h). Dérivée de Loonschijven.',
  },
  {
    sheetName: 'W',
    category: 'allocation_w',
    expectedCount: 84,
    minCount: floor(84),
    requiredCodes: ['WA2', 'IA', 'TA', 'I', 'T', 'S'],
    notes: 'Onglet "W " (espace final). I/T/S = codes mono-lettre (régression possible de la regex).',
  },
  {
    sheetName: 'AndereBedrWLH_AutresMontCHOM',
    category: 'other_unemployment_amount',
    expectedCount: 63,
    minCount: floor(63),
    notes: 'Montants par article (pas de codes d\'allocation). Clés @N par article.',
  },
  {
    sheetName: 'Activering_Activation',
    category: 'activation',
    expectedCount: 14,
    minCount: 13,
    requiredCodes: ['G•/ ••WB1••', 'CA/ ••#••••', 'G•/ ••BA1••'],
    notes: '2 blocs côte à côte (SINE gauche, ACTIVA droite). WB1 + nouveau régime SINE étaient perdus.',
  },
  {
    sheetName: 'AndereUitk_AutresAlloc',
    category: 'other_allocation',
    expectedCount: 8,
    minCount: 8,
    requiredCodes: ['opvang', 'leefloon'],
    notes: 'Opvanguitkering + Leefloon. Section Wisselkoerstoeslag volontairement ignorée.',
  },
  {
    sheetName: 'Bonus',
    category: 'employment_bonus',
    expectedCount: 8,
    minCount: 8,
    requiredCodes: ['employee', 'worker'],
    notes: '4 tranches × employé/ouvrier. Coefficients de dégressivité (col I) non extraits.',
  },
  {
    sheetName: 'Basisbedragen',
    category: 'basic_amount',
    expectedCount: 75,
    minCount: floor(75),
    notes: 'Tableau principal col D (lignes 7-82). Tableau latéral d\'indexation non couvert.',
  },
]

export interface ContractResult {
  sheet: string
  present: boolean
  actualCount: number
  expectedCount: number
  status: 'ok' | 'deviation' | 'collapse' | 'absent' | 'category_mismatch' | 'missing_codes'
}

/**
 * Vérifie chaque feuille parsée contre son contrat. Retourne les alertes (graduées)
 * et un résultat par contrat.
 */
export function verifySheetContracts(
  sheets: ParsedSheet[],
  amounts: BaremeAmountDraft[]
): { alerts: BaremeAlert[]; results: ContractResult[] } {
  const alerts: BaremeAlert[] = []
  const results: ContractResult[] = []

  const norm = (s: string) => s.trim().toLowerCase()
  const sheetByName = new Map(sheets.map((s) => [norm(s.name), s]))

  // Compte + codes par feuille (trimmé)
  const countBySheet = new Map<string, number>()
  const codesBySheet = new Map<string, Set<string>>()
  for (const a of amounts) {
    const k = norm(a.sourceSheet)
    countBySheet.set(k, (countBySheet.get(k) ?? 0) + 1)
    let set = codesBySheet.get(k)
    if (!set) {
      set = new Set()
      codesBySheet.set(k, set)
    }
    if (a.allocationCode) set.add(a.allocationCode)
    if (a.salaryCode) set.add(a.salaryCode)
  }

  for (const contract of BAREME_CONTRACTS) {
    const key = norm(contract.sheetName)
    const sheet = sheetByName.get(key)
    const actualCount = countBySheet.get(key) ?? 0

    // 1) Feuille attendue absente
    if (!sheet) {
      results.push({ sheet: contract.sheetName, present: false, actualCount: 0, expectedCount: contract.expectedCount, status: 'absent' })
      alerts.push(
        makeIssue({
          severity: 'error',
          kind: 'partial_sheet',
          title: 'Feuille attendue absente',
          sheet: contract.sheetName,
          reason: `La feuille « ${contract.sheetName} » (catégorie ${contract.category}, ~${contract.expectedCount} montants) est attendue mais introuvable dans le classeur. Renommée par l'ONEM ou structure du fichier modifiée ?`,
          recommendation: 'Vérifier le nom des onglets ; mettre à jour le contrat ou le mapping de feuille si renommage volontaire.',
        })
      )
      continue
    }

    // 2) Catégorie ré-routée (comparaison sur la catégorie des montants extraits)
    const extractedCat = amounts.find((a) => norm(a.sourceSheet) === key)?.category
    if (extractedCat && extractedCat !== contract.category) {
      results.push({ sheet: contract.sheetName, present: true, actualCount, expectedCount: contract.expectedCount, status: 'category_mismatch' })
      alerts.push(
        makeIssue({
          severity: 'error',
          kind: 'anomaly',
          title: 'Catégorie de feuille inattendue',
          sheet: contract.sheetName,
          reason: `La feuille « ${contract.sheetName} » devrait produire des montants de catégorie ${contract.category} mais produit ${extractedCat}. Mapping de parser incorrect ?`,
          recommendation: 'Vérifier sheet-templates.ts / le mapping de cette feuille.',
        })
      )
      continue
    }

    // 3) Compte
    if (actualCount === 0) {
      results.push({ sheet: contract.sheetName, present: true, actualCount, expectedCount: contract.expectedCount, status: 'collapse' })
      alerts.push(
        makeIssue({
          severity: 'error',
          kind: 'partial_sheet',
          title: 'Feuille présente mais aucun montant extrait',
          sheet: contract.sheetName,
          reason: `La feuille « ${contract.sheetName} » est présente mais 0 montant en a été extrait (attendu ~${contract.expectedCount}). Le parser ne reconnaît plus sa structure.`,
          recommendation: 'Vérifier la grille brute dans le Diagnostic ; la mise en page de cette feuille a probablement changé.',
        })
      )
      continue
    }
    if (actualCount < contract.minCount) {
      results.push({ sheet: contract.sheetName, present: true, actualCount, expectedCount: contract.expectedCount, status: 'collapse' })
      alerts.push(
        makeIssue({
          severity: 'error',
          kind: 'anomaly',
          title: 'Perte massive de montants',
          sheet: contract.sheetName,
          reason: `Seulement ${actualCount} montants extraits de « ${contract.sheetName} », bien en dessous du plancher ${contract.minCount} (attendu ${contract.expectedCount}). Perte probable.`,
          recommendation: 'Comparer à la grille brute ; un changement de structure a fait sauter une partie des données.',
        })
      )
      continue
    }

    let status: ContractResult['status'] = 'ok'

    if (actualCount !== contract.expectedCount) {
      status = 'deviation'
      const delta = actualCount - contract.expectedCount
      alerts.push(
        makeIssue({
          severity: 'warning',
          kind: 'anomaly',
          title: 'Compte de montants modifié',
          sheet: contract.sheetName,
          reason: `${actualCount} montants extraits de « ${contract.sheetName} », le contrat en attendait ${contract.expectedCount} (${delta > 0 ? '+' : ''}${delta}). Soit une évolution du barème ONEM, soit une perte/un excès parser.`,
          recommendation: `Vérifier la cause. Si c'est une évolution légitime du barème, mettre à jour expectedCount dans sheetContracts.ts.`,
        })
      )
    }

    // 4) Codes requis
    if (contract.requiredCodes?.length) {
      const present = codesBySheet.get(key) ?? new Set()
      const missing = contract.requiredCodes.filter((c) => !present.has(c))
      if (missing.length) {
        if (status === 'ok') status = 'missing_codes'
        alerts.push(
          makeIssue({
            severity: 'warning',
            kind: 'partial_sheet',
            title: 'Code-clé attendu absent',
            sheet: contract.sheetName,
            reason: `Le(s) code(s) « ${missing.join('», «')} » sont attendus dans « ${contract.sheetName} » mais absents des montants extraits. Dérive structurelle ou régression du parser.`,
            recommendation: 'Vérifier la grille brute : ces codes existent-ils encore ? Le parser les capture-t-il ?',
          })
        )
      }
    }

    results.push({ sheet: contract.sheetName, present: true, actualCount, expectedCount: contract.expectedCount, status })
  }

  return { alerts, results }
}
