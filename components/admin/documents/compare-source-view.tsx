"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Files,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PDFDocument = dynamic(() => import("react-pdf").then((m) => m.Document), { ssr: false });
const PDFPage = dynamic(() => import("react-pdf").then((m) => m.Page), { ssr: false });

interface FileRef {
  id: string;
  name: string;
  fileType?: string | null;
}

interface OtherPdf {
  id: string;
  name: string;
  sha256: string | null;
  createdAt: string;
}

interface Props {
  toolId: string;
  toolName: string;
  currentFile: FileRef;
  otherPdfs: OtherPdf[];
}

export function CompareSourceView({ toolId, toolName, currentFile, otherPdfs }: Props) {
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [numPagesA, setNumPagesA] = useState(0);
  const [numPagesB, setNumPagesB] = useState(0);
  const [pdfWorkerReady, setPdfWorkerReady] = useState(false);
  const [diffPercent, setDiffPercent] = useState<number | null>(null);
  const [computingDiff, setComputingDiff] = useState(false);
  const [showDiffOverlay, setShowDiffOverlay] = useState(true);
  const containerARef = useRef<HTMLDivElement>(null);
  const containerBRef = useRef<HTMLDivElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // Calcule le diff pixel-par-pixel quand les 2 pages sont rendues
  async function computeDiff() {
    if (!containerARef.current || !containerBRef.current) return;
    setComputingDiff(true);
    setDiffPercent(null);
    try {
      const canvasA = containerARef.current.querySelector("canvas") as HTMLCanvasElement | null;
      const canvasB = containerBRef.current.querySelector("canvas") as HTMLCanvasElement | null;
      if (!canvasA || !canvasB) {
        toast.error("Pages non rendues");
        return;
      }

      const w = Math.min(canvasA.width, canvasB.width);
      const h = Math.min(canvasA.height, canvasB.height);

      const ctxA = canvasA.getContext("2d");
      const ctxB = canvasB.getContext("2d");
      if (!ctxA || !ctxB) return;

      const imgA = ctxA.getImageData(0, 0, w, h);
      const imgB = ctxB.getImageData(0, 0, w, h);

      // Préparer le canvas overlay
      const diffCanvas = diffCanvasRef.current!;
      diffCanvas.width = w;
      diffCanvas.height = h;
      const diffCtx = diffCanvas.getContext("2d")!;
      const diffImg = diffCtx.createImageData(w, h);

      const pixelmatch = (await import("pixelmatch")).default;
      const diffCount = pixelmatch(imgA.data, imgB.data, diffImg.data, w, h, {
        threshold: 0.15,
        diffColor: [255, 0, 0],
        alpha: 0.3,
      });
      diffCtx.putImageData(diffImg, 0, 0);
      const totalPixels = w * h;
      setDiffPercent((diffCount / totalPixels) * 100);
    } catch (err) {
      console.error("Diff error:", err);
      toast.error(err instanceof Error ? err.message : "Erreur de calcul du diff");
    } finally {
      setComputingDiff(false);
    }
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

  const maxPages = Math.max(numPagesA, numPagesB) || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href={`/admin/documents/${toolId}`} />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Files className="w-6 h-6" />
            Comparer la source
          </h1>
          <p className="text-sm text-muted-foreground">{toolName}</p>
        </div>
      </div>

      <Alert>
        <AlertDescription className="text-sm">
          Sélectionnez un autre PDF pour comparer côte-à-côte avec la source actuelle. Utile lors
          d&apos;une mise à jour officielle pour repérer les zones modifiées et ajuster les
          positions des champs.
        </AlertDescription>
      </Alert>

      {/* Sélecteur du PDF de comparaison */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">Comparer avec :</span>
        <Select value={comparisonId || "__none__"} onValueChange={(v) => setComparisonId(!v || v === "__none__" ? null : v)}>
          <SelectTrigger className="w-auto min-w-[280px]">
            <SelectValue placeholder="Choisir un PDF…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Aucun —</SelectItem>
            {otherPdfs.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}{" "}
                <span className="text-muted-foreground text-xs ml-2">
                  ({new Date(f.createdAt).toLocaleDateString("fr-BE")})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {comparisonId && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={computeDiff}
              disabled={computingDiff}
            >
              {computingDiff ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Calcul…
                </>
              ) : (
                "Calculer le diff visuel"
              )}
            </Button>
            {diffPercent !== null && (
              <>
                <span
                  className={`text-sm font-medium ${
                    diffPercent < 1
                      ? "text-green-600"
                      : diffPercent < 10
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {diffPercent.toFixed(2)}% de pixels modifiés
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDiffOverlay((v) => !v)}
                >
                  {showDiffOverlay ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-1" />
                      Masquer overlay
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-1" />
                      Voir overlay
                    </>
                  )}
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {/* Navigation pages */}
      {comparisonId && maxPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            Page {page + 1} / {maxPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(maxPages - 1, p + 1))}
            disabled={page >= maxPages - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Affichage côte-à-côte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Source actuelle ·{" "}
              <span className="font-mono text-xs">{currentFile.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={containerARef} className="border rounded overflow-auto bg-muted/20">
              <PDFDocument
                file={`/api/files/${currentFile.id}/download`}
                onLoadSuccess={(pdf) => setNumPagesA(pdf.numPages)}
                loading={<div className="p-6 text-center text-sm">Chargement…</div>}
              >
                {page < numPagesA && (
                  <PDFPage
                    pageNumber={page + 1}
                    scale={1.0}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                )}
              </PDFDocument>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Comparé ·{" "}
              <span className="font-mono text-xs">
                {comparisonId
                  ? otherPdfs.find((f) => f.id === comparisonId)?.name
                  : "(non sélectionné)"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={containerBRef} className="border rounded overflow-auto bg-muted/20 relative">
              {comparisonId ? (
                <>
                  <PDFDocument
                    file={`/api/files/${comparisonId}/download`}
                    onLoadSuccess={(pdf) => setNumPagesB(pdf.numPages)}
                    loading={<div className="p-6 text-center text-sm">Chargement…</div>}
                  >
                    {page < numPagesB && (
                      <PDFPage
                        pageNumber={page + 1}
                        scale={1.0}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                      />
                    )}
                  </PDFDocument>
                  {/* Overlay diff */}
                  <canvas
                    ref={diffCanvasRef}
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{
                      display: showDiffOverlay && diffPercent !== null ? "block" : "none",
                      mixBlendMode: "multiply",
                    }}
                  />
                </>
              ) : (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Sélectionnez un PDF à comparer ci-dessus.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {comparisonId && diffPercent === null && (
        <Alert>
          <AlertDescription className="text-xs text-muted-foreground">
            Cliquez sur <b>Calculer le diff visuel</b> une fois les deux pages chargées pour
            voir les zones modifiées en rouge.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
