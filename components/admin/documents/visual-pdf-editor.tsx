"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Rnd } from "react-rnd";
import { nanoid } from "nanoid";
import { ChevronLeft, ChevronRight, Plus, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentField } from "@/lib/documents/types";

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
          Cliquez sur <b>Ajouter une zone</b> pour placer un nouveau champ. Glissez et redimensionnez les
          rectangles bleus pour les positionner. Les positions seront utilisées pour superposer le texte sur
          le PDF généré. Pensez à <b>sauvegarder</b> dans l&apos;onglet Champs après avoir terminé.
        </AlertDescription>
      </Alert>

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
