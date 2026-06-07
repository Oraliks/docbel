"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CalculatorIcon,
  ClockIcon,
  FileTextIcon,
  HeartIcon,
  type LucideIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { type Tool, getToolSlug } from "@/lib/docbel-data";
import { glyphForTool } from "@/lib/tool-glyphs";
import {
  DOMAIN_BY_ID,
  TOOL_DOMAINS,
  countByDomain,
  domainForTool,
} from "@/lib/tool-categories";
import { useToolFavorites } from "@/hooks/useToolFavorites";

interface Props {
  tools: Tool[];
}

type View = "all" | "favorites" | "recents" | "simulations";
type Sort = "pertinents" | "recent" | "name" | "duree";

const POPULAR_SEARCH_EXAMPLES = ["préavis", "pension", "allocations", "tarif social"];

/** "2 min" → 2 ; "instant" → 0. Sert au tri par durée. */
function toMinutes(time: string): number {
  const m = time.match(/(\d+)/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

/* ── Petite tuile d'icône (pastille teintée translucide → s'adapte clair/sombre) ── */
function ToolIconTile({ tool, size = 40 }: { tool: Tool; size?: number }) {
  const { Icon, hue } = glyphForTool(tool);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${hue} 18%, transparent)`,
        color: hue,
      }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.9} />
    </span>
  );
}

/* ── Ligne compacte d'outil (Populaire / Récemment) ── */
function ToolMiniRow({ tool, onOpen }: { tool: Tool; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-white/45 focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent dark:hover:bg-white/[0.05]"
    >
      <ToolIconTile tool={tool} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold tracking-tight">
          {tool.title}
        </span>
        <span className="block truncate text-[11.5px] text-[color:var(--glass-ink-faint)]">
          {tool.desc}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[color:var(--glass-ink-faint)]">
        <ClockIcon className="size-3" />
        {tool.time}
      </span>
      <span
        className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 text-[11.5px] font-bold text-[color:var(--glass-ink)] transition group-hover:bg-white/70 dark:group-hover:bg-white/10"
        aria-hidden
      >
        Ouvrir
      </span>
    </button>
  );
}

export function OutilsCatalogClient({ tools }: Props) {
  const router = useRouter();
  const { favorites, recents, isFavorite, toggleFavorite, pushRecent } =
    useToolFavorites();

  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<Sort>("pertinents");

  const bySlug = useMemo(() => {
    const map = new Map<string, Tool>();
    for (const t of tools) map.set(getToolSlug(t), t);
    return map;
  }, [tools]);

  const openTool = useCallback(
    (tool: Tool) => {
      pushRecent(getToolSlug(tool));
      router.push(tool.href ?? `/outils/${getToolSlug(tool)}`);
    },
    [pushRecent, router],
  );

  const popularTools = useMemo(
    () => tools.filter((t) => t.popular).slice(0, 4),
    [tools],
  );

  const recentlyAdded = useMemo(
    () =>
      [...tools]
        .filter((t) => t.createdAt)
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
        .slice(0, 4),
    [tools],
  );

  const featured = recentlyAdded[0] ?? popularTools[0] ?? tools[0] ?? null;
  const domainCounts = useMemo(() => countByDomain(tools), [tools]);

  const favoriteTools = useMemo(
    () => favorites.map((s) => bySlug.get(s)).filter((t): t is Tool => !!t),
    [favorites, bySlug],
  );

  // ── Liste de la table : vue + domaine + recherche + tri ──
  const tableTools = useMemo(() => {
    let list = tools;
    if (view === "favorites")
      list = list.filter((t) => favorites.includes(getToolSlug(t)));
    else if (view === "recents")
      list = list.filter((t) => recents.includes(getToolSlug(t)));
    else if (view === "simulations")
      list = list.filter((t) => t.type?.startsWith("calc_"));
    if (selectedDomain)
      list = list.filter((t) => domainForTool(t) === selectedDomain);
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q),
      );
    const sorted = [...list];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => a.title.localeCompare(b.title, "fr"));
        break;
      case "duree":
        sorted.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
        break;
      case "recent":
        sorted.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
        break;
      default:
        sorted.sort((a, b) => Number(b.popular) - Number(a.popular));
    }
    return sorted;
  }, [tools, view, selectedDomain, search, sort, favorites, recents]);

  const VIEW_LABEL: Record<View, string> = {
    all: "Tous les outils",
    favorites: "Mes outils enregistrés",
    recents: "Récemment utilisés",
    simulations: "Mes simulations",
  };
  const hasActiveFilter = view !== "all" || selectedDomain !== null || search !== "";
  const resetFilters = () => {
    setView("all");
    setSelectedDomain(null);
    setSearch("");
  };

  const quickTiles: {
    id: string;
    label: string;
    Icon: LucideIcon;
    onClick: () => void;
    active: boolean;
  }[] = [
    {
      id: "recents",
      label: "Mon historique",
      Icon: ClockIcon,
      onClick: () => setView(view === "recents" ? "all" : "recents"),
      active: view === "recents",
    },
    {
      id: "favorites",
      label: "Mes favoris",
      Icon: HeartIcon,
      onClick: () => setView(view === "favorites" ? "all" : "favorites"),
      active: view === "favorites",
    },
    {
      id: "simulations",
      label: "Mes simulations",
      Icon: CalculatorIcon,
      onClick: () => setView(view === "simulations" ? "all" : "simulations"),
      active: view === "simulations",
    },
    {
      id: "documents",
      label: "Mes documents",
      Icon: FileTextIcon,
      onClick: () => router.push("/creer-ma-demande"),
      active: false,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ───────── HERO + RECHERCHE ───────── */}
      <section className="glass-surface grid gap-8 p-7 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:p-9">
        <header className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            Catalogue
          </p>
          <h1 className="glass-display text-[36px] font-semibold leading-[1.05] sm:text-[44px]">
            Tous les outils, <em>en un endroit.</em>
          </h1>
          <p className="max-w-xl text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            Formulaires officiels, calculateurs et simulateurs pour vos démarches
            administratives belges. Filtrez par catégorie ou recherchez par
            mot-clé.
          </p>
        </header>

        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un outil…"
              className="glass-surface-strong h-14 w-full rounded-2xl border-0 pr-5 pl-14 text-[15px] text-[color:var(--glass-ink)] shadow-none placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
            />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 text-[12px] text-[color:var(--glass-ink-faint)]">
            <span>Exemples populaires :</span>
            {POPULAR_SEARCH_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setSearch(ex)}
                className="font-semibold text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
              >
                {ex}
              </button>
            ))}
          </p>
        </div>
      </section>

      {/* ───────── RANGÉE 1 : Populaire · Nouveau · Récemment ───────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Populaire */}
        <section className="glass-surface flex flex-col p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
              <SparklesIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
              Populaire
            </h2>
            <button
              type="button"
              onClick={() => {
                resetFilters();
                setSort("pertinents");
              }}
              className="text-[12px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
            >
              Voir tout
            </button>
          </div>
          <div className="flex flex-col gap-0.5">
            {popularTools.map((tool) => (
              <ToolMiniRow
                key={tool.id}
                tool={tool}
                onOpen={() => openTool(tool)}
              />
            ))}
          </div>
        </section>

        {/* Nouveau (featured) */}
        {featured ? (
          <section
            className="relative flex min-h-[230px] flex-col justify-between overflow-hidden rounded-3xl p-7 text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--glass-status-from) 0%, var(--glass-status-to) 100%)",
            }}
          >
            <span
              className="absolute -top-12 -right-10 size-44 rounded-full bg-white/20"
              style={{ filter: "blur(30px)" }}
            />
            {(() => {
              const { Icon } = glyphForTool(featured);
              return (
                <Icon className="absolute right-5 bottom-5 size-28 text-white/15" strokeWidth={1.4} />
              );
            })()}
            <span className="relative inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
              <SparklesIcon className="size-3" />
              Nouveau
            </span>
            <div className="relative mt-4">
              <h3 className="glass-display text-[26px] font-semibold leading-tight">
                {featured.title}
              </h3>
              <p className="mt-2 max-w-[88%] text-[13px] leading-[1.5] text-white/85 line-clamp-3">
                {featured.desc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openTool(featured)}
              className="relative mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-[13px] font-bold text-[color:var(--glass-status-to)] transition hover:bg-white"
            >
              Ouvrir l&apos;outil
              <ArrowRightIcon className="size-4" />
            </button>
          </section>
        ) : null}

        {/* Récemment ajoutés */}
        <section className="glass-surface flex flex-col p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
              <SparklesIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
              Récemment ajoutés
            </h2>
            <button
              type="button"
              onClick={() => {
                resetFilters();
                setSort("recent");
              }}
              className="text-[12px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
            >
              Voir tout
            </button>
          </div>
          <div className="flex flex-col gap-0.5">
            {recentlyAdded.map((tool) => (
              <ToolMiniRow
                key={tool.id}
                tool={tool}
                onOpen={() => openTool(tool)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* ───────── RANGÉE 2 : Catégories · Accès rapide+Aide · Enregistrés ───────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Catégories */}
        <section className="glass-surface flex flex-col p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold tracking-tight">Catégories</h2>
            <button
              type="button"
              onClick={() => setSelectedDomain(null)}
              className="text-[12px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
            >
              Voir tout
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TOOL_DOMAINS.map((domain) => {
              const count = domainCounts[domain.id] ?? 0;
              const active = selectedDomain === domain.id;
              return (
                <button
                  key={domain.id}
                  type="button"
                  onClick={() =>
                    setSelectedDomain(active ? null : domain.id)
                  }
                  className="glass-interactive flex flex-col gap-2 rounded-2xl border p-3 text-left"
                  style={{
                    borderColor: active ? domain.hue : "transparent",
                    background: active
                      ? `color-mix(in oklab, ${domain.hue} 12%, transparent)`
                      : "var(--glass-surface)",
                  }}
                >
                  <span
                    className="flex size-9 items-center justify-center rounded-xl"
                    style={{
                      background: `color-mix(in oklab, ${domain.hue} 18%, transparent)`,
                      color: domain.hue,
                    }}
                  >
                    <domain.Icon className="size-[18px]" strokeWidth={1.9} />
                  </span>
                  <span>
                    <span className="block text-[12.5px] font-bold leading-tight tracking-tight">
                      {domain.label}
                    </span>
                    <span className="block text-[11px] text-[color:var(--glass-ink-faint)]">
                      {count} outil{count > 1 ? "s" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Accès rapide + Aide */}
        <div className="flex flex-col gap-6">
          <section className="glass-surface flex flex-col p-6">
            <h2 className="mb-3 text-[15px] font-bold tracking-tight">
              Accès rapide
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickTiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={tile.onClick}
                  className="glass-interactive flex flex-col items-center gap-2 rounded-2xl border p-3 text-center"
                  style={{
                    borderColor: tile.active
                      ? "var(--glass-accent-deep)"
                      : "transparent",
                    background: tile.active
                      ? "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)"
                      : "var(--glass-surface)",
                  }}
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[color:var(--glass-surface-strong)] text-[color:var(--glass-accent-deep)]">
                    <tile.Icon className="size-[18px]" strokeWidth={1.9} />
                  </span>
                  <span className="text-[11.5px] font-semibold leading-tight">
                    {tile.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section
            className="relative flex flex-1 flex-col justify-center overflow-hidden rounded-3xl p-6 text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--glass-accent-a) 0%, var(--glass-accent-deep) 100%)",
            }}
          >
            <SparklesIcon className="absolute right-5 top-5 size-20 text-white/15" strokeWidth={1.4} />
            <h3 className="relative flex items-center gap-2 text-[16px] font-bold">
              <SparklesIcon className="size-4" />
              Besoin d&apos;aide pour choisir ?
            </h3>
            <p className="relative mt-1.5 max-w-[85%] text-[12.5px] leading-[1.5] text-white/85">
              Répondez à quelques questions et nous vous proposons les bons
              outils.
            </p>
            <button
              type="button"
              onClick={() => router.push("/creer-ma-demande")}
              className="relative mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/95 px-5 py-2.5 text-[13px] font-bold text-[color:var(--glass-accent-deep)] transition hover:bg-white"
            >
              Commencer
              <ArrowRightIcon className="size-4" />
            </button>
          </section>
        </div>

        {/* Mes outils enregistrés */}
        <section className="glass-surface flex flex-col p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold tracking-tight">
              Mes outils enregistrés
            </h2>
            <button
              type="button"
              onClick={() => setView("favorites")}
              className="text-[12px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
            >
              Voir tout
            </button>
          </div>
          {favoriteTools.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-8 text-center">
              <HeartIcon className="size-6 text-[color:var(--glass-ink-faint)]" />
              <p className="text-[12.5px] font-semibold">Aucun outil enregistré</p>
              <p className="max-w-[85%] text-[11.5px] text-[color:var(--glass-ink-faint)]">
                Touchez le ♥ dans la liste ci-dessous pour garder vos outils ici.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {favoriteTools.slice(0, 5).map((tool) => (
                <div
                  key={tool.id}
                  className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2"
                >
                  <button
                    type="button"
                    onClick={() => openTool(tool)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none"
                  >
                    <ToolIconTile tool={tool} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold tracking-tight">
                        {tool.title}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--glass-ink-faint)]">
                        <ClockIcon className="size-3" />
                        {tool.time}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(getToolSlug(tool))}
                    aria-label="Retirer des favoris"
                    className="shrink-0 rounded-full p-1.5 text-[color:var(--glass-accent-c)] transition hover:bg-white/45 dark:hover:bg-white/[0.06]"
                  >
                    <HeartIcon className="size-4 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ───────── TABLE : Tous les outils ───────── */}
      <section className="glass-surface flex flex-col gap-4 p-6 lg:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[18px] font-bold tracking-tight">
            {VIEW_LABEL[view]}{" "}
            <span className="text-[color:var(--glass-ink-faint)]">
              ({tableTools.length})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-1.5 text-[12px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
              >
                <XIcon className="size-3.5" />
                Réinitialiser
              </button>
            ) : null}
            <label className="flex items-center gap-2 text-[12px] text-[color:var(--glass-ink-faint)]">
              <span className="hidden sm:inline">Trier par</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="glass-surface rounded-full border-0 px-3 py-1.5 text-[12px] font-semibold text-[color:var(--glass-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
              >
                <option value="pertinents">Plus pertinents</option>
                <option value="recent">Plus récents</option>
                <option value="name">Nom (A→Z)</option>
                <option value="duree">Durée</option>
              </select>
            </label>
          </div>
        </div>

        {selectedDomain ? (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-[color:var(--glass-ink-faint)]">Catégorie :</span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold"
              style={{
                background: `color-mix(in oklab, ${DOMAIN_BY_ID[selectedDomain]?.hue} 16%, transparent)`,
                color: DOMAIN_BY_ID[selectedDomain]?.hue,
              }}
            >
              {DOMAIN_BY_ID[selectedDomain]?.label}
              <button
                type="button"
                onClick={() => setSelectedDomain(null)}
                aria-label="Retirer le filtre"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          </div>
        ) : null}

        {tableTools.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <p className="text-[14px] font-semibold">Aucun outil ne correspond.</p>
            <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
              Essayez un autre filtre ou un mot-clé plus court.
            </p>
          </div>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-[color:var(--glass-ink-line)] text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
                  <th className="py-2 pr-3 font-bold">Outil</th>
                  <th className="hidden py-2 pr-3 font-bold md:table-cell">Catégorie</th>
                  <th className="hidden py-2 pr-3 font-bold lg:table-cell">Description</th>
                  <th className="py-2 pr-3 font-bold">Durée</th>
                  <th className="py-2 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {tableTools.map((tool) => {
                  const slug = getToolSlug(tool);
                  const domain = domainForTool(tool);
                  const dom = domain ? DOMAIN_BY_ID[domain] : null;
                  const fav = isFavorite(slug);
                  return (
                    <tr
                      key={tool.id}
                      className="border-b border-[color:var(--glass-ink-line)] align-middle transition-colors last:border-0 hover:bg-white/40 dark:hover:bg-white/[0.04]"
                    >
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          onClick={() => openTool(tool)}
                          className="flex items-center gap-3 text-left outline-none"
                        >
                          <ToolIconTile tool={tool} size={36} />
                          <span className="text-[13.5px] font-bold tracking-tight">
                            {tool.title}
                          </span>
                          {tool.popular ? (
                            <StarIcon
                              className="size-3.5 shrink-0"
                              style={{ color: "var(--glass-accent-d)" }}
                              strokeWidth={2.2}
                            />
                          ) : null}
                        </button>
                      </td>
                      <td className="hidden py-3 pr-3 md:table-cell">
                        {dom ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)]">
                            <span
                              className="size-1.5 rounded-full"
                              style={{ background: dom.hue }}
                            />
                            {dom.label}
                          </span>
                        ) : (
                          <span className="text-[12.5px] text-[color:var(--glass-ink-faint)]">
                            —
                          </span>
                        )}
                      </td>
                      <td className="hidden max-w-[420px] py-3 pr-3 lg:table-cell">
                        <span className="line-clamp-1 text-[12.5px] text-[color:var(--glass-ink-soft)]">
                          {tool.desc}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)]">
                          <ClockIcon className="size-3.5" />
                          {tool.time}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleFavorite(slug)}
                            aria-label={
                              fav ? "Retirer des favoris" : "Enregistrer l'outil"
                            }
                            className="rounded-full p-1.5 transition hover:bg-white/55 dark:hover:bg-white/10"
                            style={{
                              color: fav
                                ? "var(--glass-accent-c)"
                                : "var(--glass-ink-faint)",
                            }}
                          >
                            <HeartIcon
                              className={`size-4 ${fav ? "fill-current" : ""}`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => openTool(tool)}
                            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-bold transition hover:opacity-90"
                            style={{
                              background: "var(--glass-ink)",
                              color: "var(--glass-bg-a)",
                            }}
                          >
                            Ouvrir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[12px] text-[color:var(--glass-ink-faint)]">
          {tableTools.length} outil{tableTools.length > 1 ? "s" : ""} affiché
          {tableTools.length > 1 ? "s" : ""}
        </p>
      </section>
    </div>
  );
}
