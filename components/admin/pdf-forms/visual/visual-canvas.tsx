"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { htmlToPdf, type PageGeometry } from "@/lib/pdf-canvas/coords";
import { generateFieldName } from "@/lib/pdf-forms/visual/validation";
import { useVisualEditor } from "./provider/visual-editor-context";
import { VisualFieldRect } from "./visual-field-rect";

const PDFDocument = dynamic(() => import("react-pdf").then((m) => m.Document), { ssr: false });
const PDFPage = dynamic(() => import("react-pdf").then((m) => m.Page), { ssr: false });

interface VisualCanvasProps {
  formId: string;
  onNumPages: (n: number) => void;
}

interface DrawState {
  /// Coordonnées HTML (px CSS) du point de départ par rapport au container.
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  /// Outil au moment du début du draw (figé pour cette session de draw).
  tool: "text" | "checkbox";
}

const MIN_DRAW_W = 10;
const MIN_DRAW_H = 10;

/// Canvas PDF de l'éditeur visuel. Différent du PdfCanvas de Documents :
/// pas de click-targets, pas de mode preview, pas de contextmenu — focus
/// strict sur drag-to-draw + sélection.
export function VisualCanvas({ formId, onNumPages }: VisualCanvasProps) {
  const {
    doc,
    ui,
    pageDims,
    addField,
    updateField,
    selectField,
    dispatch,
    isReadOnlyMode,
  } = useVisualEditor();

  const containerRef = useRef<HTMLDivElement>(null);
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [pdfWorkerReady, setPdfWorkerReady] = useState(false);

  // Init worker pdfjs une fois.
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

  const geo: PageGeometry | undefined = pageDims[ui.page];

  const handlePageLoadSuccess = useCallback(
    (page: { originalWidth: number; originalHeight: number }) => {
      // react-pdf renvoie la taille de la page rendue (viewport @ rotation 0).
      // Ici on assume CropBox.x = CropBox.y = 0 côté front (rare cas contraire).
      dispatch({
        type: "REGISTER_PAGE_DIMS",
        page: ui.page,
        dims: { width: page.originalWidth, height: page.originalHeight, offsetX: 0, offsetY: 0 },
      });
    },
    [dispatch, ui.page]
  );

  const handleDocumentLoadSuccess = useCallback(
    (pdf: { numPages: number }) => {
      onNumPages(pdf.numPages);
    },
    [onNumPages]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isReadOnlyMode) return;
      if (ui.tool !== "text" && ui.tool !== "checkbox") {
        // Outil "select" : un clic sur le fond désélectionne.
        if (e.target === e.currentTarget) selectField(null);
        return;
      }
      if (!geo) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraw({ startX: x, startY: y, currentX: x, currentY: y, tool: ui.tool });
    },
    [geo, isReadOnlyMode, selectField, ui.tool]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draw) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDraw({ ...draw, currentX: e.clientX - rect.left, currentY: e.clientY - rect.top });
  }, [draw]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draw || !geo) {
        setDraw(null);
        return;
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const x = Math.min(draw.startX, draw.currentX);
      const y = Math.min(draw.startY, draw.currentY);
      const w = Math.abs(draw.currentX - draw.startX);
      const h = Math.abs(draw.currentY - draw.startY);
      setDraw(null);
      if (w < MIN_DRAW_W || h < MIN_DRAW_H) return;
      const rect = htmlToPdf({ x, y, w, h }, geo, ui.scale);
      const prefix = draw.tool === "text" ? "text" : "case";
      const name = generateFieldName(doc, prefix);
      if (draw.tool === "text") {
        addField({ type: "text", name, page: ui.page, rect });
      } else {
        addField({ type: "checkbox", name, page: ui.page, rect });
      }
    },
    [addField, doc, draw, geo, ui.page, ui.scale]
  );

  // Filter par page courante.
  const fieldsOnPage = doc.fields.filter((f) => f.page === ui.page);

  // Bounding du draft (overlay live).
  const draftBox = draw && {
    x: Math.min(draw.startX, draw.currentX),
    y: Math.min(draw.startY, draw.currentY),
    w: Math.abs(draw.currentX - draw.startX),
    h: Math.abs(draw.currentY - draw.startY),
  };

  if (!pdfWorkerReady) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Initialisation du moteur PDF…</div>;
  }

  return (
    <div className="overflow-auto rounded-lg border bg-muted/20 p-4">
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative inline-block touch-none select-none"
        style={{
          cursor: ui.tool === "text" || ui.tool === "checkbox" ? "crosshair" : "default",
        }}
      >
        <PDFDocument
          file={`/api/admin/pdf/forms/${formId}/source`}
          onLoadSuccess={handleDocumentLoadSuccess}
          loading={<div className="p-12 text-center text-sm text-muted-foreground">Chargement du PDF…</div>}
          error={<div className="p-12 text-center text-sm text-destructive">Erreur de chargement du PDF</div>}
        >
          <PDFPage
            pageNumber={ui.page + 1}
            scale={ui.scale}
            onLoadSuccess={handlePageLoadSuccess}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />

          {geo &&
            fieldsOnPage.map((f) => (
              <VisualFieldRect
                key={f.id}
                field={f}
                geo={geo}
                scale={ui.scale}
                selected={ui.selectedId === f.id}
                onSelect={() => selectField(f.id)}
                onChange={(htmlPdf) => updateField(f.id, { rect: htmlPdf })}
              />
            ))}

          {/* Overlay du draft en cours */}
          {draftBox && (
            <div
              className="pointer-events-none absolute border-2 border-dashed border-primary/80 bg-primary/10"
              style={{ left: draftBox.x, top: draftBox.y, width: draftBox.w, height: draftBox.h }}
            />
          )}
        </PDFDocument>
      </div>
    </div>
  );
}
