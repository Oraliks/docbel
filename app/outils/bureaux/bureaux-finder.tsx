'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { MapPin, AlertCircle } from 'lucide-react'

import { BureauCard } from './_components/bureau-card'
import { OpTabsCard } from './_components/op-tabs-card'
import { CommunePanel } from './_components/commune-panel'
import { SearchLoader } from './_components/search-loader'
import {
  GeolocBanner,
  haversineKm,
  reverseGeocodeBE,
  type UserGeoloc,
} from './_components/geoloc-banner'
import { InfoBands } from './_components/info-bands'
import { MobileMapSheet } from './_components/mobile-map-sheet'
import { type ResolveResponse, type BureauResult } from './_components/types'
import {
  OnemLogo,
  CpasLogo,
  CommuneLogo,
  OpLogo,
} from '@/components/icons/organismes'

/**
 * Orchestrateur du finder de bureaux.
 *
 * Layout :
 *  [CP input compact] [Banner géoloc avec Modifier]
 *
 *  ┌────────────────┬────────────────────────────────┐
 *  │  CommunePanel  │  ┌──────────────────────────┐  │
 *  │  (map)         │  │ Featured Recommandé ONEM │  │
 *  │                │  └──────────────────────────┘  │
 *  │                │  ─── Autres bureaux ───        │
 *  │                │  CPAS · Commune · OP (compact) │
 *  └────────────────┴────────────────────────────────┘
 *
 *  [4 InfoBands en bas]
 *
 * La card mise en avant est l'ONEM par défaut (cet outil vit sous Outils >
 * Chômage, donc l'ONEM est la démarche par défaut). On peut piloter un autre
 * "featured" via ?for= dans le futur.
 */
export function BureauxFinder() {
  const t = useTranslations('public.outils')
  const router = useRouter()
  const params = useSearchParams()

  const [cp, setCp] = useState(params?.get('cp') ?? '')
  const [userGeoloc, setUserGeoloc] = useState<UserGeoloc | null>(null)
  const [data, setData] = useState<ResolveResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Géoloc autorisée → enrichit avec reverse geocode → auto-fill le CP.
   */
  const handleLocated = useCallback(async (geo: UserGeoloc) => {
    setUserGeoloc(geo)
    const resolved = await reverseGeocodeBE(geo.lat, geo.lng)
    if (resolved) {
      setUserGeoloc({ ...geo, postcode: resolved.postcode, city: resolved.city })
      setCp(resolved.postcode)
    }
  }, [])

  const clearGeoloc = useCallback(() => {
    setUserGeoloc(null)
  }, [])

  // Cache mémoire des résultats par CP : si tu retapes un CP déjà vu
  // pendant la session, on render direct depuis ce cache (0 ms, aucun
  // appel réseau). Survit pendant toute la vie du component, vidé au
  // refresh page. Map (pas Set) parce qu'on stocke la response complète.
  const cacheRef = useRef<Map<string, ResolveResponse>>(new Map())
  // Permet d'annuler la requête en cours si le user tape un autre CP
  // avant qu'elle finisse (évite race condition + données obsolètes).
  const abortRef = useRef<AbortController | null>(null)

  const resolve = useCallback(async (postalCode: string) => {
    if (!/^\d{4}$/.test(postalCode)) {
      setData(null)
      setLoading(false)
      return
    }

    // 1) Cache hit → instantané, pas de spinner
    const cached = cacheRef.current.get(postalCode)
    if (cached) {
      setData(cached)
      setError(null)
      setLoading(false)
      return
    }

    // 2) Annule la requête précédente si encore en vol
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bureaux/resolve?cp=${postalCode}`, {
        signal: ac.signal,
      })
      if (!res.ok) throw new Error(t('bureauxSearchError'))
      const json = (await res.json()) as ResolveResponse
      cacheRef.current.set(postalCode, json)
      // Ne rafraîchit l'UI que si on est toujours sur ce CP
      if (!ac.signal.aborted) setData(json)
    } catch (e) {
      // Ignore les aborts (race normale), on log les vraies erreurs
      if ((e as Error)?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : t('bureauxGenericError'))
      setData(null)
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    // Debounce 150 ms (vs 350 ms avant) : assez court pour que ça
    // paraisse réactif, assez long pour qu'on ne fetch pas à chaque
    // touche quand le user tape "1030" en une volée.
    const t = setTimeout(() => {
      void resolve(cp.trim())
      const usp = new URLSearchParams(params?.toString() ?? '')
      if (cp.trim()) usp.set('cp', cp.trim())
      else usp.delete('cp')
      const qs = usp.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    }, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp, resolve])

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
  // Pour la map : on inclut TOUS les OP (CAPAC + FGTB + CSC + CGSLB), pas
  // juste le premier. Ça permet de voir leur dispersion géographique réelle
  // autour de la commune sélectionnée.
  const mapBureaus = useMemo(
    () =>
      data
        ? [
            data.attitre.onem,
            data.attitre.cpas,
            data.attitre.commune,
            ...data.attitre.organismesPaiement,
          ]
        : [],
    [data]
  )

  return (
    <div className="space-y-4 w-full">
      {/* Ligne search + géoloc */}
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
            placeholder={t('bureauxCpPlaceholder')}
            value={cp}
            onChange={(e) => setCp(e.target.value.replace(/\D/g, ''))}
            className="border-0 px-0 h-auto text-sm font-medium tabular-nums shadow-none focus-visible:ring-0 bg-transparent w-[80px]"
            autoFocus
          />
        </label>
        <div className="flex-1 min-w-0">
          <GeolocBanner
            onLocated={handleLocated}
            located={userGeoloc}
            onClear={clearGeoloc}
          />
        </div>
      </div>

      {loading && <SearchLoader cp={cp.trim() || undefined} />}

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

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-4 lg:items-stretch">
            {/* Map desktop : la div stretch à la hauteur de la colonne
                droite (grâce à items-stretch sur le grid + h-full dans
                CommunePanel). Pas de sticky : le user a demandé que la
                map prenne la même hauteur que les cards, donc elle
                "vit" dans le flow normal du grid. Une max-height sur
                la map elle-même évite qu'elle dépasse le viewport quand
                la colonne droite est très haute. */}
            <div className="hidden lg:block">
              <CommunePanel commune={data.commune} bureaux={mapBureaus} />
            </div>
            <div className="lg:hidden">
              <MobileMapSheet commune={data.commune} bureaux={mapBureaus} />
            </div>

            {/* Cards — 4 bureaux traités équitablement (pas de recommandé) */}
            <div className="space-y-2.5">
              <BureauCard
                label={t('bureauxLabelOnem')}
                logo={<OnemLogo size={48} />}
                bureau={data.attitre.onem}
                distanceKm={distance(data.attitre.onem)}
                fromUserLocation={!!userGeoloc}
              />
              <BureauCard
                label={t('bureauxLabelCpas')}
                logo={<CpasLogo size={48} />}
                bureau={data.attitre.cpas}
                distanceKm={distance(data.attitre.cpas)}
                fromUserLocation={!!userGeoloc}
              />
              <BureauCard
                label={t('bureauxLabelCommune')}
                logo={<CommuneLogo size={48} />}
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
                  label={t('bureauxLabelOp')}
                  logo={<OpLogo size={48} />}
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
          {t('bureauxEmptyPrompt')}
        </div>
      )}
    </div>
  )
}
