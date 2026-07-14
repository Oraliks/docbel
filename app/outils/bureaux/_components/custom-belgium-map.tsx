'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { feature } from 'topojson-client'
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import type { Topology } from 'topojson-specification'
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson'
import { MapPin, Plus, Minus } from 'lucide-react'

interface MapBureau {
  id: string
  name: string
  lat: number
  lng: number
  color: string
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

export function CustomBelgiumMap({
  selectedInsCode,
  center,
  bureaus,
  height = 420,
  selectedId = null,
  onPinClick,
}: Props) {
  const t = useTranslations('public.outils')
  const [topo, setTopo] = useState<Topology | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 380, h: height })
  const [level, setLevel] = useState<ZoomLevel>('commune')

  // Reset au niveau commune quand la commune sélectionnée change
  useEffect(() => {
    setLevel('commune')
  }, [selectedInsCode])

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
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{ display: 'block' }}
      >
        <g>
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
          {/* Commune sélectionnée en violet */}
          {sel && (
            <path
              d={projection!.path(sel as unknown as GeoPermissibleObjects) ?? undefined}
              fill="color-mix(in oklab, var(--primary) 18%, transparent)"
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
          {sel && selBbox && level !== 'country' && (
            <text
              x={selCentroid![0]}
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

          {/* Dots bureaux (simple cercle coloré, couleur par type d'org).
              Cliquables si onPinClick est fourni : synchronise la sélection
              avec la liste. Le pin sélectionné (selectedId) est agrandi
              + halo, cf. Dot ci-dessous. */}
          {bureaus.map((b) => {
            const xy = projection?.proj([b.lng, b.lat])
            if (!xy || !Number.isFinite(xy[0])) return null
            return (
              <g key={b.id} transform={`translate(${xy[0]}, ${xy[1]})`}>
                <Dot
                  color={b.color}
                  title={b.name}
                  selected={b.id === selectedId}
                  onClick={onPinClick ? () => onPinClick(b.id) : undefined}
                />
              </g>
            )
          })}

          {/* Pas de dot sur le centroïde : le polygone violet entoure
              déjà la commune sélectionnée, ce dot ne fait que doubler
              l'info visuelle et ajouter du bruit sur les bureaux. */}
        </g>
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
            }}
            disabled={level === 'country'}
            className="p-1.5 hover:bg-muted transition-colors border-t border-border disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={t('mapZoomOutAria')}
            title={t('mapZoomOut')}
          >
            <Minus className="w-3.5 h-3.5" />
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
 *
 * Stroke contrastant : noir pour les couleurs claires (blanc CPAS/Commune),
 * blanc pour les couleurs vives (ONEM rouge clair, syndicats colorés). Ça
 * garantit la lisibilité sur le fond pastel et sur le polygone violet.
 */
function Dot({
  color,
  title,
  large = false,
  selected = false,
  onClick,
}: {
  color: string
  title: string
  large?: boolean
  /** État sélectionné (sync liste ↔ carte) : rayon agrandi + halo. */
  selected?: boolean
  /** Si fourni, le pin devient cliquable (curseur pointer). */
  onClick?: () => void
}) {
  const r = large ? 6 : 4.5
  const displayR = selected ? r * 1.35 : r
  const isLight = isLightColor(color)
  return (
    <g onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <title>{title}</title>
      {selected && (
        <circle
          cx={0}
          cy={0}
          r={displayR + 3.5}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.5}
          style={{
            filter:
              'drop-shadow(0 0 2px color-mix(in oklab, var(--primary) 65%, transparent))',
          }}
        />
      )}
      <circle
        cx={0}
        cy={0}
        r={displayR}
        fill={color}
        stroke={
          selected
            ? 'var(--primary)'
            : isLight
              ? 'rgba(0,0,0,0.4)'
              : 'rgba(255,255,255,0.95)'
        }
        strokeWidth={selected ? 1.8 : 1.2}
      />
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

// Re-export MapBureau pour typer ailleurs
export type { MapBureau }
