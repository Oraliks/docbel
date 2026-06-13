import type { BaremeAlert, BaremeAmountDraft, BaremeCategory } from './types'
import { makeIssue } from './types'

/**
 * Couche de vérification SÉMANTIQUE — la dimension absente du round-trip / des
 * contrats / de la couverture (qui prouvent présence + rattachement cellule mais
 * jamais la JUSTESSE valeur↔code↔échelle).
 *
 * Failles fermées (stress-test adversarial 2026-06-13) :
 *  - échange de colonnes / désalignement code↔colonne (le citoyen verrait la valeur
 *    d'un autre code) → SENTINELLES + ORDRE par tranche ;
 *  - valeur fausse mais plausible → BORNES de plausibilité + MONOTONIE ;
 *  - régression demi-allocation (half ≠ full/2) → COHÉRENCE INTER-FEUILLES.
 *
 * Indépendant de toute version précédente (protège même le 1er import), au
 * contraire du diff inter-versions.
 */

const SENTINEL_TOLERANCE = 0.15 // ±15 % : absorbe l'indexation, attrape les swaps

// Valeurs-ancres stables (montant journalier au salaire MIN), dérivées du barème
// 01/03/2026. Un montant extrait hors de ±15 % = code/colonne/échelle décalé.
// Référencées par comparisonKey EXACTE (incl. suffixe @N) — non ambigu même pour
// les codes en colonnes multiples (TW-CT/SpecCat).
interface Sentinel {
  comparisonKey: string
  value: number
}
const SENTINELS: Sentinel[] = [
  { comparisonKey: 'full_unemployment:AA1:MIN', value: 76.55 },
  { comparisonKey: 'full_unemployment:AA3:MIN', value: 69.59 },
  { comparisonKey: 'full_unemployment:NA1:MIN', value: 62.05 },
  { comparisonKey: 'full_unemployment:NA3:MIN', value: 56.4 },
  { comparisonKey: 'full_unemployment:BA1:MIN', value: 59.72 },
  { comparisonKey: 'full_unemployment:BA3:MIN', value: 50.11 },
  { comparisonKey: 'full_unemployment:BX:MIN', value: 41.54 },
  { comparisonKey: 'full_unemployment:BB:MIN', value: 29.27 },
  { comparisonKey: 'half_unemployment:AA1:MIN', value: 38.28 },
  { comparisonKey: 'half_unemployment:NA1:MIN', value: 31.03 },
  { comparisonKey: 'half_unemployment:BX:MIN', value: 20.77 },
  { comparisonKey: 'half_unemployment:BB:MIN', value: 14.64 },
  { comparisonKey: 'temporary_unemployment_full:A0H:MIN', value: 82.51 },
  { comparisonKey: 'temporary_unemployment_full:J/S:MIN', value: 55.37 },
  { comparisonKey: 'special_category_full:A6:MIN', value: 83.51 },
  { comparisonKey: 'special_category_full:A7:MIN', value: 69.59 },
  { comparisonKey: 'special_category_full:GB:MIN', value: 48.46 },
]

// Bornes de plausibilité du montant (par jour sauf activation = mensuel).
const PLAUSIBILITY: Partial<Record<BaremeCategory, { min: number; max: number; label: string }>> = {
  full_unemployment: { min: 18, max: 130, label: 'allocation journalière plein temps' },
  half_unemployment: { min: 9, max: 70, label: 'demi-allocation journalière' },
  temporary_unemployment_full: { min: 18, max: 130, label: 'chômage temporaire journalier' },
  special_category_full: { min: 12, max: 130, label: 'catégorie spéciale journalière' },
  hourly_wage: { min: 1, max: 80, label: 'salaire horaire' },
  salary_bracket: { min: 5, max: 350, label: 'tranche de salaire journalier' },
  activation: { min: 50, max: 2500, label: 'allocation d’activation mensuelle' },
}

