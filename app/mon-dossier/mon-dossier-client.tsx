"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  BookmarkSimpleIcon,
  BriefcaseIcon,
  ClockIcon,
  DotsThreeIcon,
  GraduationCapIcon,
  MagnifyingGlassIcon,
  PersonSimpleIcon,
  StackIcon,
  WheelchairIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { LayoutGridIcon, ListIcon, SearchIcon, XIcon } from "lucide-react";
import { IconDisplay } from "@/components/admin/documents/icon-picker";
import { LIFE_EVENT_CATEGORIES } from "@/lib/bundles/types";

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
}

interface Props {
  bundles: MonDossierBundle[];
}

/* Route réelle d'un dossier (identique à life-event-card.tsx → /d/[slug]). */
function bundleHref(slug: string): string {
  return `/d/${slug}`;
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

/* ── localStorage : dossiers mis en favori (par slug). SSR-safe. ── */
const BOOKMARKS_KEY = "docbel-dossier-bookmarks";

function readBookmarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function writeBookmarks(value: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(value));
  } catch {
    // Ignore (mode privé, quota dépassé…).
  }
}

function useDossierBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBookmarks(readBookmarks());
  }, []);

  const isBookmarked = useCallback(
    (slug: string) => bookmarks.includes(slug),
    [bookmarks],
  );

  const toggleBookmark = useCallback((slug: string) => {
    setBookmarks((prev) => {
      const next = prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : [...prev, slug];
      writeBookmarks(next);
      return next;
    });
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark };
}

