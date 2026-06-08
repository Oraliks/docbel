"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon, FilePlus2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pdfToHtml, type PageGeometry, type PdfRect } from "@/lib/pdf-canvas/coords";
import type { AcroFieldRaw } from "@/lib/pdf-forms/types";

const PDFDocument = dynamic(() => import("react-pdf").then((m) => m.Document), { ssr: false });
const PDFPage = dynamic(() => import("react-pdf").then((m) => m.Page), { ssr: false });

interface SourceItem {
  name: string;
  sizeBytes: number;
  modifiedAt: string;
}

interface WidgetsResponse {
  file: string;
  pageCount: number;
  hasAcroForm: boolean;
  pages: Array<{ index: number; geometry: PageGeometry; rotation: number }>;
  widgets: AcroFieldRaw[];
}

const TYPE_COLOR: Record<string, string> = {
  text: "bg-sky-500/20 border-sky-500/60 hover:bg-sky-500/30",
  checkbox: "bg-emerald-500/20 border-emerald-500/60 hover:bg-emerald-500/30",
  dropdown: "bg-violet-500/20 border-violet-500/60 hover:bg-violet-500/30",
  radio: "bg-amber-500/20 border-amber-500/60 hover:bg-amber-500/30",
  unknown: "bg-rose-500/20 border-rose-500/60 hover:bg-rose-500/30",
};

const TYPE_BADGE: Record<string, string> = {
  text: "border-sky-500 text-sky-700 dark:text-sky-300",
  checkbox: "border-emerald-500 text-emerald-700 dark:text-emerald-300",
  dropdown: "border-violet-500 text-violet-700 dark:text-violet-300",
  radio: "border-amber-500 text-amber-700 dark:text-amber-300",
  unknown: "border-rose-500 text-rose-700 dark:text-rose-300",
};

