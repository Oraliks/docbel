'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, Marker, DivIcon, Polygon, GeoJSON } from 'leaflet'

interface MapBureau {
  id: string
  name: string
  lat: number
  lng: number
  color: string
  type: string
}

interface Props {
  /** Centre de la commune sélectionnée (centroïde Statbel). */
  center: { lat: number; lng: number } | null
  /** Slug ou nameFr de la commune — sert à fetcher son polygone Overpass. */
  communeName?: string | null
  /** Bureaux à pinpoint sur la carte. */
  bureaus: MapBureau[]
  height?: number
}

/**
 * Carte minimaliste design pour le finder de bureaux.
 *
 * Différences vs le BureauMap admin :
 *  - Tiles Carto Voyager (rendu clean, palette neutre, contraste doux)
 *    plutôt que les tiles OSM brutes (trop "techy")
 *  - Pas de marker cluster (4 pins seulement, pas besoin)
 *  - Polygone commune highlight en violet (récupéré via Overpass quand un
 *    `communeName` est fourni)
 *  - Centre + zoom adaptés à une commune (zoom 13 par défaut)
 */
export function CommuneFinderMap({ center, communeName, bureaus, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const polygonRef = useRef<Polygon | GeoJSON | null>(null)

  // Init carte
  useEffect(() => {
    let cancelled = false
    let map: LeafletMap | null = null
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      const initialCenter: [number, number] = center
        ? [center.lat, center.lng]
        : [50.6, 4.65]

      map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: true,
      }).setView(initialCenter, center ? 13 : 8)

      // Carto Voyager : rendu cleaner, palette neutre/pastel, parfait pour design system
      // Pas de clé API requise, juste l'attribution.
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map)

      mapRef.current = map
      drawMarkers(L, map, bureaus)
    })()
    return () => {
      cancelled = true
      if (map) map.remove()
      mapRef.current = null
      markersRef.current = []
      polygonRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render markers quand bureaux changent
  useEffect(() => {
    if (!mapRef.current) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return
      // Clear anciens markers
      for (const m of markersRef.current) m.remove()
      markersRef.current = []
      drawMarkers(L, mapRef.current, bureaus)
    })()
    return () => {
      cancelled = true
    }
  }, [bureaus])

  // Re-center quand commune change + fetch polygon
  useEffect(() => {
    if (!mapRef.current || !center) return
    mapRef.current.setView([center.lat, center.lng], 13)

    if (!communeName) return
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      try {
        const polygon = await fetchCommunePolygon(communeName)
        if (cancelled || !mapRef.current || !polygon) return
        // Clear ancien polygon
        if (polygonRef.current) {
          polygonRef.current.remove()
          polygonRef.current = null
        }
        const layer = L.geoJSON(polygon, {
          style: {
            color: 'var(--primary)',
            weight: 2,
            opacity: 0.8,
            fillColor: 'var(--primary)',
            fillOpacity: 0.12,
          },
        }).addTo(mapRef.current)
        polygonRef.current = layer
        // Fit aux bounds du polygon avec padding
        try {
          mapRef.current.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 14 })
        } catch {
          /* ignore */
        }
      } catch {
        /* fetch polygon échoué — pas grave, on garde juste les pins */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [center?.lat, center?.lng, communeName])

  function drawMarkers(
    L: typeof import('leaflet'),
    map: LeafletMap,
    bureaus: MapBureau[]
  ) {
    for (const b of bureaus) {
      const icon: DivIcon = L.divIcon({
        className: '',
        html: `<div style="
          width: 28px; height: 28px;
          border-radius: 50% 50% 50% 0;
          background: ${b.color};
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          transform: rotate(-45deg);
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="
            width: 8px; height: 8px;
            border-radius: 50%; background: white;
            transform: rotate(45deg);
          "></div>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -24],
      })
      const m = L.marker([b.lat, b.lng], { icon, title: b.name })
      m.bindPopup(`<div style="font-family:'Plus Jakarta Sans',system-ui;font-weight:600;font-size:12px">${escapeHtml(b.name)}</div>`)
      m.addTo(map)
      markersRef.current.push(m)
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: '100%',
        minHeight: 280,
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}
    />
  )
}

/**
 * Récupère le polygone d'une commune belge via Nominatim (qui inclut
 * `polygon_geojson` quand demandé). Plus simple qu'Overpass pour 1 commune.
 * Cache implicite via fetch HTTP (le navigateur cache).
 */
async function fetchCommunePolygon(name: string): Promise<GeoJSON.GeometryObject | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('city', name)
  url.searchParams.set('country', 'Belgium')
  url.searchParams.set('format', 'json')
  url.searchParams.set('polygon_geojson', '1')
  url.searchParams.set('limit', '1')
  try {
    const r = await fetch(url, {
      headers: { 'Accept-Language': 'fr' },
    })
    if (!r.ok) return null
    const arr = (await r.json()) as Array<{ geojson?: GeoJSON.GeometryObject }>
    return arr[0]?.geojson ?? null
  } catch {
    return null
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
