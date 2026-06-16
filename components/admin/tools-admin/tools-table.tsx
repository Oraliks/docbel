"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, CircleSlash } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ToolRow } from "./tool-row";
import { SEGMENT_LABEL } from "./shared";
import type { FlatTool } from "./types";

type SortDir = "asc" | "desc" | null;

const PAGE_SIZES = [25, 50, 100] as const;

interface ToolsTableProps {
  tools: FlatTool[];
  /** Sections disponibles pour réassigner la catégorie d'un outil. */
  sectionOptions: { id: string; name: string }[];
}

/**
 * Table dense des outils (refonte mockup 2026-06). Gère en interne :
 *   - le tri par "Nom" (clic sur l'en-tête)
 *   - la sélection multi-lignes + barre d'actions groupées (activer/désactiver)
 *   - la pagination cliente (taille de page configurable)
 *
 * Le filtrage (recherche, catégorie, type, audience, statut) est fait en amont
 * par `workspace.tsx` qui passe la liste déjà filtrée.
 */
export function ToolsTable({ tools, sectionOptions }: ToolsTableProps) {
  const router = useRouter();
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(25);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Élague la sélection aux outils RÉELLEMENT présents quand la liste change
  // (filtre/recherche). Évite qu'une action groupée agisse sur des lignes
  // masquées et non visibles à l'écran. Comparaison par slug (contenu), donc
  // un simple router.refresh (mêmes slugs) préserve la sélection.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(tools.map((t) => t.slug));
      let changed = false;
      const next = new Set<string>();
      for (const s of prev) {
        if (present.has(s)) next.add(s);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [tools]);

  // Tri : par défaut on garde l'ordre fourni (section.order puis tool.order).
  const sorted = useMemo(() => {
    if (!sortDir) return tools;
    const copy = [...tools];
    copy.sort((a, b) =>
      sortDir === "asc"
        ? a.name.localeCompare(b.name, "fr")
        : b.name.localeCompare(a.name, "fr"),
    );
    return copy;
  }, [tools, sortDir]);

  // Pagination — clamp la page si la liste rétrécit (filtre/suppression).
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const pageTools = sorted.slice(start, start + pageSize);

  const pageSlugs = pageTools.map((t) => t.slug);
  const allOnPageSelected =
    pageSlugs.length > 0 && pageSlugs.every((s) => selected.has(s));
  const someOnPageSelected = pageSlugs.some((s) => selected.has(s));

  function toggleSelectAllOnPage(next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      for (const slug of pageSlugs) {
        if (next) copy.add(slug);
        else copy.delete(slug);
      }
      return copy;
    });
  }

  function toggleOne(slug: string, next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(slug);
      else copy.delete(slug);
      return copy;
    });
  }

  function cycleSort() {
    setSortDir((d) => (d === null ? "asc" : d === "asc" ? "desc" : null));
  }

  async function bulkSetActive(active: boolean) {
    const slugs = [...selected];
    if (slugs.length === 0) return;
    setBulkSaving(true);
    try {
      const results = await Promise.allSettled(
        slugs.map((slug) =>
          fetch(`/api/tools/${slug}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active }),
          }).then((r) => {
            if (!r.ok) throw new Error(slug);
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = slugs.length - failed;
      if (ok > 0) {
        toast.success(
          `${ok} outil${ok > 1 ? "s" : ""} ${active ? "activé" : "désactivé"}${
            ok > 1 ? "s" : ""
          }`,
        );
      }
      if (failed > 0) {
        toast.error(`${failed} échec${failed > 1 ? "s" : ""}`);
      }
      setSelected(new Set());
      router.refresh();
    } finally {
      setBulkSaving(false);
    }
  }

  const selectedCount = selected.size;
  const COLS = 10;

  return (
    <div className="flex flex-col gap-2">
      {/* Barre d'actions groupées (visible si sélection) ---------------- */}
      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-[12.5px] font-semibold text-foreground">
            {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              disabled={bulkSaving}
              onClick={() => bulkSetActive(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
            >
              <CheckCircle2 className="size-3.5" />
              Activer
            </button>
            <button
              type="button"
              disabled={bulkSaving}
              onClick={() => bulkSetActive(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[12px] font-semibold text-red-700 transition hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
            >
              <CircleSlash className="size-3.5" />
              Désactiver
            </button>
            <button
              type="button"
              disabled={bulkSaving}
              onClick={() => setSelected(new Set())}
              className="rounded-md px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
            >
              Effacer
            </button>
          </div>
        </div>
      ) : null}

      {/* Table ---------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8">
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={!allOnPageSelected && someOnPageSelected}
                  onCheckedChange={(c) => toggleSelectAllOnPage(Boolean(c))}
                  aria-label="Tout sélectionner sur cette page"
                />
              </TableHead>
              <TableHead
                aria-sort={
                  sortDir === "asc"
                    ? "ascending"
                    : sortDir === "desc"
                      ? "descending"
                      : "none"
                }
              >
                <button
                  type="button"
                  onClick={cycleSort}
                  aria-label={
                    sortDir === "asc"
                      ? "Trier par nom (croissant ; cliquer pour décroissant)"
                      : sortDir === "desc"
                        ? "Trier par nom (décroissant ; cliquer pour annuler le tri)"
                        : "Trier par nom (cliquer pour trier)"
                  }
                  className="inline-flex items-center gap-1 rounded font-medium text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Nom
                  {sortDir === "asc" ? (
                    <ArrowUp className="size-3.5" />
                  ) : sortDir === "desc" ? (
                    <ArrowDown className="size-3.5" />
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-40" />
                  )}
                </button>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-center">Actif</TableHead>
              <TableHead className="text-center">Populaire</TableHead>
              <TableHead className="text-center">{SEGMENT_LABEL.citoyen}</TableHead>
              <TableHead className="text-center">{SEGMENT_LABEL.employeur}</TableHead>
              <TableHead className="text-center">{SEGMENT_LABEL.partenaire}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageTools.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLS}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Aucun outil ne correspond à ces critères.
                </TableCell>
              </TableRow>
            ) : (
              pageTools.map((tool) => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  sections={sectionOptions}
                  selected={selected.has(tool.slug)}
                  onSelectChange={(next) => toggleOne(tool.slug, next)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pied : compteur + pagination + taille de page ------------------ */}
      <div className="flex flex-col items-center gap-3 px-1 py-1 sm:flex-row sm:justify-between">
        <p className="text-[12px] text-muted-foreground">
          {sorted.length === 0
            ? "0 outil"
            : `${start + 1}–${Math.min(start + pageSize, sorted.length)} sur ${sorted.length} outils`}
        </p>

        <div className="flex items-center gap-3">
          <Pager page={safePage} pageCount={pageCount} onChange={setPage} />
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v) || 25);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-[110px]" aria-label="Outils par page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pager — navigation de pages compacte                               */
/* ------------------------------------------------------------------ */

function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (next: number) => void;
}) {
  if (pageCount <= 1) return null;

  // Fenêtre simple : on affiche jusqu'à 5 numéros autour de la page courante.
  const pages: number[] = [];
  const from = Math.max(0, Math.min(page - 2, pageCount - 5));
  const to = Math.min(pageCount, from + 5);
  for (let i = from; i < to; i++) pages.push(i);

  return (
    <div className="flex items-center gap-0.5">
      <PagerBtn
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        label="Page précédente"
      >
        ‹
      </PagerBtn>
      {pages.map((p) => (
        <PagerBtn
          key={p}
          active={p === page}
          onClick={() => onChange(p)}
          label={`Page ${p + 1}`}
        >
          {p + 1}
        </PagerBtn>
      ))}
      <PagerBtn
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
        label="Page suivante"
      >
        ›
      </PagerBtn>
    </div>
  );
}

function PagerBtn({
  children,
  onClick,
  active,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-[12.5px] font-semibold transition disabled:opacity-40",
        active
          ? "border border-border bg-card text-primary shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