// Ordres décroissants attendus (réglementaires) par tranche, pour full/half.
// Chef de ménage ≥ isolé ≥ cohabitant (phase 1) ; phases décroissantes par situation.
const ORDERINGS: { category: BaremeCategory; chains: string[][] }[] = [
  {
    category: 'full_unemployment',
    chains: [
      ['AA1', 'AA2', 'AA3'], ['NA1', 'NA2', 'NA3'], ['BA1', 'BA2', 'BA3'], ['BX', 'BB'],
      ['AA1', 'NA1', 'BA1'], ['AA2', 'NA2', 'BA2'], ['AA3', 'NA3', 'BA3'],
    ],
  },
  {
    category: 'half_unemployment',
    chains: [
      ['AA1', 'AA2', 'AA3'], ['NA1', 'NA2', 'NA3'], ['BA1', 'BA2', 'BA3'], ['BX', 'BB'],
      ['AA1', 'NA1', 'BA1'], ['AA3', 'NA3', 'BA3'],
    ],
  },
]

const RATIO_TOLERANCE = 0.012 // ±1.2 % sur half = full/2 (arrondis ONEM)
const MAX_REPORTED = 20

export interface InvariantsResult {
  alerts: BaremeAlert[]
  sentinelsChecked: number
  orderingViolations: number
  ratioViolations: number
  monotonyViolations: number
  plausibilityViolations: number
}

