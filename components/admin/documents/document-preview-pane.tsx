"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { FileText, FileType } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PDF_WORKER_SRC } from "@/lib/documents/pdf-worker";

const PDFDocument = dynamic(() => import("react-pdf").then((m) => m.Document), {
  ssr: false,
});
const PDFPage = dynamic(() => import("react-pdf").then((m) => m.Page), {
  ssr: false,
});

interface DocumentPreviewPaneProps {
  templateId: string;
  sourceFileId: string;
  sourceFile: { name: string; fileType: string | null };
}

export function DocumentPreviewPane({
  templateId,
  sourceFileId,
  sourceFile,
}: DocumentPreviewPaneProps) {
  const [pdfWorkerReady, setPdfWorkerReady] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [docxData, setDocxData] = useState<{ text: string; placeholders: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPdf = sourceFile.fileType === "pdf";
  const isDocx = sourceFile.fileType === "docx";

  useEffect(() => {
    if (!isPdf) return;
    let cancelled = false;
    import("react-pdf").then(({ pdfjs }) => {
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
      setPdfWorkerReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isPdf]);

  useEffect(() => {
    if (!isDocx) return;
    fetch(`/api/documents/templates/${templateId}/preview`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Erreur");
        return res.json();
      })
      .then((d) => setDocxData(d))
      .catch((err) => setError(err.message));
  }, [isDocx, templateId]);

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {isPdf ? <FileType className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            Aperçu du document
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {sourceFile.fileType?.toUpperCase() || "?"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{sourceFile.name}</p>
      </CardHeader>
      <CardContent className="p-3">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {isPdf && pdfWorkerReady && (
          <div className="space-y-2">
            <div className="overflow-auto border rounded bg-muted/20 max-h-[70vh]">
              <PDFDocument
                file={`/api/files/${sourceFileId}/download`}
                onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
                onLoadError={(err) => console.error("PDF load error:", err)}
                loading={<div className="p-8 text-center text-sm">Chargement…</div>}
                error={
                  <div className="p-8 text-center text-sm text-destructive">
                    Erreur de chargement du PDF
                  </div>
                }
              >
                <PDFPage
                  pageNumber={currentPage}
                  width={400}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              </PDFDocument>
            </div>
            {numPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  ←
                </Button>
                <span className="text-xs">
                  Page {currentPage} / {numPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  disabled={currentPage === numPages}
                >
                  →
                </Button>
              </div>
            )}
          </div>
        )}

        {isPdf && !pdfWorkerReady && (
          <p className="text-sm text-muted-foreground text-center py-8">Chargement du moteur PDF…</p>
        )}

        {isDocx && docxData && (
          <div className="space-y-3">
            {docxData.placeholders.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Placeholders détectés :</p>
                <div className="flex flex-wrap gap-1">
                  {docxData.placeholders.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs font-mono">
                      {`{${p}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {docxData.placeholders.length === 0 && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Aucun placeholder détecté
                </p>
                <p className="text-amber-800 dark:text-amber-300 mt-1">
                  Ce DOCX ne contient pas de marqueurs <code className="font-mono">{"{champ}"}</code>.
                  Pour activer le remplissage automatique, éditez le document dans Word et remplacez
                  les zones à remplir par des placeholders comme{" "}
                  <code className="font-mono">{"{nom_employeur}"}</code>.
                </p>
              </div>
            )}
            <div className="border rounded p-3 max-h-[60vh] overflow-auto bg-muted/20">
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {docxData.text.slice(0, 5000)}
                {docxData.text.length > 5000 && "\n\n…"}
              </pre>
            </div>
          </div>
        )}

        {isDocx && !docxData && !error && (
          <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
        )}
      </CardContent>
    </Card>
  );
}
