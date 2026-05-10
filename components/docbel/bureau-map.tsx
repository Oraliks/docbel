"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Map as LeafletMap, Marker, DivIcon } from "leaflet";
import type { MarkerClusterGroup } from "leaflet";
import type { SerializedBureau } from "@/lib/bureaus/types";

type Props = {
  bureaus: SerializedBureau[];
  center?: { lat: number; lng: number };
  height?: number;
};

export function BureauMap({ bureaus, center, height = 400 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const clusterRef = useRef<MarkerClusterGroup | null>(null);

  // Init carte (client-only)
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      // Plugin marker cluster — s'attache à L.markerClusterGroup
      await import("leaflet.markercluster");
      if (cancelled || !containerRef.current) return;

      const initialCenter: [number, number] = center
        ? [center.lat, center.lng]
        : [50.6, 4.65];
      map = L.map(containerRef.current).setView(initialCenter, center ? 12 : 8);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const cluster = (L as unknown as {
        markerClusterGroup: (opts?: object) => MarkerClusterGroup;
      }).markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
      });
      cluster.addTo(map);
      mapRef.current = map;
      clusterRef.current = cluster;

      drawMarkers(L, cluster, bureaus);
      fitBounds(L, map, bureaus, center);
    })();
    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render markers
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clusterRef.current || !mapRef.current) return;
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      clusterRef.current.clearLayers();
      drawMarkers(L, clusterRef.current, bureaus);
      fitBounds(L, mapRef.current, bureaus, center);
    })();
    return () => {
      cancelled = true;
    };
  }, [bureaus, center]);

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    />
  );
}

function drawMarkers(
  L: typeof import("leaflet"),
  cluster: MarkerClusterGroup,
  bureaus: SerializedBureau[]
) {
  for (const b of bureaus) {
    if (b.lat === null || b.lng === null) continue;
    const color = b.organismeColor ?? "#0050A0";
    const icon: DivIcon = L.divIcon({
      className: "",
      html: `<div style="
        width: 14px; height: 14px; border-radius: 50%; background: ${color};
        border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [10, 10],
    });
    const m: Marker = L.marker([b.lat, b.lng], { icon, title: b.name });
    m.bindPopup(buildPopup(b, color));
    cluster.addLayer(m);
  }
}

function buildPopup(b: SerializedBureau, color: string): string {
  return `
    <div style="font-family:'Plus Jakarta Sans',system-ui;min-width:180px">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px">${escapeHtml(b.name)}</div>
      <div style="font-size:11.5px;color:#555;margin-bottom:4px">${escapeHtml(b.fullAddress)}</div>
      ${
        b.phone
          ? `<div style="font-size:11.5px"><a href="tel:${escapeHtml(b.phone.replace(/\s/g, ""))}" style="color:${color}">${escapeHtml(b.phone)}</a></div>`
          : ""
      }
      ${
        b.website
          ? `<div style="font-size:11.5px"><a href="${escapeHtml(b.website)}" target="_blank" rel="noreferrer" style="color:${color}">Site officiel</a></div>`
          : ""
      }
    </div>
  `;
}

function fitBounds(
  L: typeof import("leaflet"),
  map: LeafletMap,
  bureaus: SerializedBureau[],
  center?: { lat: number; lng: number }
) {
  const points = bureaus
    .filter((b) => b.lat !== null && b.lng !== null)
    .map((b) => [b.lat as number, b.lng as number] as [number, number]);
  if (center) points.push([center.lat, center.lng]);
  if (points.length === 0) return;
  if (points.length === 1) {
    map.setView(points[0], 14);
    return;
  }
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
