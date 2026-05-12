"use client";

// Page glossaire — vue d'ensemble visuelle + zoom-in par univers.
//
// Trois états visuels :
//
//   1. VUE D'ENSEMBLE (par défaut) — 6 tuiles, une par univers, avec
//      ses 3 sigles emblématiques en aperçu. Tout tient sur 1 écran.
//      L'aperçu sert de boussole : on reconnaît BCE/ONSS dans la tuile
//      "Entreprises" sans avoir besoin de comprendre le classement.
//
//   2. FOCUS UNIVERS — clic sur une tuile. Les autres se réduisent
//      à des onglets en haut, la liste complète de l'univers s'affiche
//      en dessous. Toujours sur 1 écran.
//
//   3. RECHERCHE — l'utilisateur a tapé quelque chose. On override les
//      univers et on montre les matches triés par pertinence à plat.
//      Si 0 match exact → suggestions cliquables ("Tu cherchais peut-être…").
//
// La recherche utilise `searchAcronyms` (lib/acronyms.ts) qui gère :
// trim, accents, multi-tokens, fuzzy match Levenshtein, suggestions.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, SearchIcon, XIcon } from "lucide-react";

import {
  ACRONYMS,
  ACRONYM_DOMAINS,
  POPULAR_ACRONYMS,
  lookupAcronym,
  searchAcronyms,
  type AcronymDomain,
  type AcronymEntry,
} from "@/lib/acronyms";

const ALL_ENTRIES: readonly AcronymEntry[] = Object.values(ACRONYMS);

// Ordre des univers — les plus consultés (chômage, CPAS) en tête.
const DOMAIN_ORDER: readonly AcronymDomain[] = [
  "chomage",
  "cpas",
  "emploi-regional",
  "entreprise",
  "sante-secu",
  "juridique",
];

const COUNTS_BY_DOMAIN: Readonly<Record<AcronymDomain, number>> = (() => {
  const counts = Object.fromEntries(
    DOMAIN_ORDER.map((d) => [d, 0]),
  ) as Record<AcronymDomain, number>;
  for (const entry of ALL_ENTRIES) counts[entry.domain]++;
  return counts;
})();

