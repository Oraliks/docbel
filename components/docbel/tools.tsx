"use client";

import React, { useState } from "react";
import { SearchIcon, GridIcon, ListIcon, ClockIcon, ArrowIcon, ChevronIcon } from "./icons";
import { CATEGORIES, Tool } from "@/lib/docbel-data";

interface ToolsSectionProps {
  tools: Tool[];
  search: string;
  setSearch: (s: string) => void;
  cat: string;
  setCat: (c: string) => void;
  layout: "grid" | "list";
  setLayout: (l: "grid" | "list") => void;
  accent: string;
  setOpenTool: (t: Tool) => void;
}

type SortKey = "popularity" | "name" | "time";
const SORT_LABELS: Record<SortKey, string> = {
  popularity: "Popularité",
  name: "Nom (A → Z)",
  time: "Temps estimé",
};

export function ToolsSection({
  tools,
  search,
  setSearch,
  cat,
  setCat,
  layout,
  setLayout,
  accent,
  setOpenTool,
}: ToolsSectionProps) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortKey>("popularity");
  const [sortOpen, setSortOpen] = useState(false);
  const PER_PAGE = 6;

  const sorted = [...tools].sort((a, b) => {
    if (sort === "popularity") return Number(b.popular) - Number(a.popular);
    if (sort === "name") return a.title.localeCompare(b.title);
    if (sort === "time") return parseInt(a.time) - parseInt(b.time);
    return 0;
  });

  const needsPagination = sorted.length > PER_PAGE;
  const totalPages = needsPagination ? Math.ceil(sorted.length / PER_PAGE) : 1;
  const visible = needsPagination ? sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE) : sorted.slice(0, PER_PAGE);

  React.useEffect(() => { setPage(0); }, [cat, search, sort]);

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-4.5 flex-wrap gap-3">
        <h2 className="text-2xl font-black text-foreground" style={{ letterSpacing: "-0.5px" }}>
          Catalogue d'outils
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-medium">
            {tools.length} résultats
          </span>
          <div className="flex border border-border rounded-lg overflow-hidden">
            {([["grid", GridIcon], ["list", ListIcon]] as const).map(([val, Icon]) => (
              <button
                key={val}
                onClick={() => setLayout(val)}
                className="px-3 py-1.75 border-none cursor-pointer flex items-center transition-all text-xs"
                style={{
                  background: layout === val ? accent : "transparent",
                  color: layout === val ? "white" : "var(--color-text-muted)",
                }}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar: search | pills | sort */}
      <div className="flex items-center gap-3 mb-5.5 flex-wrap">
        <div className="relative w-[260px] shrink-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none">
            <SearchIcon size={14} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un outil..."
            className="w-full px-3 py-2.25 pl-8.5 rounded-lg border border-border bg-input text-foreground text-sm outline-none transition-colors placeholder:text-text-muted focus:border-[var(--accent)]"
            style={{
              borderColor: undefined,
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
          />
        </div>

        <div className="flex gap-1.5 flex-1 flex-wrap">
          {CATEGORIES.map((c) => {
            const active = cat === c;
            const label = c === "Tous" ? "Tous les outils" : c;
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-3.5 py-2 rounded-lg text-xs transition-all ${
                  active ? "font-semibold" : "font-medium text-text-muted"
                }`}
                style={{
                  border: `1px solid ${active ? accent : "var(--color-border)"}`,
                  background: active ? `${accent}12` : "transparent",
                  color: active ? accent : undefined,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setSortOpen((o) => !o)}
            className="flex items-center gap-2 px-3.5 py-2.25 rounded-lg border border-border bg-surface text-foreground cursor-pointer text-xs font-medium transition-all"
          >
            <span className="text-text-muted">Trier par :</span>
            <span className="font-semibold">{SORT_LABELS[sort]}</span>
            <ChevronIcon size={12} down={!sortOpen} />
          </button>
          {sortOpen && (
            <div className="absolute top-[calc(100%_+_6px)] right-0 bg-surface border border-border rounded-xl p-1 shadow-lg z-50 min-w-[180px]">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setSort(k);
                    setSortOpen(false);
                  }}
                  className={`block w-full px-3 py-2.25 text-left text-xs rounded-lg transition-all ${
                    sort === k ? "font-semibold" : "font-medium text-foreground"
                  }`}
                  style={{
                    background: sort === k ? `${accent}12` : "transparent",
                    color: sort === k ? accent : undefined,
                  }}
                >
                  {SORT_LABELS[k]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {layout === "grid" ? (
        <div className="grid grid-cols-3 gap-4.5">
          {visible.map((tool) => (
            <ToolCard key={tool.id} tool={tool} accent={accent} onClick={() => setOpenTool(tool)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((tool) => (
            <ToolRow key={tool.id} tool={tool} accent={accent} onClick={() => setOpenTool(tool)} />
          ))}
        </div>
      )}

      {needsPagination && (
        <div className="flex items-center justify-center gap-2 mt-7">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-9 h-9 rounded-lg border border-border bg-transparent text-text-muted cursor-pointer flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-default"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center text-xs font-semibold transition-all ${
                i === page
                  ? "text-white cursor-pointer"
                  : "border-border bg-transparent text-text-muted cursor-pointer"
              }`}
              style={{
                borderColor: i === page ? accent : undefined,
                background: i === page ? accent : undefined,
              }}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="w-9 h-9 rounded-lg border border-border bg-transparent text-text-muted cursor-pointer flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-default"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <span className="text-xs text-text-faint ml-2">
            {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, sorted.length)} sur {sorted.length}
          </span>
        </div>
      )}

      {tools.length === 0 && (
        <div className="text-center py-15 px-5 text-text-muted">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-base font-semibold">Aucun outil trouvé</div>
          <div className="text-sm mt-1">Essayez un autre terme de recherche</div>
        </div>
      )}

    </section>
  );
}

interface ToolItemProps {
  tool: Tool;
  accent: string;
  onClick: () => void;
}

function ToolCard({ tool, accent, onClick }: ToolItemProps) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="bg-surface border rounded-xl px-5.5 py-4.5 cursor-pointer text-left transition-all flex flex-col gap-3"
      style={{
        border: `1px solid ${hov ? accent + "50" : "var(--color-border)"}`,
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? `0 8px 24px ${accent}15` : "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex justify-between items-start">
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: `${accent}10`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
          }}
        >
          {tool.icon}
        </div>
        {tool.popular && (
          <span
            className="text-xs font-bold px-2.25 py-0.75 rounded-full"
            style={{
              background: `${accent}15`,
              color: accent,
              letterSpacing: "0.04em",
            }}
          >
            Populaire
          </span>
        )}
      </div>
      <div>
        <div className="text-sm font-bold text-foreground mb-1.5 leading-tight">
          {tool.title}
        </div>
        <div className="text-xs text-text-muted leading-tight">{tool.desc}</div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="flex items-center gap-1 text-xs text-text-faint font-medium">
          <ClockIcon size={11} /> {tool.time}
        </span>
        <span style={{ color: accent }} className="text-xs font-semibold flex items-center gap-1">
          Utiliser <ArrowIcon size={11} />
        </span>
      </div>
    </button>
  );
}

function ToolRow({ tool, accent, onClick }: ToolItemProps) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="bg-surface border rounded-xl px-5 py-4 cursor-pointer text-left flex items-center gap-4 transition-all"
      style={{
        border: `1px solid ${hov ? accent + "50" : "var(--color-border)"}`,
        boxShadow: hov ? `0 4px 12px ${accent}12` : "none",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: `${accent}10`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {tool.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-foreground">{tool.title}</div>
        <div className="text-xs text-text-muted mt-0.5 truncate">
          {tool.desc}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-xs text-text-faint font-medium flex items-center gap-1">
          <ClockIcon size={11} /> {tool.time}
        </span>
        {tool.popular && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: `${accent}12`,
              color: accent,
            }}
          >
            Populaire
          </span>
        )}
        <span className="text-sm text-text-muted">
          <ArrowIcon size={15} />
        </span>
      </div>
    </button>
  );
}
