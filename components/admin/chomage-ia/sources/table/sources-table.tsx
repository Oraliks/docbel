"use client";

/**
 * Table virtualisée des sources (lignes de 52 px, dense, style Gmail/Linear).
 *
 * Utilise `@tanstack/react-virtual` pour ne rendre que les lignes visibles.
 * Important : la div parent doit avoir une hauteur définie (sinon le scroll
 * virtuel ne sait pas où s'ancrer). On utilise une hauteur calculée via
 * `min-h-[calc(100vh-280px)]` pour s'adapter au header de page.
 *
 * Header sticky avec checkbox "select all visible" + colonnes triables
 * (click pour toggler asc/desc).
 */

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Inbox,
  Loader2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { KnowledgeSourceListItem } from "@/lib/chomage-ia/types";
import {
  SourcesTableRow,
} from "./sources-table-row";
import type { SortColumn, SortDirection } from "./_shared-table";

const ROW_HEIGHT = 52;

interface Props {
  items: KnowledgeSourceListItem[];
  selectedIds: Set<string>;
  aiAvailable: boolean;
  loading: boolean;
  /** Triple-state pour le checkbox header : true/false/"indeterminate". */
  selectAllState: boolean | "indeterminate";
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSortChange: (col: SortColumn) => void;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string) => void;
  onOpen: (id: string) => void;
  onRowAction: (
    id: string,
    action:
      | { kind: "edit" }
      | { kind: "reindex" }
      | { kind: "summarize" }
      | { kind: "toggle-enabled" }
      | { kind: "delete" }
  ) => void | Promise<void>;
  /** Affiché en cas de liste vide. */
  onCreate?: () => void;
}

export function SourcesTable({
  items,
  selectedIds,
  aiAvailable,
  loading,
  selectAllState,
  sortColumn,
  sortDirection,
  onSortChange,
  onSelectAll,
  onSelectOne,
  onOpen,
  onRowAction,
  onCreate,
}: Props) {
  const t = useTranslations("admin.chomageIa");
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  // Re-mesure quand items change beaucoup (filtres, tri).
  useEffect(() => {
    virtualizer.measure();
  }, [items.length, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden">
      {/* Header sticky */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <div className="flex w-6 shrink-0 items-center justify-center">
          <Checkbox
            checked={selectAllState === true ? true : false}
            indeterminate={selectAllState === "indeterminate"}
            onCheckedChange={(c) => onSelectAll(!!c)}
            aria-label={t("selectAll")}
            disabled={items.length === 0}
          />
        </div>
        {/* Spacer pour la drag-handle column (migration 21) */}
        <div className="w-5 shrink-0" aria-hidden />
        <div className="w-8 shrink-0" aria-hidden />
        <SortHeader
          column="title"
          label={t("colNameSource")}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          className="min-w-0 flex-1"
        />
        <div className="hidden w-[88px] shrink-0 sm:block">{t("colStatus")}</div>
        <SortHeader
          column="size"
          label={t("colSize")}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          className="hidden w-[60px] shrink-0 justify-end md:flex"
          align="right"
        />
        <SortHeader
          column="date"
          label={t("colDate")}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          className="hidden w-[52px] shrink-0 justify-end md:flex"
          align="right"
        />
        <div className="w-7 shrink-0" aria-hidden />
      </div>

      {/* Body */}
      {loading && items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-[12.5px]">{t("loading")}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Inbox className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-[14px] font-bold">
              {t("noSourcesYet")}
            </h3>
            <p className="max-w-md text-[12.5px] text-muted-foreground">
              {t("noSourcesYetHint")}
            </p>
          </div>
          {onCreate ? (
            <Button size="sm" onClick={onCreate}>
              {t("createSource")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="relative flex-1 overflow-y-auto"
          style={{ contain: "strict" }}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {virtualRows.map((virtualRow) => {
              const item = items[virtualRow.index];
              if (!item) return null;
              return (
                <SourcesTableRow
                  key={item.id}
                  source={item}
                  selected={selectedIds.has(item.id)}
                  aiAvailable={aiAvailable}
                  height={virtualRow.size}
                  top={virtualRow.start}
                  onSelect={() => onSelectOne(item.id)}
                  onOpen={() => onOpen(item.id)}
                  onAction={(action) => onRowAction(item.id, action)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSortChange,
  className,
  align,
}: {
  column: SortColumn;
  label: string;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  onSortChange: (col: SortColumn) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const active = sortColumn === column;
  const Icon = !active
    ? ArrowUpDown
    : sortDirection === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSortChange(column)}
      className={`group inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-foreground ${
        active ? "text-foreground" : "text-muted-foreground"
      } ${className ?? ""}`}
      aria-sort={
        active
          ? sortDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      {align === "right" ? <span className="flex-1" /> : null}
      <span>{label}</span>
      <Icon
        className={`size-3 transition-opacity ${
          active ? "opacity-100" : "opacity-40 group-hover:opacity-80"
        }`}
      />
    </button>
  );
}
