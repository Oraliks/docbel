'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { MapPin, AlertCircle, Search } from 'lucide-react'

import { OfficeList } from './_components/office-list'
import { TypeFilterChips } from './_components/type-filter-chips'
import { OfficeDetail } from './_components/office-detail'
import { FinderMap } from './_components/finder-map'
import { MobileSheet } from './_components/mobile-sheet'
import { useFavorites } from './_components/use-favorites'
import { SearchLoader } from './_components/search-loader'
import { GeolocBanner, reverseGeocodeBE, type UserGeoloc } from './_components/geoloc-banner'
import { InfoBands } from './_components/info-bands'
import { type ResolveResponse } from './_components/types'
import { buildOffices, filterOffices, TYPE_ORDER, type OfficeType } from '@/lib/bureaus/finder-model'

/**
 * Orchestrateur du finder de bureaux (refonte liste + carte + fiche).
 *
 * Desktop (`lg:`) : deux colonnes pleine hauteur. Colonne gauche (420px) =
 * titre + recherche + géoloc + puces de type + liste ; quand un bureau est
 * sélectionné, `OfficeDetail variant="inline"` recouvre la colonne. Colonne
 * droite = carte plein cadre. La sélection est bidirectionnelle liste ↔ carte.
 *
 * Mobile (`<lg`) : carte plein écran d'abord, barre de recherche flottante en
 * haut, `MobileSheet` glissante en bas (count + puces + liste) ; sélection →
 * `OfficeDetail variant="sheet"` dans un overlay bas assombri.
 *
 * La logique de résolution (cache mémoire par CP, AbortController, debounce
 * 150 ms, sync `?cp=`, reverse-geocode géoloc) est conservée à l'identique.
 */
