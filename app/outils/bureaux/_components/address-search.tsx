'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, LocateFixed, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { GLASS_INPUT, GLASS_LABEL } from '@/lib/glass-classes'

export interface CommuneSuggestion {
  insCode: string
  nameFr: string
  cp: string
}

interface Props {
  value: string
  onChange: (v: string) => void
  onSelectCommune: (c: CommuneSuggestion) => void
  onUseLocation: () => void
  locating?: boolean
  /** Message d'échec géoloc déjà traduit par l'orchestrateur (refus, HTTP non
   * sécurisé, indisponible…) ; `null`/absent = rien à afficher. */
  geolocError?: string | null
}

const DEBOUNCE_MS = 200
const MIN_CHARS = 2
const CP_RE = /^\d{4}$/

/**
 * Champ « Adresse » (code postal, commune ou adresse libre) + bouton pleine
 * largeur « Utiliser ma position ». La résolution CP (4 chiffres) reste
 * côté orchestrateur ; ce composant ajoute une liste de suggestions de
 * COMMUNES (autocomplete `/api/bureaux/communes`) pour le texte libre, et
 * remonte la sélection via `onSelectCommune` (l'orchestrateur en tire un CP
 * représentatif tout en affichant le nom choisi dans le champ).
 *
 * `eligible` (≥2 caractères, PAS un CP à 4 chiffres) sert de garde DÉRIVÉE :
 * on ne déclenche jamais de fetch pour un CP tapé directement (résolu sans
 * suggestion, comme avant) ni pour une saisie trop courte, et le dropdown se
 * referme tout seul dès que la saisie redevient inéligible — sans avoir à
 * vider `suggestions` de façon synchrone dans l'effet (ce qui déclencherait
 * `react-hooks/set-state-in-effect` : dériver un état dans un effet plutôt
 * que par un calcul direct).
 */
export function AddressSearch({
  value,
  onChange,
  onSelectCommune,
  onUseLocation,
  locating = false,
  geolocError = null,
}: Props) {
  const t = useTranslations('public.outils')
  const [suggestions, setSuggestions] = useState<CommuneSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const abortRef = useRef<AbortController | null>(null)
  // Sélection en cours : `onSelectCommune` réécrit `value` (nom choisi) chez
  // le parent, ce qui redéclenche cet effet (dep `trimmed`). Sans ce garde,
  // le nom tout juste choisi (auto-match) relancerait un fetch 200 ms après
  // et rouvrirait le dropdown sur la MÊME commune — un flash très visible.
  // Un seul cycle d'effet est ignoré (consommé), puis le fetch reprend
  // normalement dès la frappe suivante.
  const skipNextFetchRef = useRef(false)

  const trimmed = value.trim()
  const eligible = trimmed.length >= MIN_CHARS && !CP_RE.test(trimmed)
  const showDropdown = eligible && open && suggestions.length > 0

  // Fetch debouncé (200 ms) + AbortController (annule la requête précédente) :
  // même mécanique que la résolution CP de l'orchestrateur. Les seuls
  // `setState` qui touchent `suggestions`/`open` arrivent dans le callback
  // ASYNCHRONE du fetch (après le `setTimeout`), jamais de façon synchrone
  // dans le corps de l'effet — la branche « inéligible » se contente
  // d'annuler une requête en vol, sans écrire d'état (cf. `showDropdown`).
  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      abortRef.current?.abort()
      return
    }
    if (!eligible) {
      abortRef.current?.abort()
      return
    }
    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      fetch(`/api/bureaux/communes?q=${encodeURIComponent(trimmed)}`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((json: { items?: CommuneSuggestion[] } | null) => {
          if (ac.signal.aborted) return
          const items = json?.items ?? []
          setSuggestions(items)
          setOpen(items.length > 0)
          setActiveIndex(-1)
        })
        .catch((e) => {
          if ((e as Error)?.name === 'AbortError' || ac.signal.aborted) return
          setSuggestions([])
          setOpen(false)
        })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [trimmed, eligible])

  // Annule toute requête encore en vol au démontage.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const selectSuggestion = (item: CommuneSuggestion) => {
    skipNextFetchRef.current = true
    onSelectCommune(item)
    setOpen(false)
    setSuggestions([])
    setActiveIndex(-1)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (open) setOpen(false)
      return
    }
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        // preventDefault : évite toute soumission implicite (champ dans un
        // formulaire) quand une suggestion est en cours de sélection au clavier.
        e.preventDefault()
        selectSuggestion(suggestions[activeIndex])
      }
    }
  }

  const listboxId = 'office-address-listbox'
  const activeOptionId =
    showDropdown && activeIndex >= 0 && activeIndex < suggestions.length
      ? `office-address-option-${suggestions[activeIndex].insCode}`
      : undefined

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
            id="office-address"
            inputMode="text"
            autoComplete="off"
            placeholder={t('bureauxAddressPlaceholder')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setOpen(true)
            }}
            onBlur={() => {
              // Délai avant fermeture pour laisser le `onMouseDown` d'une
              // suggestion (ci-dessous) aboutir avant que le blur ne ferme.
              setTimeout(() => setOpen(false), 150)
            }}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            className="border-0 px-0 h-auto bg-transparent shadow-none focus-visible:ring-0 text-sm font-medium"
          />
        </div>
        {showDropdown && (
          <ul
            id={listboxId}
            role="listbox"
            className="glass-surface absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto p-1.5"
          >
            {suggestions.map((s, i) => {
              const isActive = i === activeIndex
              return (
                <li
                  key={s.insCode}
                  id={`office-address-option-${s.insCode}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => {
                    // onMouseDown (avant le blur de l'input) pour que le clic
                    // ne soit pas annulé par la fermeture au blur.
                    e.preventDefault()
                    selectSuggestion(s)
                  }}
                  className={`cursor-pointer rounded-xl px-3 py-2 text-sm transition-colors hover:bg-[color:var(--glass-pop-bg)] ${
                    isActive ? 'bg-[color:var(--glass-pop-bg)]' : ''
                  }`}
                >
                  <span className="font-medium text-[color:var(--glass-ink)]">{s.nameFr}</span>{' '}
                  <span className="text-[color:var(--glass-ink-soft)]">· {s.cp}</span>
                </li>
              )
            })}
          </ul>
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
