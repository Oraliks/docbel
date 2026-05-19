"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentField } from "@/lib/documents/types";
import type { PageDims } from "./use-pdf-doc";

interface UseFieldSelectionParams {
  schema: DocumentField[];
  currentPage: number;
  setCurrentPage: (n: number) => void;
  scale: number;
  pageDims: Record<number, PageDims>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/// Gère la sélection d'un champ + interactions UX associées :
///   - hoverField : highlight discret sur le PDF quand on survole un row sidebar
///   - pulseField : animation 800ms quand sélection vient depuis l'extérieur
///   - selectFieldFromSidebar : navigue vers la page du champ + scroll + pulse
///   - auto-scroll : centre le champ dans la vue du PDF
///
/// Le clic direct sur un Rnd utilise juste `setSelectedFieldId` (pas de pulse).
export function useFieldSelection({
  schema,
  currentPage,
  setCurrentPage,
  scale,
  pageDims,
  containerRef,
}: UseFieldSelectionParams) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [pulsingFieldId, setPulsingFieldId] = useState<string | null>(null);
  /// Sélection multiple (Shift+clic) — en plus du champ "primaire" sélectionné.
  /// Sert au batch-delete (Del) et au highlight visuel. Le drag/édition reste
  /// limité au champ primaire pour la simplicité.
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());

  /// Sélection "externe" : navigation page + pulse + auto-scroll.
  const selectFieldFromSidebar = useCallback(
    (id: string | null) => {
      setSelectedFieldId(id);
      if (!id) return;
      const field = schema.find((f) => f.id === id);
      if (!field?.position) return;
      if (field.position.page !== currentPage) {
        setCurrentPage(field.position.page);
      }
      setPulsingFieldId(id);
    },
    [schema, currentPage, setCurrentPage]
  );

  /// Auto-cleanup du pulse après 800ms.
  useEffect(() => {
    if (!pulsingFieldId) return;
    const t = setTimeout(() => setPulsingFieldId(null), 800);
    return () => clearTimeout(t);
  }, [pulsingFieldId]);

  /// Auto-scroll : on attend un tick que la page rende avant de scroller.
  useEffect(() => {
    if (!selectedFieldId || !pulsingFieldId) return;
    const field = schema.find((f) => f.id === selectedFieldId);
    if (!field?.position || field.position.page !== currentPage) return;
    const dims = pageDims[currentPage];
    if (!dims) return;
    const t = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const htmlY = (dims.height - field.position!.y - field.position!.h) * scale;
      const targetTop = Math.max(0, htmlY - container.clientHeight / 2);
      container.scrollTo({ top: targetTop, behavior: "smooth" });
    }, 80);
    return () => clearTimeout(t);
  }, [selectedFieldId, pulsingFieldId, currentPage, pageDims, scale, schema, containerRef]);

  /// Toggle dans la multi-selection (Shift+clic sur un Rnd).
  const toggleMultiSelect = useCallback((id: string) => {
    setMultiSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearMultiSelect = useCallback(() => {
    setMultiSelectedIds(new Set());
  }, []);

  return {
    selectedFieldId,
    setSelectedFieldId,
    hoveredFieldId,
    setHoveredFieldId,
    pulsingFieldId,
    selectFieldFromSidebar,
    multiSelectedIds,
    toggleMultiSelect,
    clearMultiSelect,
  };
}
