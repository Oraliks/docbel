/**
 * Décodeur d'anatomie pour les codes structurés ONEM (signalétique chômage,
 * S-flows, codes postaux). Décompose un code en segments lisibles, sans
 * remplacer la lookup en base — c'est un complément pédagogique.
 *
 * Source : nomenclature partagée par l'utilisateur (chômage complet, ligne de
 * barème, situation familiale A/N/B, phases A1-A3 / 2ème période B/X).
 */

import { MODULES } from './modules'

export interface CodeAnatomyPart {
  /** Étiquette de la section (ex: "Type", "Ligne", "Situation familiale"). */
  label: string
  /** Le fragment de code (ex: "01", "43", "A", "A1"). */
  value: string
  /** Description courte. `null` quand on n'a pas (encore) de mapping fiable. */
  description: string | null
}

export type CodeAnatomyKind =
  | 'signaletic-compensation'
  | 's-flow'
  | 'postal'
  | 'sanction'
  | 'unknown'

export interface CodeAnatomy {
  raw: string
  kind: CodeAnatomyKind
  /** Famille de tables suggérée pour pré-filtrer (slugs). */
  suggestedTables: string[]
  parts: CodeAnatomyPart[]
  /** Si possible, message qui résume l'intention du code en une phrase. */
  summary?: string
}

// ─── Mappings ──────────────────────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
  '01': 'Chômage complet',
  '02': 'Chômage temporaire',
}

// Situations familiales : laissées sans description pour ne pas véhiculer
// d'info incertaine. La table SignaleticCompensationArticle en DB donne la
// description complète quand on a un code complet.
const SITUATION_MAP: Record<string, string> = {
  A: 'Catégorie A',
  N: 'Catégorie N',
  B: 'Catégorie B',
}

const PHASE_MAP: Record<string, string> = {
  A1: '1ère période — phase 1',
  A2: '1ère période — phase 2',
  A3: '1ère période — phase 3 (forfait)',
  B: '2ème période (et dernière)',
  X: '2ème période — cohabitant privilégié',
}

// Description courte pour chaque S-flow ONEM. On délègue à MODULES (single
// source of truth) pour éviter la double maintenance lors de l'ajout d'un
// nouveau module.
const SFLOW_MAP: Record<string, string> = Object.fromEntries(
  MODULES.filter((m) => /^S\d{2}$/.test(m.prefix)).map((m) => [
    m.prefix.slice(1),
    m.description,
  ])
)

// ─── Parsing ────────────────────────────────────────────────────────────────

/**
 * Tente de reconnaître la structure d'un code ONEM. Retourne `null` si le
 * code ne ressemble à rien de connu (la recherche libre prend alors le relais).
 */
export function parseOnemCode(raw: string): CodeAnatomy | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // On normalise une seule fois pour tolérer toutes les variations de séparateurs :
  //   01/43AA1, 01-43AA1, 01 43 A A1, 0143AA1, 01/43A/A1, 01.43.AA1, S 04, 1 000…
  // → en majuscules, sans caractères non-alphanumériques.
  const normalized = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!normalized) return null

  // ─── Signalétique compensation ───
  // On essaie d'abord ligne à 2 chiffres (forme la plus fréquente : 42, 43, 44…),
  // puis 3 chiffres en fallback.
  const sigPatterns = [
    /^(0[12])(\d{2})([ANB])?([AB][1-3]?|X)?$/, // ligne 2 chiffres
    /^(0[12])(\d{3})([ANB])?([AB][1-3]?|X)?$/, // ligne 3 chiffres
  ]
  for (const re of sigPatterns) {
    const m = re.exec(normalized)
    if (!m) continue
    const [, type, ligne, situation, phase] = m
    const parts: CodeAnatomyPart[] = [
      { label: 'Type', value: type, description: TYPE_MAP[type] ?? null },
      {
        label: 'Ligne',
        value: ligne,
        description: 'Numéro de ligne du barème (détermine le montant)',
      },
    ]
    if (situation) {
      parts.push({
        label: 'Situation familiale',
        value: situation,
        description: SITUATION_MAP[situation] ?? null,
      })
    }
    if (phase) {
      parts.push({
        label: 'Phase / Période',
        value: phase,
        description: PHASE_MAP[phase] ?? null,
      })
    }
    return {
      raw: trimmed,
      kind: 'signaletic-compensation',
      suggestedTables: [
        'signaletic-compensation-article',
        'signaletic-special-compensation-article',
        'signaletic-compensation-article-s29',
      ],
      parts,
      summary:
        `Article d'indemnisation chômage — ${TYPE_MAP[type] ?? 'type ' + type}, ligne ${ligne}` +
        (phase ? `, ${PHASE_MAP[phase] ?? 'phase ' + phase}` : ''),
    }
  }

  // ─── S-flow : S04, S31, S52 — tolère séparateurs (S 04, s-04, S/04, s.04) ───
  const sflow = /^S(\d{2})$/.exec(normalized)
  if (sflow) {
    const num = sflow[1]
    return {
      raw: trimmed,
      kind: 's-flow',
      suggestedTables: [],
      parts: [
        {
          label: 'Flux',
          value: `S${num}`,
          description: SFLOW_MAP[num] ?? null,
        },
      ],
      summary: SFLOW_MAP[num]
        ? `Flux ONEM S${num} — ${SFLOW_MAP[num]}`
        : `Flux ONEM S${num}`,
    }
  }

  // ─── Code postal belge : 4 chiffres (1000-9999) — tolère "1 000", "1.000" ───
  const postal = /^(\d{4})$/.exec(normalized)
  if (postal) {
    const num = parseInt(postal[1], 10)
    if (num >= 1000 && num <= 9999) {
      return {
        raw: trimmed,
        kind: 'postal',
        suggestedTables: ['localite', 'parametres-onem-cp', 'parametres-onem-localite'],
        parts: [
          {
            label: 'Code postal',
            value: postal[1],
            description: postalRegion(num),
          },
        ],
        summary: `Code postal belge ${postal[1]} (${postalRegion(num)})`,
      }
    }
  }

  // ─── Sanction (article) : 51-52-53-54 + variantes ───
  // Pas de pattern strict, juste un indice pour orienter la recherche.

  return null
}

/**
 * Heuristique très grossière pour la région d'un code postal belge.
 * Sert juste à donner un peu de contexte dans l'anatomy panel.
 */
function postalRegion(cp: number): string {
  if (cp >= 1000 && cp <= 1299) return 'Bruxelles-Capitale'
  if (cp >= 1300 && cp <= 1499) return 'Brabant wallon'
  if (cp >= 1500 && cp <= 1999) return 'Brabant flamand'
  if (cp >= 2000 && cp <= 2999) return 'Anvers'
  if (cp >= 3000 && cp <= 3499) return 'Brabant flamand / Louvain'
  if (cp >= 3500 && cp <= 3999) return 'Limbourg'
  if (cp >= 4000 && cp <= 4999) return 'Liège'
  if (cp >= 5000 && cp <= 5999) return 'Namur'
  if (cp >= 6000 && cp <= 6599) return 'Hainaut (Charleroi)'
  if (cp >= 6600 && cp <= 6999) return 'Luxembourg'
  if (cp >= 7000 && cp <= 7999) return 'Hainaut (Mons / Tournai)'
  if (cp >= 8000 && cp <= 8999) return 'Flandre occidentale'
  if (cp >= 9000 && cp <= 9999) return 'Flandre orientale'
  return 'Belgique'
}
