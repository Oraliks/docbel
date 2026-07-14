'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, LocateFixed, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { GLASS_INPUT, GLASS_LABEL } from '@/lib/glass-classes'
import { classifyQuery } from '@/lib/bureaus/search-classifier'
import type { SuggestResponse } from '@/app/api/bureaux/suggest/route'
import type { AddressSuggestion } from '@/app/api/geocode/suggest/route'

export interface CommuneSuggestion {
  insCode: string
  nameFr: string
  cp: string
}

/** Adresse résolue : `postcode` GARANTI (le géocodeur ne renvoie que des items
 * dont le CP à 4 chiffres est validé) + coords précises pour les distances. */
export interface AddressPick {
  label: string
  postcode: string
  lat: number
  lng: number
}
export interface OrganismePick {
  code: string
  label: string
}
export interface ServicePick {
  key: string
  label: string
}

interface Props {
  value: string
  onChange: (v: string) => void
  onSelectAddress: (a: AddressPick) => void
  onSelectCommune: (c: CommuneSuggestion) => void
  onSelectOrganisme: (o: OrganismePick) => void
  onSelectService: (s: ServicePick) => void
  onUseLocation: () => void
  locating?: boolean
  /** Message d'échec géoloc déjà traduit par l'orchestrateur (refus, HTTP non
   * sécurisé, indisponible…) ; `null`/absent = rien à afficher. */
  geolocError?: string | null
}

const DEBOUNCE_MS = 250
const MIN_CHARS = 2
/** Longueur mini avant d'interroger AUSSI le géocodeur d'adresses (Nominatim
 * exige ≥4 chars côté route ; on aligne pour ne pas déclencher un 200 vide). */
const ADDRESS_MIN_CHARS = 4
const CP_RE = /^\d{4}$/

const ID_PREFIX = 'office-address-option'
const GEOLOC_ID = `${ID_PREFIX}-geoloc`
const LISTBOX_ID = 'office-address-listbox'

const EMPTY_SUGGEST: SuggestResponse = {
  municipalities: [],
  organizations: [],
  offices: [],
  services: [],
}

// Fetchs définis au niveau module : ne capturent aucun état du composant (q +
// signal en paramètres), donc stables entre les rendus → aucune dépendance
// d'effet parasite. Dégradation gracieuse : toute erreur (réseau, JSON, abort)
// renvoie la forme vide, jamais une exception (l'effet garde `ac.signal.aborted`
// pour ignorer les résolutions périmées).
function fetchSuggest(q: string, signal: AbortSignal): Promise<SuggestResponse> {
  return fetch(`/api/bureaux/suggest?q=${encodeURIComponent(q)}`, { signal })
    .then((r) => (r.ok ? r.json() : null))
    .then((json: SuggestResponse | null) => json ?? EMPTY_SUGGEST)
    .catch(() => EMPTY_SUGGEST)
}

function fetchAddresses(q: string, signal: AbortSignal): Promise<AddressSuggestion[]> {
  return fetch(`/api/geocode/suggest?q=${encodeURIComponent(q)}`, { signal })
    .then((r) => (r.ok ? r.json() : null))
    .then((json: { items?: AddressSuggestion[] } | null) => json?.items ?? [])
    .catch(() => [])
}

/** Ligne sélectionnable de l'autocomplete (union discriminée) : porte à la fois
 * l'affichage et la charge utile typée passée au bon callback à l'activation.
 * `ResultRow` = lignes de RÉSULTAT (dans un groupe, toujours un `label`) ;
 * `Row` ajoute l'action geoloc (hors groupe, dernière de la liste plate). */
type ResultRow =
  | { kind: 'address'; id: string; label: string; pick: AddressPick }
  | { kind: 'commune'; id: string; label: string; sub: string; pick: CommuneSuggestion }
  | { kind: 'organisme'; id: string; label: string; pick: OrganismePick }
  | { kind: 'service'; id: string; label: string; pick: ServicePick }
type Row = ResultRow | { kind: 'geoloc'; id: string }

type Group = { key: string; labelKey: string; rows: ResultRow[] }

