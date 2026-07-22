'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MapPin, Info, HeartPulse, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { AddressSearch } from './_components/address-search'
import { DemarcheSelector } from './_components/demarche-selector'
import { MutuelleSelector, MUTUELLE_CODES, ROUTABLE_MUTUELLES, MC_CODE } from './_components/mutuelle-selector'
import { ActiveFilters } from './_components/active-filters'
import { RecommendedOfficeCard } from './_components/recommended-office-card'
import { OfficeResultsList } from './_components/office-results-list'
import { OfficeDetail } from './_components/office-detail'
import { TrustBar } from './_components/trust-bar'
import { MobileViewSwitcher, type MobileView } from './_components/mobile-view-switcher'
import { EmptyState, ErrorState, SkeletonResults } from './_components/finder-states'
import { reverseGeocodeBE, type UserGeoloc } from './_components/geoloc-banner'
import { type ResolveResponse, type BureauResult } from './_components/types'
import type { OfficeMapMarker } from './_components/office-map-types'
import { buildOffices, officeTypeOfBureau, TYPE_META, type OfficeItem } from '@/lib/bureaus/finder-model'
import { rankOffices } from '@/lib/bureaus/office-ranking'
import { DEMARCHE_META, DEMARCHE_ORDER, type Demarche } from '@/lib/bureaus/demarche-map'
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
  solidaris: 'sante',
  mc: 'sante',
  mloz: 'sante',
  helan: 'sante',
  partenamut: 'sante',
  caami: 'sante',
}

/** Lit `?demarche=` au chargement (partage/reload) et le valide contre les
 * démarches connues ; toute valeur inconnue retombe sur « Je ne sais pas ». */
function parseDemarcheParam(raw: string | null | undefined): Demarche {
  return raw && (DEMARCHE_ORDER as readonly string[]).includes(raw) ? (raw as Demarche) : 'inconnu'
}

/** Lit `?mutuelle=` au chargement et le valide contre les codes connus (MC
 * comprise) ; toute valeur inconnue → `''` (toutes). */
