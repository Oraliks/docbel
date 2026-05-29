"use client";

import { useEffect, useState } from "react";
import type { DocumentField } from "@/lib/documents/types";
import { pdfToHtml } from "@/lib/pdf-canvas/coords";
import type { PageDims } from "./hooks/use-pdf-doc";

interface Props {
  dims: PageDims | undefined;
  fieldsOnPage: DocumentField[];
  selectedFieldId: string | null;
  scale: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /// Largeur cible de la mini-map en pixels (par défaut 120). La hauteur est
  /// calculée pour respecter l'aspect-ratio de la page.
  width?: number;
}

/// Mini-carte abstraite de la page courante : rectangle aspect-ratio page +
/// pastilles colorées pour chaque champ + indicateur de viewport visible.
///
/// Clic sur la mini-map → scroll le PDF principal pour centrer le point cliqué.
/// Pas de rendu du PDF lui-même (trop lourd) — juste les positions des champs.
export function PdfMiniMap({
  dims,
  fieldsOnPage,
  selectedFieldId,
  scale,
  containerRef,
  width = 120,
}: Props) {
  const [viewport, setViewport] = useState({ top: 0, height: 0, totalHeight: 1 });

  /// Suit le scroll du conteneur PDF pour positionner le viewport indicator.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function update() {
      const c = containerRef.current;
      if (!c) return;
      setViewport({
        top: c.scrollTop,
        height: c.clientHeight,
        totalHeight: c.scrollHeight,
      });
    }
    update();
    container.addEventListener("scroll", update, { passive: true });
    // Re-update aussi à chaque changement de scale (le scrollHeight change)
    const t = setTimeout(update, 100);
    return () => {
      container.removeEventListener("scroll", update);
      clearTimeout(t);
    };
  }, [containerRef, scale, dims]);

  if (!dims) {
    return (
      <div
        style={{ width, height: width * 1.41 }}
        className="rounded border border-border bg-muted/30"
      />
    );
  }

  const aspect = dims.height / dims.width;
  const height = width * aspect;
  /// Ratio entre la mini-map et le PDF rendu (en pixels écran).
  const miniRatio = width / (dims.width * scale);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    /// Convertit la y mini en y conteneur pour scroller.
    const targetScrollTop = (relY / height) * container.scrollHeight - container.clientHeight / 2;
    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: "smooth",
    });
  }

  return (
    <div
      onClick={handleClick}
      title="Cliquez pour naviguer · vue d'ensemble de la page"
      className="relative rounded border border-border bg-card/60 backdrop-blur-sm shadow-sm cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
      style={{ width, height }}
    >
      {/* Champs en mini-pastilles */}
      {fieldsOnPage.map((f) => {
        if (!f.position) return null;
        const ratio = width / dims.width;
        const mini = pdfToHtml(
          { x: f.position.x, y: f.position.y, w: f.position.w, h: f.position.h },
          { width: dims.width, height: dims.height, offsetX: 0, offsetY: 0 },
          ratio
        );
        const miniX = mini.x;
        const miniY = mini.y;
        const miniW = Math.max(2, mini.w);
        const miniH = Math.max(2, mini.h);
        const selected = f.id === selectedFieldId;
        return (
          <div
            key={f.id}
            className={`absolute rounded-[1px] ${
              selected ? "bg-primary" : "bg-blue-400/70 dark:bg-blue-500/70"
            }`}
            style={{ left: miniX, top: miniY, width: miniW, height: miniH }}
          />
        );
      })}

      {/* Indicateur de viewport */}
      {viewport.totalHeight > 0 && (
        <div
          className="absolute left-0 right-0 border border-primary/70 bg-primary/10 pointer-events-none"
          style={{
            top: (viewport.top / viewport.totalHeight) * height,
            height: Math.min(
              height,
              (viewport.height / viewport.totalHeight) * height
            ),
          }}
        />
      )}

      {/* Aide visuelle */}
      <div className="absolute bottom-0.5 right-1 text-[8px] text-muted-foreground bg-card/80 px-1 rounded">
        {fieldsOnPage.length}
      </div>

      {/* Voile pour réduire l'opacité quand pas hover */}
      <div className="absolute inset-0 pointer-events-none" />

      {/* miniRatio is exposed for future zoom-on-minimap support */}
      <span hidden data-mini-ratio={miniRatio} />
    </div>
  );
}