export function BureauxFinder() {
  const t = useTranslations('public.outils')
  const router = useRouter()
  const params = useSearchParams()

  const [cp, setCp] = useState(params?.get('cp') ?? '')
  const [query, setQuery] = useState('')
  const [userGeoloc, setUserGeoloc] = useState<UserGeoloc | null>(null)
  const [data, setData] = useState<ResolveResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTypes, setActiveTypes] = useState<Set<OfficeType>>(new Set(TYPE_ORDER))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { favorites, toggle: toggleFavorite } = useFavorites()

  // --- Résolution : logique conservée à l'identique (cache/abort/debounce) ---
  const handleLocated = useCallback(async (geo: UserGeoloc) => {
    setUserGeoloc(geo)
    const resolved = await reverseGeocodeBE(geo.lat, geo.lng)
    if (resolved) {
      setUserGeoloc({ ...geo, postcode: resolved.postcode, city: resolved.city })
      setCp(resolved.postcode)
    }
  }, [])
  const clearGeoloc = useCallback(() => setUserGeoloc(null), [])

  // Cache mémoire des résultats par CP : retaper un CP déjà vu pendant la
  // session render direct depuis ce cache (0 ms, aucun appel réseau).
  const cacheRef = useRef<Map<string, ResolveResponse>>(new Map())
  // Annule la requête en cours si le user tape un autre CP avant qu'elle
  // finisse (évite race condition + données obsolètes).
  const abortRef = useRef<AbortController | null>(null)

  const resolve = useCallback(
    async (postalCode: string) => {
      if (!/^\d{4}$/.test(postalCode)) {
        setData(null)
        setLoading(false)
        return
      }
      const cached = cacheRef.current.get(postalCode)
      if (cached) {
        setData(cached)
        setError(null)
        setLoading(false)
        return
      }
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/bureaux/resolve?cp=${postalCode}`, { signal: ac.signal })
        if (!res.ok) throw new Error(t('bureauxSearchError'))
        const json = (await res.json()) as ResolveResponse
        cacheRef.current.set(postalCode, json)
        if (!ac.signal.aborted) setData(json)
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        setError(e instanceof Error ? e.message : t('bureauxGenericError'))
        setData(null)
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    const id = setTimeout(() => {
      void resolve(cp.trim())
      const usp = new URLSearchParams(params?.toString() ?? '')
      if (cp.trim()) usp.set('cp', cp.trim())
      else usp.delete('cp')
      const qs = usp.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    }, 150)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp, resolve])

  // Le reset de la sélection quand le jeu de données change est DÉRIVÉ (pas
  // d'effet synchrone) : `selected` ci-dessous retombe à null si `selectedId`
  // n'existe plus dans les nouveaux résultats → la fiche se ferme d'elle-même.

  const distanceRef = useMemo(() => {
    if (userGeoloc) return { lat: userGeoloc.lat, lng: userGeoloc.lng }
    if (data?.commune?.lat != null && data?.commune?.lng != null)
      return { lat: data.commune.lat, lng: data.commune.lng }
    return null
  }, [userGeoloc, data?.commune])

  const allItems = useMemo(() => (data ? buildOffices(data, distanceRef) : []), [data, distanceRef])
  const items = useMemo(() => filterOffices(allItems, activeTypes, query), [allItems, activeTypes, query])

  const counts = useMemo(() => {
    const c = Object.fromEntries(TYPE_ORDER.map((ty) => [ty, 0])) as Record<OfficeType, number>
    for (const it of allItems) c[it.type]++
    return c
  }, [allItems])

  const countLabel = useMemo(() => {
    const n = items.length
    return query
      ? t('bureauxResultCount', { count: n, query })
      : t('bureauxNearCount', { count: n })
  }, [items.length, query, t])

  const toggleType = useCallback((ty: OfficeType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(ty)) next.delete(ty)
      else next.add(ty)
      return next
    })
  }, [])

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? allItems.find((i) => i.id === selectedId) ?? null,
    [items, allItems, selectedId],
  )
  const showResults = !!data && !loading

  // Barre de recherche partagée (CP déclenche la résolution ; texte filtre la liste)
  const searchBar = (
    <label className="flex items-center gap-2.5 h-12 px-3.5 rounded-2xl glass-surface border border-border">
      <Search className="w-4.5 h-4.5" style={{ color: 'var(--primary)' }} />
      <Input
        inputMode="text"
        placeholder={t('bureauxSearchPlaceholder')}
        value={query || cp}
        onChange={(e) => {
          const v = e.target.value
          const digits = v.replace(/\D/g, '')
          if (/^\d{0,4}$/.test(v)) {
            setCp(digits)
            setQuery('')
          } else {
            setQuery(v)
          }
        }}
        className="border-0 px-0 h-auto bg-transparent shadow-none focus-visible:ring-0 text-sm font-medium"
      />
    </label>
  )

  return (
    <div className="w-full">
      {/* ===== Desktop ===== */}
      <div className="hidden lg:flex gap-4 h-[calc(100vh-13rem)] min-h-[640px]">
        <div className="relative w-[420px] flex-none glass-surface rounded-3xl border border-border flex flex-col overflow-hidden">
          <div className="p-5 pb-3 space-y-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>
                {t('bureauxEyebrow')}
              </div>
              <h1 className="text-2xl font-extrabold text-foreground mt-1">{t('bureauxTitle')}</h1>
            </div>
            {searchBar}
            <GeolocBanner onLocated={handleLocated} located={userGeoloc} onClear={clearGeoloc} />
          </div>
          <div className="px-5">
            <TypeFilterChips active={activeTypes} onToggle={toggleType} counts={counts} />
          </div>
          <div className="flex-1 min-h-0 px-5 pt-2">
            {loading && <SearchLoader cp={cp.trim() || undefined} />}
            {error && <ErrorBox error={error} />}
            {showResults && (
              <OfficeList
                items={items}
                selectedId={selectedId}
                favorites={favorites}
                onSelect={setSelectedId}
                onToggleFavorite={toggleFavorite}
                countLabel={countLabel}
              />
            )}
            {!loading && !data && <EmptyPrompt />}
          </div>
          {selected && (
            <div className="absolute inset-0 z-20 glass-surface">
              <OfficeDetail
                item={selected}
                isFavorite={favorites.has(selected.id)}
                onToggleFavorite={toggleFavorite}
                onClose={() => setSelectedId(null)}
                variant="inline"
              />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 rounded-3xl overflow-hidden border border-border">
          <FinderMap commune={data?.commune ?? null} items={items} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      {/* ===== Mobile ===== */}
      <div className="lg:hidden relative h-[calc(100vh-9rem)] min-h-[560px] rounded-3xl overflow-hidden border border-border">
        <div className="absolute inset-0">
          <FinderMap commune={data?.commune ?? null} items={items} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="absolute top-3 left-3 right-3 z-30 space-y-2">
          {searchBar}
          <GeolocBanner onLocated={handleLocated} located={userGeoloc} onClear={clearGeoloc} />
          {error && <ErrorBox error={error} />}
        </div>
        {showResults && (
          <MobileSheet header={<span className="text-sm font-extrabold text-foreground">{countLabel}</span>}>
            <TypeFilterChips active={activeTypes} onToggle={toggleType} counts={counts} />
            <div className="mt-2">
              <OfficeList
                items={items}
                selectedId={selectedId}
                favorites={favorites}
                onSelect={setSelectedId}
                onToggleFavorite={toggleFavorite}
                countLabel=""
              />
            </div>
          </MobileSheet>
        )}
        {loading && (
          <div className="absolute bottom-0 left-0 right-0 z-20 glass-surface rounded-t-3xl p-5">
            <SearchLoader cp={cp.trim() || undefined} />
          </div>
        )}
        {selected && (
          <div className="fixed inset-0 z-40 flex flex-col justify-end">
            <button
              type="button"
              aria-label={t('bureauxClose')}
              className="absolute inset-0 bg-black/40"
              onClick={() => setSelectedId(null)}
            />
            <div className="relative glass-surface rounded-t-3xl max-h-[85%]">
              <OfficeDetail
                item={selected}
                isFavorite={favorites.has(selected.id)}
                onToggleFavorite={toggleFavorite}
                onClose={() => setSelectedId(null)}
                variant="sheet"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bandeaux pédagogiques (conservés) */}
      {showResults && (
        <div className="mt-6">
          {data!.warnings.length > 0 && <WarningsBox warnings={data!.warnings} />}
          <InfoBands />
        </div>
      )}
    </div>
  )
}

function ErrorBox({ error }: { error: string }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>
  )
}
function WarningsBox({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-md border border-orange-300 bg-orange-50/60 dark:bg-orange-950/10 p-3 text-xs text-orange-900 dark:text-orange-200 space-y-1 mb-4">
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  )
}
function EmptyPrompt() {
  const t = useTranslations('public.outils')
  return (
    <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground h-full flex flex-col items-center justify-center">
      <MapPin className="w-10 h-10 text-muted-foreground/40 mb-3" />
      {t('bureauxEmptyPrompt')}
    </div>
  )
}
