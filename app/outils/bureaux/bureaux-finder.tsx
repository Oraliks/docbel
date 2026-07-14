'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { AddressSearch } from './_components/address-search'
import { DemarcheSelector } from './_components/demarche-selector'
import { ActiveFilters } from './_components/active-filters'
import { RecommendedOfficeCard } from './_components/recommended-office-card'
import { OfficeResultsList } from './_components/office-results-list'
import { OfficeDetail } from './_components/office-detail'
import { TrustBar } from './_components/trust-bar'
import { MobileViewSwitcher, type MobileView } from './_components/mobile-view-switcher'
import { EmptyState, ErrorState, SkeletonResults } from './_components/finder-states'
import { reverseGeocodeBE, type UserGeoloc } from './_components/geoloc-banner'
import { type ResolveResponse } from './_components/types'
import type { OfficeMapMarker } from './_components/office-map-types'
import { buildOffices, TYPE_META } from '@/lib/bureaus/finder-model'
import { rankOffices } from '@/lib/bureaus/office-ranking'
import { DEMARCHE_META, type Demarche } from '@/lib/bureaus/demarche-map'
import { computeOpenStatus } from '@/lib/bureaus/types'

/**
 * `OfficeMap` code-splitté (~120 KB de d3-geo/topojson via `CustomBelgiumMap`)
 * hors du bundle initial : `ssr: false` (la projection SVG n'a aucun sens
 * côté serveur) + squelette pleine hauteur pendant le chargement de la puce.
 * Défini au niveau module pour rester stable entre les rendus (sinon la carte
 * se remonterait à chaque render de l'orchestrateur).
 */
const OfficeMap = dynamic(
  () => import('./_components/office-map').then((m) => ({ default: m.OfficeMap })),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-3xl" /> },
)

/**
 * Correspondance HEURISTIQUE code organisme → démarche : sélectionner un
 * organisme dans l'autocomplete règle le filtre démarche (sans toucher le
 * champ adresse). Résolution « organisme-first » plus fine = étape ultérieure.
 */
const ORG_TO_DEMARCHE: Record<string, Demarche> = {
  onem: 'chomage',
  capac: 'chomage',
  fgtb: 'chomage',
  csc: 'chomage',
  synova: 'chomage',
  cpas: 'aide_sociale',
  commune: 'documents_communaux',
  actiris: 'emploi',
  forem: 'emploi',
  vdab: 'emploi',
  adg: 'emploi',
}

/**
 * Orchestrateur V2 du finder de bureaux : parcours « démarche → recommandé →
 * action ». L'utilisateur indique son adresse (code postal) et sa démarche ;
 * `rankOffices` désigne un bureau n°1 recommandé (héros) + une liste
 * numérotée ; la carte partage les mêmes numéros. Survol liste ↔ carte
 * synchronisé (`activeId`) ; « Voir le bureau » ouvre la fiche (`detailId`).
 *
 * Desktop (`lg:`) : deux colonnes (contrôles + résultats à gauche, carte
 * collante à droite), `TrustBar` dessous. Mobile (`<lg`) : `MobileViewSwitcher`
 * bascule Liste/Carte ; la recherche reste toujours accessible.
 *
 * La machinerie de résolution est conservée à l'identique (cache mémoire par
 * CP, `AbortController`, debounce 150 ms, sync `?cp=`, reverse-geocode géoloc).
 * Le reset de la fiche/sélection est DÉRIVÉ (pas de setState synchrone dans un
 * effet) : un `id` obsolète ne matche plus `ranked` → rendu nul, sans effet.
 */
