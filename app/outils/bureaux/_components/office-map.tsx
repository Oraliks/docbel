// app/outils/bureaux/_components/office-map.tsx
'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CustomBelgiumMap, type MapBureau } from './custom-belgium-map'
import { OfficeMapPopup } from './office-map-popup'
import type { OfficeMapProps } from './office-map-types'

/**
 * Boundary cartographique unique du finder de bureaux : SEUL composant qui
 * importe `CustomBelgiumMap`. L'orchestrateur et le reste de l'écran ne
 * connaissent que `OfficeMapProps`/`OfficeMapMarker` (`./office-map-types`)
 * — une future implémentation (Mapbox/MapLibre) réécrit CE fichier sans
 * toucher à l'orchestrateur.
 *
 * Possède aussi l'en-tête intégré (zone + compteur + légende) et le popup
 * de sélection : ce sont des éléments cartographiques (overlay au-dessus
 * du fond de carte), pas des éléments de layout de l'orchestrateur. Owns le
 * cadre (rounded/border/glass) — rôle auparavant tenu par `CommunePanel`.
 */
export function OfficeMap(props: OfficeMapProps) {
  const t = useTranslations('public.outils')

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
  const { bureaus: memoizedBureaus, unlocatedCount } = useMemo(() => {
    const located: MapBureau[] = []
    let missing = 0
    for (const marker of props.markers) {
      const { lat, lng } = marker
      if (lat == null || lng == null) {
        missing += 1
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
    return { bureaus: located, unlocatedCount: missing }
  }, [props.markers])

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
          {unlocatedCount > 0 && (
            <p className="truncate text-[11px] text-muted-foreground/80">
              {t('mapUnlocatedNote', { count: unlocatedCount })}
            </p>
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
