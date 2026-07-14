'use client'

import { useEffect, useRef, useState, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslations } from 'next-intl'
import { feature } from 'topojson-client'
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import type { Topology } from 'topojson-specification'
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { MapPin, Plus, Minus, Crosshair } from 'lucide-react'
import { clusterPoints } from '@/lib/bureaus/map-clustering'

interface MapBureau {
  id: string
  name: string
  lat: number
  lng: number
  color: string
  /** Rang à afficher dans le pin (1 = bureau recommandé, puis 2, 3…).
   *  Optionnel : les appelants existants (ex. CommunePanel) sans
   *  numérotation gardent le dot simple, sans texte dessus. */
  number?: number
  /** Bureau n°1 recommandé pour la démarche en cours : pin plus grand +
   *  présence renforcée. Optionnel, absent/`false` = dot standard. */
  recommended?: boolean
}

interface Props {
  /** insCode de la commune sélectionnée (= nis dans le topojson). */
  selectedInsCode: string | null
  /** Centre fallback si la commune ne match pas. */
  center?: { lat: number; lng: number } | null
  /** Bureaux à pinpoint (CPAS, ONEM, Commune, OP). */
  bureaus: MapBureau[]
  height?: number
  /** Id du bureau actuellement sélectionné (sync pin ↔ liste). Optionnel :
   *  les usages existants sans sélection continuent de fonctionner tels quels. */
  selectedId?: string | null
  /** Callback au clic sur un pin — permet la sélection pin ↔ liste. Optionnel :
   *  si absent, les pins restent non cliquables (comportement inchangé). */
  onPinClick?: (id: string) => void
  /** Callback au survol d'un pin (entrée → id, sortie → null) — permet la
   *  synchronisation hover pin ↔ liste. Optionnel : si absent, aucun
   *  handler n'est posé (comportement inchangé). */
  onPinHover?: (id: string | null) => void
}

interface MunicipalityProps {
  nis: string
  name_fr: string
  name_nl: string
  arr_nis?: string
  arr_fr?: string
  reg_nis?: string
  reg_fr?: string
}

type MunicipalityFeature = Feature<Polygon | MultiPolygon, MunicipalityProps>

/** Position écran mémoïsée d'un bureau (résultat de la projection d3-geo). */
interface MapMarker {
  bureau: MapBureau
  x: number
  y: number
}

/** Snapshot figé d'un geste pan/pinch en cours (valeurs de départ du geste). */
interface Gesture {
  mode: 'pan' | 'pinch'
  startX: number
  startY: number
  startTx: number
  startTy: number
  startScale: number
  startDist: number
  midX: number
  midY: number
}

/**
 * Carte custom 100% SVG construite à partir du TopoJSON Belgique
 * (bmesuere/belgium-topojson, 581 communes + arrondissements + provinces).
 *
 * Pas de tiles externes. Rendu pur design system :
 *   - Commune sélectionnée en violet plein
 *   - Voisines (mêmes bbox overlap + arrondissement) en gris clair avec label
 *   - Pin violet sur le centroïde de la commune sélectionnée
 *   - Pins pour les bureaux (couleur organisme)
 *   - Boutons + / − zoom custom
 *
 * Le TopoJSON est chargé lazy au mount (1 fetch, ~150KB gzippé). En SSR le
 * composant rend juste un placeholder (height fixe pour pas de layout shift).
 */
type ZoomLevel = 'commune' | 'arrondissement' | 'country'

const ZOOM_LABEL_KEYS: Record<ZoomLevel, string> = {
  commune: 'mapZoomCommune',
  arrondissement: 'mapZoomArrondissement',
  country: 'mapZoomCountry',
}

const ZOOM_ORDER: ZoomLevel[] = ['commune', 'arrondissement', 'country']

/** Bornes du zoom continu (vue libre : molette / pinch). */
const MIN_SCALE = 0.8
const MAX_SCALE = 8

