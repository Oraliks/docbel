'use client'

import { useState, useEffect } from 'react'
import { MapPin, X, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'bureaux:geoloc:dismissed'

export interface UserGeoloc {
  lat: number
  lng: number
}

interface Props {
  onLocated: (geo: UserGeoloc) => void
  located: UserGeoloc | null
}

/**
 * Banner discret dismissible qui propose d'activer la géolocalisation pour
 * affiner les distances. Non-bloquant : si refusé/ignoré, le user a quand
 * même les bureaux compétents (juste distance centroïde commune).
 *
 * État dismissed sauvegardé en localStorage pour pas réafficher à chaque
 * visite.
 */
export function GeolocBanner({ onLocated, located }: Props) {
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
    return (
      <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50/60 dark:bg-green-950/20 border border-green-200/60 rounded-md px-3 py-1.5">
        <Check className="w-3.5 h-3.5 shrink-0" />
        <span>
          Position activée — les distances affichées sont calculées depuis
          ta position actuelle.
        </span>
      </div>
    )
  }

  if (dismissed) return null

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée par ton navigateur.')
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
          setError('Permission refusée. Tu peux activer la géoloc dans les réglages du navigateur.')
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Position indisponible — réessaye dans un instant.')
        } else {
          setError('Échec de la géoloc.')
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
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
          <strong>Active ta position</strong> pour des distances précises depuis
          chez toi.
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
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Localisation…
          </>
        ) : (
          'Activer'
        )}
      </Button>
      <button
        type="button"
        onClick={dismiss}
        title="Masquer"
        aria-label="Masquer la proposition de géolocalisation"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
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