/**
 * Champ « Adresse » (code postal, commune, adresse libre, organisme ou service)
 * + bouton pleine largeur « Utiliser ma position ». La résolution CP (4 chiffres
 * tapés) reste côté orchestrateur ; ce composant ajoute un autocomplete GROUPÉ
 * universel réutilisant deux endpoints existants :
 *  - `/api/bureaux/suggest` (TOUJOURS) → communes + organismes + services ;
 *  - `/api/geocode/suggest` (SI la requête ressemble à une adresse ≥4 chars) →
 *    adresses précises (label + CP + coords lat/lng → distances exactes).
 * Les résultats sont fusionnés en groupes ordonnés (Adresses, Communes,
 * Organismes, Services). Le groupe `offices` est volontairement DIFFÉRÉ.
 *
 * `eligible` (≥2 caractères, PAS un CP à 4 chiffres) sert de garde DÉRIVÉE :
 * on ne déclenche jamais de fetch pour un CP tapé directement (résolu sans
 * suggestion) ni pour une saisie trop courte, et le dropdown se referme tout
 * seul dès que la saisie redevient inéligible — sans vider `suggestions` de
 * façon synchrone dans l'effet (ce qui déclencherait `set-state-in-effect`).
 * Le garde `focused` empêche une écriture PROGRAMMATIQUE de `value` (geoloc,
 * sélection) de rouvrir un dropdown fantôme.
 */
