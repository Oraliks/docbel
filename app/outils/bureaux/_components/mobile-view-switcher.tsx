// app/outils/bureaux/_components/mobile-view-switcher.tsx
'use client'

import { useTranslations } from 'next-intl'
import { List, Map as MapIcon } from 'lucide-react'

export type MobileView = 'liste' | 'carte'

interface Props {
  view: MobileView
  onChange: (v: MobileView) => void
  resultCount: number
}

const SEGMENT_BASE =
  'flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]'
const SEGMENT_ACTIVE = 'bg-[color:var(--primary)] text-white'
const SEGMENT_INACTIVE = 'text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]'

/**
 * Toggle Liste/Carte du layout mobile (`<lg`) : sur petit écran le finder
 * montre soit la liste soit la carte, jamais les deux empilées — l'orches-
 * trateur (`bureaux-finder.tsx`) enveloppe ce composant en `lg:hidden` et
 * monte l'un ou l'autre selon `view`. Présentational pur : la vue active et
 * le callback de bascule restent côté parent.
 */
export function MobileViewSwitcher({ view, onChange, resultCount }: Props) {
  const t = useTranslations('public.outils')

  return (
    <div
      role="tablist"
      className="inline-flex w-full items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === 'liste'}
        onClick={() => onChange('liste')}
        className={`${SEGMENT_BASE} ${view === 'liste' ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
      >
        <List className="w-4 h-4" />
        <span>{t('viewList')}</span>
        <span className="opacity-70">{resultCount}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'carte'}
        onClick={() => onChange('carte')}
        className={`${SEGMENT_BASE} ${view === 'carte' ? SEGMENT_ACTIVE : SEGMENT_INACTIVE}`}
      >
        <MapIcon className="w-4 h-4" />
        <span>{t('viewMap')}</span>
      </button>
    </div>
  )
}