export function BureauxFinder() {
  // Cast (idiome partagé avec les enfants, cf. office-card.tsx / demarche-
  // selector.tsx) : `TYPE_META[..].labelKey` / `DEMARCHE_META[..].labelKey`
  // sont des `string` dynamiques (jamais des littéraux), donc le typage strict
  // next-intl (`i18n/global.ts`) fait échouer `tsc` sans ce cast. L'orches-
  // trateur ne passe que des chaînes déjà résolues aux enfants : aucune
  // interpolation ici (les enfants — OfficeMap, ActiveFilters… — gèrent la leur).
  const t = useTranslations('public.outils') as (key: string) => string
  const router = useRouter()
  const params = useSearchParams()

  // --- État de résolution -----------------------------------------------
  // `addressInput` = valeur AFFICHÉE du champ Adresse (CP, nom de commune ou
  // adresse libre) ; `cp` en est DÉRIVÉ de DEUX sources : soit une sélection
  // explicite dans le dropdown de suggestions (`selectedCp`, prioritaire —
  // le champ affiche alors un NOM mais résout le CP représentatif de la
  // commune), soit un code postal à 4 chiffres tapé directement. Toute
  // frappe libre invalide une sélection précédente (cf. `handleAddressChange`).
  const [addressInput, setAddressInput] = useState(params?.get('cp') ?? '')
  const [selectedCp, setSelectedCp] = useState<string | null>(null)
  const cp = useMemo(
    () => selectedCp ?? (/^\d{4}$/.test(addressInput.trim()) ? addressInput.trim() : ''),
    [selectedCp, addressInput],
  )

  const [userGeoloc, setUserGeoloc] = useState<UserGeoloc | null>(null)
  const [locating, setLocating] = useState(false)
  const [geolocError, setGeolocError] = useState<string | null>(null)
  const [data, setData] = useState<ResolveResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- État d'interaction ------------------------------------------------
  const [demarche, setDemarche] = useState<Demarche>('inconnu')
  const [activeId, setActiveId] = useState<string | null>(null) // survol liste ↔ carte
  const [detailId, setDetailId] = useState<string | null>(null) // fiche ouverte
  const [mobileView, setMobileView] = useState<MobileView>('liste')

  // --- Résolution : cache mémoire par CP + annulation + debounce (conservé) --
  const cacheRef = useRef<Map<string, ResolveResponse>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  const resolve = useCallback(
    async (postalCode: string) => {
      if (!/^\d{4}$/.test(postalCode)) {
        setData(null)
        setError(null)
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
      void resolve(cp)
      const usp = new URLSearchParams(params?.toString() ?? '')
      if (cp) usp.set('cp', cp)
      else usp.delete('cp')
      const qs = usp.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    }, 150)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp, resolve])

  // Géoloc pilotée par le bouton « Utiliser ma position » d'AddressSearch :
  // getCurrentPosition → reverseGeocodeBE → le champ affiche la VILLE
  // résolue et `selectedCp` porte le CP (même logique que la sélection
  // d'une commune dans le dropdown). `userGeoloc` affine ensuite les
  // distances. Échec (refus, contexte non sécurisé, indisponible…) → message
  // `geolocError` affiché par `AddressSearch` (jamais un échec silencieux).
  const handleUseLocation = useCallback(() => {
    setGeolocError(null)
    const unsupported =
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      (typeof window !== 'undefined' && !window.isSecureContext)
    if (unsupported) {
      setGeolocError(t('geolocInsecure'))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const geo: UserGeoloc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserGeoloc(geo)
        void reverseGeocodeBE(geo.lat, geo.lng).then((resolved) => {
          if (resolved) {
            setUserGeoloc({ ...geo, postcode: resolved.postcode, city: resolved.city })
            setAddressInput(resolved.city || resolved.postcode)
            setSelectedCp(resolved.postcode)
          }
          setLocating(false)
        })
      },
      (err) => {
        setGeolocError(err.code === err.PERMISSION_DENIED ? t('geolocDenied') : t('geolocUnavailable'))
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }, [t])

  const retry = useCallback(() => {
    void resolve(cp)
  }, [resolve, cp])

  // Frappe libre dans le champ Adresse : invalide toute sélection de commune
  // précédente (sinon `cp` resterait figé sur l'ancien `selectedCp` malgré
  // un champ modifié — cf. dérivation de `cp` plus haut).
  const handleAddressChange = useCallback((v: string) => {
    setAddressInput(v)
    setSelectedCp(null)
    setUserGeoloc(null)
  }, [])

  const removeFilter = useCallback((key: string) => {
    if (key === 'demarche') setDemarche('inconnu')
    else if (key === 'cp') {
      setAddressInput('')
      setSelectedCp(null)
      setUserGeoloc(null)
      setGeolocError(null)
    }
  }, [])
  const clearAllFilters = useCallback(() => {
    setDemarche('inconnu')
    setAddressInput('')
    setSelectedCp(null)
    setUserGeoloc(null)
    setGeolocError(null)
  }, [])

  // --- Dérivations -------------------------------------------------------
  // Référence de distance : position géoloc si connue, sinon centroïde commune.
  const distanceRef = useMemo(() => {
    if (userGeoloc) return { lat: userGeoloc.lat, lng: userGeoloc.lng }
    if (data?.commune?.lat != null && data?.commune?.lng != null)
      return { lat: data.commune.lat, lng: data.commune.lng }
    return null
  }, [userGeoloc, data])

  const allItems = useMemo(() => (data ? buildOffices(data, distanceRef) : []), [data, distanceRef])
  const ranked = useMemo(() => rankOffices(allItems, { demarche }), [allItems, demarche])
  const recommended = ranked[0] ?? null
  const others = useMemo(() => ranked.slice(1), [ranked])
  const hasRanked = ranked.length > 0

  // Fiche ouverte = résolution DÉRIVÉE de `detailId` : un id devenu obsolète
  // (jeu de données changé) ne matche plus `ranked` → `null` → la fiche se
  // ferme d'elle-même, sans effet synchrone.
  const detail = useMemo(() => ranked.find((o) => o.id === detailId) ?? null, [ranked, detailId])

  // Marqueurs carte — mémo perf-critique (STABLE) : `OfficeMap`/`CustomBelgiumMap`
  // mémoïsent leur projection sur l'identité de ce tableau. Ne dépend que de
  // `[ranked, t]` (t = référence stable next-intl) → pas de reprojection sur un
  // simple survol. Tous les libellés arrivent déjà résolus (i18n, formatage).
  const markers = useMemo<OfficeMapMarker[]>(
    () =>
      ranked.map((office) => {
        const b = office.bureau
        const s = computeOpenStatus(b.hours)
        // Statut honnête : jamais « Fermé » inventé quand aucun horaire connu.
        const statusLabel =
          s.state === 'open'
            ? t('bureauxStatusOpen')
            : s.state === 'no_data'
              ? null
              : t('bureauxStatusClosed')
        const address =
          [b.street, b.streetNum].filter(Boolean).join(' ') + `, ${b.postalCode} ${b.city}`
        return {
          id: office.id,
          number: office.number,
          recommended: office.isRecommended,
          lat: b.lat,
          lng: b.lng,
          color: TYPE_META[office.type].color,
          label: b.name,
          typeLabel: t(TYPE_META[office.type].labelKey),
          address,
          statusLabel,
          distanceLabel:
            office.distanceKm != null
              ? `${office.distanceKm.toFixed(1).replace('.', ',')} km`
              : null,
        }
      }),
    [ranked, t],
  )

  const activeFilters = useMemo(() => {
    const f: { key: string; label: string }[] = []
    if (data) f.push({ key: 'cp', label: data.commune?.nameFr ?? cp })
    if (demarche !== 'inconnu') f.push({ key: 'demarche', label: t(DEMARCHE_META[demarche].labelKey) })
    return f
  }, [data, cp, demarche, t])

  // --- Fragments d'interface partagés (mobile ↔ desktop) -----------------
  const emptyBody = demarche !== 'inconnu' ? t('demarcheEmptyBody') : t('emptyBody')

  const emptyActions = (
    <>
      {demarche !== 'inconnu' && (
        <Button type="button" size="sm" onClick={() => setDemarche('inconnu')}>
          {t('clearFilters')}
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => removeFilter('cp')}>
        {t('modifySearch')}
      </Button>
    </>
  )

  // Colonne résultats (gauche desktop / vue Liste mobile).
  let results: ReactNode
  if (loading) {
    results = <SkeletonResults />
  } else if (error) {
    results = <ErrorState message={error} onRetry={retry} />
  } else if (data) {
    results = hasRanked ? (
      <div className="space-y-4">
        {recommended && <RecommendedOfficeCard office={recommended} onView={setDetailId} />}
        {others.length > 0 && (
          <OfficeResultsList
            offices={others}
            selectedId={activeId}
            onView={setDetailId}
            onHover={setActiveId}
          />
        )}
      </div>
    ) : (
      <EmptyState title={t('emptyTitle')} body={emptyBody} actions={emptyActions} />
    )
  } else {
    // Initial (aucun CP) : jamais un écran vide sans explication.
    results = <InitialPrompt text={t('bureauxSubtitle')} />
  }

  // Zone carte (droite desktop / vue Carte mobile). Jamais de carte vide sans
  // explication : on montre un placeholder tant qu'il n'y a pas de résultats.
  const mapArea: ReactNode = loading ? (
    <Skeleton className="h-full w-full rounded-3xl" />
  ) : data && hasRanked ? (
    <OfficeMap
      markers={markers}
      center={distanceRef}
      selectedInsCode={data.commune?.insCode ?? null}
      selectedId={activeId}
      zoneLabel={data.commune?.nameFr ?? cp}
      resultCount={ranked.length}
      onHover={setActiveId}
      onSelect={setActiveId}
      onView={setDetailId}
    />
  ) : (
    <MapPlaceholder text={error ?? (data ? emptyBody : t('bureauxSubtitle'))} />
  )

  return (
    <div className="w-full">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_1.08fr] lg:gap-5">
        {/* ===== Colonne gauche : recherche + démarche + filtres + résultats ===== */}
        <div className="min-w-0 space-y-4">
          <AddressSearch
            value={addressInput}
            onChange={handleAddressChange}
            onSelectAddress={(a) => {
              // Le gros gain : adresse précise → CP pour la résolution ET coords
              // exactes pour les distances (pas seulement le centroïde commune).
              setAddressInput(a.label)
              setSelectedCp(a.postcode)
              setUserGeoloc({ lat: a.lat, lng: a.lng })
            }}
            onSelectCommune={(c) => {
              setAddressInput(c.nameFr)
              setSelectedCp(c.cp)
              setUserGeoloc(null)
            }}
            onSelectOrganisme={(o) => {
              const d = ORG_TO_DEMARCHE[o.code]
              if (d) setDemarche(d)
            }}
            onSelectService={(s) => {
              setDemarche(s.key as Demarche)
            }}
            onUseLocation={handleUseLocation}
            locating={locating}
            geolocError={geolocError}
          />

          {/* Bascule Liste/Carte — mobile uniquement */}
          <div className="lg:hidden">
            <MobileViewSwitcher view={mobileView} onChange={setMobileView} resultCount={ranked.length} />
          </div>

          {/* Démarche + filtres + résultats : masqués en vue Carte mobile,
              toujours visibles sur `lg`. */}
          <div className={`${mobileView === 'carte' ? 'hidden' : ''} space-y-4 lg:block`}>
            <DemarcheSelector value={demarche} onChange={setDemarche} />
            <ActiveFilters filters={activeFilters} onRemove={removeFilter} onClear={clearAllFilters} />
            {results}
          </div>
        </div>

        {/* ===== Colonne droite : carte (collante desktop, plein cadre mobile) ===== */}
        <div className={`${mobileView === 'carte' ? '' : 'hidden'} mt-4 lg:mt-0 lg:block`}>
          <div className="h-[calc(100vh-16rem)] min-h-[440px] lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)] lg:min-h-[600px]">
            {mapArea}
          </div>
        </div>
      </div>

      {/* ===== Barre de confiance (remplace les cartes InfoBands) ===== */}
      <div className="mt-6">
        <TrustBar />
      </div>

      {/* ===== Fiche bureau (overlay) : mobile = bottom-sheet, desktop = modale ===== */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label={t('bureauxClose')}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDetailId(null)}
          />
          <div className="relative w-full glass-surface rounded-t-3xl sm:w-auto sm:max-w-md sm:rounded-3xl max-h-[85vh] overflow-hidden">
            <OfficeDetail item={detail} onClose={() => setDetailId(null)} variant="sheet" />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Invite initiale (aucun code postal saisi) affichée dans la colonne résultats.
 */
function InitialPrompt({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[color:var(--glass-border)] px-6 py-14 text-center">
      <MapPin className="h-10 w-10 text-muted-foreground/40" aria-hidden />
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

/**
 * Substitut de carte quand il n'y a pas (encore) de résultats à projeter :
 * garde le cadre verre plein et explique pourquoi la carte est vide.
 */
function MapPlaceholder({ text }: { text: string }) {
  return (
    <div className="glass-surface flex h-full w-full flex-col items-center justify-center gap-3 rounded-3xl px-6 text-center">
      <MapPin className="h-10 w-10 text-muted-foreground/40" aria-hidden />
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