export function verifyInvariants(amounts: BaremeAmountDraft[]): InvariantsResult {
  const alerts: BaremeAlert[] = []

  // Index : category → code → salaryCode → amount
  const idx = new Map<string, Map<string, Map<string, number>>>()
  for (const a of amounts) {
    if (!a.allocationCode || !a.salaryCode) continue
    let byCode = idx.get(a.category)
    if (!byCode) { byCode = new Map(); idx.set(a.category, byCode) }
    let byTranche = byCode.get(a.allocationCode)
    if (!byTranche) { byTranche = new Map(); byCode.set(a.allocationCode, byTranche) }
    byTranche.set(a.salaryCode, a.amount)
  }
  // Index par comparisonKey exacte (désambiguïse les codes multi-colonnes).
  const byKey = new Map<string, number>()
  for (const a of amounts) if (a.allocationCode && a.salaryCode) byKey.set(a.comparisonKey, a.amount)

  // 1) SENTINELLES
  let sentinelsChecked = 0
  for (const s of SENTINELS) {
    const v = byKey.get(s.comparisonKey)
    if (v === undefined) continue // l'absence est gérée par les contrats
    sentinelsChecked++
    const lo = s.value * (1 - SENTINEL_TOLERANCE)
    const hi = s.value * (1 + SENTINEL_TOLERANCE)
    if (v < lo || v > hi) {
      alerts.push(
        makeIssue({
          severity: 'error',
          kind: 'anomaly',
          title: 'Valeur-sentinelle hors fourchette (code↔colonne ?)',
          sheet: s.comparisonKey.split(':')[0],
          reason: `${s.comparisonKey} = ${v}, attendu ~${s.value} (±15 % : [${lo.toFixed(2)}, ${hi.toFixed(2)}]). Une valeur aussi éloignée signale un échange de colonnes, un désalignement code↔colonne ou une mauvaise échelle.`,
          recommendation: 'Vérifier que la colonne du code correspond bien à son en-tête dans la grille brute. Si le barème a réellement bougé de >15 %, mettre à jour la sentinelle.',
        })
      )
    }
  }

  // 2) ORDRES par tranche
  let orderingViolations = 0
  for (const { category, chains } of ORDERINGS) {
    const byCode = idx.get(category)
    if (!byCode) continue
    const tranches = collectTranches(byCode)
    for (const t of tranches) {
      for (const chain of chains) {
        for (let i = 0; i + 1 < chain.length; i++) {
          const a = byCode.get(chain[i])?.get(t)
          const b = byCode.get(chain[i + 1])?.get(t)
          if (a === undefined || b === undefined) continue
          // tolérance d'un centime pour l'égalité
          if (a + 0.011 < b) {
            orderingViolations++
            if (alerts.length < MAX_REPORTED + 40) {
              alerts.push(
                makeIssue({
                  severity: 'error',
                  kind: 'anomaly',
                  title: 'Ordre de montants violé (colonnes échangées ?)',
                  sheet: category,
                  reason: `À la tranche ${t}, ${chain[i]} (${a}) < ${chain[i + 1]} (${b}), or l'ordre réglementaire attendu est ${chain.join(' ≥ ')}. Deux colonnes sont probablement échangées ou mal étiquetées.`,
                  recommendation: 'Vérifier l’alignement code↔colonne dans la grille brute.',
                })
              )
            }
          }
        }
      }
    }
  }

  // 3) COHÉRENCE half = full/2
  let ratioViolations = 0
  const full = idx.get('full_unemployment')
  const half = idx.get('half_unemployment')
  if (full && half) {
    for (const [code, tranches] of full) {
      const halfCode = half.get(code)
      if (!halfCode) continue
      for (const [t, fv] of tranches) {
        const hv = halfCode.get(t)
        if (hv === undefined || fv === 0) continue
        const expected = fv / 2
        if (Math.abs(hv - expected) > Math.max(0.02, expected * RATIO_TOLERANCE)) {
          ratioViolations++
          if (ratioViolations <= MAX_REPORTED) {
            alerts.push(
              makeIssue({
                severity: 'warning',
                kind: 'anomaly',
                title: 'Demi-allocation ≠ plein/2',
                sheet: 'half_unemployment',
                reason: `${code}/${t} : demi = ${hv}, attendu ${expected.toFixed(2)} (= plein ${fv} / 2). Régression de l'arithmétique demi-temps ou cellule ONEM non divisée.`,
                recommendation: 'Vérifier la feuille A_N_B_half_demi : les montants doivent valoir la moitié du plein.',
              })
            )
          }
        }
      }
    }
  }

  // 4) MONOTONIE (montant croissant au sens large sur les tranches numériques)
  let monotonyViolations = 0
  for (const [category, byCode] of idx) {
    if (!isMatrixCategory(category)) continue
    for (const [code, byTranche] of byCode) {
      const nums = [...byTranche.keys()].filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b)
      let prev = -Infinity
      let prevT = 0
      for (const n of nums) {
        const v = byTranche.get(String(n))!
        if (v + 0.011 < prev) {
          monotonyViolations++
          if (monotonyViolations <= MAX_REPORTED) {
            alerts.push(
              makeIssue({
                severity: 'warning',
                kind: 'anomaly',
                title: 'Montant décroissant entre tranches',
                sheet: category,
                reason: `${code} : la tranche ${n} (${v}) est inférieure à la tranche ${prevT} (${prev}). Les montants doivent croître avec le salaire — colonne transposée ou ligne permutée ?`,
                recommendation: 'Vérifier l’ordre des lignes/colonnes dans la grille brute.',
              })
            )
          }
        }
        prev = v
        prevT = n
      }
    }
  }

  // 5) BORNES de plausibilité
  let plausibilityViolations = 0
  const reportedBounds = new Set<string>()
  for (const a of amounts) {
    const b = PLAUSIBILITY[a.category]
    if (!b || a.amount === 0) continue
    if (a.amount < b.min || a.amount > b.max) {
      plausibilityViolations++
      const k = `${a.category}:${a.allocationCode}`
      if (!reportedBounds.has(k) && reportedBounds.size < MAX_REPORTED) {
        reportedBounds.add(k)
        alerts.push(
          makeIssue({
            severity: 'warning',
            kind: 'anomaly',
            title: 'Montant hors bornes de plausibilité',
            sheet: a.category,
            cell: a.trace?.sourceCell,
            reason: `${a.comparisonKey} = ${a.amount}, hors de la fourchette plausible [${b.min}, ${b.max}] pour « ${b.label} ». Valeur fausse, mauvaise unité ou mauvaise échelle ?`,
            recommendation: 'Vérifier la cellule source ; ajuster les bornes si le barème a réellement évolué.',
          })
        )
      }
    }
  }

  return {
    alerts,
    sentinelsChecked,
    orderingViolations,
    ratioViolations,
    monotonyViolations,
    plausibilityViolations,
  }
}

function collectTranches(byCode: Map<string, Map<string, number>>): string[] {
  const set = new Set<string>()
  for (const tranches of byCode.values()) for (const t of tranches.keys()) set.add(t)
  return [...set]
}

function isMatrixCategory(category: string): boolean {
  return (
    category === 'full_unemployment' ||
    category === 'half_unemployment' ||
    category === 'temporary_unemployment_full' ||
    category === 'special_category_full'
  )
}
