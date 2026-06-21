"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  FileQuestion,
  FolderOpen,
  HelpCircle,
  Layers,
  Lightbulb,
  Lock,
  Phone,
  RotateCcw,
  Search as SearchIcon,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { IconDisplay } from "@/components/admin/documents/icon-picker";
import { DossierWizard } from "@/components/docbel/onboarding/dossier-wizard";
import { LIFE_EVENT_CATEGORIES } from "@/lib/bundles/types";
import { scoreBundleMatch } from "@/lib/bundles/vocabulary";
import { trackBundleEventClient } from "@/lib/bundles/analytics-client";
import type { WizardSituation } from "@/lib/dossier-wizard/config";
import type { WizardCatalog } from "@/lib/dossier-wizard/derive-results";
import type { ActiveBundleRun } from "@/lib/landing/resume";

export interface MonDossierBundle {
  slug: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  lifeEventCategory: string | null;
  itemCount: number;
  createdAt: string | null;
  popular: boolean;
  organism: string | null;
  vocabularyTags: string[];
  keywords: string[];
  synonyms: string[];
}

interface Props {
  bundles: MonDossierBundle[];
  catalog: WizardCatalog;
  /// Dernier dossier local en cours (zone « Reprendre »), ou null.
  activeRun: ActiveBundleRun | null;
  /// Situations du wizard : arbre publié (Decision Builder) si dispo, sinon
  /// fallback `WIZARD_SITUATIONS` (résolu côté serveur dans page.tsx).
  situations: WizardSituation[];
}

/* Route réelle d'un dossier (identique à life-event-card.tsx → /d/[slug]). */
function bundleHref(slug: string): string {
  return `/d/${slug}`;
}

/* Repli « sous-chaîne » pour la frappe partielle (ex. "chom" → "chômage"),
   que le scorer par tokens entiers ne capterait pas. Score faible (1). */
function substringHit(b: MonDossierBundle, q: string): boolean {
  if (!q) return false;
  if (b.name.toLowerCase().includes(q)) return true;
  if ((b.description ?? "").toLowerCase().includes(q)) return true;
  if ((b.organism ?? "").toLowerCase().includes(q)) return true;
  return [...b.vocabularyTags, ...b.keywords, ...b.synonyms].some((t) =>
    t.toLowerCase().includes(q),
  );
}

/* Teintes de repli par catégorie (charte mauve), quand bundle.color manque. */
const CATEGORY_HUE: Record<string, string> = {
  emploi: "#5B46E5",
  formation: "#7C3AED",
  famille: "#ff5fa2",
  logement: "#0ea5e9",
  sante: "#10b981",
  pension: "#f59e0b",
  social: "#ff7a7a",
  independant: "#8b5cf6",
};

function hueForBundle(b: MonDossierBundle): string {
  if (b.color && b.color.trim()) return b.color;
  if (b.lifeEventCategory && CATEGORY_HUE[b.lifeEventCategory]) {
    return CATEGORY_HUE[b.lifeEventCategory];
  }
  return "var(--glass-accent-deep)";
}

/* Feuilles qui « tombent » dans le dossier du hero (décalage, inclinaison,
   teinte d'en-tête, délai). Peintes SOUS le PNG du dossier (cf. .hero-doc). */
const HERO_DOCS: {
  dx: string;
  r: string;
  delay: string;
  tint: string;
}[] = [
  { dx: "-12px", r: "-10deg", delay: "0s", tint: "var(--glass-accent-a)" },
  { dx: "13px", r: "8deg", delay: "0.95s", tint: "var(--glass-accent-c)" },
  { dx: "1px", r: "-3deg", delay: "1.9s", tint: "var(--glass-accent-deep)" },
];

