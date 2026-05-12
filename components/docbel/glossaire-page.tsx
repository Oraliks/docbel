"use client";

// Page glossaire — liste tous les sigles connus dans une carte par entrée,
// avec un champ de recherche. Source unique : `lib/acronyms.ts`. Ajouter
// un nouveau sigle là met automatiquement à jour cette page.

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";

import { ACRONYMS, type AcronymEntry } from "@/lib/acronyms";

const ALL_ENTRIES: readonly AcronymEntry[] = Object.values(ACRONYMS).sort(
  (a, b) => a.code.localeCompare(b.code, "fr"),
);

function matches(entry: AcronymEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    entry.code.toLowerCase().includes(q) ||
    entry.label.toLowerCase().includes(q) ||
    entry.definition.toLowerCase().includes(q) ||
    (entry.aliases?.some((a) => a.toLowerCase().includes(q)) ?? false)
  );
}

export function GlossairePage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => ALL_ENTRIES.filter((e) => matches(e, query)),
    [query],
  );

  // On groupe par première lettre pour donner un repère de scan rapide.
  const grouped = useMemo(() => {
    const map = new Map<string, AcronymEntry[]>();
    for (const entry of filtered) {
      const initial = entry.code[0]?.toUpperCase() ?? "?";
      const bucket = map.get(initial) ?? [];
      bucket.push(entry);
      map.set(initial, bucket);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [filtered]);

  return (
    <section className="flex flex-col gap-8">
      <header className="glass-surface flex flex-col gap-5 p-8 sm:p-10">
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em]"
          style={{
            background: "var(--glass-ink)",
            color: "var(--glass-bg-a)",
          }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: "var(--glass-accent-c)" }}
          />
          Aide
        </span>

        <h1 className="glass-display max-w-3xl text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
          Glossaire des <em>sigles</em> administratifs
        </h1>

        <p className="max-w-3xl text-[15px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
          ONEM, CAPAC, RIS, AGR, C4, BCE… Les sigles utilisés par
          l&apos;administration belge en clair, avec une définition courte
          pour chacun. Survolez ou touchez un sigle dans n&apos;importe
          quel article de DocBel pour voir sa définition apparaître.
        </p>

        <div className="relative max-w-md">
          <SearchIcon
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2"
            style={{ color: "var(--glass-ink-soft)" }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par sigle, définition…"
            className="glass-surface h-11 w-full rounded-2xl border-0 pr-4 pl-11 text-[13px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
          />
        </div>

        <div className="text-[12px] text-[color:var(--glass-ink-faint)]">
          {filtered.length} sigle{filtered.length > 1 ? "s" : ""}
          {query ? ` pour « ${query} »` : ""}
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="glass-surface flex flex-col items-center gap-2 px-6 py-16 text-center">
          <p className="text-[14px] font-semibold">Aucun sigle ne correspond.</p>
          <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
            Si un sigle administratif manque ici, signalez-le via la page
            contact — on l&apos;ajoutera.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([letter, entries]) => (
            <section key={letter} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="glass-display flex size-9 items-center justify-center rounded-full text-[18px] font-semibold"
                  style={{
                    background: "var(--glass-surface)",
                    color: "var(--glass-accent-deep)",
                  }}
                >
                  {letter}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
                  {entries.length} entrée{entries.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((entry) => (
                  <article
                    key={entry.code}
                    id={`g-${entry.code.toLowerCase()}`}
                    className="glass-surface flex flex-col gap-2 p-5"
                  >
                    <header className="flex items-baseline justify-between gap-3">
                      <h2 className="glass-display text-[22px] font-semibold leading-none text-[color:var(--glass-ink)]">
                        {entry.code}
                      </h2>
                      {entry.aliases?.length ? (
                        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-faint)]">
                          aussi : {entry.aliases.join(", ")}
                        </span>
                      ) : null}
                    </header>
                    <div className="text-[12px] font-semibold text-[color:var(--glass-accent-deep)]">
                      {entry.label}
                    </div>
                    <p className="text-[13px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                      {entry.definition}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
