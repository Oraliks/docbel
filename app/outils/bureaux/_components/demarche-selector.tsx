// app/outils/bureaux/_components/demarche-selector.tsx
'use client'

import { useTranslations } from 'next-intl'
import { DEMARCHE_ORDER, DEMARCHE_META, type Demarche } from '@/lib/bureaus/demarche-map'
import { GLASS_LABEL } from '@/lib/glass-classes'
import { TypeIcon } from './type-icon'

interface Props {
  value: Demarche | null
  onChange: (d: Demarche) => void
}

/**
 * Sélecteur de démarche — « Que souhaitez-vous faire ? ». 5 cartes
 * compactes (chômage / aide sociale / documents communaux / emploi / je ne
 * sais pas) qui pilotent le filtrage `officeTypes` côté orchestrateur
 * (`demarcheToOfficeTypes`, lib/bureaus/demarche-map.ts). Présentational
 * pur : la démarche active et le callback de sélection restent côté parent.
 */
export function DemarcheSelector({ value, onChange }: Props) {
  // Cast (idiome déjà utilisé dans office-card.tsx / type-filter-chips.tsx) :
  // `DEMARCHE_META[d].labelKey` est un `string` dynamique (jamais un
  // littéral), le typage strict next-intl (`i18n/global.ts`) fait échouer
  // `tsc` sans ce cast.
  const t = useTranslations('public.outils') as (key: string) => string

  return (
    <div className="space-y-2">
      <h2 className={GLASS_LABEL}>{t('demarcheTitle')}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {DEMARCHE_ORDER.map((d) => {
          const meta = DEMARCHE_META[d]
          const selected = value === d
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange(d)}
              aria-pressed={selected}
              className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] ${
                selected
                  ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-white'
                  : 'border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] hover:bg-[color:var(--glass-surface-strong)]'
              }`}
            >
              <TypeIcon name={meta.icon} className="w-5 h-5" />
              <span className="text-xs font-semibold leading-tight">{t(meta.labelKey)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