/* ── Pastille d'icône teintée (glow) pour une ligne de dossier ── */
function RowIconTile({ bundle, size = 36 }: { bundle: MonDossierBundle; size?: number }) {
  const hue = hueForBundle(bundle);
  const category = bundle.lifeEventCategory
    ? LIFE_EVENT_CATEGORIES.find((c) => c.id === bundle.lifeEventCategory)
    : null;

  return (
    <span
      className="glass-icon-tile flex shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-[1.06] motion-reduce:transform-none"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${hue} 18%, transparent)`,
        color: hue,
        "--tile-hue": hue,
      } as React.CSSProperties}
    >
      {bundle.icon ? (
        <IconDisplay value={bundle.icon} className="size-[48%]" />
      ) : category ? (
        <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{category.emoji}</span>
      ) : (
        <Layers size={size * 0.46} />
      )}
    </span>
  );
}

/* ── Ligne « Accès direct » (icône + nom + sous-titre + chevron) ── */
function AccessRow({ bundle }: { bundle: MonDossierBundle }) {
  // Organisme en sous-titre (façon mockup) ; repli sur le nombre de documents.
  const subtitle =
    bundle.organism?.trim() ||
    (bundle.itemCount > 0
      ? `${bundle.itemCount} document${bundle.itemCount > 1 ? "s" : ""} à préparer`
      : "Dossier guidé");

  return (
    <Link
      href={bundleHref(bundle.slug)}
      onClick={() =>
        trackBundleEventClient("bundle_opened", {
          bundleId: bundle.slug,
          metadata: { slug: bundle.slug, from: "direct" },
        })
      }
      className="group flex items-center gap-3 rounded-2xl border border-transparent px-2.5 py-2.5 transition-all hover:-translate-y-px hover:border-[color:var(--glass-border)] hover:bg-[color:var(--glass-surface)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]/40"
    >
      <RowIconTile bundle={bundle} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-bold leading-tight text-[color:var(--glass-ink)]">
          {bundle.name}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-[color:var(--glass-ink-faint)]">
          {subtitle}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-[color:var(--glass-ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--glass-accent-deep)]" />
    </Link>
  );
}

/* ── Lien de la colonne « Besoin d'aide » ── */
function HelpRow({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: typeof HelpCircle;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--glass-accent-deep)] transition-colors"
        style={{
          background: "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)",
        }}
        aria-hidden
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[color:var(--glass-ink)]">
        {label}
      </span>
      <ChevronRight className="size-4 shrink-0 text-[color:var(--glass-ink-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[color:var(--glass-accent-deep)]" />
    </>
  );

  const cls =
    "glass-interactive group flex w-full items-center gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-2.5 text-left";

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ── Zone « Reprendre un dossier » : dernier dossier local + code BELDOC ── */
function ActiveRunCard({ run }: { run: ActiveBundleRun }) {
  const pct = run.total > 0 ? Math.round((run.completed / run.total) * 100) : 0;
  const hue = run.color || "var(--glass-accent-deep)";
  return (
    <Link
      href={bundleHref(run.slug)}
      onClick={() =>
        trackBundleEventClient("bundle_opened", {
          bundleId: run.slug,
          metadata: { slug: run.slug, from: "resume_local" },
        })
      }
      className="glass-interactive group flex flex-col gap-2 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3.5"
    >
      <div className="flex items-center gap-3">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: hue }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold text-[color:var(--glass-ink)]">
            {run.name}
          </span>
          <span className="text-[12px] text-[color:var(--glass-ink-faint)]">
            {run.completed} sur {run.total} document{run.total > 1 ? "s" : ""}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[color:var(--glass-accent-deep)]">
          Reprendre
          <ArrowRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
      <span
        className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--glass-ink-line)]"
        aria-hidden
      >
        <span
          className="block h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: hue }}
        />
      </span>
    </Link>
  );
}

type Sort = "populaires" | "az" | "categories" | "recents";

const SORT_PILLS: { id: Sort; label: string }[] = [
  { id: "populaires", label: "Populaires" },
  { id: "az", label: "A-Z" },
  { id: "categories", label: "Catégories" },
  { id: "recents", label: "Récents" },
];

type Mode = "guide" | "direct";

/* Les deux parcours du segmented control. Chaque onglet porte un sous-titre
   qui clarifie ce qu'il fait (le toggle devient un vrai choix, pas un gadget). */
const MODE_TABS: {
  id: Mode;
  label: string;
  sub: string;
  icon: typeof Sparkles;
}[] = [
  {
    id: "guide",
    label: "Je me laisse guider",
    sub: "Quelques questions simples",
    icon: Sparkles,
  },
  {
    id: "direct",
    label: "J'accède directement",
    sub: "Recherche & catégories",
    icon: FolderOpen,
  },
];

export function MonDossierClient({ bundles, catalog, activeRun, situations }: Props) {
  const [mode, setMode] = useState<Mode>("guide");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("populaires");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set());
  const [showAllCats, setShowAllCats] = useState(false);

  const trimmed = search.trim().toLowerCase();
  const isSearching = trimmed.length > 0;

  // ── Filtre par catégorie (puces « Filtres ») ──
  const catFiltered = useMemo(() => {
    if (activeCats.size === 0) return bundles;
    return bundles.filter(
      (b) => b.lifeEventCategory && activeCats.has(b.lifeEventCategory),
    );
  }, [bundles, activeCats]);

  // ── Recherche CLASSÉE par score (scorer vocabulaire : tags + mots-clés +
  //    synonymes + organisme + nom + description), avec repli sous-chaîne pour
  //    la frappe partielle. cf. lib/bundles/vocabulary.ts ──
  const searchResults = useMemo(() => {
    if (!isSearching) return [] as MonDossierBundle[];
    const scored: { b: MonDossierBundle; score: number }[] = [];
    for (const b of catFiltered) {
      const s = scoreBundleMatch(search, {
        id: b.slug,
        slug: b.slug,
        name: b.name,
        description: b.description,
        vocabularyTags: b.vocabularyTags,
        keywords: b.keywords,
        synonyms: b.synonyms,
        organism: b.organism,
      }).score;
      const fallback = s === 0 && substringHit(b, trimmed) ? 1 : 0;
      const total = s + fallback;
      if (total > 0) scored.push({ b, score: total });
    }
    return scored.sort((a, b) => b.score - a.score).map((x) => x.b);
  }, [catFiltered, search, trimmed, isSearching]);

  // ── Tri intra-groupe ──
  const sortItems = useMemo(() => {
    return (list: MonDossierBundle[]) => {
      const arr = [...list];
      switch (sort) {
        case "az":
          arr.sort((a, b) => a.name.localeCompare(b.name, "fr"));
          break;
        case "recents":
          arr.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
          break;
        default:
          arr.sort((a, b) => Number(b.popular) - Number(a.popular));
          break;
      }
      return arr;
    };
  }, [sort]);

  // ── Regroupement par catégorie (vue sans recherche) ──
  const groups = useMemo(() => {
    const map = new Map<string, MonDossierBundle[]>();
    const uncategorized: MonDossierBundle[] = [];
    for (const b of catFiltered) {
      if (b.lifeEventCategory && CATEGORY_HUE[b.lifeEventCategory]) {
        const arr = map.get(b.lifeEventCategory) ?? [];
        arr.push(b);
        map.set(b.lifeEventCategory, arr);
      } else {
        uncategorized.push(b);
      }
    }
    const ordered: {
      id: string;
      label: string;
      emoji: string;
      items: MonDossierBundle[];
    }[] = LIFE_EVENT_CATEGORIES.filter((c) => map.has(c.id)).map((c) => ({
      id: c.id,
      label: c.label,
      emoji: c.emoji,
      items: sortItems(map.get(c.id) ?? []),
    }));
    if (uncategorized.length > 0) {
      ordered.push({
        id: "_autres",
        label: "Autres dossiers",
        emoji: "📁",
        items: sortItems(uncategorized),
      });
    }
    return ordered;
  }, [catFiltered, sortItems]);

  // Catégories disponibles (pour les puces de filtre).
  const availableCats = useMemo(
    () =>
      LIFE_EVENT_CATEGORIES.filter((c) =>
        bundles.some((b) => b.lifeEventCategory === c.id),
      ),
    [bundles],
  );

  // « Catégories » → déplie tout ; « Populaires/Récents » → limite à 3 groupes.
  const collapsed = !isSearching && !showAllCats && sort !== "categories";
  const visibleGroups = collapsed ? groups.slice(0, 3) : groups;
  const hiddenCount = groups.length - visibleGroups.length;

  function toggleCat(id: string) {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isEmpty = isSearching
    ? searchResults.length === 0
    : catFiltered.length === 0;

  // ── Analytics recherche (débouncé) : search_performed / search_no_result ──
  useEffect(() => {
    if (!isSearching || trimmed.length < 2) return;
    const t = setTimeout(() => {
      if (searchResults.length === 0) {
        trackBundleEventClient("search_no_result", { metadata: { q: trimmed } });
      } else {
        trackBundleEventClient("search_performed", {
          metadata: { q: trimmed, results: searchResults.length },
        });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [trimmed, isSearching, searchResults.length]);

  return (
    <section className="relative isolate flex flex-col gap-7">
      {/* ───────── HERO ───────── */}
      <header className="relative flex flex-col gap-3 px-1">
        {/* Illustration 3D : dossier + feuilles qui s'y classent (coin haut-droit) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-6 right-6 hidden h-[200px] w-[230px] lg:block"
        >
          {/* Le wrapper flotte ; les feuilles (hero-doc) descendent à l'intérieur
              puis passent DERRIÈRE le PNG du dossier (occlusion) → effet rangement. */}
          <div className="hero-float absolute right-4 top-0 h-[185px] w-[185px]">
            {HERO_DOCS.map((d, i) => (
              <span
                key={i}
                className="hero-doc absolute left-1/2 top-0 -ml-[15px] block h-[36px] w-[30px] overflow-hidden rounded-[5px] bg-white"
                style={
                  {
                    "--dx": d.dx,
                    "--r": d.r,
                    animationDelay: d.delay,
                    boxShadow: "0 9px 16px rgba(20,10,45,0.30)",
                  } as React.CSSProperties
                }
              >
                <span
                  className="block h-[8px] w-full"
                  style={{ background: d.tint }}
                />
                <span className="mx-[4px] mt-[5px] block h-[2.5px] rounded-full bg-[rgba(42,15,77,0.18)]" />
                <span className="mx-[4px] mt-[3px] block h-[2.5px] w-[68%] rounded-full bg-[rgba(42,15,77,0.13)]" />
                <span className="mx-[4px] mt-[3px] block h-[2.5px] w-[82%] rounded-full bg-[rgba(42,15,77,0.13)]" />
              </span>
            ))}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/3d/folder.png"
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
              style={{
                filter:
                  "drop-shadow(0 20px 36px rgba(20,10,45,0.30)) drop-shadow(0 0 50px color-mix(in oklab, var(--glass-accent-deep) 35%, transparent))",
              }}
            />
          </div>
        </div>

        <nav
          aria-label="Fil d'Ariane"
          className="flex items-center gap-1.5 text-[11.5px] text-[color:var(--glass-ink-faint)]"
        >
          <Link href="/" className="transition hover:text-[color:var(--glass-ink)]">
            Accueil
          </Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-[color:var(--glass-ink-soft)]">
            Mon dossier
          </span>
        </nav>
        <h1 className="glass-display max-w-2xl text-[36px] font-semibold leading-[1.05] sm:text-[46px]">
          Créer ou retrouver <em>le bon dossier</em>
        </h1>
        <p className="max-w-2xl text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          Laissez-vous guider en quelques questions simples, ou accédez
          directement au dossier dont vous avez besoin.
        </p>
      </header>

      {/* ═══════ Parcours (toggle) + panneau actif + aide — pleine largeur ═══════ */}
      <div className="flex w-full flex-col gap-6">
        {/* ── Segmented control : choix RÉEL du parcours (pastille glissante) ── */}
        <div
          role="tablist"
          aria-label="Choisissez votre parcours"
          className="glass-surface-strong relative flex w-full max-w-2xl rounded-2xl p-1.5"
        >
          {/* Pastille glissante = onglet actif */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-1.5 rounded-xl transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{
              width: "calc(50% - 0.375rem)",
              transform:
                mode === "direct" ? "translateX(100%)" : "translateX(0)",
              background:
                "linear-gradient(135deg, var(--glass-accent-deep), color-mix(in oklab, var(--glass-accent-deep) 72%, var(--glass-accent-a)))",
              boxShadow:
                "0 10px 24px color-mix(in oklab, var(--glass-accent-deep) 38%, transparent), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          />
          {MODE_TABS.map((t) => {
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => setMode(t.id)}
                className="relative z-10 flex flex-1 items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors sm:justify-start sm:px-4"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors"
                  style={{
                    background: active
                      ? "rgba(255,255,255,0.20)"
                      : "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)",
                    color: active ? "#fff" : "var(--glass-accent-deep)",
                  }}
                  aria-hidden
                >
                  <t.icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span
                    className="block truncate text-[13px] font-bold leading-tight transition-colors sm:text-[13.5px]"
                    style={{ color: active ? "#fff" : "var(--glass-ink)" }}
                  >
                    {t.label}
                  </span>
                  <span
                    className="mt-0.5 hidden truncate text-[11.5px] leading-tight transition-colors sm:block"
                    style={{
                      color: active
                        ? "rgba(255,255,255,0.82)"
                        : "var(--glass-ink-faint)",
                    }}
                  >
                    {t.sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* ── 2 colonnes : panneau actif (guide OU accès direct) + aide ──
             Largeurs aside augmentées progressivement (lg → 2xl) : sur très
             large (≥ 1600px) l'aide a plus de présence pour équilibrer le
             panneau qui devient très large. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* ════ Panneau principal — swap selon le parcours ════ */}
          <div className="min-w-0">
            {/* Parcours guidé */}
            <div
              role="tabpanel"
              id="panel-guide"
              aria-labelledby="tab-guide"
              className={mode === "guide" ? "outils-rise" : "hidden"}
            >
              <DossierWizard situations={situations} catalog={catalog} />
            </div>

            {/* Accès direct */}
            <section
              role="tabpanel"
              id="panel-direct"
              aria-labelledby="tab-direct"
              className={`glass-surface flex-col gap-4 p-6 ${
                mode === "direct" ? "outils-rise flex" : "hidden"
              }`}
            >
              <div className="flex items-center gap-3">
            <span
              className="glass-icon-tile flex size-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--glass-accent-deep)]"
              style={{
                background:
                  "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
                "--tile-hue": "var(--glass-accent-deep)",
              } as React.CSSProperties}
              aria-hidden
            >
              <FolderOpen className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold leading-tight text-[color:var(--glass-ink)]">
                Accès direct
              </h2>
              <p className="text-xs text-[color:var(--glass-ink-faint)]">
                Recherchez ou parcourez vos dossiers par catégorie.
              </p>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un dossier (ex. : chômage, RCC, insertion…)"
              className="search-glow glass-surface-strong h-12 w-full rounded-2xl border-0 py-3 pr-4 pl-11 text-[14px] text-[color:var(--glass-ink)] shadow-none placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none"
              aria-label="Rechercher un dossier"
            />
          </div>

          {/* Pills de tri + Filtres */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Trier les dossiers"
            >
              {SORT_PILLS.map((pill) => {
                const active = sort === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSort(pill.id)}
                    aria-pressed={active}
                    className="rounded-full border px-3 py-1.5 text-[12px] font-semibold transition"
                    style={{
                      borderColor: active
                        ? "var(--glass-accent-deep)"
                        : "var(--glass-border)",
                      background: active
                        ? "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)"
                        : "var(--glass-surface)",
                      color: active
                        ? "var(--glass-accent-deep)"
                        : "var(--glass-ink-soft)",
                    }}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-pressed={filtersOpen}
              aria-label="Filtres par catégorie"
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition"
              style={{
                borderColor:
                  filtersOpen || activeCats.size > 0
                    ? "var(--glass-accent-deep)"
                    : "var(--glass-border)",
                background:
                  filtersOpen || activeCats.size > 0
                    ? "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)"
                    : "var(--glass-surface)",
                color:
                  filtersOpen || activeCats.size > 0
                    ? "var(--glass-accent-deep)"
                    : "var(--glass-ink-soft)",
              }}
            >
              <SlidersHorizontal className="size-3.5" />
              Filtres
              {activeCats.size > 0 ? (
                <span className="ml-0.5 rounded-full bg-[color:var(--glass-accent-deep)] px-1.5 text-[10px] font-bold text-white">
                  {activeCats.size}
                </span>
              ) : null}
            </button>
          </div>

          {/* Puces de filtre par catégorie (repliables) */}
          {filtersOpen && availableCats.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 rounded-2xl border border-[color:var(--glass-ink-line)] p-2.5">
              {availableCats.map((c) => {
                const on = activeCats.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCat(c.id)}
                    aria-pressed={on}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition"
                    style={{
                      borderColor: on
                        ? "var(--glass-accent-deep)"
                        : "var(--glass-border)",
                      background: on
                        ? "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)"
                        : "transparent",
                      color: on
                        ? "var(--glass-accent-deep)"
                        : "var(--glass-ink-soft)",
                    }}
                  >
                    <span aria-hidden>{c.emoji}</span>
                    {c.label}
                  </button>
                );
              })}
              {activeCats.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveCats(new Set())}
                  className="ml-auto text-[12px] font-semibold text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
                >
                  Réinitialiser
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Liste groupée / résultats de recherche */}
          {isEmpty ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center">
              <SearchIcon className="size-6 text-[color:var(--glass-ink-faint)]" />
              <p className="text-[14px] font-semibold text-[color:var(--glass-ink)]">
                {bundles.length === 0
                  ? "Aucun dossier n'est encore publié."
                  : "Aucun dossier ne correspond."}
              </p>
              <p className="max-w-sm text-[12.5px] text-[color:var(--glass-ink-soft)]">
                {bundles.length === 0
                  ? "Les dossiers ne sont pas encore disponibles. Réessayez dans un instant."
                  : "Essayez un autre mot-clé, ou lancez le guide à gauche."}
              </p>
            </div>
          ) : isSearching ? (
            <div className="flex flex-col gap-1">
              {searchResults.map((b) => (
                <AccessRow key={b.slug} bundle={b} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {visibleGroups.map((g) => (
                <div key={g.id} className="flex flex-col gap-1.5">
                  <h3 className="flex items-center gap-2 px-1 text-[13px] font-bold text-[color:var(--glass-ink)]">
                    <span aria-hidden>{g.emoji}</span>
                    {g.label}
                    <span
                      className="ml-auto min-w-[1.25rem] rounded-full px-1.5 py-1 text-center text-[11px] font-bold leading-none tabular-nums"
                      style={{
                        background:
                          "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)",
                        color: "var(--glass-accent-deep)",
                      }}
                    >
                      {g.items.length}
                    </span>
                  </h3>
                  <div className="flex flex-col gap-0.5">
                    {g.items.map((b) => (
                      <AccessRow key={b.slug} bundle={b} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pied : voir toutes les catégories */}
          {!isSearching && groups.length > 0 ? (
            <div className="mt-1 border-t border-[color:var(--glass-ink-line)] pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAllCats((v) => !v);
                  if (!showAllCats) setSort("categories");
                }}
                className="group inline-flex w-full items-center justify-between gap-1 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
              >
                {collapsed && hiddenCount > 0
                  ? `Voir toutes les catégories (${groups.length})`
                  : "Voir moins"}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            </div>
          ) : null}
            </section>
          </div>

          {/* ════ Aide — sidebar persistante ════ */}
          <aside
            className="glass-surface outils-rise flex flex-col gap-4 p-6 lg:sticky lg:top-6"
            style={{ animationDelay: "120ms" }}
          >
          <div className="flex items-center gap-3">
            <span
              className="glass-icon-tile flex size-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--glass-accent-deep)]"
              style={{
                background:
                  "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
                "--tile-hue": "var(--glass-accent-deep)",
              } as React.CSSProperties}
              aria-hidden
            >
              <HelpCircle className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold leading-tight text-[color:var(--glass-ink)]">
                Besoin d&apos;aide ?
              </h2>
              <p className="text-xs text-[color:var(--glass-ink-faint)]">
                Trouvez rapidement une réponse.
              </p>
            </div>
          </div>

          {/* Dossier en cours sur cet appareil (dynamique — absent du mockup statique) */}
          {activeRun ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
                Dossier en cours
              </p>
              <ActiveRunCard run={activeRun} />
            </div>
          ) : null}

          {/* 4 liens d'aide (identiques au mockup) */}
          <div className="flex flex-col gap-2">
            <HelpRow
              icon={HelpCircle}
              label="Comment trouver le bon dossier ?"
              onClick={() => setMode("guide")}
            />
            <HelpRow
              icon={FileQuestion}
              label="Je ne trouve pas mon dossier"
              href="/contact"
            />
            <HelpRow
              icon={RotateCcw}
              label="Où en est ma demande ?"
              href="/reprendre"
            />
            <HelpRow
              icon={Phone}
              label="Comment joindre le support ?"
              href="/contact"
            />
          </div>

          {/* Conseil */}
          <div
            className="relative flex items-start gap-3 overflow-hidden rounded-2xl border p-4"
            style={{
              borderColor: "color-mix(in oklab, var(--glass-accent-c) 35%, transparent)",
              background: "color-mix(in oklab, var(--glass-accent-c) 12%, transparent)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 22px color-mix(in oklab, var(--glass-accent-c) 18%, transparent)",
            }}
          >
            <span
              aria-hidden
              className="animate-soft-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
            <span
              className="relative flex size-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                background:
                  "color-mix(in oklab, var(--glass-accent-c) 30%, var(--glass-surface-strong))",
                color: "var(--glass-pop-fg)",
              }}
              aria-hidden
            >
              <Lightbulb className="size-[18px]" />
            </span>
            <div className="relative min-w-0">
              <p className="text-[13.5px] font-bold text-[color:var(--glass-ink)]">
                Conseil
              </p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-[color:var(--glass-ink-soft)]">
                Préparez vos informations avant de commencer : vos identifiants,
                documents et informations personnelles.
              </p>
            </div>
          </div>

          <p className="mt-auto inline-flex items-center gap-1.5 text-[11.5px] text-[color:var(--glass-ink-faint)]">
            <Lock className="size-3.5" aria-hidden />
            Vos données restent confidentielles et ne sont jamais transmises.
          </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
