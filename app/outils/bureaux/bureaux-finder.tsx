'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Building2,
  Loader2,
  MapPin,
  AlertCircle,
  Users,
  Wallet,
  Briefcase,
} from 'lucide-react'

import { BureauCard } from './_components/bureau-card'
import { OpTabsCard } from './_components/op-tabs-card'
import { CommunePanel } from './_components/commune-panel'
import {
  GeolocBanner,
  haversineKm,
  reverseGeocodeBE,
  type UserGeoloc,
} from './_components/geoloc-banner'
import { InfoBands } from './_components/info-bands'
import { MobileMapSheet } from './_components/mobile-map-sheet'
import { type ResolveResponse, type BureauResult } from './_components/types'

/**
 * Orchestrateur du finder de bureaux.
 *
 *  [Search compacte CP (4 chiffres)] [Banner géoloc dismissible]
 *
 *  ┌────────────────┬────────────────────────────────┐
 *  │  CommunePanel  │  4 cards horizontales          │
 *  │  (map + info)  │  (ONEM / CPAS / Commune / OP)  │
 *  └────────────────┴────────────────────────────────┘
 *
 *  [4 InfoBands en bas]
 */
export function BureauxFinder() {
  const router = useRouter()
  const params = useSearchParams()

  const [cp, setCp] = useState(params?.get('cp') ?? '')
  const [userGeoloc, setUserGeoloc] = useState<UserGeoloc | null>(null)
  const [data, setData] = useState<ResolveResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Géoloc autorisée → on enrichit avec reverse geocode (Nominatim) pour
   * récupérer le CP + ville, on met à jour le champ search, ce qui déclenche
   * automatiquement la recherche via le debounce déjà en place.
   */
  const handleLocated = useCallback(async (geo: UserGeoloc) => {
    // Set immédiatement la position pour que les distances soient calculées
    // depuis chez le user même avant que le reverse résolve.
    setUserGeoloc(geo)
    const resolved = await reverseGeocodeBE(geo.lat, geo.lng)
    if (resolved) {
      setUserGeoloc({ ...geo, postcode: resolved.postcode, city: resolved.city })
      // Auto-fill le CP → déclenche la recherche via le debounce
      setCp(resolved.postcode)
    }
  }, [])

  const resolve = useCallback(async (postalCode: string) => {
    if (!/^\d{4}$/.test(postalCode)) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bureaux/resolve?cp=${postalCode}`)
      if (!res.ok) throw new Error('Échec de la recherche')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce + sync URL
  useEffect(() => {
    const t = setTimeout(() => {
      void resolve(cp.trim())
      const usp = new URLSearchParams(params?.toString() ?? '')
      if (cp.trim()) usp.set('cp', cp.trim())
      else usp.delete('cp')
      const qs = usp.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp, resolve])

  // Référence pour calculer les distances : géoloc si dispo, sinon centroïde commune
  const distanceRef = useMemo(() => {
    if (userGeoloc) return userGeoloc
    if (data?.commune?.lat != null && data?.commune?.lng != null) {
      return { lat: data.commune.lat, lng: data.commune.lng }
    }
    return null
  }, [userGeoloc, data?.commune])

  const distance = useCallback(
    (b: BureauResult | null): number | null => {
      if (!b || b.lat === null || b.lng === null || !distanceRef) return null
      return haversineKm(distanceRef, { lat: b.lat, lng: b.lng })
    },
    [distanceRef]
  )

  const showResults = !!data && !loading
  const fourBureaus = useMemo(
    () =>
      data
        ? [
            data.attitre.onem,
            data.attitre.cpas,
            data.attitre.commune,
            ...data.attitre.organismesPaiement.slice(0, 1),
          ]
        : [],
    [data]
  )

  return (
    <div className="space-y-4 w-full">
      {/* Search compacte : input CP 4 chiffres centré, pas de gros wrapper Card */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label
          htmlFor="cp-input"
          className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 h-10 max-w-[200px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0"
        >
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            id="cp-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="Ex: 1000"
            value={cp}
            onChange={(e) => setCp(e.target.value.replace(/\D/g, ''))}
            className="border-0 px-0 h-auto text-sm font-medium tabular-nums shadow-none focus-visible:ring-0 bg-transparent w-[80px]"
            autoFocus
          />
        </label>
        {/* Banner géoloc à côté en desktop, dessous en mobile */}
        <div className="flex-1 min-w-0">
          <GeolocBanner onLocated={handleLocated} located={userGeoloc} />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Recherche…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {showResults && data && (
        <>
          {data.warnings.length > 0 && (
            <div className="rounded-md border border-orange-300 bg-orange-50/60 dark:bg-orange-950/10 p-3 text-xs text-orange-900 dark:text-orange-200 space-y-1">
              {data.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Layout 2-col desktop : map sticky gauche, cards droite */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-4">
            <div className="hidden lg:block lg:sticky lg:top-4 lg:self-start">
              <CommunePanel commune={data.commune} bureaux={fourBureaus} />
            </div>
            <div className="lg:hidden">
              <MobileMapSheet commune={data.commune} bureaux={fourBureaus} />
            </div>

            <div className="space-y-3">
              <BureauCard
                title="ONEM (chômage)"
                icon={<Briefcase className="w-5 h-5" />}
                iconBg="linear-gradient(135deg, #0050A0, #3B82F6)"
                bureau={data.attitre.onem}
                distanceKm={distance(data.attitre.onem)}
                fromUserLocation={!!userGeoloc}
              />
              <BureauCard
                title="CPAS"
                icon={<Users className="w-5 h-5" />}
                iconBg="linear-gradient(135deg, #7c3aed, #a78bfa)"
                bureau={data.attitre.cpas}
                distanceKm={distance(data.attitre.cpas)}
                fromUserLocation={!!userGeoloc}
              />
              <BureauCard
                title="Maison communale"
                icon={<Building2 className="w-5 h-5" />}
                iconBg="linear-gradient(135deg, #059669, #34d399)"
                bureau={data.attitre.commune}
                distanceKm={distance(data.attitre.commune)}
                fromUserLocation={!!userGeoloc}
              />
              {data.attitre.organismesPaiement.length > 0 ? (
                <OpTabsCard
                  bureaux={data.attitre.organismesPaiement}
                  commune={data.commune}
                  userGeoloc={userGeoloc}
                />
              ) : (
                <BureauCard
                  title="Organisme de paiement"
                  icon={<Wallet className="w-5 h-5" />}
                  iconBg="linear-gradient(135deg, #ea580c, #fb923c)"
                  bureau={null}
                />
              )}
            </div>
          </div>

          <InfoBands />
        </>
      )}

      {!loading && !data && cp.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          Tape ton code postal pour voir les bureaux compétents pour ta commune.
        </div>
      )}
    </div>
  )
}
