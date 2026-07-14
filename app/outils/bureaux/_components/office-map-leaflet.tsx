// app/outils/bureaux/_components/office-map-leaflet.tsx
'use client'

// Import de la CSS Leaflet AU NIVEAU MODULE : indispensable pour le rendu
// correct des tuiles, contrôles zoom et positionnement des marqueurs.
import 'leaflet/dist/leaflet.css'
// `import L from 'leaflet'` accède à `window` au moment de l'import. C'est SÛR
// ici car ce composant n'est JAMAIS chargé côté serveur : il est destiné à un
// import dynamique `{ ssr: false }` (câblé dans la tâche suivante, derrière le
// même boundary que la carte SVG). `esModuleInterop` (tsconfig) mappe le
// default sur le namespace `L`.
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import type { OfficeMapProps, OfficeMapMarker } from './office-map-types'

/**
 * Implémentation cartographique ALTERNATIVE du finder de bureaux, à fond de
 * tuiles réelles (OpenStreetMap ou compatible), en Leaflet BRUT (pas de
 * `react-leaflet`, pas de dépendance supplémentaire — juste `leaflet` +
 * `@types/leaflet` déjà installés).
 *
 * Consomme EXACTEMENT le même `OfficeMapProps` que la carte SVG
 * (`./office-map-types`), plus `tileUrl` : le finder reste totalement isolé
 * de l'implémentation carto. Aucun type métier n'entre ici — tout arrive déjà
 * résolu (i18n, couleurs, formatage). L'orchestrateur ne connaît que le
 * contrat ; on peut basculer SVG ↔ tuiles sans le toucher.
 *
 * Tout est IMPÉRATIF (refs Leaflet), pas de state React : pan / drag / molette /
 * pinch / double-clic sont gérés nativement par Leaflet (c'est tout l'intérêt
 * des tuiles vs. la carte SVG maison). Les marqueurs sont des `divIcon` HTML
 * pour maîtriser le look ET contourner le bug bien connu du chemin d'icône par
 * défaut de Leaflet (images cassées quand les assets ne sont pas résolus par
 * le bundler).
 *
 * NON couvert dans cette passe (suivi documenté) : le clustering natif Leaflet
 * (`leaflet.markercluster`). Le zoom natif sépare déjà les pins ; le clustering
 * sera ajouté ultérieurement si nécessaire.
 */

/** Vue initiale : Belgique entière (repli tant qu'aucun marqueur localisé). */
const BELGIUM_CENTER: L.LatLngExpression = [50.85, 4.35]
const BELGIUM_ZOOM = 8