export function AddressSearch({
  value,
  onChange,
  onSelectAddress,
  onSelectCommune,
  onSelectOrganisme,
  onSelectService,
  onUseLocation,
  locating = false,
  geolocError = null,
}: Props) {
  // Cast idiome partagé (cf. bureaux-finder.tsx) : `t()` reçoit ici des clés
  // DYNAMIQUES (labels de groupes stockés en variable, `suggestGroup*` etc.),
  // ce que le typage strict next-intl rejette pour une non-littérale. Toutes
  // les clés utilisées existent bien dans fr.json.
  const t = useTranslations('public.outils') as (key: string) => string

  const [addresses, setAddresses] = useState<AddressSuggestion[]>([])
  const [communes, setCommunes] = useState<SuggestResponse['municipalities']>([])
  const [organizations, setOrganizations] = useState<SuggestResponse['organizations']>([])
  const [services, setServices] = useState<SuggestResponse['services']>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  // Focus réel du champ (posé par `onFocus`/`onBlur`) : distingue une frappe
  // utilisateur d'une écriture PROGRAMMATIQUE de `value` (geoloc, sélection).
  const [focused, setFocused] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Sélection ADRESSE/COMMUNE : le callback réécrit `value` chez le parent, ce
  // qui redéclenche l'effet (dep `trimmed`). Sans ce garde, le libellé tout
  // juste choisi relancerait un fetch et rouvrirait le dropdown (flash visible).
  // Un seul cycle d'effet est consommé, puis le fetch reprend à la frappe
  // suivante. Organisme/Service ne changent PAS `value` → on n'arme PAS le
  // garde pour eux (sinon il subsisterait et avalerait le fetch suivant).
  const skipNextFetchRef = useRef(false)

  const trimmed = value.trim()
  const eligible = trimmed.length >= MIN_CHARS && !CP_RE.test(trimmed)

  // Fetch debouncé (250 ms) + AbortController (annule la requête précédente).
  // Deux sources sous le MÊME debounce, fusionnées : `/suggest` toujours, et
  // `/geocode/suggest` si la requête ressemble à une adresse (≥4 chars). Les
  // seuls `setState` qui touchent les résultats/loading/open arrivent dans le
  // callback ASYNCHRONE (après le `setTimeout`), jamais de façon synchrone dans
  // le corps de l'effet — la branche « inéligible / pas focus / skip » se
  // contente d'annuler une requête en vol, sans écrire d'état.
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      abortRef.current?.abort()
      return
    }
    if (!eligible || !focused) {
      abortRef.current?.abort()
      return
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      setOpen(true)
      const alsoAddress =
        classifyQuery(trimmed) === 'address' && trimmed.length >= ADDRESS_MIN_CHARS
      Promise.all([
        fetchSuggest(trimmed, ac.signal),
        alsoAddress
          ? fetchAddresses(trimmed, ac.signal)
          : Promise.resolve<AddressSuggestion[]>([]),
      ])
        .then(([suggest, addr]) => {
          if (ac.signal.aborted) return
          setAddresses(addr)
          setCommunes(suggest.municipalities)
          setOrganizations(suggest.organizations)
          setServices(suggest.services)
          setActiveIndex(-1)
          setLoading(false)
        })
        .catch(() => {
          if (ac.signal.aborted) return
          setAddresses([])
          setCommunes([])
          setOrganizations([])
          setServices([])
          setLoading(false)
        })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [trimmed, eligible, focused])

  // Annule toute requête encore en vol au démontage.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Liste PLATE ordonnée (adresses → communes → organismes → services → geoloc)
  // pour la navigation clavier, + groupes non vides pour le rendu. La ligne
  // geoloc est TOUJOURS la dernière de la liste plate (action, hors groupe).
  const { rows, groups } = useMemo(() => {
    const addressRows: ResultRow[] = addresses
      .filter(
        (a): a is AddressSuggestion & { postcode: string } =>
          typeof a.postcode === 'string' && /^\d{4}$/.test(a.postcode),
      )
      .map((a, i) => ({
        kind: 'address',
        id: `${ID_PREFIX}-address-${i}`,
        label: a.label,
        pick: { label: a.label, postcode: a.postcode, lat: a.lat, lng: a.lng },
      }))
    const communeRows: ResultRow[] = communes.map((c) => ({
      kind: 'commune',
      id: `${ID_PREFIX}-commune-${c.insCode}`,
      label: c.nameFr,
      sub: c.cp,
      pick: c,
    }))
    const orgRows: ResultRow[] = organizations.map((o) => ({
      kind: 'organisme',
      id: `${ID_PREFIX}-org-${o.code}`,
      label: o.label,
      pick: o,
    }))
    const serviceRows: ResultRow[] = services.map((s) => ({
      kind: 'service',
      id: `${ID_PREFIX}-service-${s.key}`,
      label: s.label,
      pick: s,
    }))
    const geolocRow: Row = { kind: 'geoloc', id: GEOLOC_ID }

    const g: Group[] = []
    if (addressRows.length) g.push({ key: 'address', labelKey: 'suggestGroupAddresses', rows: addressRows })
    if (communeRows.length) g.push({ key: 'commune', labelKey: 'suggestGroupCommunes', rows: communeRows })
    if (orgRows.length) g.push({ key: 'organisme', labelKey: 'suggestGroupOrganismes', rows: orgRows })
    if (serviceRows.length) g.push({ key: 'service', labelKey: 'suggestGroupServices', rows: serviceRows })

    const flat: Row[] = [...addressRows, ...communeRows, ...orgRows, ...serviceRows, geolocRow]
    return { rows: flat, groups: g }
  }, [addresses, communes, organizations, services])

  const indexById = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r, i) => m.set(r.id, i))
    return m
  }, [rows])

  const hasResults = groups.length > 0
  const showDropdown = eligible && open && focused
  const activeOptionId =
    showDropdown && activeIndex >= 0 && activeIndex < rows.length ? rows[activeIndex].id : undefined

  const closeList = () => {
    setOpen(false)
    setActiveIndex(-1)
    setAddresses([])
    setCommunes([])
    setOrganizations([])
    setServices([])
  }

  const activateRow = (row: Row) => {
    switch (row.kind) {
      case 'address':
        skipNextFetchRef.current = true
        onSelectAddress(row.pick)
        closeList()
        break
      case 'commune':
        skipNextFetchRef.current = true
        onSelectCommune(row.pick)
        closeList()
        break
      case 'organisme':
        // Ne change pas `value` (règle la démarche) → pas de garde skip.
        onSelectOrganisme(row.pick)
        closeList()
        break
      case 'service':
        onSelectService(row.pick)
        closeList()
        break
      case 'geoloc':
        onUseLocation()
        closeList()
        // Blur explicite : la géoloc réécrit `value` (ville résolue) de façon
        // asynchrone ; sans retirer le focus, ce changement rouvrirait un
        // dropdown fantôme (le garde skip ne couvre qu'un cycle immédiat).
        inputRef.current?.blur()
        break
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setActiveIndex(-1)
      }
      return
    }
    if (!showDropdown || rows.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % rows.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? rows.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < rows.length) {
        // preventDefault : évite une soumission implicite pendant la sélection.
        e.preventDefault()
        activateRow(rows[activeIndex])
      }
    }
  }

  const rowClass = (active: boolean) =>
    `cursor-pointer rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[color:var(--glass-pop-bg)] ${
      active ? 'bg-[color:var(--glass-pop-bg)]' : ''
    }`

  const geolocIndex = rows.length - 1
  const geolocActive = showDropdown && activeIndex === geolocIndex

  return (
    <div className="space-y-2.5">
      <div className="relative flex flex-col gap-1.5">
        <label htmlFor="office-address" className={GLASS_LABEL}>
          {t('bureauxAddressLabel')}
        </label>
        <div
          className={`${GLASS_INPUT} flex h-12 items-center gap-2.5 border px-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--primary)]`}
        >
          <MapPin
            className="w-[18px] h-[18px] shrink-0"
            style={{ color: 'var(--primary)' }}
            aria-hidden="true"
          />
          <Input
            ref={inputRef}
            id="office-address"
            inputMode="text"
            autoComplete="off"
            placeholder={t('bureauxAddressPlaceholder')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              // Délai avant fermeture pour laisser le `onMouseDown` d'une ligne
              // aboutir avant que le blur ne referme le dropdown.
              setTimeout(() => setOpen(false), 150)
              setFocused(false)
            }}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={LISTBOX_ID}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            className="border-0 px-0 h-auto bg-transparent shadow-none focus-visible:ring-0 text-sm font-medium"
          />
        </div>
        {showDropdown && (
          <div
            id={LISTBOX_ID}
            role="listbox"
            aria-label={t('bureauxAddressLabel')}
            className="glass-surface absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto p-1.5"
          >
            {groups.map((group) => (
              <div key={group.key} role="group" aria-label={t(group.labelKey)}>
                <div
                  aria-hidden="true"
                  className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]"
                >
                  {t(group.labelKey)}
                </div>
                {group.rows.map((row) => {
                  const idx = indexById.get(row.id) ?? -1
                  const active = idx === activeIndex
                  return (
                    <div
                      key={row.id}
                      id={row.id}
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        activateRow(row)
                      }}
                      className={rowClass(active)}
                    >
                      {row.kind === 'commune' ? (
                        <>
                          <span className="font-medium text-[color:var(--glass-ink)]">{row.label}</span>{' '}
                          <span className="text-[color:var(--glass-ink-soft)]">· {row.sub}</span>
                        </>
                      ) : (
                        <span className="text-[color:var(--glass-ink)]">{row.label}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {!hasResults && loading && (
              <div
                role="presentation"
                className="flex items-center gap-2 px-3 py-2 text-sm text-[color:var(--glass-ink-soft)]"
              >
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {t('suggestLoading')}
              </div>
            )}
            {!hasResults && !loading && (
              <div role="presentation" className="px-3 py-2 text-sm text-[color:var(--glass-ink-soft)]">
                {t('suggestNoResult')}
              </div>
            )}

            {/* Action géoloc — dernière ligne PLATE (clavier-atteignable). */}
            <div
              id={GEOLOC_ID}
              role="option"
              aria-selected={geolocActive}
              onMouseDown={(e) => {
                e.preventDefault()
                activateRow({ kind: 'geoloc', id: GEOLOC_ID })
              }}
              className={`mt-1 flex items-center gap-2 border-t border-[color:var(--glass-border)] pt-2 ${rowClass(
                geolocActive,
              )}`}
            >
              <LocateFixed className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} aria-hidden="true" />
              <span className="font-medium text-[color:var(--glass-ink)]">{t('bureauxUseLocation')}</span>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onUseLocation}
        disabled={locating}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-sm font-bold text-[color:var(--glass-ink)] transition-colors hover:bg-[color:var(--glass-surface-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {locating ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <LocateFixed className="w-4 h-4" aria-hidden="true" />
        )}
        {t('bureauxUseLocation')}
      </button>
      {geolocError && (
        <p role="alert" className="text-xs font-medium text-amber-700 dark:text-amber-400">
          {geolocError}
        </p>
      )}
    </div>
  )
}
