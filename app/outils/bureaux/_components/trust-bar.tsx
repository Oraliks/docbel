// app/outils/bureaux/_components/trust-bar.tsx
'use client'

import { useTranslations } from 'next-intl'
import { ShieldCheck, MapPinCheck, RefreshCw, Flag, type LucideIcon } from 'lucide-react'

/**
 * Barre de confiance horizontale (bas de page finder) : 4 repères
 * informatifs courts — source officielle, compétence territoriale,
 * fraîcheur des données, signalement — qui remplacent les 4 grandes cartes
 * `InfoBands`. Purement présentationnel, aucune interaction : chaque item
 * n'est qu'icône + titre + sous-texte (le signalement lui-même se fait
 * depuis la fiche bureau via `ReportForm`, pas ici).
 *
 * Desktop (`sm:` et +) : une seule rangée de 4, séparée par de fins filets
 * verticaux. Mobile : grille 2×2 (jamais un empilement vertical qui
 * allongerait démesurément la page) — les filets basculent en conséquence,
 * cf. `POSITION_BORDER`.
 */
export function TrustBar() {
  const t = useTranslations('public.outils')
  return (
    <div className="glass-surface grid grid-cols-2 rounded-2xl sm:grid-cols-4">
      <TrustItem
        icon={ShieldCheck}
        title={t('trustOfficialTitle')}
        body={t('trustOfficialBody')}
        position={0}
      />
      <TrustItem
        icon={MapPinCheck}
        title={t('trustTerritorialTitle')}
        body={t('trustTerritorialBody')}
        position={1}
      />
      <TrustItem
        icon={RefreshCw}
        title={t('trustUpdatesTitle')}
        body={t('trustUpdatesBody')}
        position={2}
      />
      <TrustItem
        icon={Flag}
        title={t('trustReportTitle')}
        body={t('trustReportBody')}
        position={3}
      />
    </div>
  )
}

// Filets internes selon la position (0..3) dans la grille :
// - mobile (2 colonnes) : filet à droite des items impairs (1,3) + filet en
//   haut de la 2e rangée (2,3).
// - `sm:`+ (1 rangée de 4) : filet à gauche de chaque item sauf le premier,
//   jamais de filet horizontal.
// La couleur (`border-[color:var(--glass-border)]`) est posée sur les 4 —
// no-op tant qu'aucune largeur de bordure n'est activée par cette entrée.
const POSITION_BORDER: readonly string[] = [
  '',
  'border-l',
  'border-t sm:border-t-0 sm:border-l',
  'border-l border-t sm:border-t-0',
]

function TrustItem({
  icon: Icon,
  title,
  body,
  position,
}: {
  icon: LucideIcon
  title: string
  body: string
  position: 0 | 1 | 2 | 3
}) {
  return (
    <div
      className={`flex flex-col gap-1 border-[color:var(--glass-border)] px-3.5 py-3 sm:px-4 ${POSITION_BORDER[position]}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="text-xs font-bold text-foreground">{title}</h3>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">{body}</p>
    </div>
  )
}
