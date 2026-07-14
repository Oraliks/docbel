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
import { clusterPoints, type ClusterPoint } from '@/lib/bureaus/map-clustering'
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
 * PARITÉ avec la carte SVG :
 *  - Clic sur un pin → `onView(id)` (ouvre la fiche du bureau) ; survol →
 *    `onHover(id)` (sync liste ↔ carte). Le tooltip natif Leaflet tient
 *    l'aperçu au survol, d'où l'absence de popup pinnée côté tuiles (cf.
 *    `office-map.tsx`).
 *  - Clustering des marqueurs qui se CHEVAUCHENT au zoom courant (via
 *    `clusterPoints`, la même primitive déterministe que la carte SVG) :
 *    une pastille de comptage remplace les pins superposés et, au clic, zoome
 *    pour les séparer. Le n°1 recommandé n'est JAMAIS absorbé — il reste
 *    toujours rendu comme pin individuel au-dessus des clusters.
 */

/** Vue initiale : Belgique entière (repli tant qu'aucun marqueur localisé). */
const BELGIUM_CENTER: L.LatLngExpression = [50.85, 4.35]
const BELGIUM_ZOOM = 8

/**
 * Seuil de chevauchement (en pixels ÉCRAN) au-delà duquel deux pins sont
 * fusionnés en cluster. Calibré un peu au-dessus du diamètre d'un pin standard
 * (26–34 px) pour ne regrouper QUE des marqueurs qui se recouvrent réellement.
 * La distance pixel entre deux positions dépend UNIQUEMENT du zoom (invariante
 * au pan), d'où le reclustering seulement sur `zoomend`.
 */
const CLUSTER_RADIUS_PX = 34

/** Zoom marqueur agrandi/pin recommandé — juste au-dessus des clusters. */
const Z_CLUSTER = 500

/** Marqueur déjà localisé (lat/lng non nuls) — évite les gardes null en aval. */
type LocatedMarker = OfficeMapMarker & { lat: number; lng: number }
const isLocated = (m: OfficeMapMarker): m is LocatedMarker =>
  m.lat != null && m.lng != null

