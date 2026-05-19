"use client";

import { useEffect, useRef, useState } from "react";

/// Type minimal du PDFDocumentProxy de pdfjs qu'on utilise (pour éviter
/// d'importer le type complet et déclencher du dynamic import lourd).
export type PdfPageProxy = {
  getTextContent: () => Promise<{
    items: { str: string; transform: number[]; width: number; height: number }[];
  }>;
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  getViewport: (opts: { scale: number }) => { width: number; height: number };
};

export type PdfDocProxy = {
  getPage: (n: number) => Promise<PdfPageProxy>;
};

export interface PageDims {
  width: number;
  height: number;
}

/// Encapsule la configuration et l'état du PDF rendu : worker, document proxy,
/// pagination, zoom, dimensions de page mises en cache.
///
/// Le composant parent fournit `onLoadSuccess` à <PDFDocument> qui set le ref
/// et numPages. Les autres états (currentPage, scale) sont locaux au hook.
export function usePdfDoc() {
  const [pdfWorkerReady, setPdfWorkerReady] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [scale, setScale] = useState(1.3);
  const [pageDims, setPageDims] = useState<Record<number, PageDims>>({});
  const pdfDocRef = useRef<PdfDocProxy | null>(null);

  /// Init du worker pdfjs (une fois au mount).
  useEffect(() => {
    let cancelled = false;
    import("react-pdf").then(({ pdfjs }) => {
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      setPdfWorkerReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleDocumentLoadSuccess(pdf: { numPages: number }) {
    setNumPages(pdf.numPages);
    pdfDocRef.current = pdf as unknown as PdfDocProxy;
  }

  function handlePageLoadSuccess(page: { originalWidth: number; originalHeight: number }) {
    setPageDims((prev) => ({
      ...prev,
      [currentPage]: { width: page.originalWidth, height: page.originalHeight },
    }));
  }

  const dims = pageDims[currentPage];

  return {
    pdfWorkerReady,
    numPages,
    currentPage,
    setCurrentPage,
    scale,
    setScale,
    pageDims,
    dims,
    pdfDocRef,
    handleDocumentLoadSuccess,
    handlePageLoadSuccess,
  };
}