function parseMutuelleParam(raw: string | null | undefined): string {
  return raw && (MUTUELLE_CODES as readonly string[]).includes(raw) ? raw : ''
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
  // Démarche initialisée depuis l'URL (`?demarche=`) : un lien partagé ou un
  // reload restaure le filtre actif (cf. sync dans l'effet de résolution).
  const [demarche, setDemarche] = useState<Demarche>(() => parseDemarcheParam(params?.get('demarche')))
  // Mutuelle choisie (démarche « santé ») : les 6 mutuelles bien référencées
  // résolvent leur office attitré via `?mutuelle=<code>` ; MC est gérée à part
  // (renvoi mc.be). Restaurée depuis l'URL. Ignorée hors démarche « santé ».
  const [mutuelleCode, setMutuelleCode] = useState<string>(() => parseMutuelleParam(params?.get('mutuelle')))
  const [activeId, setActiveId] = useState<string | null>(null) // survol liste ↔ carte
  const [detailId, setDetailId] = useState<string | null>(null) // fiche ouverte (résolution CP)
  // Fiche « détachée » : un bureau choisi dans l'autocomplete (recherche par
  // nom) n'est pas forcément dans la résolution CP courante → on le récupère
  // par id (/api/bureaux/[id]) et on l'affiche hors de `ranked`.
  const [externalDetail, setExternalDetail] = useState<OfficeItem | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>('liste')

  // --- Résolution : cache mémoire par CP + annulation + debounce (conservé) --
  const cacheRef = useRef<Map<string, ResolveResponse>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  const resolve = useCallback(
    async (postalCode: string, mutuelle: string | null) => {
      if (!/^\d{4}$/.test(postalCode)) {
        setData(null)
        setError(null)
        setLoading(false)
        return
      }
      // Clé de cache COMPOSITE (CP + mutuelle) : deux résolutions du même CP
      // avec/sans mutuelle donnent des réponses différentes (attitre.mutuelle),
      // il ne faut pas qu'elles se recouvrent.
      const key = `${postalCode}|${mutuelle ?? ''}`
      const cached = cacheRef.current.get(key)
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
        const url = `/api/bureaux/resolve?cp=${postalCode}${
          mutuelle ? `&mutuelle=${encodeURIComponent(mutuelle)}` : ''
        }`
        const res = await fetch(url, { signal: ac.signal })
        if (!res.ok) throw new Error(t('bureauxSearchError'))
        const json = (await res.json()) as ResolveResponse
        cacheRef.current.set(key, json)
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

  // Mutuelle EFFECTIVEMENT passée au résolveur : seulement en démarche « santé »
  // ET pour une mutuelle routable (MC exclue — pas de routage, cf. renvoi mc.be).
  const resolveMutuelle =
    demarche === 'sante' && (ROUTABLE_MUTUELLES as readonly string[]).includes(mutuelleCode)
      ? mutuelleCode
      : null

  useEffect(() => {
    const id = setTimeout(() => {
      void resolve(cp, resolveMutuelle)
      const usp = new URLSearchParams(params?.toString() ?? '')
      if (cp) usp.set('cp', cp)
      else usp.delete('cp')
      // Persiste la démarche active dans l'URL (partage/reload) ; « Je ne sais
      // pas » = pas de filtre → on retire le paramètre pour garder l'URL propre.
      if (demarche !== 'inconnu') usp.set('demarche', demarche)
      else usp.delete('demarche')
      // Mutuelle : persistée seulement en démarche « santé » (hors santé elle est
      // inactive → on nettoie l'URL). MC comprise (déclenche le renvoi mc.be).
      if (demarche === 'sante' && mutuelleCode) usp.set('mutuelle', mutuelleCode)
      else usp.delete('mutuelle')
      const qs = usp.toString()
      router.replace(qs ? `?${qs}` : '?', { scroll: false })
    }, 150)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cp, demarche, mutuelleCode, resolveMutuelle, resolve])

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
    void resolve(cp, resolveMutuelle)
  }, [resolve, cp, resolveMutuelle])

  // Frappe libre dans le champ Adresse : invalide toute sélection de commune
  // précédente (sinon `cp` resterait figé sur l'ancien `selectedCp` malgré
  // un champ modifié — cf. dérivation de `cp` plus haut).
  const handleAddressChange = useCallback((v: string) => {
    setAddressInput(v)
    setSelectedCp(null)
    setUserGeoloc(null)
  }, [])

  // Ouvre la fiche d'un bureau de la résolution courante (liste/carte) ; ferme
  // une éventuelle fiche « détachée » (autocomplete) pour ne pas cumuler.
  const openDetail = useCallback((id: string) => {
    setExternalDetail(null)
    setDetailId(id)
  }, [])

  const closeDetail = useCallback(() => {
    setDetailId(null)
    setExternalDetail(null)
  }, [])

  // Bureau choisi dans l'autocomplete (recherche par NOM) : il n'est pas
  // forcément dans la résolution CP courante → on récupère sa fiche par id et
  // on l'ouvre en « détaché ». Best-effort : échec réseau silencieux (le champ
  // reste utilisable). Le type (icône/couleur, purement cosmétique) est déduit
  // via `officeTypeOfBureau` ; la distance est laissée nulle (le bureau cherché
  // peut être loin de l'adresse en cours — pas de distance trompeuse).
  const openOfficeById = useCallback(async (id: string) => {
    setDetailId(null)
    try {
      const res = await fetch(`/api/bureaux/${id}`)
      if (!res.ok) return
      const b = (await res.json()) as BureauResult
      setExternalDetail({
        id: b.id,
        type: officeTypeOfBureau({ type: b.type, organismeCode: b.organismeCode }),
        bureau: b,
        distanceKm: null,
        isCompetent: false,
      })
    } catch {
      /* silencieux : autocomplete best-effort */
    }
  }, [])

  const removeFilter = useCallback((key: string) => {
    if (key === 'demarche') {
      setDemarche('inconnu')
      setMutuelleCode('') // la démarche santé s'en va → la mutuelle n'a plus de sens
    } else if (key === 'cp') {
      setAddressInput('')
      setSelectedCp(null)
      setUserGeoloc(null)
      setGeolocError(null)
    }
  }, [])
  const clearAllFilters = useCallback(() => {
    setDemarche('inconnu')
    setMutuelleCode('')
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

  // Fiche affichée = « détachée » (autocomplete, hors résolution) en priorité,
  // sinon celle de la résolution CP courante.
  const activeDetail = externalDetail ?? detail

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

  // Avertissements du résolveur (`data.warnings`) : la plupart sont des notes de
  // provenance INTERNES (« trouvé via le mapping officiel ONEM », « estimé par
  // proximité ») sans intérêt pour le public. On ne surface QUE celui qui change
  // ce que l'utilisateur voit : code postal absent de l'annuaire → aucun bureau
  // officiellement attitré, résultats simplement classés par proximité. On mappe
  // vers une copie propre (pas la chaîne technique brute). Détection par le
  // marqueur stable « pas encore référencé » émis par lib/bureaus/resolve.ts ;
  // à réviser si ce libellé serveur change.
  const resolverNotice = useMemo(
    () =>
      (data?.warnings ?? []).some((w) => w.includes('pas encore référencé'))
        ? t('bureauxNoticeUnreferenced')
        : null,
    [data, t],
  )

  // Honnêteté : les avertissements non surfacés (provenance ONEM, estimations)
  // restent tracés en dev pour ne pas les perdre silencieusement, sans polluer
  // l'écran du citoyen.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const warnings = data?.warnings
    if (warnings && warnings.length > 0) {
      console.debug('[bureaux] avertissements résolveur:', warnings)
    }
  }, [data])

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
        {recommended && <RecommendedOfficeCard office={recommended} onView={openDetail} />}
        {others.length > 0 && (
          <OfficeResultsList
            offices={others}
            selectedId={activeId}
            onView={openDetail}
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
      onView={openDetail}
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
            onSelectOffice={(o) => void openOfficeById(o.id)}
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
            {/* Sélecteur de mutuelle : uniquement en démarche « santé ». MC
                choisie → renvoi honnête vers mc.be (pas de routage erroné). */}
            {demarche === 'sante' && (
              <MutuelleSelector value={mutuelleCode} onChange={setMutuelleCode} />
            )}
            {demarche === 'sante' && mutuelleCode === MC_CODE && (
              <McFinderCallout label={t('mutuelleMcNotice')} cta={t('mutuelleMcCta')} />
            )}
            <ActiveFilters filters={activeFilters} onRemove={removeFilter} onClear={clearAllFilters} />
            {!loading && !error && resolverNotice && <ResolverNotice message={resolverNotice} />}
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
      {activeDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            aria-label={t('bureauxClose')}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeDetail}
          />
          <div className="relative w-full glass-surface rounded-t-3xl sm:w-auto sm:max-w-md sm:rounded-3xl max-h-[85vh] overflow-hidden">
            <OfficeDetail item={activeDetail} onClose={closeDetail} variant="sheet" />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Notice discrète, non-bloquante (« informatif jamais bloquant ») posée au-dessus
 * des résultats quand le résolveur signale un cas qui change ce que voit le
 * citoyen — actuellement : code postal absent de l'annuaire. Surface verre,
 * accent ambre (cf. `ErrorState`/`geoloc-banner`), icône d'info : jamais une
 * erreur ni une modale. Le libellé arrive déjà localisé du parent.
 */
function ResolverNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-2xl border border-[color:var(--glass-warning-border)] bg-[color:var(--glass-warning-surface)] px-4 py-3 text-sm text-foreground"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--glass-warning)]" aria-hidden />
      <p className="min-w-0">{message}</p>
    </div>
  )
}

/**
 * Renvoi honnête vers le localisateur mc.be quand l'utilisateur choisit la
 * Mutualité chrétienne : ses agences locales ne sont pas (encore) dans notre
 * annuaire, donc plutôt que de router vers un bureau erroné, on l'oriente vers
 * l'outil officiel MC. Surface verre neutre, lien externe explicite.
 */
function McFinderCallout({ label, cta }: { label: string; cta: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-3 text-sm">
      <HeartPulse className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--primary)' }} aria-hidden />
      <div className="min-w-0">
        <p className="text-foreground">{label}</p>
        <a
          href="https://www.mc.be/fr/services-en-ligne/points-de-contact"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 font-bold"
          style={{ color: 'var(--primary)' }}
        >
          {cta}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
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