/** prefers-reduced-motion : coupe les animations (zoom/fondu) — vue instantanée. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function OfficeMapLeaflet(props: OfficeMapProps & { tileUrl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  // Groupe de couches STABLE (créé au montage, jamais réassigné) qui contient
  // TOUS les calques dessinés (pins + pastilles de cluster). Le rendu se fait
  // par `clearLayers()` puis ré-ajout : pas de fuite, pas d'index à maintenir.
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  // Clé du DERNIER jeu de marqueurs localisés déjà cadré (fitBounds), pour ne
  // PAS recadrer quand seule la sélection change (cf. plus bas). `null` = jamais
  // cadré encore.
  const fittedKeyRef = useRef<string | null>(null)

  // Miroir des dernières props. Les handlers de marqueur (clic/survol) lisent
  // `latestProps.current.*` : ils voient donc toujours les callbacks à jour
  // même si l'effet de (re)construction des marqueurs n'a pas re-tourné (ex.
  // l'orchestrateur passe un nouvel `onView` sans changer `markers`). Évite les
  // closures périmées SANS mettre les callbacks dans les deps de l'effet (ce
  // qui reconstruirait tous les pins à chaque changement d'identité de callback).
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

    // prefers-reduced-motion : coupe TOUTES les animations Leaflet (zoom,
    // fondu des tuiles, zoom des marqueurs) — les transitions deviennent
    // instantanées, comme la carte SVG qui applique sa vue sans animation.
    const reduceMotion = prefersReducedMotion()

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
    // Le groupe qui portera pins + clusters, ajouté une fois pour toutes.
    layerGroupRef.current = L.layerGroup().addTo(map)

    // Dans un conteneur flex/grid, la hauteur réelle peut n'être connue qu'après
    // le premier layout : Leaflet mesure alors 0px et rend une carte grise.
    // Un `invalidateSize()` à la frame suivante force la re-mesure. Annulé au
    // démontage pour ne jamais toucher une carte détruite.
    const raf = requestAnimationFrame(() => {
      mapRef.current?.invalidateSize()
    })

    return () => {
      cancelAnimationFrame(raf)
      // `map.remove()` détruit la carte, TOUTES ses couches (tuiles, groupe de
      // marqueurs + leurs écouteurs clic/survol/tooltip) : aucune fuite.
      map.remove()
      mapRef.current = null
      layerGroupRef.current = null
      fittedKeyRef.current = null
    }
  }, [])

  // ─── (Re)construction des calques à chaque changement du jeu de marqueurs ou
  // de la sélection, ET à chaque changement de zoom (le clustering dépend de la
  // distance ÉCRAN entre pins). Pour ~10 pins, tout reconstruire est trivial ;
  // le garde-fou `fittedKeyRef` évite juste le RECADRAGE quand seule la
  // sélection change. ───
  useEffect(() => {
    const map = mapRef.current
    const group = layerGroupRef.current
    if (!map || !group) return

    // Ne place JAMAIS un bureau sans coordonnées connues à une position devinée :
    // il est simplement absent de la carte (honnêteté, comme la carte SVG). Sa
    // présence est signalée ailleurs par le boundary (`OfficeMap`).
    const located = props.markers.filter(isLocated)

    // Ajoute un pin individuel (clic → fiche, survol → sync liste). Réutilisé
    // pour les singletons de cluster ET pour le n°1 recommandé (jamais absorbé).
    const addPin = (m: LocatedMarker) => {
      const selected = m.id === latestProps.current.selectedId
      const lMarker = L.marker([m.lat, m.lng], {
        icon: makeDivIcon(m, selected),
        riseOnHover: true,
        // Le n°1 recommandé domine toujours l'empilement ; le sélectionné passe
        // au-dessus des pins standard ; les autres au niveau de base.
        zIndexOffset: m.recommended ? 1000 : selected ? 900 : 0,
      })
      // Clic sur un pin → ouvre la fiche du bureau (équivalent « Voir le
      // bureau » de la liste). Survol → synchronise le surlignage liste ↔ carte
      // via `onHover`. Callbacks lus sur `latestProps` (jamais périmés).
      lMarker.on('click', () => latestProps.current.onView(m.id))
      lMarker.on('mouseover', () => latestProps.current.onHover(m.id))
      lMarker.on('mouseout', () => latestProps.current.onHover(null))
      lMarker.bindTooltip(m.label)
      lMarker.addTo(group)
    }

    // Ajoute une pastille de comptage à la position centroïde du cluster. Au
    // clic : zoome pour cadrer ses membres (les pins se séparent alors au
    // reclustering déclenché par `zoomend`). Cas dégénéré (membres à coords
    // identiques → bounds ponctuelle) : simple zoom-in autour du point.
    const addCluster = (
      center: L.LatLng,
      count: number,
      members: LocatedMarker[],
    ) => {
      const cMarker = L.marker(center, {
        icon: makeClusterIcon(count),
        riseOnHover: true,
        zIndexOffset: Z_CLUSTER,
      })
      cMarker.on('click', () => {
        const latlngs = members.map((m): L.LatLngExpression => [m.lat, m.lng])
        if (latlngs.length === 0) return
        const animate = !prefersReducedMotion()
        const bounds = L.latLngBounds(latlngs)
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
          map.setView(bounds.getCenter(), Math.min(map.getZoom() + 3, 18), { animate })
        } else {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18, animate })
        }
      })
      cMarker.addTo(group)
    }

    // Reconstruit tous les calques au zoom courant. Séparé du cadrage
    // (fitBounds) pour pouvoir être rappelé sur `zoomend` SANS refitter (ce qui
    // écraserait le zoom de l'utilisateur).
    const renderLayers = () => {
      group.clearLayers()

      // Le n°1 recommandé est TOUJOURS rendu à part, jamais soumis au
      // clustering : sa position est garantie visible et cliquable.
      const clusterable: LocatedMarker[] = []
      const recommended: LocatedMarker[] = []
      for (const m of located) {
        if (m.recommended) recommended.push(m)
        else clusterable.push(m)
      }

      // Projette chaque marqueur clusterable en point de calque (distances
      // relatives = pixels écran au zoom courant, invariantes au pan).
      const byId = new Map<string, LocatedMarker>()
      const points: ClusterPoint[] = []
      for (const m of clusterable) {
        byId.set(m.id, m)
        const pt = map.latLngToLayerPoint([m.lat, m.lng])
        points.push({ id: m.id, x: pt.x, y: pt.y })
      }

      for (const cluster of clusterPoints(points, CLUSTER_RADIUS_PX)) {
        const members: LocatedMarker[] = []
        for (const id of cluster.ids) {
          const m = byId.get(id)
          if (m) members.push(m)
        }
        if (members.length === 0) continue
        if (members.length === 1) {
          addPin(members[0])
        } else {
          // Centroïde renvoyé en point de calque → reconverti en lat/lng.
          addCluster(map.layerPointToLatLng([cluster.x, cluster.y]), cluster.count, members)
        }
      }

      // Recommandé(s) dessiné(s) EN DERNIER et au-dessus : jamais absorbé(s).
      for (const m of recommended) addPin(m)
    }

    renderLayers()

    // fitBounds seulement quand le JEU de marqueurs localisés change réellement
    // (clé = ids triés joints). Sinon (changement de sélection uniquement, ou
    // simple mise à jour de libellés sans changement d'ids), on NE recadre PAS :
    // le zoom/pan de l'utilisateur est préservé.
    const idKey = located
      .map((m) => m.id)
      .sort()
      .join('|')
    if (idKey !== fittedKeyRef.current) {
      fittedKeyRef.current = idKey
      if (located.length >= 1) {
        // `maxZoom` garde un cadrage raisonnable même avec un seul pin (sinon
        // fitBounds zoomerait à fond sur un point unique). `animate: false` =
        // cadrage direct (respecte aussi l'esprit reduced-motion).
        const coords = located.map((m): L.LatLngExpression => [m.lat, m.lng])
        map.fitBounds(L.latLngBounds(coords), {
          padding: [40, 40],
          maxZoom: 15,
          animate: false,
        })
      }
      // 0 marqueur localisé → on garde la vue Belgique posée au montage.
    }

    // Le clustering dépend du zoom : on recluste après chaque changement de
    // zoom (le pan est sans effet sur les distances pixel entre pins). Le
    // listener est nettoyé au re-run/démontage de l'effet.
    map.on('zoomend', renderLayers)
    return () => {
      map.off('zoomend', renderLayers)
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

/**
 * Pastille de COMPTAGE d'un cluster de pins superposés. Fond violet foncé
 * translucide (même teinte que le halo de sélection, `rgba(27,21,48,…)`) +
 * bordure et chiffre blancs : c'est de la LISIBILITÉ de marqueur au-dessus d'un
 * fond de tuiles quelconque (comme les pins), pas une surface d'app — d'où le
 * blanc assumé ici, cohérent avec `makeDivIcon`. Visuellement distincte des
 * pins catégoriels pour signaler « plusieurs bureaux, cliquer pour dézoomer ».
 */
function makeClusterIcon(count: number): L.DivIcon {
  const size = count >= 10 ? 44 : 38
  const fontSize = count >= 10 ? 15 : 16
  const html =
    `<div style="` +
    `width:${size}px;height:${size}px;` +
    `display:flex;align-items:center;justify-content:center;` +
    `box-sizing:border-box;border-radius:9999px;` +
    `background:rgba(27,21,48,0.90);border:2px solid #fff;` +
    `box-shadow:0 2px 8px rgba(0,0,0,0.45);` +
    `color:#fff;font-weight:800;line-height:1;` +
    `font-size:${fontSize}px;` +
    `font-family:var(--font-sans),system-ui,sans-serif;` +
    `">${String(count)}</div>`

  return L.divIcon({
    html,
    className: 'oml-cluster',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}
