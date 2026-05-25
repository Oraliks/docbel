"use client";

/**
 * Toolbar sticky de la vue tabulaire des sources.
 *
 * Layout :
 *   [gauche] compteur "X / Y" + search input
 *   [centre] 3 dropdowns (Statut · Type · Tags) — badge count si actifs
 *   [droite] "Upload fichiers" (secondary) + "Nouvelle source" (default)
 */

import { useMemo } from "react";
import {
  ChevronDown,
  Filter as FilterIcon,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Upload,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { KIND_LABELS } from "../../_shared";
import type { StatusFilter, ValidityFilter } from "./_shared-table";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Tous les statuts" },
  { value: "active", label: "Actives uniquement" },
  { value: "disabled", label: "Désactivées" },
  { value: "extraction-failed", label: "Extraction échouée" },
  { value: "not-indexed", label: "Non indexées (RAG)" },
];

const VALIDITY_OPTIONS: Array<{ value: ValidityFilter; label: string }> = [
  { value: "all", label: "Toute fraîcheur" },
  { value: "fresh", label: "🟢 Fraîches" },
  { value: "stale", label: "🟡 À vérifier" },
  { value: "obsolete", label: "🔴 Périmées" },
  { value: "unknown", label: "⚪ Non scannées" },
];

interface Props {
  /** Nombre total après filtres. */
  filteredCount: number;
  /** Nombre total brut (sans filtre). */
  totalCount: number;
  /** Search texte. */
  search: string;
  onSearchChange: (s: string) => void;
  /** Statut. */
  statusFilter: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  /** Kind. */
  kindFilter: string;
  onKindChange: (k: string) => void;
  /** Fraîcheur (migration 22). */
  validityFilter: ValidityFilter;
  onValidityChange: (v: ValidityFilter) => void;
  /** Tag filters. */
  tagFilters: string[];
  onTagFiltersChange: (tags: string[]) => void;
  /** Tags disponibles dans le snapshot courant. */
  allTags: string[];
  /** Loading global → désactive refresh. */
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onUpload: () => void;
}

export function SourcesToolbar({
  filteredCount,
  totalCount,
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  kindFilter,
  onKindChange,
  validityFilter,
  onValidityChange,
  tagFilters,
  onTagFiltersChange,
  allTags,
  loading,
  onRefresh,
  onCreate,
  onUpload,
}: Props) {
  const hasFilters =
    statusFilter !== "all" ||
    kindFilter !== "all" ||
    validityFilter !== "all" ||
    tagFilters.length > 0 ||
    search.length > 0;

  const statusLabel = useMemo(
    () =>
      STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "Statut",
    [statusFilter]
  );
  const kindLabel = useMemo(
    () => (kindFilter === "all" ? "Type" : KIND_LABELS[kindFilter] ?? kindFilter),
    [kindFilter]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Counter */}
      <div className="text-[12px] font-semibold tabular-nums text-muted-foreground">
        {filteredCount === totalCount ? (
          <span>
            {totalCount} source{totalCount > 1 ? "s" : ""}
          </span>
        ) : (
          <span>
            <span className="text-foreground">{filteredCount}</span>
            <span className="text-muted-foreground/70"> / {totalCount}</span>
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-8 pr-8 text-[12.5px]"
        />
        {search.length > 0 ? (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        ) : null}
      </div>

      {/* Filters group */}
      <div className="flex items-center gap-1">
        {/* Statut */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-[12px]"
              />
            }
          >
            <FilterIcon className="size-3.5" />
            {statusLabel}
            {statusFilter !== "all" ? (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold tabular-nums text-primary">
                1
              </span>
            ) : null}
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52">
            <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider">
              Filtrer par statut
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={statusFilter}
              onValueChange={(v) => onStatusChange(v as StatusFilter)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem
                  key={opt.value}
                  value={opt.value}
                  className="text-[12px]"
                >
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Kind */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-[12px]"
              />
            }
          >
            {kindLabel}
            {kindFilter !== "all" ? (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold tabular-nums text-primary">
                1
              </span>
            ) : null}
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider">
              Filtrer par type
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={kindFilter}
              onValueChange={(v) => onKindChange(v)}
            >
              <DropdownMenuRadioItem value="all" className="text-[12px]">
                Tous les types
              </DropdownMenuRadioItem>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  className="text-[12px]"
                >
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tags */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-[12px]"
              />
            }
          >
            <Tag className="size-3.5" />
            Tags
            {tagFilters.length > 0 ? (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold tabular-nums text-primary">
                {tagFilters.length}
              </span>
            ) : null}
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-52 max-h-72 overflow-y-auto">
            <DropdownMenuLabel className="flex items-center justify-between text-[10.5px] uppercase tracking-wider">
              <span>Filtrer par tag (OR)</span>
              {tagFilters.length > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onTagFiltersChange([]);
                  }}
                  className="text-[10px] font-normal text-primary normal-case tracking-normal hover:underline"
                >
                  clear
                </button>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allTags.length === 0 ? (
              <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                Aucun tag dans la KB pour l&apos;instant.
              </div>
            ) : (
              allTags.map((tag) => {
                const checked = tagFilters.includes(tag);
                return (
                  <DropdownMenuItem
                    key={tag}
                    onClick={(e) => {
                      e.preventDefault();
                      onTagFiltersChange(
                        checked
                          ? tagFilters.filter((t) => t !== tag)
                          : [...tagFilters, tag]
                      );
                    }}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <Checkbox
                      checked={checked}
                      aria-label={tag}
                      className="pointer-events-none"
                    />
                    <span className="truncate">{tag}</span>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Validity (Feature 3) */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-[12px]"
              />
            }
          >
            {VALIDITY_OPTIONS.find((o) => o.value === validityFilter)?.label ?? "Fraîcheur"}
            {validityFilter !== "all" ? (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-bold tabular-nums text-primary">
                1
              </span>
            ) : null}
            <ChevronDown className="size-3 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider">
              Filtrer par fraîcheur
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={validityFilter}
              onValueChange={(v) => onValidityChange(v as ValidityFilter)}
            >
              {VALIDITY_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem
                  key={opt.value}
                  value={opt.value}
                  className="text-[12px]"
                >
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-[11px] text-muted-foreground"
            onClick={() => {
              onSearchChange("");
              onStatusChange("all");
              onKindChange("all");
              onValidityChange("all");
              onTagFiltersChange([]);
            }}
          >
            <X className="size-3.5" />
            Reset
          </Button>
        ) : null}
      </div>

      {/* Right group */}
      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Rafraîchir"
          title="Rafraîchir"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="secondary" size="sm" onClick={onUpload}>
          <Upload className="size-3.5" />
          Upload fichiers
        </Button>
        <Button size="sm" onClick={onCreate}>
          <Plus className="size-3.5" />
          Nouvelle source
        </Button>
      </div>
    </div>
  );
}
