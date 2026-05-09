"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Rnd } from "react-rnd";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Wand2,
  Loader2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentField, DocumentFieldType } from "@/lib/documents/types";
import { ocrWordsToPdfCoords, detectFields, type DetectedField, type OCRWord } from "@/lib/documents/ocr-detector";

const PDFDocument = dynamic(() => import("react-pdf").then((m) => m.Document), {
  ssr: false,
});
const PDFPage = dynamic(() => import("react-pdf").then((m) => m.Page), {
  ssr: false,
});

interface VisualPdfEditorProps {
  templateId: string;
  sourceFileId: string;
  schema: DocumentField[];
  onSchemaChange: (next: DocumentField[]) => void;
}

interface PageDims {
  width: number;
  height: number;
}

export function VisualPdfEditor({
  sourceFileId,
  schema,
  onSchemaChange,
}: VisualPdfEditorProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageDims, setPageDims] = useState<Record<number, PageDims>>({});
  const [scale, setScale] = useState(1.3);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [pdfWorkerReady, setPdfWorkerReady] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrPageStatus, setOcrPageStatus] = useState<string>("");
  const [pendingDetections, setPendingDetections] = useState<DetectedField[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const fieldsOnPage = schema.filter((f) => f.position && f.position.page === currentPage);
  const dims = pageDims[currentPage];

  function updateField(id: string, updates: Partial<DocumentField>) {
    onSchemaChange(schema.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  function updatePosition(id: string, htmlPos: { x: number; y: number; w: number; h: number }) {
    if (!dims) return;
    const pdfH = dims.height;
    onSchemaChange(
      schema.map((f) => {
        if (f.id !== id) return f;
        return {
          ...f,
          position: {
            page: f.position?.page ?? currentPage,
            x: htmlPos.x / scale,
            y: pdfH - (htmlPos.y / scale) - (htmlPos.h / scale),
            w: htmlPos.w / scale,
            h: htmlPos.h / scale,
            fontSize: f.position?.fontSize || 11,
          },
        };
      })
    );
  }

  function addZone() {
    if (!dims) return;
    const id = `field_${nanoid(6)}`;
    const defaultW = 150;
    const defaultH = 20;
    const defaultX = 50;
    const defaultY = dims.height - 100;
    onSchemaChange([
      ...schema,
      {
        id,
        label: "Nouveau champ",
        type: "text",
        required: false,
        position: {
          page: currentPage,
          x: defaultX,
          y: defaultY,
          w: defaultW,
          h: defaultH,
          fontSize: 11,
        },
      },
    ]);
    setSelectedFieldId(id);
  }

  function removeZone(id: string) {
    onSchemaChange(schema.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  }

  /// Analyse une page : extraction texte natif si possible, sinon OCR fallback.
  async function detectOnePage(
    pdfDoc: { getPage: (n: number) => Promise<unknown> },
    pageIdx: number,
    onOcrProgress?: (p: number) => void
  ): Promise<{ detections: DetectedField[]; method: string }> {
    type PdfPage = {
      getTextContent: () => Promise<{ items: { str: string; transform: number[]; width: number; height: number }[] }>;
      getViewport: (opts: { scale: number }) => { width: number; height: number };
      render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }) => { promise: Promise<void> };
    };
    const page = (await pdfDoc.getPage(pageIdx + 1)) as PdfPage;
    const pageHeight = page.getViewport({ scale: 1 }).height;

    const textContent = await page.getTextContent();
    const items = textContent.items.filter((it) => it.str && it.str.length > 0);

    let words: OCRWord[];
    let method: string;

    if (items.length >= 5) {
      // Texte natif PDF — instantané et précis
      words = items.map((it) => ({
        text: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        h: it.height || Math.abs(it.transform[3]) || 10,
        confidence: 100,
      }));
      method = "texte natif";
    } else {
      // Fallback OCR (PDF scanné)
      const OCR_SCALE = 4.0;
      const viewport = page.getViewport({ scale: OCR_SCALE });
      const offCanvas = document.createElement("canvas");
      offCanvas.width = Math.ceil(viewport.width);
      offCanvas.height = Math.ceil(viewport.height);
      const offCtx = offCanvas.getContext("2d");
      if (!offCtx) throw new Error("Canvas OCR indisponible");
      offCtx.fillStyle = "#ffffff";
      offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
      await page.render({ canvasContext: offCtx, viewport, canvas: offCanvas }).promise;

      const Tesseract = await import("tesseract.js");
      const worker = await Tesseract.createWorker("fra", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text" && onOcrProgress) {
            onOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      const { data } = await worker.recognize(offCanvas, {}, { blocks: true });
      await worker.terminate();

      type RawWord = {
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
        confidence: number;
      };
      const rawWords: RawWord[] = [];
      type Block = { paragraphs?: { lines?: { words?: RawWord[] }[] }[] };
      const blocks = (data as { blocks?: Block[] }).blocks || [];
      for (const block of blocks) {
        for (const para of block.paragraphs || []) {
          for (const line of para.lines || []) {
            for (const word of line.words || []) {
              if (word.text.trim()) rawWords.push(word);
            }
          }
        }
      }
      words = ocrWordsToPdfCoords(rawWords, pageHeight, OCR_SCALE);
      method = "OCR";
    }

    return { detections: detectFields(words, pageIdx), method };
  }

  /// Mode mono-page (currentPage) ou multi-pages (toutes les pages du PDF).
  async function runOCR(allPages = false) {
    if (!dims) {
      toast.error("PDF non chargé");
      return;
    }
    setOcrRunning(true);
    setOcrProgress(0);
    setOcrPageStatus("");
    setPendingDetections(null);
    try {
      const { pdfjs } = await import("react-pdf");
      const pdfDoc = await pdfjs.getDocument(`/api/files/${sourceFileId}/download`).promise;
      const pagesToProcess = allPages
        ? Array.from({ length: numPages }, (_, i) => i)
        : [currentPage];

      const rawDetections: DetectedField[] = [];
      const methods = new Set<string>();
      for (let i = 0; i < pagesToProcess.length; i++) {
        const pageIdx = pagesToProcess[i];
        if (allPages) setOcrPageStatus(`Page ${pageIdx + 1}/${numPages}`);
        const baseProgress = Math.round((i / pagesToProcess.length) * 100);
        setOcrProgress(baseProgress);

        const { detections, method } = await detectOnePage(pdfDoc, pageIdx, (ocrPct) => {
          // Mix progression globale + progression OCR de la page
          const pageWeight = 1 / pagesToProcess.length;
          setOcrProgress(Math.round((i + ocrPct / 100) * pageWeight * 100));
        });
        rawDetections.push(...detections);
        methods.add(method);
      }

      // Filtrer les détections qui chevauchent un champ déjà placé.
      // Évite les doublons quand l'admin relance Auto-détecter après avoir
      // déjà appliqué une première vague.
      const allDetections = rawDetections.filter((d) => !overlapsExistingField(d, schema));
      const skipped = rawDetections.length - allDetections.length;

      const methodStr = methods.size === 1 ? Array.from(methods)[0] : "mixte";
      const scope = allPages ? `${pagesToProcess.length} pages` : `page ${currentPage + 1}`;

      if (allDetections.length === 0) {
        if (skipped > 0) {
          toast.info(
            `${skipped} champ(s) détecté(s) déjà présent(s) — rien de nouveau à proposer.`
          );
        } else {
          toast.info(`Aucun champ détecté via ${methodStr} sur ${scope}.`);
        }
      } else {
        const skippedNote = skipped > 0 ? ` (${skipped} doublon${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""})` : "";
        toast.success(
          `${allDetections.length} nouveau(x) champ(s) détecté(s) sur ${scope} via ${methodStr}${skippedNote}.`
        );
        setPendingDetections(allDetections);
      }
    } catch (err) {
      console.error("Detection error:", err);
      toast.error(err instanceof Error ? err.message : "Erreur de détection");
    } finally {
      setOcrRunning(false);
      setOcrProgress(0);
      setOcrPageStatus("");
    }
  }

  /// Détermine si une détection chevauche significativement un champ existant
  /// déjà placé sur la même page. Utilisé pour éviter de proposer 2 fois
  /// la même position quand l'admin relance Auto-détecter.
  function overlapsExistingField(detection: DetectedField, existingFields: DocumentField[]): boolean {
    for (const f of existingFields) {
      if (!f.position || f.position.page !== detection.page) continue;
      const a = detection;
      const b = f.position;
      // Centre de la détection
      const cx = a.x + a.w / 2;
      const cy = a.y + a.h / 2;
      // Le centre est-il dans le rectangle existant (avec un padding de tolérance) ?
      const PAD = 4;
      if (
        cx >= b.x - PAD &&
        cx <= b.x + b.w + PAD &&
        cy >= b.y - PAD &&
        cy <= b.y + b.h + PAD
      ) {
        return true;
      }
      // OU le centre du champ existant est-il dans le rectangle détecté ?
      const cxB = b.x + b.w / 2;
      const cyB = b.y + b.h / 2;
      if (
        cxB >= a.x - PAD &&
        cxB <= a.x + a.w + PAD &&
        cyB >= a.y - PAD &&
        cyB <= a.y + a.h + PAD
      ) {
        return true;
      }
    }
    return false;
  }

  function applyDetections() {
    if (!pendingDetections) return;
    const newFields: DocumentField[] = pendingDetections.map((d) => ({
      id: `field_${nanoid(6)}`,
      label: d.label || "Champ détecté",
      type: d.type as DocumentFieldType,
      required: false,
      position: {
        page: d.page,
        x: d.x,
        y: d.y,
        w: d.w,
        h: d.h,
        fontSize: 11,
      },
    }));
    onSchemaChange([...schema, ...newFields]);
    toast.success(`${newFields.length} champ(s) ajouté(s)`);
    setPendingDetections(null);
  }

  if (!pdfWorkerReady) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Chargement du moteur PDF…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Cliquez sur <b>Ajouter une zone</b> pour placer un nouveau champ, ou{" "}
          <b>Auto-détecter</b> pour analyser la page courante. Pour scanner d&apos;un coup tout le
          document, utilisez <b>Toutes les pages</b> (peut prendre plus de temps si le PDF est
          scanné). Glissez et redimensionnez les rectangles bleus pour les positionner.
        </AlertDescription>
      </Alert>

      {pendingDetections && pendingDetections.length > 0 && (
        <Alert className="bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-800">
          <AlertDescription className="text-sm flex items-center justify-between gap-3 flex-wrap">
            <span className="text-green-800 dark:text-green-300">
              <b>{pendingDetections.filter((d) => d.page === currentPage).length}</b> sur cette
              page (<b>{pendingDetections.length}</b> au total). Rectangles verts pointillés
              ci-dessous = positions proposées.
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPendingDetections(null)}>
                Annuler
              </Button>
              <Button size="sm" onClick={applyDetections}>
                Tout appliquer ({pendingDetections.length})
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Page {currentPage + 1} / {numPages || "?"}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(numPages - 1, p + 1))}
              disabled={currentPage >= numPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm self-center">{Math.round(scale * 100)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.min(3, s + 0.1))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runOCR(false)}
              disabled={!dims || ocrRunning}
              title="Détecte sur la page courante"
            >
              {ocrRunning && !ocrPageStatus ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {ocrProgress}%
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-1" />
                  Auto-détecter
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runOCR(true)}
              disabled={!dims || ocrRunning || numPages <= 1}
              title="Détecte sur toutes les pages du document"
            >
              {ocrRunning && ocrPageStatus ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {ocrPageStatus} · {ocrProgress}%
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 mr-1" />
                  Toutes les pages
                </>
              )}
            </Button>
            <Button size="sm" onClick={addZone} disabled={!dims}>
              <Plus className="w-4 h-4 mr-1" />
              Ajouter une zone
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={containerRef}
            className="relative inline-block border rounded overflow-auto bg-muted/20 mx-auto"
            style={{ maxWidth: "100%" }}
          >
            <PDFDocument
              file={`/api/files/${sourceFileId}/download`}
              onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
              loading={<div className="p-12 text-center">Chargement du PDF…</div>}
              error={<div className="p-12 text-center text-destructive">Erreur de chargement du PDF</div>}
            >
              <PDFPage
                pageNumber={currentPage + 1}
                scale={scale}
                onLoadSuccess={(p) =>
                  setPageDims((prev) => ({
                    ...prev,
                    [currentPage]: { width: p.originalWidth, height: p.originalHeight },
                  }))
                }
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
              {/* Détections OCR en attente — overlay vert pointillé */}
              {dims && pendingDetections &&
                pendingDetections
                  .filter((d) => d.page === currentPage)
                  .map((d, idx) => {
                    const htmlX = d.x * scale;
                    const htmlY = (dims.height - d.y - d.h) * scale;
                    const htmlW = d.w * scale;
                    const htmlH = d.h * scale;
                    return (
                      <div
                        key={`detect-${idx}`}
                        className="absolute pointer-events-none"
                        style={{
                          left: htmlX,
                          top: htmlY,
                          width: htmlW,
                          height: htmlH,
                          border: "2px dashed #16a34a",
                          background: "rgba(22, 163, 74, 0.15)",
                        }}
                      >
                        <div className="text-[10px] px-1 py-0.5 bg-green-600 text-white truncate absolute -top-4 left-0">
                          {d.label} ({d.type})
                        </div>
                      </div>
                    );
                  })}

              {dims &&
                fieldsOnPage.map((f) => {
                  const htmlX = f.position!.x * scale;
                  const htmlY = (dims.height - f.position!.y - f.position!.h) * scale;
                  const htmlW = f.position!.w * scale;
                  const htmlH = f.position!.h * scale;
                  const isSelected = selectedFieldId === f.id;
                  return (
                    <Rnd
                      key={f.id}
                      bounds="parent"
                      position={{ x: htmlX, y: htmlY }}
                      size={{ width: htmlW, height: htmlH }}
                      onDragStop={(_, d) =>
                        updatePosition(f.id, { x: d.x, y: d.y, w: htmlW, h: htmlH })
                      }
                      onResizeStop={(_e, _dir, ref, _delta, position) =>
                        updatePosition(f.id, {
                          x: position.x,
                          y: position.y,
                          w: ref.offsetWidth,
                          h: ref.offsetHeight,
                        })
                      }
                      onClick={() => setSelectedFieldId(f.id)}
                      style={{
                        border: `2px solid ${isSelected ? "#0070f3" : "#3b82f6"}`,
                        background: isSelected ? "rgba(0,112,243,0.2)" : "rgba(59,130,246,0.15)",
                        cursor: "move",
                      }}
                    >
                      <div className="text-xs px-1 py-0.5 bg-blue-500 text-white truncate">
                        {f.label || f.id}
                      </div>
                    </Rnd>
                  );
                })}
            </PDFDocument>
          </div>
        </CardContent>
      </Card>

      {selectedFieldId && (() => {
        const f = schema.find((x) => x.id === selectedFieldId);
        if (!f) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Champ sélectionné</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Libellé</label>
                  <input
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={f.label}
                    onChange={(e) => updateField(f.id, { label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Identifiant</label>
                  <input
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm font-mono"
                    value={f.id}
                    onChange={(e) =>
                      updateField(f.id, {
                        id: e.target.value.replace(/[^a-z0-9_]/gi, "_"),
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">X (pt)</label>
                  <input
                    type="number"
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={Math.round(f.position?.x || 0)}
                    onChange={(e) =>
                      updateField(f.id, {
                        position: {
                          ...(f.position || {
                            page: currentPage,
                            y: 0,
                            w: 100,
                            h: 20,
                            fontSize: 11,
                          }),
                          x: parseFloat(e.target.value) || 0,
                        } as DocumentField["position"],
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Y (pt)</label>
                  <input
                    type="number"
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={Math.round(f.position?.y || 0)}
                    onChange={(e) =>
                      updateField(f.id, {
                        position: {
                          ...(f.position || {
                            page: currentPage,
                            x: 0,
                            w: 100,
                            h: 20,
                            fontSize: 11,
                          }),
                          y: parseFloat(e.target.value) || 0,
                        } as DocumentField["position"],
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Police</label>
                  <input
                    type="number"
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={f.position?.fontSize || 11}
                    onChange={(e) =>
                      updateField(f.id, {
                        position: {
                          ...(f.position || {
                            page: currentPage,
                            x: 0,
                            y: 0,
                            w: 100,
                            h: 20,
                          }),
                          fontSize: parseInt(e.target.value, 10) || 11,
                        } as DocumentField["position"],
                      })
                    }
                  />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => removeZone(f.id)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-1" />
                Supprimer la zone
              </Button>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
