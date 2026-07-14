// app/outils/bureaux/_components/office-map.tsx
'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CustomBelgiumMap, type MapBureau } from './custom-belgium-map'
import { OfficeMapPopup } from './office-map-popup'
import { Skeleton } from '@/components/ui/skeleton'
import type { OfficeMapProps, OfficeMapMarker } from './office-map-types'

/**
 * Implémentation à tuiles réelles (Leaflet), chargée UNIQUEMENT quand
 * `NEXT_PUBLIC_MAP_TILE_URL` est configuré (cf. `tileUrl` plus bas — sinon
 * ce chunk n'est jamais demandé). `ssr: false` est IMPÉRATIF : Leaflet
 * touche `window` dès son import (cf. l'en-tête de `office-map-leaflet.tsx`),
 * ce qui casserait le rendu serveur. Ça code-splitte aussi ~150 Ko
 * (leaflet + sa CSS) hors du bundle initial quand la carte SVG de secours
 * suffit (cas par défaut, zéro config). Défini au niveau module (comme le
 * `OfficeMap` dynamique dans `bureaux-finder.tsx`) pour rester stable entre
 * les rendus.
 */
const OfficeMapLeaflet = dynamic(
  () => import('./office-map-leaflet').then((m) => ({ default: m.OfficeMapLeaflet })),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
)

/**
 * Boundary cartographique unique du finder de bureaux : SEUL composant qui
 * importe une implémentation cartographique concrète — `CustomBelgiumMap`
 * (SVG, repli par défaut, zéro config) ou `OfficeMapLeaflet` (tuiles raster
 * réelles, derrière `NEXT_PUBLIC_MAP_TILE_URL`). L'orchestrateur et le reste
 * de l'écran ne connaissent que `OfficeMapProps`/`OfficeMapMarker`
 * (`./office-map-types`) — une future implémentation réécrit CE fichier
 * sans toucher à l'orchestrateur.
 *
 * Possède aussi l'en-tête intégré (zone + compteur + légende), l'encart
 * bureaux non localisés et le popup de sélection : ce sont des éléments
 * cartographiques (overlay au-dessus du fond de carte) ou de layout partagé,
 * pas des éléments propres à une implémentation — ils ne doivent donc JAMAIS
 * être dupliqués dans `office-map-leaflet.tsx`. Owns le cadre
 * (rounded/border/glass) — rôle auparavant tenu par `CommunePanel`.
 *
 * Le popup de sélection (`OfficeMapPopup`, pinné via `pinnedId`) reste pour
 * l'instant propre au flux SVG : `CustomBelgiumMap.onPinClick` le pin
 * explicitement ci-dessous, alors que `OfficeMapLeaflet` appelle `onView`
 * directement au clic sur un pin (son propre tooltip natif tient déjà le
 * rôle d'aperçu au survol) — `pinnedId` reste donc `null` et aucun popup ne
 * se monte quand Leaflet est actif.
 */