export function OfficeMapLeaflet(props: OfficeMapProps & { tileUrl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  // Marqueurs vivants indexés par id — permet de tous les retirer/reconstruire
  // proprement (pas de fuite) à chaque changement de `markers`/`selectedId`.
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  // Clé du DERNIER jeu de marqueurs localisés déjà cadré (fitBounds), pour ne
  // PAS recadrer quand seule la sélection change (cf. plus bas). `null` = jamais
  // cadré encore.
  const fittedKeyRef = useRef<string | null>(null)

  // Miroir des dernières props. Les handlers de marqueur (clic/survol) et
  // l'effet d'init lisent `latestProps.current.*` : ils voient donc toujours
  // les callbacks/tileUrl à jour même si l'effet de (re)construction des
  // marqueurs n'a pas re-tourné (ex. l'orchestrateur passe un nouvel `onView`
  // sans changer `markers`). Évite les closures périmées SANS mettre les
  // callbacks dans les deps de l'effet (ce qui reconstruirait tous les pins à
  // chaque changement d'identité de callback).
  const latestProps = useRef(props)
  // Synchronisée dans un effet APRÈS chaque rendu — jamais en phase de rendu :
  // la règle react-hooks/refs interdit d'écrire `.current` pendant le rendu.
  // `useRef(props)` a déjà posé la valeur initiale, donc l'effet d'init (monté
  // avant toute interaction) lit bien le `tileUrl` initial.
  useEffect(() => {
    latestProps.current = props
  })

  // ─── Cycle de vie de la carte : créée UNE FOIS au montage, détruite au
  // démontage. Aucune dépendance réactive dans les deps (`[]`) : `tileUrl` est
  // lu via `latestProps` (ref, non réactive) donc pas d'avertissement
  // exhaustive-deps, et la carte n'est jamais recréée (tileUrl est une valeur
  // d'environnement stable pour la vie du composant). ───
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // `markersRef.current` est un Map STABLE (jamais réassigné, seulement
    // muté) : on le capture pour l'utiliser dans le cleanup sans lire
    // `.current` au démontage (react-hooks/exhaustive-deps).
    const markersMap = markersRef.current

    // prefers-reduced-motion : coupe TOUTES les animations Leaflet (zoom,
    // fondu des tuiles, zoom des marqueurs) — les transitions deviennent
    // instantanées, comme la carte SVG qui applique sa vue sans animation.
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const mapOptions: L.MapOptions = {
      zoomControl: true,
      attributionControl: true,
    }
    if (reduceMotion) {
      mapOptions.zoomAnimation = false
      mapOptions.fadeAnimation = false
      mapOptions.markerZoomAnimation = false
    }

    const map = L.map(container, mapOptions)
    L.tileLayer(latestProps.current.tileUrl, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    map.setView(BELGIUM_CENTER, BELGIUM_ZOOM)
    mapRef.current = map

    // Dans un conteneur flex/grid, la hauteur réelle peut n'être connue qu'après
    // le premier layout : Leaflet mesure alors 0px et rend une carte grise.
    // Un `invalidateSize()` à la frame suivante force la re-mesure. Annulé au
    // démontage pour ne jamais toucher une carte détruite.
    const raf = requestAnimationFrame(() => {
      mapRef.current?.invalidateSize()
    })

    return () => {
      cancelAnimationFrame(raf)
      // `map.remove()` détruit la carte, TOUTES ses couches (tuiles + marqueurs)
      // et leurs écouteurs (clic/survol des pins, tooltips) : aucune fuite.
      map.remove()
      mapRef.current = null
      markersMap.clear()
      fittedKeyRef.current = null
    }
  }, [])

  // ─── (Re)construction des marqueurs à chaque changement du jeu de marqueurs
  // ou de la sélection. Pour ~10 pins, tout reconstruire est trivial ; le
  // garde-fou `fittedKeyRef` évite juste le RECADRAGE quand seule la sélection
  // change. ───
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Retire tous les marqueurs existants + vide l'index (chaque `remove()`
    // détache aussi les écouteurs et le tooltip du marqueur : pas de fuite).
    for (const marker of markersRef.current.values()) marker.remove()
    markersRef.current.clear()

    const coords: L.LatLngExpression[] = []
    for (const marker of props.markers) {
      const { lat, lng } = marker
      // Un bureau sans coordonnées connues n'est JAMAIS placé à une position
      // devinée : il est simplement absent de la carte (honnêteté, comme la
      // carte SVG). Sa présence est signalée ailleurs par le boundary.
      if (lat == null || lng == null) continue

      const latlng: L.LatLngExpression = [lat, lng]
      coords.push(latlng)
      const selected = marker.id === props.selectedId

      const lMarker = L.marker(latlng, {
        icon: makeDivIcon(marker, selected),
        riseOnHover: true,
        // Le n°1 recommandé domine toujours l'empilement ; le sélectionné passe
        // au-dessus des pins standard ; les autres au niveau de base.
        zIndexOffset: marker.recommended ? 1000 : selected ? 900 : 0,
      })

      // Clic sur un pin → ouvre la fiche du bureau (équivalent « Voir le
      // bureau » de la liste). Survol → synchronise le surlignage liste ↔ carte
      // via `onHover`. Les callbacks sont lus sur `latestProps` (jamais périmés).
      lMarker.on('click', () => latestProps.current.onView(marker.id))
      lMarker.on('mouseover', () => latestProps.current.onHover(marker.id))
      lMarker.on('mouseout', () => latestProps.current.onHover(null))
      lMarker.bindTooltip(marker.label)
      lMarker.addTo(map)
      markersRef.current.set(marker.id, lMarker)
    }

    // fitBounds seulement quand le JEU de marqueurs localisés change réellement
    // (clé = ids triés joints). Sinon (changement de sélection uniquement, ou
    // simple mise à jour de libellés sans changement d'ids), on NE recadre PAS :
    // le zoom/pan de l'utilisateur est préservé.
    const idKey = [...markersRef.current.keys()].sort().join('|')
    if (idKey !== fittedKeyRef.current) {
      fittedKeyRef.current = idKey
      if (coords.length >= 1) {
        // `maxZoom` garde un cadrage raisonnable même avec un seul pin (sinon
        // fitBounds zoomerait à fond sur un point unique). `animate: false` =
        // cadrage direct (respecte aussi l'esprit reduced-motion).
        map.fitBounds(L.latLngBounds(coords), {
          padding: [40, 40],
          maxZoom: 15,
          animate: false,
        })
      }
      // 0 marqueur localisé → on garde la vue Belgique posée au montage.
    }
  }, [props.markers, props.selectedId])

  return (
    <div
      ref={containerRef}
      // Le parent (boundary `OfficeMap`) impose la vraie taille + le cadre
      // (arrondi / overflow-hidden). `minHeight` = plancher pour que Leaflet
      // puisse toujours se dimensionner même si le parent n'a pas encore de
      // hauteur résolue.
      className="h-full w-full"
      style={{ minHeight: 320 }}
    />
  )
}

