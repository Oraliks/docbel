'use client'

import { useTranslations } from 'next-intl'
import { Loader2, LocateFixed, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { GLASS_INPUT, GLASS_LABEL } from '@/lib/glass-classes'

interface Props {
  value: string
  onChange: (v: string) => void
  onUseLocation: () => void
  locating?: boolean
}

/**
 * Champ « Adresse » (code postal, commune ou adresse libre) + bouton pleine
 * largeur « Utiliser ma position ». Présentational uniquement : la
 * résolution CP (4 chiffres) reste côté orchestrateur, tout comme l'appel
 * géoloc (`getCurrentPosition` + `reverseGeocodeBE` de `geoloc-banner.tsx`)
 * qui pilote `onUseLocation`/`locating`.
 */
export function AddressSearch({ value, onChange, onUseLocation, locating = false }: Props) {
  const t = useTranslations('public.outils')

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="office-address" className={GLASS_LABEL}>
          {t('bureauxAddressLabel')}
        </label>
        <div
          className={`${GLASS_INPUT} flex h-12 items-center gap-2.5 border px-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--primary)]`}
        >
          <MapPin
            className="w-[18px] h-[18px] shrink-0"
            style={{ color: 'var(--primary)' }}
            aria-hidden="true"
          />
          <Input
            id="office-address"
            inputMode="text"
            placeholder={t('bureauxAddressPlaceholder')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="border-0 px-0 h-auto bg-transparent shadow-none focus-visible:ring-0 text-sm font-medium"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onUseLocation}
        disabled={locating}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-sm font-bold text-[color:var(--glass-ink)] transition-colors hover:bg-[color:var(--glass-surface-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {locating ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <LocateFixed className="w-4 h-4" aria-hidden="true" />
        )}
        {t('bureauxUseLocation')}
      </button>
    </div>
  )
}