export function CustomBelgiumMap({
  selectedInsCode,
  center,
  bureaus,
  height = 420,
  selectedId = null,
  onPinClick,
  onPinHover,
}: Props) {
  const t = useTranslations('public.outils')
  const [topo, setTopo] = useState<Topology | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 380, h: height })
  const [level, setLevel] = useState<ZoomLevel>('commune')

  // ─── Vue pan / zoom / pinch : transform SVG (translate + scale) appliqué
  // PAR-DESSUS la projection fitExtent. Identité { scale:1, tx:0, ty:0 } = aucune
  // transformation (la projection cadre déjà la commune au « scale 1 »). Les
  // POLYGONES sont mis à l'échelle dans un <g transform> ; les PINS sont rendus
  // hors de ce groupe et gardent une taille constante (cf. rendu plus bas). ───
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 })
  const [grabbing, setGrabbing] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  // Pointeurs actifs (souris / tactile) + snapshot du geste en cours.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const gestureRef = useRef<Gesture | null>(null)
  // Passe à true dès qu'un pan/pinch a réellement bougé : empêche le clic d'un
  // pin de se déclencher après un vrai déplacement (un tap net sélectionne).
  const draggedRef = useRef(false)
  // `t` casté comme le reste du finder pour référencer `mapRecenter` (clé
  // ajoutée dans une tâche ultérieure) sans casser le typecheck ; le fallback
  // next-intl est non-bloquant si la clé manque encore.
  const tLoose = t as (key: string) => string

  // Reset au niveau commune quand la commune sélectionnée change
  useEffect(() => {
    setLevel('commune')
  }, [selectedInsCode])

  // Reset de la VUE (pan/zoom) quand la commune sélectionnée change — via le
  // pattern React sanctionné « ajuster l'état pendant le rendu ». L'ESLint du
  // repo interdit un setState synchrone dans un useEffect ; on n'ajoute donc
  // PAS ce reset au useEffect setLevel ci-dessus (ce serait une nouvelle erreur
  // à côté de l'existante), on le fait en phase de rendu.
  const [prevSel, setPrevSel] = useState(selectedInsCode)
  if (selectedInsCode !== prevSel) {
    setPrevSel(selectedInsCode)
    setView({ scale: 1, tx: 0, ty: 0 })
  }

  // Charge le TopoJSON une fois
  useEffect(() => {
    let cancelled = false
    fetch('/geo/belgium.topo.json')
      .then((r) => r.json())
      .then((data: Topology) => {
        if (!cancelled) setTopo(data)
      })
      .catch(() => {
        /* fallback : composant affichera un message d'erreur */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Tracker la taille du container (responsive)
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (cr) setSize({ w: Math.round(cr.width), h: Math.round(cr.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Zoom molette : listener natif NON-passif. React attache `onWheel` en passif
  // (e.preventDefault() y serait ignoré + warning console), on passe donc par
  // addEventListener({ passive: false }) pour bloquer le scroll de page et
  // zoomer autour du curseur. Clé sur `topo` : le <svg> n'existe qu'une fois le
  // TopoJSON chargé (avant, on rend le placeholder → svgRef.current est null).
  useEffect(() => {
    const el = svgRef.current
    if (!el || !topo) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      setView((v) => {
        const s2 = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
        if (s2 === v.scale) return v
        // Zoom-around-point : garde le point sous le curseur fixe.
        return {
          scale: s2,
          tx: cx - (cx - v.tx) * (s2 / v.scale),
          ty: cy - (cy - v.ty) * (s2 / v.scale),
        }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [topo])

  const projection = useMemo(() => {
    if (!topo || !topo.objects.municipalities) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fc = feature(topo, topo.objects.municipalities as any) as unknown as FeatureCollection<
      Polygon | MultiPolygon,
      MunicipalityProps
    >

    // Commune sélectionnée
    const selected = selectedInsCode
      ? (fc.features.find(
          (f) => f.properties.nis === selectedInsCode
        ) as MunicipalityFeature | undefined)
      : null

    // Détermine les voisins selon le niveau de zoom :
    //   commune        : voisins directs (bbox overlap)
    //   arrondissement : toutes les communes du même arr_nis
    //   country        : toutes les communes du pays (Belgique entière)
    let neighbors: MunicipalityFeature[] = []
    if (selected) {
      if (level === 'arrondissement') {
        neighbors = fc.features.filter(
          (f) =>
            f.properties.nis !== selected.properties.nis &&
            f.properties.arr_nis === selected.properties.arr_nis
        ) as MunicipalityFeature[]
      } else if (level === 'country') {
        // Toute la Belgique : toutes les autres communes
        neighbors = fc.features.filter(
          (f) => f.properties.nis !== selected.properties.nis
        ) as MunicipalityFeature[]
      } else {
        // commune : voisins directs via bbox overlap
        const p = geoPath()
        const sb = p.bounds(selected as unknown as GeoPermissibleObjects)
        const [[x0, y0], [x1, y1]] = sb
        const padX = (x1 - x0) * 0.6
        const padY = (y1 - y0) * 0.6
        const expanded: [[number, number], [number, number]] = [
          [x0 - padX, y0 - padY],
          [x1 + padX, y1 + padY],
        ]
        neighbors = fc.features.filter((f) => {
          if (f.properties.nis === selected.properties.nis) return false
          const fb = p.bounds(f as unknown as GeoPermissibleObjects)
          return bboxOverlaps(fb, expanded)
        }) as MunicipalityFeature[]
      }
    }

    // Projection : fitExtent dépend du niveau
    //   commune        : juste la commune sélectionnée (gros zoom)
    //   arrondissement : commune + toutes celles de l'arrondissement
    //   country        : toute la Belgique (toutes les communes du pays)
    let focusFeatures: MunicipalityFeature[]
    if (!selected) {
      focusFeatures = fc.features as MunicipalityFeature[]
    } else if (level === 'commune') {
      focusFeatures = [selected]
    } else if (level === 'country') {
      // Fit sur tout le pays — peu importe la commune sélectionnée
      focusFeatures = fc.features as MunicipalityFeature[]
    } else {
      focusFeatures = [selected, ...neighbors]
    }
    const focusCollection: FeatureCollection<Polygon | MultiPolygon> = {
      type: 'FeatureCollection',
      features: focusFeatures,
    }
    // Padding : gros zoom commune = beaucoup d'air ; arr/pays = bord
    // serré pour maximiser la surface utile
    const pad = level === 'commune' ? 70 : level === 'country' ? 12 : 24
    const proj = geoMercator().fitExtent(
      [
        [pad, pad],
        [size.w - pad, size.h - pad],
      ],
      focusCollection as unknown as GeoPermissibleObjects
    )
    const path = geoPath(proj)
    return {
      selected,
      neighbors,
      path,
      proj,
    }
  }, [topo, selectedInsCode, size.w, size.h, level])

  // Positions écran mémoïsées des bureaux : évite de reprojeter chaque pin
  // à chaque re-render du parent (ex. frappe dans un champ de recherche)
  // tant que la projection et la liste de bureaux ne changent pas réellement.
  // Pas besoin de size.w/size.h ici : `projection` change déjà d'identité
  // quand la taille change (cf. ses propres deps ci-dessus), donc ces
  // dépendances seraient redondantes (et signalées comme telles par eslint).
  const markers = useMemo<MapMarker[]>(() => {
    if (!projection) return []
    const out: MapMarker[] = []
    for (const b of bureaus) {
      const xy = projection.proj([b.lng, b.lat])
      if (xy && Number.isFinite(xy[0])) {
        out.push({ bureau: b, x: xy[0], y: xy[1] })
      }
    }
    return out
  }, [projection, bureaus])

  // Index bureau par id : `clusterPoints` ne travaille que sur des points bruts
  // {id,x,y}, jamais sur l'objet bureau complet — ce lookup permet de retrouver
  // le bureau (couleur/numéro/nom…) derrière un id de cluster au rendu.
  const markersById = useMemo(() => {
    const map = new Map<string, MapMarker>()
    for (const m of markers) map.set(m.bureau.id, m)
    return map
  }, [markers])

  // Position ÉCRAN (sous la vue pan/zoom courante) de chaque marqueur localisé.
  // C'est cette position — pas `markers[].{x,y}`, qui vit dans l'espace de
  // base non zoomé — qu'il faut comparer pour détecter des pins superposés à
  // l'écran : deux bureaux proches en coordonnées de base peuvent être très
  // écartés à l'écran une fois zoomés, et inversement une fois dézoomés.
  const screenPts = useMemo(
    () =>
      markers.map((m) => ({
        id: m.bureau.id,
        x: view.tx + m.x * view.scale,
        y: view.ty + m.y * view.scale,
      })),
    [markers, view]
  )

  // Regroupe les pins superposés en clusters — SAUF le n°1 recommandé, qui ne
  // doit JAMAIS être absorbé dans une bulle de compte (c'est l'ancre visuelle
  // de la carte : il doit toujours rester identifiable en un coup d'œil).
  // `clusterPoints` ne reçoit donc que les points « clusterables » (tous sauf
  // le recommandé) ; le recommandé est collecté à part et rendu séparément,
  // toujours en Dot individuel (cf. rendu plus bas).
  const { clusters, recommendedPts } = useMemo(() => {
    const recommended: typeof screenPts = []
    const clusterable: typeof screenPts = []
    for (const p of screenPts) {
      const bureau = markersById.get(p.id)?.bureau
      if (bureau && (bureau.recommended || bureau.number === 1)) {
        recommended.push(p)
      } else {
        clusterable.push(p)
      }
    }
    return { clusters: clusterPoints(clusterable, 28), recommendedPts: recommended }
  }, [screenPts, markersById])

  // Zoom autour d'un point ÉCRAN : (cx,cy) reste visuellement fixe pendant que
  // le scale change (même formule zoom-around-point que la molette, cf.
  // `onWheel` plus bas — dupliquée ici plutôt que partagée pour ne PAS toucher
  // à la logique molette/pinch existante). Utilisé pour le clic de
  // dé-clustering sur une bulle : zoomer vers le cluster jusqu'à ce qu'il
  // éclate en pins individuels.
  function zoomAroundPoint(cx: number, cy: number, factor: number) {
    setView((v) => {
      const s2 = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
      if (s2 === v.scale) return v
      return {
        scale: s2,
        tx: cx - (cx - v.tx) * (s2 / v.scale),
        ty: cy - (cy - v.ty) * (s2 / v.scale),
      }
    })
  }

  // Rendu d'un Dot individuel (bureau localisé) à une position ÉCRAN donnée —
  // factorisé car utilisé à deux endroits : cluster de taille 1 (singleton,
  // rendu identique à l'ancien comportement pin-par-pin) et pins recommandés
  // (toujours rendus à part, jamais clusterisés). Ferme sur les mêmes props
  // que l'ancien rendu (selectedId/onPinClick/onPinHover/draggedRef).
  function renderDot(b: MapBureau, sx: number, sy: number) {
    return (
      <g
        key={b.id}
        transform={`translate(${sx}, ${sy})`}
        onMouseEnter={() => onPinHover?.(b.id)}
        onMouseLeave={() => onPinHover?.(null)}
      >
        <Dot
          color={b.color}
          title={b.name}
          selected={b.id === selectedId}
          number={b.number}
          recommended={b.recommended}
          onClick={
            onPinClick
              ? () => {
                  // Un vrai drag/pinch ne doit pas sélectionner un pin ; un
                  // simple tap (sans déplacement) sélectionne toujours.
                  if (!draggedRef.current) onPinClick(b.id)
                }
              : undefined
          }
        />
      </g>
    )
  }

  // ─── Gestes pan / pinch via Pointer Events (aucune dépendance externe) ───
  // Le viewBox du <svg> est 1:1 avec ses pixels rendus (width=size.w,
  // viewBox="0 0 size.w size.h"), donc 1 px client = 1 unité SVG : les deltas
  // client s'appliquent directement à tx/ty, et (clientX - rect.left) donne la
  // position locale au SVG pour le zoom-around-point.
  function toLocal(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: clientX, y: clientY }
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function onPointerDownSvg(e: ReactPointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const wasEmpty = pointersRef.current.size === 0
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (wasEmpty) draggedRef.current = false // nouvelle interaction
    setGrabbing(true)
    const pts = [...pointersRef.current.values()]
    if (pts.length === 1) {
      // 1 pointeur → PAN : fige position + translation de départ.
      gestureRef.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        startTx: view.tx,
        startTy: view.ty,
        startScale: view.scale,
        startDist: 0,
        midX: 0,
        midY: 0,
      }
    } else if (pts.length === 2) {
      // 2 pointeurs → PINCH : distance initiale + milieu (coords SVG) + scale
      // et translation de départ. Un pinch n'est jamais un clic de pin.
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const mid = toLocal((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2)
      draggedRef.current = true
      gestureRef.current = {
        mode: 'pinch',
        startX: 0,
        startY: 0,
        startTx: view.tx,
        startTy: view.ty,
        startScale: view.scale,
        startDist: Math.hypot(dx, dy) || 1,
        midX: mid.x,
        midY: mid.y,
      }
    }
  }

  function onPointerMoveSvg(e: ReactPointerEvent<SVGSVGElement>) {
    const p = pointersRef.current.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    const g = gestureRef.current
    if (!g) return
    const pts = [...pointersRef.current.values()]
    if (g.mode === 'pan' && pts.length === 1) {
      // Pan : translation = départ + déplacement client depuis le pointerdown.
      const dx = e.clientX - g.startX
      const dy = e.clientY - g.startY
      if (!draggedRef.current && Math.hypot(dx, dy) > 4) draggedRef.current = true
      setView({ scale: g.startScale, tx: g.startTx + dx, ty: g.startTy + dy })
    } else if (g.mode === 'pinch' && pts.length >= 2) {
      // Pinch : nouveau scale = scale de départ × (dist courante / dist départ),
      // borné, appliqué en zoom-around-point autour du milieu figé au départ.
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const dist = Math.hypot(dx, dy) || 1
      const s2 = clamp(g.startScale * (dist / g.startDist), MIN_SCALE, MAX_SCALE)
      setView({
        scale: s2,
        tx: g.midX - (g.midX - g.startTx) * (s2 / g.startScale),
        ty: g.midY - (g.midY - g.startTy) * (s2 / g.startScale),
      })
    }
  }

  function onPointerUpSvg(e: ReactPointerEvent<SVGSVGElement>) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // capture déjà relâchée — sans effet
    }
    pointersRef.current.delete(e.pointerId)
    const pts = [...pointersRef.current.values()]
    if (pts.length === 1) {
      // Il reste 1 doigt après un pinch → on repart proprement en pan pour lui
      // (sinon le geste resterait « coincé » en mode pinch avec un seul point).
      gestureRef.current = {
        mode: 'pan',
        startX: pts[0].x,
        startY: pts[0].y,
        startTx: view.tx,
        startTy: view.ty,
        startScale: view.scale,
        startDist: 0,
        midX: 0,
        midY: 0,
      }
    } else if (pts.length === 0) {
      gestureRef.current = null
      setGrabbing(false)
    }
  }

  if (!topo) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          minHeight: height,
          borderRadius: 10,
          background: 'var(--muted)',
        }}
        className="flex items-center justify-center text-xs text-muted-foreground"
      >
        {t('mapLoading')}
      </div>
    )
  }

  const sel = projection?.selected
  const selCentroid = sel ? projection!.path.centroid(sel as unknown as GeoPermissibleObjects) : null
  const selBbox = sel ? projection!.path.bounds(sel as unknown as GeoPermissibleObjects) : null

  return (
    <div
      ref={containerRef}
      // height: 100 % laisse le parent (flex-1 dans CommunePanel) imposer
      // la vraie hauteur ; minHeight garantit un fallback lisible si le
      // parent n'a pas de hauteur explicite (e.g. usage standalone).
      // Le ResizeObserver détecte la taille réelle et reprojette la carte.
      style={{
        width: '100%',
        height: '100%',
        minHeight: height,
        borderRadius: 10,
        overflow: 'hidden',
      }}
      className="relative bg-[color-mix(in_oklab,var(--primary)_4%,white)] dark:bg-[color-mix(in_oklab,var(--primary)_8%,#0c0c12)] border border-border"
    >
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        onPointerDown={onPointerDownSvg}
        onPointerMove={onPointerMoveSvg}
        onPointerUp={onPointerUpSvg}
        onPointerCancel={onPointerUpSvg}
        style={{
          display: 'block',
          // touch-action: none → le navigateur ne scrolle/zoome pas la page
          // pendant un pan/pinch tactile sur la carte.
          touchAction: 'none',
          cursor: grabbing ? 'grabbing' : 'grab',
        }}
      >
        {/* Groupe TRANSFORMÉ (pan + zoom continu) : polygones + labels. Les
            strokes restent fins grâce à vectorEffect="non-scaling-stroke".
            Aucune transition CSS sur le transform → pas de mouvement animé
            (respecte prefers-reduced-motion : on applique la vue directement). */}
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          {/* Voisins en gris clair. Stroke + fill légèrement plus
              discrets au niveau pays (580 polygones) pour ne pas
              créer un quadrillage trop chargé. */}
          {projection?.neighbors.map((f) => (
            <path
              key={f.properties.nis}
              d={projection.path(f as unknown as GeoPermissibleObjects) ?? undefined}
              fill={
                level === 'country'
                  ? 'color-mix(in oklab, var(--foreground) 3%, transparent)'
                  : 'color-mix(in oklab, var(--foreground) 5%, transparent)'
              }
              stroke={
                level === 'country'
                  ? 'color-mix(in oklab, var(--foreground) 10%, transparent)'
                  : 'color-mix(in oklab, var(--foreground) 15%, transparent)'
              }
              strokeWidth={level === 'country' ? 0.4 : 0.6}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* Commune sélectionnée : contour violet net, mais remplissage
              très discret — les marqueurs numérotés doivent rester le
              point focal de la carte, pas le polygone. */}
          {sel && (
            <path
              d={projection!.path(sel as unknown as GeoPermissibleObjects) ?? undefined}
              fill="color-mix(in oklab, var(--primary) 8%, transparent)"
              stroke="var(--primary)"
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Labels voisins — masqués au niveau pays (580 communes,
              labels superposés totalement illisibles). Affichés
              uniquement au niveau commune + arrondissement. */}
          {level !== 'country' &&
            projection?.neighbors.map((f) => {
              const c = projection.path.centroid(f as unknown as GeoPermissibleObjects)
              if (!Number.isFinite(c[0])) return null
              const b = projection.path.bounds(f as unknown as GeoPermissibleObjects)
              const polyW = b[1][0] - b[0][0]
              // skip si trop petit pour le label
              if (polyW < 35) return null
              return (
                <text
                  key={`lbl-${f.properties.nis}`}
                  x={c[0]}
                  y={c[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9.5}
                  fill="color-mix(in oklab, var(--foreground) 55%, transparent)"
                  style={{
                    pointerEvents: 'none',
                    fontFamily: 'var(--font-sans), system-ui, sans-serif',
                  }}
                >
                  {f.properties.name_fr}
                </text>
              )
            })}

          {/* Label commune sélectionnée — masqué au niveau pays car
              la commune est minuscule et un texte 12px serait
              disproportionné (illisible / déborde) */}
          {sel && selCentroid && selBbox && level !== 'country' &&
            Number.isFinite(selCentroid[0]) && Number.isFinite(selBbox[0][1]) && (
            <text
              x={selCentroid[0]}
              y={selBbox[0][1] - 4}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill="var(--primary)"
              style={{ pointerEvents: 'none' }}
            >
              {sel.properties.name_fr}
            </text>
          )}

          {/* Pas de dot sur le centroïde : le polygone violet entoure
              déjà la commune sélectionnée, ce dot ne fait que doubler
              l'info visuelle et ajouter du bruit sur les bureaux. */}
        </g>

        {/* Clusters de bureaux localisés — rendus HORS du groupe zoomé pour
            garder une taille CONSTANTE quel que soit le zoom (sinon les
            cercles/numéros « ballonnent »). `clusters[].x/y` sont déjà des
            coordonnées ÉCRAN (calculées dans `screenPts`, sous la vue pan/zoom
            courante) : aucune transformation supplémentaire à appliquer ici.
            Un cluster de taille 1 (singleton) rend le Dot inchangé (couleur,
            numéro, sélection, clic, survol) ; un cluster de taille > 1 rend
            une bulle de compte cliquable qui zoome vers lui pour le
            dé-clusteriser. */}
        {clusters.map((c) => {
          if (c.count === 1) {
            const m = markersById.get(c.ids[0])
            return m ? renderDot(m.bureau, c.x, c.y) : null
          }
          return (
            <g key={`cluster-${c.ids[0]}`} transform={`translate(${c.x}, ${c.y})`}>
              <ClusterBubble
                count={c.count}
                onClick={() => {
                  // Un vrai drag/pinch ne doit pas déclencher un zoom ; seul
                  // un tap net (sans déplacement) dé-clusterise.
                  if (!draggedRef.current) zoomAroundPoint(c.x, c.y, 1.8)
                }}
              />
            </g>
          )
        })}

        {/* Pins recommandés (n°1) — TOUJOURS rendus APRÈS les clusters, donc
            au-dessus dans l'ordre de peinture SVG : jamais masqués par une
            bulle de cluster voisine. Jamais eux-mêmes clusterisés (exclus en
            amont dans le useMemo `recommendedPts`/`clusters`). */}
        {recommendedPts.map((p) => {
          const m = markersById.get(p.id)
          return m ? renderDot(m.bureau, p.x, p.y) : null
        })}
      </svg>

      {/* Boutons zoom custom — 3 niveaux discrets : commune → arrondissement → région */}
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-background/95 border border-border text-muted-foreground shadow-sm">
          {t(ZOOM_LABEL_KEYS[level] as Parameters<typeof t>[0])}
        </span>
        <div className="flex flex-col rounded-md overflow-hidden shadow border border-border bg-background">
          <button
            type="button"
            onClick={() => {
              const i = ZOOM_ORDER.indexOf(level)
              if (i > 0) setLevel(ZOOM_ORDER[i - 1])
              // On repart d'une vue propre : le cadrage du preset (fitExtent)
              // n'a pas à cumuler un pan/zoom manuel précédent.
              setView({ scale: 1, tx: 0, ty: 0 })
            }}
            disabled={level === 'commune'}
            className="p-1.5 hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={t('mapZoomInAria')}
            title={t('mapZoomIn')}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const i = ZOOM_ORDER.indexOf(level)
              if (i < ZOOM_ORDER.length - 1) setLevel(ZOOM_ORDER[i + 1])
              setView({ scale: 1, tx: 0, ty: 0 })
            }}
            disabled={level === 'country'}
            className="p-1.5 hover:bg-muted transition-colors border-t border-border disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={t('mapZoomOutAria')}
            title={t('mapZoomOut')}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          {/* Recentrer : annule le pan/zoom manuel (retour à l'identité).
              La clé i18n `mapRecenter` sera ajoutée dans une tâche ultérieure ;
              en attendant le fallback next-intl est non-bloquant. */}
          <button
            type="button"
            onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}
            className="p-1.5 hover:bg-muted transition-colors border-t border-border"
            aria-label={tLoose('mapRecenter')}
            title={tLoose('mapRecenter')}
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Attribution discrète */}
      <span className="absolute bottom-2 left-3 text-[9px] text-muted-foreground/50">
        © Statbel · TopoJSON
      </span>

      {/* Si pas de commune sélectionnée — état neutre */}
      {!sel && center && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-muted-foreground">
            {t('mapEmptyHint')}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Marqueur simple : un cercle plein coloré avec un fin halo pour le détacher
 * du fond. La taille `large` est utilisée pour le centroïde de la commune
 * sélectionnée — distingue le repère "ma zone" des bureaux individuels.
 * `number` affiche un rang dans le pin (liste ↔ carte partagent le même
 * numéro) ; `recommended` (le n°1) agrandit encore le pin et lui donne un
 * halo doux pour qu'il se distingue immédiatement des autres.
 *
 * Stroke contrastant : noir pour les couleurs claires (blanc CPAS/Commune),
 * blanc pour les couleurs vives (ONEM rouge clair, syndicats colorés). Ça
 * garantit la lisibilité sur le fond pastel et sur le polygone violet. Le
 * texte du numéro suit la même logique (via `isLightColor`) pour rester
 * lisible même sur un pin blanc (COMMUNE).
 */
function Dot({
  color,
  title,
  large = false,
  selected = false,
  number,
  recommended = false,
  onClick,
}: {
  color: string
  title: string
  large?: boolean
  /** État sélectionné (sync liste ↔ carte) : rayon agrandi + halo. */
  selected?: boolean
  /** Rang affiché dans le pin (1, 2, 3…). Absent = dot simple sans texte. */
  number?: number
  /** Bureau n°1 recommandé : pin plus grand + présence renforcée. */
  recommended?: boolean
  /** Si fourni, le pin devient cliquable (curseur pointer). */
  onClick?: () => void
}) {
  const r = recommended ? 7.5 : large ? 6 : 4.5
  const displayR = selected ? r * 1.35 : r
  const isLight = isLightColor(color)
  return (
    <g onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <title>{title}</title>
      {selected && (
        // Halo sombre universel : visible même sur le pin COMMUNE (fill blanc),
        // où un anneau clair se fondrait dans le fond. Ne dépend d'aucune
        // couleur d'organisme ni de var(--primary).
        <circle
          cx={0}
          cy={0}
          r={displayR + 3.5}
          fill="none"
          stroke="#1b1530"
          strokeWidth={1.5}
          style={{
            filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.55))',
          }}
        />
      )}
      {recommended && !selected && (
        // Halo doux (propre couleur du pin) pour le n°1 recommandé quand il
        // n'est pas sélectionné — évite un double-anneau avec le halo sombre
        // ci-dessus si les deux états coïncident.
        <circle cx={0} cy={0} r={displayR + 3} fill="none" stroke={color} strokeWidth={1} opacity={0.35} />
      )}
      <circle
        cx={0}
        cy={0}
        r={displayR}
        fill={color}
        stroke={
          selected
            // Anneau blanc universel : contraste garanti sur les fills sombres
            // ou saturés (marine, orange, violet SRE, rose), combiné au halo
            // sombre ci-dessus pour rester lisible sur le pin blanc COMMUNE.
            ? '#ffffff'
            : isLight
              ? 'rgba(0,0,0,0.4)'
              : 'rgba(255,255,255,0.95)'
        }
        strokeWidth={selected ? 2.5 : recommended ? 2 : 1.2}
      />
      {number != null && (
        <text
          x={0}
          y={0.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={recommended ? (number >= 10 ? 8.5 : 10) : number >= 10 ? 6.5 : 7.5}
          fontWeight={700}
          fill="#ffffff"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={0.7}
          paintOrder="stroke"
          style={{
            pointerEvents: 'none',
            fontFamily: 'var(--font-sans), system-ui, sans-serif',
          }}
        >
          {number}
        </text>
      )}
    </g>
  )
}

/**
 * Bulle de cluster : regroupe plusieurs bureaux dont les pins se superposent
 * à l'écran (cf. `clusterPoints`, rayon 28px). Remplace visuellement les Dots
 * individuels tant qu'on n'a pas assez zoomé pour les séparer — teinte neutre
 * (`--primary`) plutôt que la couleur d'un organisme précis, car la bulle
 * représente un mélange, pas un seul type. Le clic zoome vers le cluster
 * (dé-clustering, cf. `zoomAroundPoint`). Même technique de texte à contour
 * sombre que les numéros de pin (`Dot`) pour rester lisible sur tout fond.
 */
function ClusterBubble({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <title>{`${count} bureaux`}</title>
      <circle cx={0} cy={0} r={14} fill="var(--primary)" stroke="#ffffff" strokeWidth={2} />
      <text
        x={0}
        y={0.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={count >= 100 ? 9 : count >= 10 ? 11 : 12}
        fontWeight={700}
        fill="#ffffff"
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={0.7}
        paintOrder="stroke"
        style={{
          pointerEvents: 'none',
          fontFamily: 'var(--font-sans), system-ui, sans-serif',
        }}
      >
        {count}
      </text>
    </g>
  )
}

/** Détecte si une couleur est claire (pour adapter le stroke). */
function isLightColor(hexOrVar: string): boolean {
  // var(--primary) ou autres custom properties : on suppose pas clair
  if (hexOrVar.startsWith('var(')) return false
  // FFFFFF blanc évident
  if (/^#?fff(fff)?$/i.test(hexOrVar)) return true
  // hex courts ou longs
  const m = hexOrVar.replace('#', '')
  if (m.length !== 3 && m.length !== 6) return false
  const expand = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const r = parseInt(expand.slice(0, 2), 16)
  const g = parseInt(expand.slice(2, 4), 16)
  const b = parseInt(expand.slice(4, 6), 16)
  // perceived luminance (Rec. 709)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.7
}

function bboxOverlaps(
  a: [[number, number], [number, number]],
  b: [[number, number], [number, number]]
): boolean {
  return !(a[1][0] < b[0][0] || a[0][0] > b[1][0] || a[1][1] < b[0][1] || a[0][1] > b[1][1])
}

/** Borne une valeur dans [min, max] (zoom continu molette/pinch). */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

// Re-export MapBureau pour typer ailleurs
export type { MapBureau }