/* ── Tuile d'icône teintée (glow) pour un dossier ── */
function DossierIconTile({ bundle, size = 44 }: { bundle: MonDossierBundle; size?: number }) {
  const hue = hueForBundle(bundle);
  const category = bundle.lifeEventCategory
    ? LIFE_EVENT_CATEGORIES.find((c) => c.id === bundle.lifeEventCategory)
    : null;

  return (
    <span
      className="glass-icon-tile flex shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-[1.06] group-hover:-translate-y-px motion-reduce:transform-none"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${hue} 18%, transparent)`,
        color: hue,
        "--tile-hue": hue,
      } as React.CSSProperties}
    >
      {/* IconDisplay = même rendu lucide/emoji que life-event-card (composant stable). */}
      {bundle.icon ? (
        <IconDisplay value={bundle.icon} className="size-[46%]" />
      ) : category ? (
        <span style={{ fontSize: size * 0.5, lineHeight: 1 }}>{category.emoji}</span>
      ) : (
        <StackIcon size={size * 0.46} weight="duotone" />
      )}
    </span>
  );
}

/* ── Carte dossier (réutilise glass-surface + glass-interactive) ── */
function DossierCard({
  bundle,
  bookmarked,
  onToggleBookmark,
  onOpen,
  listView,
}: {
  bundle: MonDossierBundle;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onOpen: () => void;
  listView: boolean;
}) {
  return (
    <div
      className={`glass-surface glass-interactive group relative flex p-5 ${
        listView ? "flex-row items-center gap-4" : "flex-col gap-3"
      }`}
    >
      {/* Favori (coin haut droit) */}
      <button
        type="button"
        onClick={onToggleBookmark}
        aria-label={bookmarked ? "Retirer des favoris" : "Enregistrer le dossier"}
        aria-pressed={bookmarked}
        className="absolute right-3 top-3 z-10 rounded-full p-1.5 transition hover:bg-white/55 dark:hover:bg-white/10"
        style={{ color: bookmarked ? "var(--glass-accent-c)" : "var(--glass-ink-faint)" }}
      >
        <BookmarkSimpleIcon
          key={`${bundle.slug}-${bookmarked}`}
          size={18}
          weight={bookmarked ? "fill" : "duotone"}
          className={bookmarked ? "animate-heart-pop" : ""}
        />
      </button>

      <div className={`flex items-start gap-3 ${listView ? "flex-1 min-w-0" : ""}`}>
        <DossierIconTile bundle={bundle} size={44} />
        <div className="min-w-0 flex-1 pr-7">
          <h3 className="text-[14.5px] font-bold leading-tight tracking-tight text-[color:var(--glass-ink)]">
            {bundle.name}
          </h3>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
            <ClockIcon className="size-3" />
            {bundle.itemCount} document{bundle.itemCount > 1 ? "s" : ""}
          </span>
          {bundle.description ? (
            <p className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-[color:var(--glass-ink-soft)]">
              {bundle.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className={listView ? "shrink-0" : "mt-auto pt-1"}>
        <button
          type="button"
          onClick={onOpen}
          className="glass-cta inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold"
        >
          Créer
          <ArrowRightIcon size={15} weight="bold" className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none" />
        </button>
      </div>
    </div>
  );
}

type Sort = "populaires" | "az" | "categories" | "recents";

const SORT_PILLS: { id: Sort; label: string }[] = [
  { id: "populaires", label: "Populaires" },
  { id: "az", label: "A-Z" },
  { id: "categories", label: "Catégories" },
  { id: "recents", label: "Récents" },
];

interface SituationOption {
  id: string;
  label: string;
  Icon: PhosphorIcon;
}

const SITUATIONS: SituationOption[] = [
  { id: "travail", label: "Je travaille", Icon: BriefcaseIcon },
  { id: "recherche", label: "Je recherche un emploi", Icon: MagnifyingGlassIcon },
  { id: "etudiant", label: "Je suis étudiant ou apprenti", Icon: GraduationCapIcon },
  { id: "retraite", label: "Je suis retraité", Icon: PersonSimpleIcon },
  { id: "handicap", label: "Je suis en situation de handicap", Icon: WheelchairIcon },
  { id: "autre", label: "Autre situation", Icon: DotsThreeIcon },
];

const STEPS = ["Votre situation", "Vos besoins", "Affinons", "Résultat"];

export function MonDossierClient({ bundles }: Props) {
  const router = useRouter();
  const { isBookmarked, toggleBookmark } = useDossierBookmarks();

  const [situation, setSituation] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("populaires");
  const [listView, setListView] = useState(false);

  const openBundle = useCallback(
    (slug: string) => router.push(bundleHref(slug)),
    [router],
  );

  // ── Recherche (nom + description) ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bundles;
    return bundles.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.description ?? "").toLowerCase().includes(q),
    );
  }, [bundles, search]);

  // ── Tri (hors regroupement par catégorie, géré séparément) ──
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "az":
        list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
        break;
      case "recents":
        list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
        break;
      case "populaires":
      default:
        list.sort((a, b) => Number(b.popular) - Number(a.popular));
        break;
    }
    return list;
  }, [filtered, sort]);

  // ── Regroupement par catégorie (vue "Catégories") ──
  const grouped = useMemo(() => {
    const map = new Map<string, MonDossierBundle[]>();
    const uncategorized: MonDossierBundle[] = [];
    for (const b of filtered) {
      if (b.lifeEventCategory && CATEGORY_HUE[b.lifeEventCategory]) {
        const arr = map.get(b.lifeEventCategory) ?? [];
        arr.push(b);
        map.set(b.lifeEventCategory, arr);
      } else {
        uncategorized.push(b);
      }
    }
    return { map, uncategorized };
  }, [filtered]);

  const gridClass = listView
    ? "grid grid-cols-1 gap-4"
    : "grid gap-4 sm:grid-cols-2";

  const renderCard = (b: MonDossierBundle) => (
    <DossierCard
      key={b.slug}
      bundle={b}
      bookmarked={isBookmarked(b.slug)}
      onToggleBookmark={() => toggleBookmark(b.slug)}
      onOpen={() => openBundle(b.slug)}
      listView={listView}
    />
  );

  const isEmpty = filtered.length === 0;

  return (
    <section className="flex flex-col gap-8">
      {/* ───────── EN-TÊTE ───────── */}
      <header className="flex flex-col gap-3 px-1">
        <nav
          aria-label="Fil d'Ariane"
          className="flex items-center gap-1.5 text-[11.5px] text-[color:var(--glass-ink-faint)]"
        >
          <Link href="/" className="transition hover:text-[color:var(--glass-ink)]">
            Accueil
          </Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-[color:var(--glass-ink-soft)]">Mon dossier</span>
        </nav>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Mon dossier
        </p>
        <h1 className="glass-display text-[36px] font-semibold leading-[1.05] sm:text-[46px]">
          Créer ou retrouver <em>le bon dossier</em>
        </h1>
        <p className="max-w-2xl text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          Laissez-vous guider en quelques questions simples, ou accédez
          directement au dossier dont vous avez besoin.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        {/* ═════════ COLONNE GAUCHE — Assistant guidé ═════════ */}
        <section
          className="glass-surface outils-rise flex flex-col gap-5 p-7"
          style={{ animationDelay: "0ms" }}
        >
          <div className="flex flex-col gap-1.5">
            <h2 className="glass-display text-[24px] font-semibold leading-tight">
              Trouver le bon dossier
            </h2>
            <p className="text-[13px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
              Répondez à quelques questions simples. Nous vous orientons vers le
              dossier le plus adapté.
            </p>
          </div>

          {/* Illustration 3D flottante + glow */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/3d/compass.png"
            alt=""
            aria-hidden
            className="hero-float mx-auto h-[120px] w-[120px] object-contain"
            style={{
              filter:
                "drop-shadow(0 16px 26px rgba(20,10,45,0.4)) drop-shadow(0 0 24px color-mix(in oklab, var(--glass-accent-deep) 55%, transparent))",
            }}
          />

          {/* Stepper 4 étapes */}
          <ol className="flex items-center gap-1.5" aria-label="Progression du guide">
            {STEPS.map((label, i) => {
              const active = i === 0;
              return (
                <li key={label} className="flex flex-1 items-center gap-1.5">
                  <span className="flex flex-col items-center gap-1.5">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-[12px] font-bold transition ${
                        active
                          ? "bg-[color:var(--glass-accent-deep)] text-white shadow-[0_0_16px_color-mix(in_oklab,var(--glass-accent-deep)_55%,transparent)]"
                          : "border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-faint)]"
                      }`}
                      aria-current={active ? "step" : undefined}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`text-center text-[9.5px] font-semibold leading-tight ${
                        active
                          ? "text-[color:var(--glass-ink)]"
                          : "text-[color:var(--glass-ink-faint)]"
                      }`}
                    >
                      {label}
                    </span>
                  </span>
                  {i < STEPS.length - 1 ? (
                    <span
                      className="mb-5 h-[2px] flex-1 rounded-full"
                      style={{ background: "var(--glass-ink-line)" }}
                      aria-hidden
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>

          {/* Sélection de situation */}
          <div className="flex flex-col gap-2.5">
            <p className="text-[13.5px] font-semibold text-[color:var(--glass-ink)]">
              Quelle est votre situation principale ?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SITUATIONS.map((opt) => {
                const selected = situation === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSituation(selected ? null : opt.id)}
                    aria-pressed={selected}
                    className="glass-interactive group flex flex-col items-center gap-2 rounded-2xl border p-3 text-center"
                    style={{
                      borderColor: selected
                        ? "var(--glass-accent-deep)"
                        : "var(--glass-border)",
                      background: selected
                        ? "color-mix(in oklab, var(--glass-accent-deep) 12%, transparent)"
                        : "var(--glass-surface)",
                    }}
                  >
                    <span
                      className="glass-icon-tile flex size-9 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-[1.06] group-hover:-translate-y-px motion-reduce:transform-none"
                      style={{
                        background:
                          "color-mix(in oklab, var(--glass-accent-deep) 16%, transparent)",
                        color: "var(--glass-accent-deep)",
                      }}
                    >
                      <opt.Icon size={18} weight="duotone" />
                    </span>
                    <span className="text-[11.5px] font-semibold leading-tight text-[color:var(--glass-ink)]">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CTA + durée */}
          <div className="mt-auto flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => router.push("/creer-ma-demande")}
              className="glass-cta inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[14px] font-bold"
            >
              Commencer le guide
              <ArrowRightIcon size={17} weight="bold" />
            </button>
            <p className="inline-flex items-center justify-center gap-1.5 text-[11.5px] text-[color:var(--glass-ink-faint)]">
              <ClockIcon className="size-3.5" />
              2 minutes
            </p>
          </div>
        </section>

        {/* ═════════ COLONNE DROITE — Accès direct ═════════ */}
        <section
          className="glass-surface outils-rise flex flex-col gap-4 p-7"
          style={{ animationDelay: "80ms" }}
        >
          <h2 className="glass-display text-[24px] font-semibold leading-tight">
            Accès direct
          </h2>

          {/* Recherche */}
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un dossier (ex. : chômage, APL, carte grise…)"
              className="search-glow glass-surface-strong h-13 w-full rounded-2xl border-0 py-3.5 pr-4 pl-12 text-[14px] text-[color:var(--glass-ink)] shadow-none placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none"
              aria-label="Rechercher un dossier"
            />
          </div>

          {/* Pills de tri + bascule de vue */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Trier les dossiers">
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

            <div className="flex items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-0.5">
              <button
                type="button"
                onClick={() => setListView(false)}
                aria-label="Vue grille"
                aria-pressed={!listView}
                className="rounded-full p-1.5 transition"
                style={{
                  background: !listView
                    ? "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)"
                    : "transparent",
                  color: !listView
                    ? "var(--glass-accent-deep)"
                    : "var(--glass-ink-faint)",
                }}
              >
                <LayoutGridIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setListView(true)}
                aria-label="Vue liste"
                aria-pressed={listView}
                className="rounded-full p-1.5 transition"
                style={{
                  background: listView
                    ? "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)"
                    : "transparent",
                  color: listView
                    ? "var(--glass-accent-deep)"
                    : "var(--glass-ink-faint)",
                }}
              >
                <ListIcon className="size-4" />
              </button>
            </div>
          </div>

          {/* Grille de dossiers */}
          {isEmpty ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl px-6 py-14 text-center">
              <SearchIcon className="size-6 text-[color:var(--glass-ink-faint)]" />
              <p className="text-[14px] font-semibold text-[color:var(--glass-ink)]">
                {bundles.length === 0
                  ? "Aucun dossier n'est encore publié."
                  : "Aucun dossier ne correspond."}
              </p>
              <p className="max-w-sm text-[12.5px] text-[color:var(--glass-ink-soft)]">
                {bundles.length === 0
                  ? "Les dossiers ne sont pas encore disponibles. Réessayez dans un instant."
                  : "Essayez un autre mot-clé plus court, ou lancez le guide à gauche."}
              </p>
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
                >
                  <XIcon className="size-3.5" />
                  Effacer la recherche
                </button>
              ) : null}
            </div>
          ) : sort === "categories" ? (
            <div className="flex flex-col gap-6">
              {LIFE_EVENT_CATEGORIES.map((cat) => {
                const list = grouped.map.get(cat.id);
                if (!list || list.length === 0) return null;
                return (
                  <div key={cat.id} className="flex flex-col gap-3">
                    <h3 className="flex items-center gap-2 text-[14px] font-bold text-[color:var(--glass-ink)]">
                      <span aria-hidden>{cat.emoji}</span>
                      {cat.label}
                      <span className="text-[color:var(--glass-ink-faint)]">
                        ({list.length})
                      </span>
                    </h3>
                    <div className={gridClass}>{list.map(renderCard)}</div>
                  </div>
                );
              })}
              {grouped.uncategorized.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <h3 className="text-[14px] font-bold text-[color:var(--glass-ink)]">
                    Autres dossiers{" "}
                    <span className="text-[color:var(--glass-ink-faint)]">
                      ({grouped.uncategorized.length})
                    </span>
                  </h3>
                  <div className={gridClass}>
                    {grouped.uncategorized.map(renderCard)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={gridClass}>{sorted.map(renderCard)}</div>
          )}

          {/* Pied : catégories + aide */}
          <div className="mt-2 flex flex-col gap-2 border-t border-[color:var(--glass-ink-line)] pt-4 text-[12.5px] sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setSort("categories")}
              className="group inline-flex items-center gap-1 font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
            >
              Voir toutes les catégories
              <ArrowRightIcon
                size={14}
                weight="bold"
                className="-translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transform-none"
              />
            </button>
            <p className="text-[color:var(--glass-ink-faint)]">
              Vous ne trouvez pas votre dossier ?{" "}
              <Link
                href="/contact"
                className="font-semibold text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
              >
                Nous aider à l&apos;améliorer
              </Link>
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
