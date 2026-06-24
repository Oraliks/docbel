'use client'

import { useTranslations } from 'next-intl'
import { ShieldCheck, Database, RefreshCw, Flag } from 'lucide-react'

/**
 * 4 bandes d'info pédagogiques en bas de page : transparence sur la
 * méthodologie + invitation au signalement. Volontairement discrètes
 * (text-xs, icônes muted) pour pas voler l'attention des résultats.
 */
export function InfoBands() {
  const t = useTranslations('public.outils')
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
      <InfoBand
        icon={<ShieldCheck className="w-4 h-4" />}
        title={t('infoBandWhyTitle')}
        body={t('infoBandWhyBody')}
      />
      <InfoBand
        icon={<Database className="w-4 h-4" />}
        title={t('infoBandSourcesTitle')}
        body={t('infoBandSourcesBody')}
      />
      <InfoBand
        icon={<RefreshCw className="w-4 h-4" />}
        title={t('infoBandUpdatesTitle')}
        body={t('infoBandUpdatesBody')}
      />
      <InfoBand
        icon={<Flag className="w-3.5 h-3.5" />}
        title={t('infoBandReportTitle')}
        body={t('infoBandReportBody')}
      />
    </div>
  )
}

function InfoBand({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-xs font-semibold">{title}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{body}</p>
    </div>
  )
}