export function OfficeMap(props: OfficeMapProps) {
  const t = useTranslations('public.outils')
  // `t` casté (idiome déjà utilisé dans custom-belgium-map.tsx / office-result-row.tsx)
  // pour référencer `mapUnlocatedTitle`, une clé ajoutée dans une tâche i18n
  // ultérieure (V3-7) : le fallback next-intl est non-bloquant si elle manque
  // encore. Les autres appels `t(...)` de ce fichier restent typés normalement.
  const tLoose = t as (key: string) => string

  // `NEXT_PUBLIC_*` est inliné côté client au build (Next.js) : vide/absent
  // → carte SVG de secours (repli honnête, toujours fonctionnel sans aucune
  // config). Une valeur non vide → bascule vers les tuiles Leaflet. Lu ici
  // (composant, pas module) car il conditionne aussi le repère dev-only
  // ci-dessous (gate `NODE_ENV`), pas seulement le choix d'implémentation.
  const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL

  // Encart bureaux non localisés : replié par défaut (juste le compteur),
  // dépliable pour lister les bureaux concernés au lieu de se contenter de
  // les compter — ils restent honnêtement absents de la carte (pas de
  // position devinée), mais deviennent atteignables via `onView`.
  const [unlocatedOpen, setUnlocatedOpen] = useState(false)

  // Popup épinglée par CLIC — distincte du highlight de pin (`selectedId`,
  // piloté par le survol côté orchestrateur, cf. plus bas). Sans cette
  // distinction, la popup clignotait au survol de la liste/des pins sur
  // desktop et ses boutons étaient inatteignables (elle se démontait dès
  // que la souris quittait le pin). `useState` posé dans le handler de clic
  // ci-dessous (jamais dans un effet) : un `pinnedId` devenu obsolète (jeu
  // de résultats changé) ne matche plus aucun marker → `pinnedMarker`
  // retombe à `null` → plus de popup, sans effet correctif nécessaire.
  const [pinnedId, setPinnedId] = useState<string | null>(null)

  // Seuls les marqueurs avec de vraies coordonnées peuvent être projetés
  // sur la carte SVG — jamais de faux placement (ex. centroïde commune)
  // pour un bureau sans lat/lng connu ; les autres sont comptés pour la
  // note honnête ci-dessous.
  //
  // Mémoïsé sur `[props.markers]` : le parent peut recevoir un tableau
  // `markers` reconstruit à un rythme qui ne reflète pas un vrai
  // changement de données (ex. re-render déclenché par autre chose que la
  // liste de bureaux). Sans ce memo, `bureaus` changerait d'identité à
  // chaque appel et invaliderait le memo interne de `CustomBelgiumMap`
  // (`useMemo` sur `[projection, bureaus]`), qui reprojetterait alors tous
  // les pins inutilement. Ce memo ne peut garantir la stabilité que si
  // `props.markers` lui-même est stable côté appelant — condition posée
  // ici, à charge de l'orchestrateur de la respecter.
  const { bureaus: memoizedBureaus, unlocatedMarkers } = useMemo(() => {
    const located: MapBureau[] = []
    const unlocated: OfficeMapMarker[] = []
    for (const marker of props.markers) {
      const { lat, lng } = marker
      if (lat == null || lng == null) {
        unlocated.push(marker)
        continue
      }
      located.push({
        id: marker.id,
        name: marker.label,
        lat,
        lng,
        color: marker.color,
        number: marker.number,
        recommended: marker.recommended,
      })
    }
    return { bureaus: located, unlocatedMarkers: unlocated }
  }, [props.markers])
  const unlocatedCount = unlocatedMarkers.length

  const pinnedMarker =
    pinnedId != null ? (props.markers.find((m) => m.id === pinnedId) ?? null) : null

  return (
    <div className="glass-surface relative h-full w-full overflow-hidden rounded-3xl">
      {/* En-tête intégré : zone + compteur + légende, en overlay flottant
          au-dessus du fond de carte (jamais dans le flux, pour laisser la
          carte remplir tout le cadre). `pointer-events-none` sur le
          conteneur pleine largeur + `pointer-events-auto` sur les puces :
          les zones vides entre les puces restent cliquables/glissables
          pour la carte en dessous (pins, zoom). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="glass-surface-strong pointer-events-auto min-w-0 flex-1 rounded-2xl px-3.5 py-2.5">
          <p className="truncate text-sm font-bold text-foreground">{props.zoneLabel}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t('mapResultCount', { count: props.resultCount })}
          </p>
          {/* Bureaux sans coordonnées connues : jamais placés sur la carte à
              une position devinée (pas de fausse précision) — encart honnête,
              replié par défaut, qui les liste par numéro + nom au lieu de se
              contenter de les compter (cf. `mapUnlocatedNote` ci-dessous). */}
          {unlocatedCount > 0 && (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setUnlocatedOpen((v) => !v)}
                aria-expanded={unlocatedOpen}
                className="flex w-full items-center gap-1 text-left text-[11px] text-muted-foreground/80"
              >
                {unlocatedOpen ? (
                  <ChevronUp className="h-3 w-3 flex-none" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3 w-3 flex-none" aria-hidden="true" />
                )}
                <span className="truncate">{t('mapUnlocatedNote', { count: unlocatedCount })}</span>
              </button>
              {unlocatedOpen && (
                <div className="mt-1.5 border-t border-border/60 pt-1.5">
                  <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">
                    {tLoose('mapUnlocatedTitle')}
                  </p>
                  <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                    {unlocatedMarkers.map((marker) => (
                      <button
                        key={marker.id}
                        type="button"
                        onClick={() => props.onView(marker.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-foreground/10"
                      >
                        <span
                          className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-black text-white"
                          style={{ background: marker.color }}
                          aria-hidden="true"
                        >
                          {marker.number}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                          {marker.label}
                        </span>
                        <span className="flex-none truncate text-[10px] text-muted-foreground">
                          {marker.typeLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="glass-surface-strong pointer-events-auto flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5">
          <span
            className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-full text-[9px] font-black text-white"
            style={{ background: 'var(--primary)' }}
            aria-hidden="true"
          >
            1
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {t('mapRecommendedLegend')}
          </span>
        </div>
      </div>

      {tileUrl ? (
        <OfficeMapLeaflet {...props} tileUrl={tileUrl} />
      ) : (
        <CustomBelgiumMap
          selectedInsCode={props.selectedInsCode}
          center={props.center}
          bureaus={memoizedBureaus}
          selectedId={props.selectedId}
          onPinClick={(id) => {
            setPinnedId(id)
            props.onSelect(id)
          }}
          onPinHover={props.onHover}
        />
      )}

      {/* Repère développeur uniquement : signale que la config tuiles est
          absente et qu'on est sur le repli SVG. Jamais en production (gate
          `NODE_ENV`) ; pas de clé i18n — ce n'est pas un texte utilisateur.
          `pointer-events-none` + fond sombre dédié (pas un token de thème,
          comme les halos de pin de `office-map-leaflet.tsx`) pour rester
          lisible par-dessus un fond de carte quelconque, sans jamais gêner
          un clic sur un pin/la carte en dessous. */}
      {!tileUrl && process.env.NODE_ENV === 'development' && (
        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-2 left-1/2 z-10 max-w-[92%] -translate-x-1/2 truncate rounded-full bg-black/60 px-2.5 py-1 text-center text-[10px] font-medium text-white/70"
        >
          NEXT_PUBLIC_MAP_TILE_URL non défini — carte de secours (SVG)
        </p>
      )}

      {pinnedMarker && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3">
          <div className="pointer-events-auto mx-auto w-full max-w-sm">
            <OfficeMapPopup
              marker={pinnedMarker}
              onView={props.onView}
              onClose={() => {
                setPinnedId(null)
                props.onHover(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
