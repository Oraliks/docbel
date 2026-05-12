"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { LandingToolCard } from "@/components/docbel/landing/tool-card";
import { CATEGORIES, TOOLS_DATA } from "@/lib/docbel-data";
import { useAppState } from "@/lib/app-state-context";

export default function OutilsIndexPage() {
  const { toolsCat, setToolsCat } = useAppState();
  const [search, setSearch] = useState("");

  const filtered = TOOLS_DATA.filter((tool) => {
    const matchesCategory = toolsCat === "Tous" || tool.cat === toolsCat;
    const lower = search.toLowerCase();
    const matchesSearch =
      tool.title.toLowerCase().includes(lower) ||
      tool.desc.toLowerCase().includes(lower);
    return matchesCategory && matchesSearch;
  });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Catalogue
        </p>
        <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[48px]">
          Tous les outils, <em>en un endroit.</em>
        </h1>
        <p className="max-w-2xl text-[14px] text-[color:var(--glass-ink-soft)]">
          Formulaires officiels, simulateurs et localisateurs pour vos
          démarches administratives belges. Filtrez par catégorie ou
          recherchez par mot-clé.
        </p>
      </header>

      <div className="flex flex-col gap-3 px-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un outil…"
            className="glass-surface h-11 w-full rounded-2xl border-0 pr-4 pl-11 text-[13px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => {
            const active = cat === toolsCat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setToolsCat(cat)}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? "border-transparent text-[color:var(--glass-bg-a)]"
                    : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
                }`}
                style={active ? { background: "var(--glass-ink)" } : undefined}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-surface flex flex-col items-center gap-2 px-6 py-16 text-center">
          <p className="text-[14px] font-semibold">Aucun outil ne correspond.</p>
          <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
            Essayez une autre catégorie ou un mot-clé plus court.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((tool, index) => (
            <LandingToolCard key={tool.id} tool={tool} index={index} />
          ))}
        </div>
      )}

      <p className="px-2 text-[12px] text-[color:var(--glass-ink-faint)]">
        {filtered.length} outil{filtered.length > 1 ? "s" : ""} affiché
        {filtered.length > 1 ? "s" : ""}
      </p>
    </section>
  );
}