export function GlossairePage() {
  const [query, setQuery] = useState("");
  const [focusedDomain, setFocusedDomain] = useState<AcronymDomain | null>(null);
  // `expanded` : null = utiliser l'auto-déplier (3 résultats ou moins),
  // string vide = utilisateur a fermé manuellement, code = ouvert.
  const [expanded, setExpanded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { matches, suggestions } = useMemo(
    () => searchAcronyms(query),
    [query],
  );

  const trimmedQuery = query.trim();
  const inSearchMode = trimmedQuery.length > 0;
  const inFocusMode = !inSearchMode && focusedDomain !== null;
  const inGridMode = !inSearchMode && focusedDomain === null;

  const focusedEntries = useMemo(() => {
    if (!focusedDomain) return [];
    return ALL_ENTRIES.filter((e) => e.domain === focusedDomain).sort((a, b) =>
      a.code.localeCompare(b.code, "fr"),
    );
  }, [focusedDomain]);

  // Auto-déplier dérivé : ouvre tout quand la recherche narrow ≤ 3.
  const isOpen = (code: string, visibleCount: number): boolean => {
    if (expanded === code) return true;
    if (expanded !== null) return false;
    if (inSearchMode && visibleCount > 0 && visibleCount <= 3) return true;
    return false;
  };

  const popularEntries = useMemo(
    () =>
      POPULAR_ACRONYMS.map((code) => lookupAcronym(code)).filter(
        (e): e is AcronymEntry => Boolean(e),
      ),
    [],
  );

  const resetSearchState = (nextQuery: string) => {
    setQuery(nextQuery);
    setExpanded(null);
  };

  return (
    <section className="flex flex-col gap-5">
      {/* HERO — recherche + raccourcis */}
      <header className="glass-surface flex flex-col gap-4 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
              style={{
                background: "var(--glass-ink)",
                color: "var(--glass-bg-a)",
              }}
            >
              Aide
            </span>
            <h1 className="glass-display mt-2 text-[26px] font-semibold leading-[1.1] sm:text-[32px]">
              C&apos;est quoi ce <em>sigle</em>&nbsp;?
            </h1>
          </div>
          <div className="hidden text-right text-[11px] text-[color:var(--glass-ink-faint)] sm:block">
            {ALL_ENTRIES.length} sigles
            <br />
            {DOMAIN_ORDER.length} univers
          </div>
        </div>

        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2"
            style={{ color: "var(--glass-ink-soft)" }}
          />
          <input
            ref={inputRef}
            // type="text" et pas "search" → on évite le ✕ natif WebKit
            // qui dupliquait notre bouton de reset.
            type="text"
            value={query}
            onChange={(e) => resetSearchState(e.target.value)}
            placeholder="Tape ton sigle, un mot, une situation…"
            spellCheck={false}
            autoComplete="off"
            className="glass-surface-strong h-14 w-full rounded-2xl border-0 pr-14 pl-14 text-[16px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                resetSearchState("");
                inputRef.current?.focus();
              }}
              aria-label="Effacer la recherche"
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[color:var(--glass-ink-soft)] transition hover:bg-white/40 hover:text-[color:var(--glass-ink)]"
            >
              <XIcon className="size-4" />
            </button>
          ) : null}
        </div>

        {!inSearchMode ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-faint)]">
              On cherche surtout
            </span>
            {popularEntries.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => {
                  resetSearchState(entry.code);
                  inputRef.current?.focus();
                }}
                className="glass-surface rounded-full border-0 px-3 py-1 text-[12px] font-semibold text-[color:var(--glass-ink)] transition hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
              >
                {entry.code}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[color:var(--glass-ink-faint)]">
            {matches.length === 0
              ? `Aucun résultat exact pour « ${trimmedQuery} »`
              : `${matches.length} résultat${matches.length > 1 ? "s" : ""} pour « ${trimmedQuery} »`}
          </div>
        )}
      </header>

      {/* ÉTAT SEARCH : matches ou suggestions */}
      {inSearchMode ? (
        matches.length > 0 ? (
          <FlatResultList
            entries={matches}
            isOpen={(code) => isOpen(code, matches.length)}
            onToggle={(code, currentlyOpen) =>
              setExpanded(currentlyOpen ? "" : code)
            }
          />
        ) : (
          <EmptyResults
            query={trimmedQuery}
            suggestions={suggestions}
            onPick={(code) => {
              resetSearchState(code);
              inputRef.current?.focus();
            }}
          />
        )
      ) : null}

      {/* ÉTAT FOCUS UNIVERS : tabs + liste */}
      {inFocusMode && focusedDomain ? (
        <>
          <DomainTabs
            current={focusedDomain}
            onSelect={(d) => {
              setFocusedDomain(d);
              setExpanded(null);
            }}
            onReset={() => {
              setFocusedDomain(null);
              setExpanded(null);
            }}
          />
          <section className="glass-surface flex flex-col gap-3 p-5 sm:p-6">
            <header
              className="flex items-baseline justify-between gap-3 border-b pb-3"
              style={{ borderBottomColor: "var(--glass-ink-line)" }}
            >
              <h2 className="glass-display text-[20px] font-semibold leading-none text-[color:var(--glass-ink)]">
                {ACRONYM_DOMAINS[focusedDomain].label}
              </h2>
              <span className="hidden text-[12px] italic text-[color:var(--glass-ink-soft)] sm:block">
                {ACRONYM_DOMAINS[focusedDomain].tagline}
              </span>
            </header>
            <CompactList
              entries={focusedEntries}
              isOpen={(code) => isOpen(code, focusedEntries.length)}
              onToggle={(code, currentlyOpen) =>
                setExpanded(currentlyOpen ? "" : code)
              }
            />
          </section>
        </>
      ) : null}

      {/* ÉTAT VUE D'ENSEMBLE : 6 tuiles */}
      {inGridMode ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DOMAIN_ORDER.map((domain) => (
            <DomainTile
              key={domain}
              domain={domain}
              count={COUNTS_BY_DOMAIN[domain]}
              onOpen={() => {
                setFocusedDomain(domain);
                setExpanded(null);
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ============================================================
// Sous-composants
// ============================================================

function DomainTile({
  domain,
  count,
  onOpen,
}: {
  domain: AcronymDomain;
  count: number;
  onOpen: () => void;
}) {
  const meta = ACRONYM_DOMAINS[domain];
  const featured = meta.featured
    .map((code) => lookupAcronym(code))
    .filter((e): e is AcronymEntry => Boolean(e));
  const remaining = Math.max(0, count - featured.length);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-surface group flex h-full flex-col gap-3 p-5 text-left outline-none transition hover:-translate-y-0.5 hover:shadow-[0_12px_38px_rgba(80,40,140,0.16)] focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
    >
      <header className="flex items-start justify-between gap-3">
        <h2 className="glass-display text-[18px] font-semibold leading-tight text-[color:var(--glass-ink)]">
          {meta.label}
        </h2>
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]"
          style={{
            background: "var(--glass-pop-bg)",
            color: "var(--glass-pop-fg)",
          }}
        >
          {count}
        </span>
      </header>
      <p className="text-[12px] italic leading-snug text-[color:var(--glass-ink-soft)]">
        {meta.tagline}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {featured.map((entry) => (
          <span
            key={entry.code}
            className="rounded-full bg-white/40 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--glass-ink)] group-hover:bg-white/65"
          >
            {entry.code}
          </span>
        ))}
        {remaining > 0 ? (
          <span className="text-[11px] text-[color:var(--glass-ink-faint)]">
            +{remaining} autre{remaining > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function DomainTabs({
  current,
  onSelect,
  onReset,
}: {
  current: AcronymDomain;
  onSelect: (d: AcronymDomain) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onReset}
        className="glass-surface inline-flex items-center gap-1.5 rounded-full border-0 px-3 py-1.5 text-[12px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
      >
        <ArrowLeftIcon className="size-3.5" />
        Vue d&apos;ensemble
      </button>
      <span className="text-[color:var(--glass-ink-faint)]">·</span>
      {DOMAIN_ORDER.map((domain) => {
        const active = domain === current;
        return (
          <button
            key={domain}
            type="button"
            onClick={() => onSelect(domain)}
            className={`rounded-full border-0 px-3 py-1.5 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] ${
              active
                ? "text-[color:var(--glass-bg-a)]"
                : "glass-surface text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
            }`}
            style={active ? { background: "var(--glass-ink)" } : undefined}
          >
            {ACRONYM_DOMAINS[domain].label}
          </button>
        );
      })}
    </div>
  );
}

function FlatResultList({
  entries,
  isOpen,
  onToggle,
}: {
  entries: readonly AcronymEntry[];
  isOpen: (code: string) => boolean;
  onToggle: (code: string, currentlyOpen: boolean) => void;
}) {
  return (
    <section className="glass-surface flex flex-col gap-2 p-5 sm:p-6">
      <CompactList entries={entries} isOpen={isOpen} onToggle={onToggle} />
    </section>
  );
}

function CompactList({
  entries,
  isOpen,
  onToggle,
}: {
  entries: readonly AcronymEntry[];
  isOpen: (code: string) => boolean;
  onToggle: (code: string, currentlyOpen: boolean) => void;
}) {
  return (
    <ul className="flex flex-col">
      {entries.map((entry, i) => {
        const open = isOpen(entry.code);
        return (
          <li
            key={entry.code}
            id={`g-${entry.code.toLowerCase()}`}
            className={i < entries.length - 1 ? "border-b" : ""}
            style={{ borderBottomColor: "var(--glass-ink-line)" }}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => onToggle(entry.code, open)}
              className="flex w-full items-baseline gap-3 py-2.5 text-left outline-none transition focus-visible:bg-white/30"
            >
              <span className="glass-display min-w-[72px] text-[15px] font-semibold text-[color:var(--glass-ink)]">
                {entry.code}
              </span>
              <span className="flex-1">
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--glass-accent-deep)" }}
                >
                  {entry.label}
                </span>
                <span
                  className={`block text-[12.5px] leading-[1.5] text-[color:var(--glass-ink-soft)] ${
                    open ? "mt-1" : "mt-0.5 line-clamp-1"
                  }`}
                >
                  {entry.definition}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyResults({
  query,
  suggestions,
  onPick,
}: {
  query: string;
  suggestions: readonly AcronymEntry[];
  onPick: (code: string) => void;
}) {
  return (
    <div className="glass-surface flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
          Aucun sigle exact pour « {query} ».
        </p>
        <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
          Une faute de frappe&nbsp;? Une variante&nbsp;?
        </p>
      </div>

      {suggestions.length > 0 ? (
        <div className="flex flex-col items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
            Tu cherchais peut-être
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {suggestions.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => onPick(entry.code)}
                className="glass-surface rounded-full border-0 px-3.5 py-1.5 text-[13px] font-semibold text-[color:var(--glass-ink)] transition hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
              >
                {entry.code}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="max-w-md text-[12px] text-[color:var(--glass-ink-faint)]">
        Si un sigle administratif manque, signale-le via la page contact —
        on l&apos;ajoutera.
      </p>
    </div>
  );
}
