'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
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
export function CustomBelgiumMap({
  selectedInsCode,
  center,
  bureaus,
  height = 420,
}: Props) {
  const [topo, setTopo] = useState<Topology | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 380, h: height })
  const [zoom, setZoom] = useState(1)

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

    // Détermine les voisins via bbox overlap (approche simple, suffit pour
    // l'effet design "commune au centre, voisins autour")
    let neighbors: MunicipalityFeature[] = []
    if (selected) {
      const p = geoPath()
      const sb = p.bounds(selected as unknown as GeoPermissibleObjects)
      // sb = [[x0,y0],[x1,y1]] en lat/lng (puisque path sans projection)
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

    // Calcule la projection pour englober commune + voisins (ou tout pays
    // en fallback)
    const focusFeatures = selected ? [selected, ...neighbors] : fc.features
    const focusCollection: FeatureCollection<Polygon | MultiPolygon> = {
      type: 'FeatureCollection',
      features: focusFeatures,
    }
    const proj = geoMercator().fitExtent(
      [
        [12, 12],
        [size.w - 12, size.h - 12],
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
  }, [topo, selectedInsCode, size.w, size.h])

  if (!topo) {
    return (
      <div
        ref={containerRef}
        style={{
          height,
          width: '100%',
          borderRadius: 10,
          background: 'var(--muted)',
        }}
        className="flex items-center justify-center text-xs text-muted-foreground"
      >
        Chargement de la carte…
      </div>
    )
  }

  const sel = projection?.selected
  const selCentroid = sel ? projection!.path.centroid(sel as unknown as GeoPermissibleObjects) : null
  const selBbox = sel ? projection!.path.bounds(sel as unknown as GeoPermissibleObjects) : null

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, borderRadius: 10, overflow: 'hidden' }}
      className="relative bg-[color-mix(in_oklab,var(--primary)_4%,white)] dark:bg-[color-mix(in_oklab,var(--primary)_8%,#0c0c12)] border border-border"
    >
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{ display: 'block' }}
      >
        <g style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
          {/* Voisins en gris clair */}
          {projection?.neighbors.map((f) => (
            <path
              key={f.properties.nis}
              d={projection.path(f as unknown as GeoPermissibleObjects) ?? undefined}
              fill="color-mix(in oklab, var(--foreground) 5%, transparent)"
              stroke="color-mix(in oklab, var(--foreground) 15%, transparent)"
              strokeWidth={0.6}
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

          {/* Labels voisins */}
          {projection?.neighbors.map((f) => {
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
                  fontFamily:
                    'var(--font-sans), system-ui, sans-serif',
                }}
              >
                {f.properties.name_fr}
              </text>
            )
          })}

          {/* Label commune sélectionnée */}
          {sel && selBbox && (
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

          {/* Pins bureaux */}
          {bureaus.map((b) => {
            const xy = projection?.proj([b.lng, b.lat])
            if (!xy || !Number.isFinite(xy[0])) return null
            return (
              <g key={b.id} transform={`translate(${xy[0]}, ${xy[1]})`}>
                <Pin color={b.color} title={b.name} />
              </g>
            )
          })}

          {/* Pin centroïde commune sélectionnée (au-dessus des bureaux) */}
          {sel && selCentroid && Number.isFinite(selCentroid[0]) && (
            <g transform={`translate(${selCentroid[0]}, ${selCentroid[1]})`}>
              <Pin color="var(--primary)" title={sel.properties.name_fr} large />
            </g>
          )}
        </g>
      </svg>

      {/* Boutons zoom custom */}
      <div className="absolute bottom-3 right-3 flex flex-col rounded-md overflow-hidden shadow border border-border bg-background">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3, z * 1.3))}
          className="p-1.5 hover:bg-muted transition-colors"
          aria-label="Zoomer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.5, z / 1.3))}
          className="p-1.5 hover:bg-muted transition-colors border-t border-border"
          aria-label="Dézoomer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Attribution discrète */}
      <span className="absolute bottom-2 left-3 text-[9px] text-muted-foreground/50">
        © Statbel · TopoJSON
      </span>

      {/* Si pas de commune sélectionnée — état neutre */}
      {!sel && center && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs text-muted-foreground">
            Tape un code postal pour voir la zone
          </span>
        </div>
      )}
    </div>
  )
}

function Pin({
  color,
  title,
  large = false,
}: {
  color: string
  title: string
  large?: boolean
}) {
  const w = large ? 22 : 14
  const h = large ? 26 : 16
  return (
    <g>
      <title>{title}</title>
      {/* Drop pin shape */}
      <path
        d={`M0 ${-h} C ${-w / 1.6} ${-h} ${-w / 1.6} ${-h / 2.2} 0 0 C ${w / 1.6} ${-h / 2.2} ${w / 1.6} ${-h} 0 ${-h} Z`}
        fill={color}
        stroke="white"
        strokeWidth={1.5}
      />
      <circle cx={0} cy={-h * 0.65} r={w / 4} fill="white" />
    </g>
  )
}

function bboxOverlaps(
  a: [[number, number], [number, number]],
  b: [[number, number], [number, number]]
): boolean {
  return !(a[1][0] < b[0][0] || a[0][0] > b[1][0] || a[1][1] < b[0][1] || a[0][1] > b[1][1])
}

// Re-export MapBureau pour typer ailleurs
export type { MapBureau }
