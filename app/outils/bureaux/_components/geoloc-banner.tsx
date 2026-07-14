'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { MapPin, X, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'bureaux:geoloc:dismissed'

export interface UserGeoloc {
  lat: number
  lng: number
  /** Code postal résolu via reverse geocode (optionnel). */
  postcode?: string
  /** Ville résolue (town/city/village) via reverse geocode. */
  city?: string
}

interface Props {
  onLocated: (geo: UserGeoloc) => void
  located: UserGeoloc | null
  /** Permet à l'utilisateur de retirer sa position (bouton "Modifier"). */
  onClear?: () => void
}

/**
 * Banner discret dismissible qui propose d'activer la géolocalisation pour
 * affiner les distances. Non-bloquant : si refusé/ignoré, le user a quand
 * même les bureaux compétents (juste distance centroïde commune).
 *
 * État dismissed sauvegardé en localStorage pour pas réafficher à chaque
 * visite.
 */
export function GeolocBanner({ onLocated, located, onClear }: Props) {
  const t = useTranslations('public.outils')
  const [dismissed, setDismissed] = useState<boolean>(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Hydrate l'état dismissed depuis localStorage côté client
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      /* SSR-safe */
    }
  }, [])

  if (located) {
    const place =
      located.city && located.postcode
        ? `${located.city} (${located.postcode})`
        : located.postcode
          ? located.postcode
          : null
    return (
      <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50/60 dark:bg-green-950/20 border border-green-200/60 rounded-md px-3 py-1.5">
        <Check className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1">
          {place ? (
            t.rich('geolocActiveRich', { strong: (c) => <strong>{c}</strong> })
          ) : (
            t('geolocActivePlain')
          )}
        </span>
        {onClear && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 text-[11px] px-2 gap-1"
            onClick={onClear}
            title={t('geolocModifyTitle')}
          >
            <MapPin className="w-3 h-3" /> {t('geolocModify')}
          </Button>
        )}
      </div>
    )
  }

  if (dismissed) return null

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError(t('geolocErrUnsupported'))
      return
    }
    // La geoloc nécessite HTTPS (sauf localhost). Si on est sur du HTTP non
    // local, on prévient avant de tenter — sinon l'utilisateur a juste
    // "Échec" sans comprendre pourquoi.
    const isSecure =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1')
    if (!isSecure) {
      setError(t('geolocErrInsecure'))
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false)
        onLocated({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        setLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          setError(t('geolocErrDenied'))
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError(t('geolocErrUnavailable'))
        } else if (err.code === err.TIMEOUT) {
          setError(t('geolocErrTimeout'))
        } else {
          setError(
            t('geolocErrGeneric', {
              code: err.code,
              message: err.message ?? t('geolocErrUnknown'),
            })
          )
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    )
  }

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
      <MapPin className="w-4 h-4 shrink-0 text-primary" />
      <div className="flex-1 min-w-0">
        <p className="text-foreground">
          {t.rich('geolocPromptRich', { strong: (c) => <strong>{c}</strong> })}
        </p>
        {error && <p className="text-[10px] text-red-600 mt-0.5">{error}</p>}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={requestLocation}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t('geolocLocating')}
          </>
        ) : (
          t('geolocActivate')
        )}
      </Button>
      <button
        type="button"
        onClick={dismiss}
        title={t('geolocHideTitle')}
        aria-label={t('geolocHideAria')}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

/**
 * Reverse geocode BE : lat/lng → adresse belge structurée.
 * Renvoie le code postal + la ville si trouvable, ou null sinon.
 *
 * Passe par le proxy serveur `/api/geocode` (jamais d'appel direct à
 * Nominatim depuis le client — cf. contrainte §13) : celui-ci ajoute déjà le
 * User-Agent, le cache et le rate-limit nécessaires.
 */
export async function reverseGeocodeBE(
  lat: number,
  lng: number
): Promise<{ postcode: string; city: string } | null> {
  try {
    const r = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
    if (!r.ok) return null
    const json = (await r.json()) as {
      data?: {
        address?: {
          postcode?: string
          city?: string
          town?: string
          village?: string
          suburb?: string
          municipality?: string
        }
      }
    }
    const a = json.data?.address ?? {}
    const postcode = a.postcode
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? ''
    if (!postcode || !/^\d{4}$/.test(postcode)) return null
    return { postcode, city }
  } catch {
    return null
  }
}

/**
 * Haversine distance (km) entre deux points lat/lng.
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