/**
 * Construit l'icône HTML (`divIcon`) d'un pin : pastille circulaire à la
 * couleur catégorielle du bureau, numéro en blanc lisible sur N'IMPORTE quel
 * fond grâce à une ombre de texte sombre (même principe que le contour sombre
 * des numéros de la carte SVG). La couleur de la pastille + le numéro blanc,
 * c'est de la LISIBILITÉ de marqueur (comme la carte SVG), pas une surface
 * d'app — d'où l'usage assumé de blanc ici.
 *
 * `recommended` → plus grand + anneau clair doux. `selected` → agrandi + halo
 * sombre (box-shadow) pour ressortir sur le fond de tuiles.
 *
 * En passant `className: 'oml-pin'`, on REMPLACE la classe par défaut
 * `leaflet-div-icon` (dont la CSS Leaflet impose un fond blanc + bordure grise) :
 * plus de « boîte blanche » parasite, et aucune CSS externe nécessaire au-delà
 * de `leaflet.css`.
 */
function makeDivIcon(m: OfficeMapMarker, selected: boolean): L.DivIcon {
  const base = m.recommended ? 34 : 26
  // +6 en sélection → tailles paires (32 / 40) : ancrage entier et net.
  const size = selected ? base + 6 : base
  const digits = String(m.number).length
  const fontSize = digits >= 2 ? Math.round(size * 0.38) : Math.round(size * 0.46)

  let boxShadow: string
  if (selected) {
    // Halo sombre universel (lisible même sur une pastille claire, ex. COMMUNE
    // blanche) + ombre portée pour décoller du fond de tuiles.
    boxShadow = '0 0 0 3px rgba(27,21,48,0.92), 0 2px 8px rgba(0,0,0,0.5)'
  } else if (m.recommended) {
    // Anneau clair doux pour le n°1 recommandé (présence renforcée).
    boxShadow = '0 0 0 3px rgba(255,255,255,0.5), 0 2px 6px rgba(0,0,0,0.4)'
  } else {
    // Simple ombre portée pour détacher tout pin standard du fond.
    boxShadow = '0 1px 4px rgba(0,0,0,0.4)'
  }

  // `m.number` est un nombre (sûr) — on le sérialise juste en chaîne. La couleur
  // provient d'un registre interne de confiance (TYPE_META), pas d'une entrée
  // utilisateur.
  const html =
    `<div style="` +
    `width:${size}px;height:${size}px;` +
    `display:flex;align-items:center;justify-content:center;` +
    `box-sizing:border-box;border-radius:9999px;` +
    `background:${m.color};border:2px solid #fff;` +
    `box-shadow:${boxShadow};` +
    `color:#fff;font-weight:800;line-height:1;` +
    `font-size:${fontSize}px;` +
    `font-family:var(--font-sans),system-ui,sans-serif;` +
    `text-shadow:0 0 2px rgba(0,0,0,0.8);` +
    `">${String(m.number)}</div>`

  return L.divIcon({
    html,
    className: 'oml-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  })
}
