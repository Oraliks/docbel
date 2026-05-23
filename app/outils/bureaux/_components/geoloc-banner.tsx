'use client'

import { useState, useEffect } from 'react'
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
    const place =
      located.city && located.postcode
        ? `${located.city} (${located.postcode})`
        : located.postcode
          ? located.postcode
          : null
    return (
      <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50/60 dark:bg-green-950/20 border border-green-200/60 rounded-md px-3 py-1.5">
        <Check className="w-3.5 h-3.5 shrink-0" />
        <span>
          {place ? (
            <>
              Position détectée : <strong>{place}</strong>. La recherche est
              lancée.
            </>
          ) : (
            'Position activée — distances calculées depuis chez toi.'
          )}
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
    // La geoloc nécessite HTTPS (sauf localhost). Si on est sur du HTTP non
    // local, on prévient avant de tenter — sinon l'utilisateur a juste
    // "Échec" sans comprendre pourquoi.
    const isSecure =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1')
    if (!isSecure) {
      setError(
        'La géolocalisation nécessite une connexion sécurisée (HTTPS). Sur un domaine HTTP, le navigateur la bloque.'
      )
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
          setError(
            "Permission refusée. Pour réessayer : icône cadenas dans la barre d'adresse → Paramètres du site → Localisation = Autoriser."
          )
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError(
            'Position indisponible (GPS/WiFi désactivés ?). Réessaye dans un instant.'
          )
        } else if (err.code === err.TIMEOUT) {
          setError('Temps dépassé. Réessaye — ton GPS prend peut-être du temps à fixer.')
        } else {
          setError(`Échec de la géoloc (code ${err.code}): ${err.message ?? 'inconnu'}.`)
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
 * Reverse geocode via Nominatim : lat/lng → adresse belge structurée.
 * Renvoie le code postal + la ville si trouvable, ou null sinon.
 *
 * Nominatim est gratuit, sans clé, mais demande un User-Agent et un usage
 * raisonnable (1 req/s côté server, dans le browser pas de limite stricte
 * mais on évite le spam). Pour notre cas (1 reverse par activation géoloc),
 * c'est largement OK.
 */
export async function reverseGeocodeBE(
  lat: number,
  lng: number
): Promise<{ postcode: string; city: string } | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('format', 'json')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('zoom', '14') // niveau commune/quartier
    const r = await fetch(url.toString(), {
      headers: { 'Accept-Language': 'fr' },
    })
    if (!r.ok) return null
    const data = (await r.json()) as {
      address?: {
        postcode?: string
        city?: string
        town?: string
        village?: string
        suburb?: string
        municipality?: string
      }
    }
    const a = data.address ?? {}
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
