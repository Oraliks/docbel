'use client'

import { useTranslations } from 'next-intl'
import { getCountryIso2 } from '@/lib/lookup/countryFlag'

export function FlagPrefix({ tableSlug, label }: { tableSlug: string; label: string }) {
  const t = useTranslations('public.lookupLib')
  if (tableSlug !== 'nationalite') return null
  const iso2 = getCountryIso2(label)
  if (!iso2) return null
  return (
    <span
      className={`fi fi-${iso2.toLowerCase()} mr-1.5 rounded-sm shadow-sm`}
      style={{
        width: '1.25em',
        height: '0.9375em',
        display: 'inline-block',
        verticalAlign: '-2px',
      }}
      title={`${iso2} — ${label}`}
      aria-label={t('flagAriaLabel', { iso2 })}
    />
  )
}
