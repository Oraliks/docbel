import { getCountryIso2 } from '@/lib/lookup/countryFlag'

/**
 * Drapeau SVG (lib `flag-icons`) affiché en préfixe d'une nationalité ONEM.
 * No-op si la table n'est pas `nationalite` ou si le libellé ne matche pas un
 * pays connu — évite tout faux positif.
 */
export function FlagPrefix({ tableSlug, label }: { tableSlug: string; label: string }) {
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
      aria-label={`Drapeau ${iso2}`}
    />
  )
}
