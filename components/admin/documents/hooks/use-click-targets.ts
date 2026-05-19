"use client";

import { useEffect, useState } from "react";
import {
  extractClickTargets,
  type ClickTarget,
} from "@/lib/documents/click-targets";
import type { PdfDocProxy } from "./use-pdf-doc";

/// Charge les click targets pour la page courante. Re-déclenché quand la page
/// change OU quand le PDF devient disponible (numPages passe de 0 à N).
export function useClickTargets(
  pdfDocRef: React.MutableRefObject<PdfDocProxy | null>,
  currentPage: number,
  numPages: number
) {
  const [clickTargets, setClickTargets] = useState<ClickTarget[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);

  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return;
    let cancelled = false;
    setTargetsLoading(true);
    pdfDocRef.current
      .getPage(currentPage + 1)
      .then(extractClickTargets)
      .then((targets) => {
        if (cancelled) return;
        setClickTargets(targets);
      })
      .catch((err) => {
        console.warn("extractClickTargets failed:", err);
        if (!cancelled) setClickTargets([]);
      })
      .finally(() => {
        if (!cancelled) setTargetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // pdfDocRef est un ref donc stable — eslint l'exige quand même mais on l'ignore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, numPages]);

  return { clickTargets, targetsLoading };
}
