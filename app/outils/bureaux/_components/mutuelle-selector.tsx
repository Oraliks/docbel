'use client'

import { useTranslations } from 'next-intl'
import { HeartPulse } from 'lucide-react'
import { GLASS_INPUT, GLASS_LABEL } from '@/lib/glass-classes'

/**
 * Mutuelles dont le réseau d'offices est correctement référencé en base
 * (résolvables par code postal via `?mutuelle=<code>` → office attitré). MC
 * (Mutualité chrétienne) est volontairement ABSENTE de cette liste : ses
 * agences locales ne sont pas encore dans notre annuaire (INAMI ne publie que
 * son siège national), donc on ne route pas vers un bureau erroné — l'orches-
 * trateur affiche à la place un renvoi honnête vers le localisateur mc.be.
 */
export const ROUTABLE_MUTUELLES = ['solidaris', 'neutrales', 'mutlibres', 'caami', 'mloz', 'hr-rail'] as const
export const MC_CODE = 'mc'
/** Toutes les valeurs sélectionnables (MC comprise, gérée à part). */
export const MUTUELLE_CODES = [...ROUTABLE_MUTUELLES, MC_CODE] as const

// Libellés = noms propres (marques) → identiques dans toutes les langues, pas
// d'i18n. Seuls le label du champ et l'option « toutes » passent par next-intl.
const MUTUELLE_LABELS: Record<string, string> = {
  solidaris: 'Solidaris (mutualité socialiste)',
  neutrales: 'Mutualités Neutres',
  mutlibres: 'Mutualité Libérale',
  caami: 'CAAMI (caisse auxiliaire publique)',
  mloz: 'Mutualités Libres (Partenamut, Helan…)',
  'hr-rail': 'HR Rail (personnel des chemins de fer)',
  mc: 'Mutualité chrétienne (MC / CM)',
}

export function mutuelleLabel(code: string): string {
  return MUTUELLE_LABELS[code] ?? code
}

interface Props {
  /** Code mutuelle sélectionné (`''` = toutes / je ne sais pas). */
  value: string
  onChange: (code: string) => void
}

/**
 * Sélecteur « Votre mutuelle » — affiché uniquement en démarche « santé ».
 * Un `<select>` natif (robuste, accessible, sans piège de sentinelle base-ui)
 * sous le verre mauve. Choisir une mutuelle résout son office attitré ; MC
 * déclenche côté parent un renvoi vers mc.be (données locales insuffisantes).
 */
export function MutuelleSelector({ value, onChange }: Props) {
  // Cast idiome partagé (cf. bureaux-finder.tsx) : clés statiques ici, mais on
  // garde le même type que les autres enfants de l'orchestrateur.
  const t = useTranslations('public.outils') as (key: string) => string
  return (
    <div className="space-y-2">
      <label htmlFor="mutuelle-select" className={GLASS_LABEL}>
        {t('mutuelleSelectLabel')}
      </label>
      <div
        className={`${GLASS_INPUT} flex h-12 items-center gap-2.5 border px-3.5 focus-within:ring-2 focus-within:ring-[color:var(--primary)]`}
      >
        <HeartPulse className="w-[18px] h-[18px] shrink-0" style={{ color: 'var(--primary)' }} aria-hidden="true" />
        <select
          id="mutuelle-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer bg-transparent text-sm font-medium text-[color:var(--glass-ink)] focus:outline-none"
        >
          <option value="">{t('mutuelleSelectAll')}</option>
          {MUTUELLE_CODES.map((c) => (
            <option key={c} value={c}>
              {mutuelleLabel(c)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
