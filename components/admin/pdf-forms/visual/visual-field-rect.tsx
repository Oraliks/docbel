"use client";

import { Rnd } from "react-rnd";
import { Type as TypeIcon, CheckSquare } from "lucide-react";
import { pdfToHtml, htmlToPdf, type PageGeometry } from "@/lib/pdf-canvas/coords";
import type { VisualField } from "@/lib/pdf-forms/visual/types";

interface VisualFieldRectProps {
  field: VisualField;
  geo: PageGeometry;
  scale: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: { x: number; y: number; w: number; h: number }) => void;
}

/// Affiche un champ visuel comme rectangle draggable/resizable sur le canvas.
/// Conversion PDF↔HTML via lib/pdf-canvas/coords pour rester cohérent avec
/// la matérialisation côté serveur.
export function VisualFieldRect({ field, geo, scale, selected, onSelect, onChange }: VisualFieldRectProps) {
  const html = pdfToHtml(field.rect, geo, scale);
  const Icon = field.type === "text" ? TypeIcon : CheckSquare;
  const color = field.type === "text" ? "37, 99, 235" : "16, 185, 129";

  return (
    <Rnd
      bounds="parent"
      position={{ x: html.x, y: html.y }}
      size={{ width: html.w, height: html.h }}
      onDragStop={(_, p) => {
        const next = htmlToPdf({ x: p.x, y: p.y, w: html.w, h: html.h }, geo, scale);
        onChange(next);
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        const next = htmlToPdf(
          { x: position.x, y: position.y, w: ref.offsetWidth, h: ref.offsetHeight },
          geo,
          scale
        );
        onChange(next);
      }}
      onMouseDown={(e) => {
        // Évite que le pointerdown du canvas (drag-to-draw) ne se déclenche.
        e.stopPropagation();
        onSelect();
      }}
      style={{
        border: `2px solid rgba(${color}, ${selected ? 1 : 0.6})`,
        background: `rgba(${color}, ${selected ? 0.18 : 0.08})`,
        borderRadius: 4,
        boxShadow: selected ? `0 0 0 3px rgba(${color}, 0.25)` : undefined,
        transition: "box-shadow 150ms, border-color 150ms",
      }}
    >
      <div
        className="flex h-full w-full items-center gap-1 overflow-hidden px-1 text-[10px] font-medium"
        style={{ color: `rgb(${color})` }}
        title={`${field.name} (${field.type})`}
      >
        <Icon className="size-3 shrink-0" />
        <span className="truncate">{field.name}</span>
      </div>
    </Rnd>
  );
}