export function PdfSourceInspector() {
  const [sources, setSources] = useState<SourceItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<WidgetsResponse | null>(null);
  const [page, setPage] = useState(0);
  const [scale, setScale] = useState(1);
  const [hoveredWidget, setHoveredWidget] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Init worker pdfjs.
  useEffect(() => {
    let cancelled = false;
    import("react-pdf").then(({ pdfjs }) => {
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      setWorkerReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Liste initiale.
  useEffect(() => {
    let active = true;
    fetch("/api/admin/pdf-sources/list")
      .then((r) => r.json())
      .then((j: { items: SourceItem[] }) => {
        if (!active) return;
        setSources(j.items);
        if (j.items[0]) selectFile(j.items[0].name);
      })
      .catch(() => setSources([]));
    return () => {
      active = false;
    };
  }, []);

  // Widgets du PDF sélectionné. Les resets (setData/setPage) sont faits dans
  // `selectFile` côté handler pour éviter setState-in-effect.
  useEffect(() => {
    if (!selected) return;
    let active = true;
    fetch(`/api/admin/pdf-sources/${encodeURIComponent(selected)}/widgets`)
      .then((r) => r.json())
      .then((j: WidgetsResponse) => {
        if (active) setData(j);
      })
      .catch(() => {
        if (active) setData(null);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  function selectFile(name: string) {
    setSelected(name);
    setData(null);
    setPage(0);
    setHoveredWidget(null);
  }

  const widgetsOnPage = useMemo(() => {
    if (!data) return [];
    return data.widgets.filter((w) => (w.page ?? 0) === page);
  }, [data, page]);

  const geometry = data?.pages[page]?.geometry;

  function scrollToWidget(name: string) {
    const row = rowRefs.current[name];
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)_360px]">
      {/* Colonne 1 : liste des PDFs */}
      <aside className="flex min-h-0 flex-col gap-1 overflow-auto rounded-lg border bg-card p-2">
        <h2 className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          Sources ({sources?.length ?? 0})
        </h2>
        {sources === null && <p className="px-2 text-xs text-muted-foreground">Chargement…</p>}
        {sources?.length === 0 && (
          <p className="px-2 text-xs text-muted-foreground">
            Aucun PDF sous <code>private/pdfs/</code>.
          </p>
        )}
        {sources?.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => selectFile(s.name)}
            className={`flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
              selected === s.name ? "bg-primary/10 text-primary" : "hover:bg-muted"
            }`}
          >
            <span className="flex items-center gap-1.5 truncate font-medium">
              <FileTextIcon className="size-3.5 shrink-0" />
              {s.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {Math.round(s.sizeBytes / 1024)} Ko
            </span>
          </button>
        ))}
      </aside>

      {/* Colonne 2 : preview PDF avec overlay des widgets */}
      <main className="flex min-h-0 flex-col rounded-lg border bg-muted/20">
        {selected && data ? (
          <>
            <div className="flex items-center gap-2 border-b bg-card/50 p-2">
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page <= 0}
                  aria-label="Page précédente"
                >
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <span className="min-w-16 text-center text-xs text-muted-foreground tabular-nums">
                  Page {page + 1} / {data.pageCount}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => setPage((p) => Math.min(data.pageCount - 1, p + 1))}
                  disabled={page >= data.pageCount - 1}
                  aria-label="Page suivante"
                >
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
              <div className="mx-1 h-5 w-px bg-border" />
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                  disabled={scale <= 0.5}
                  aria-label="Dézoomer"
                >
                  <ZoomOutIcon className="size-4" />
                </Button>
                <span className="min-w-12 text-center text-xs text-muted-foreground tabular-nums">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
                  disabled={scale >= 2.5}
                  aria-label="Zoomer"
                >
                  <ZoomInIcon className="size-4" />
                </Button>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">
                {data.widgets.length} widget{data.widgets.length > 1 ? "s" : ""} total
                {data.pageCount > 1 ? ` · ${widgetsOnPage.length} sur cette page` : ""}
              </span>
              <Button
                size="sm"
                variant="default"
                className="gap-1.5"
                render={<Link href={`/admin/pdf/new?source=${encodeURIComponent(selected)}`} />}
              >
                <FilePlus2Icon className="size-4" />
                Créer un formulaire
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {!workerReady ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Initialisation du moteur PDF…
                </div>
              ) : (
                <div className="relative inline-block">
                  <PDFDocument
                    file={`/api/admin/pdf-sources/${encodeURIComponent(selected)}/pdf`}
                    loading={<div className="p-12 text-center text-sm text-muted-foreground">Chargement…</div>}
                    error={<div className="p-12 text-center text-sm text-destructive">Erreur de chargement.</div>}
                  >
                    <PDFPage
                      pageNumber={page + 1}
                      scale={scale}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                    />
                    {geometry &&
                      widgetsOnPage.map((w) => {
                        if (!w.rect) return null;
                        const r: PdfRect = { x: w.rect[0], y: w.rect[1], w: w.rect[2], h: w.rect[3] };
                        const html = pdfToHtml(r, geometry, scale);
                        const isHovered = hoveredWidget === w.pdfFieldName;
                        const color = TYPE_COLOR[w.acroType] ?? TYPE_COLOR.unknown;
                        return (
                          <button
                            type="button"
                            key={w.pdfFieldName}
                            onMouseEnter={() => setHoveredWidget(w.pdfFieldName)}
                            onMouseLeave={() => setHoveredWidget(null)}
                            onClick={() => scrollToWidget(w.pdfFieldName)}
                            className={`absolute rounded border-2 transition-all ${color} ${
                              isHovered ? "z-10 ring-2 ring-offset-1 ring-primary" : ""
                            }`}
                            style={{ left: html.x, top: html.y, width: html.w, height: html.h }}
                            title={`${w.pdfFieldName} (${w.acroType})`}
                          />
                        );
                      })}
                  </PDFDocument>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {selected ? "Chargement des widgets…" : "Choisis un PDF dans la liste à gauche."}
          </div>
        )}
      </main>

      {/* Colonne 3 : tableau des widgets */}
      <aside className="flex min-h-0 flex-col rounded-lg border bg-card">
        <div className="border-b p-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Widgets {data ? `(page ${page + 1})` : ""}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {data ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left">Nom</th>
                  <th className="px-2 py-1.5 text-left">Type</th>
                  <th className="px-2 py-1.5 text-left">Tooltip</th>
                </tr>
              </thead>
              <tbody>
                {widgetsOnPage.map((w) => {
                  const isHovered = hoveredWidget === w.pdfFieldName;
                  return (
                    <tr
                      key={w.pdfFieldName}
                      ref={(el) => {
                        rowRefs.current[w.pdfFieldName] = el;
                      }}
                      onMouseEnter={() => setHoveredWidget(w.pdfFieldName)}
                      onMouseLeave={() => setHoveredWidget(null)}
                      className={`border-t transition-colors ${
                        isHovered ? "bg-primary/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <td className="px-2 py-1.5 align-top">
                        <code className="text-[11px]">{w.pdfFieldName}</code>
                        {(w.required || w.readOnly || w.multiline) && (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {w.required && <span className="text-[9px] font-bold text-destructive">REQUIS</span>}
                            {w.readOnly && <span className="text-[9px] font-bold text-muted-foreground">READONLY</span>}
                            {w.multiline && <span className="text-[9px] font-bold text-muted-foreground">MULTI</span>}
                          </div>
                        )}
                        {w.maxLen && (
                          <div className="text-[9px] text-muted-foreground">max {w.maxLen}</div>
                        )}
                        {w.options?.length ? (
                          <div className="mt-0.5 text-[9px] text-muted-foreground">
                            opt: {w.options.join(" | ")}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <Badge variant="outline" className={`text-[9px] ${TYPE_BADGE[w.acroType] ?? ""}`}>
                          {w.acroType}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 align-top text-[11px] text-muted-foreground">
                        {w.tooltip || "—"}
                      </td>
                    </tr>
                  );
                })}
                {widgetsOnPage.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-3 text-center text-xs text-muted-foreground">
                      Pas de widget sur cette page.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-xs text-muted-foreground">—</p>
          )}
        </div>
      </aside>
    </div>
  );
}
