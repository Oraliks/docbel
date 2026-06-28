"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CompassIcon,
  SearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import type { TrainingCardData } from "@/lib/formations/queries";
import { TrainingCard } from "@/components/formations/training-card";
import { resolveIcon } from "@/components/formations/icons";

interface Category {
  slug: string;
  name: string;
  color: string;
  icon: string | null;
}

interface Props {
  trainings: TrainingCardData[];
  categories: Category[];
}

const PRICE_FILTERS = [
  { id: "free", labelKey: "filterPriceFree" },
  { id: "paid", labelKey: "filterPricePaid" },
] as const;
const FORMAT_FILTERS = [
  { id: "online", labelKey: "filterFormatOnline" },
  { id: "onsite", labelKey: "filterFormatOnsite" },
  { id: "hybrid", labelKey: "filterFormatHybrid" },
] as const;
const LEVEL_FILTERS = [
  { id: "debutant", labelKey: "filterLevelDebutant" },
  { id: "intermediaire", labelKey: "filterLevelIntermediaire" },
  { id: "avance", labelKey: "filterLevelAvance" },
] as const;

export function CatalogueClient({ trainings, categories }: Props) {
  const router = useRouter();
  const t = useTranslations("public.formations");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trainings.filter((t) => {
      if (category && t.category?.slug !== category) return false;
      if (price && t.priceType !== price) return false;
      if (format && t.format !== format) return false;
      if (level && t.level !== level) return false;
      if (q) {
        const hay = `${t.title} ${t.shortDescription ?? ""} ${t.organization.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [trainings, search, category, price, format, level]);

  const recommended = useMemo(
    () => trainings.filter((t) => t.isDocbelRecommended).slice(0, 3),
    [trainings],
  );

  const hasFilter = !!(category || price || format || level || search);
  const reset = () => {
    setSearch("");
    setCategory(null);
    setPrice(null);
    setFormat(null);
    setLevel(null);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* HERO */}
      <section className="glass-surface grid gap-5 p-5 sm:gap-8 sm:p-7 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:p-9">
        <header className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            {t("eyebrow")}
          </p>
          <h1 className="glass-display text-[34px] font-semibold leading-[1.05] sm:text-[42px]">
            {t.rich("heroTitle", { em: (chunks) => <em>{chunks}</em> })}
          </h1>
          <p className="max-w-xl text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            {t("heroSubtitle")}
          </p>
          <div className="mt-1 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => router.push("/formations/boussole")}
              className="glass-cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold"
            >
              <CompassIcon className="size-4" />
              {t("ctaLaunchBoussole")}
            </button>
            <a
              href="#catalogue"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-2.5 text-[13px] font-bold text-[color:var(--glass-ink)] transition hover:bg-white/55 dark:hover:bg-white/10"
            >
              {t("ctaSeeTrainings")}
              <ArrowRightIcon className="size-4" />
            </a>
            <button
              type="button"
              onClick={() => router.push("/mon-espace/formations")}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
            >
              <BookmarkIcon className="size-4" />
              {t("ctaMyTrainings")}
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="glass-surface-strong h-14 w-full rounded-2xl border-0 pr-5 pl-14 text-[15px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
            />
          </div>
          <p className="pl-1 text-[12px] text-[color:var(--glass-ink-faint)]">
            {t("searchHintPrefix")}{" "}
            <button
              type="button"
              onClick={() => router.push("/formations/boussole")}
              className="font-semibold text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
            >
              {t("searchHintLink")}
            </button>
            .
          </p>
        </div>
      </section>

      {/* RECOMMANDÉ */}
      {recommended.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 px-1 text-[16px] font-bold tracking-tight">
            <SparklesIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            {t("recommendedByDocbel")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((t) => (
              <TrainingCard key={t.id} training={t} />
            ))}
          </div>
        </section>
      )}

      {/* FILTRES + CATALOGUE */}
      <section id="catalogue" className="glass-surface flex flex-col gap-5 p-4 sm:p-6 lg:p-7">
        <div className="flex flex-col gap-4">
          {/* Catégories */}
          <div className="flex flex-wrap gap-2">
            <FilterChip active={category === null} onClick={() => setCategory(null)}>
              {t("filterAll")}
            </FilterChip>
            {categories.map((c) => {
              const Icon = resolveIcon(c.icon);
              const active = category === c.slug;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setCategory(active ? null : c.slug)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition"
                  style={{
                    borderColor: active ? c.color : "var(--glass-border)",
                    background: active
                      ? `color-mix(in oklab, ${c.color} 14%, transparent)`
                      : "var(--glass-surface)",
                    color: active ? c.color : "var(--glass-ink-soft)",
                  }}
                >
                  <Icon className="size-3.5" />
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* Filtres secondaires */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <FilterGroup
              label={t("filterPrice")}
              filters={PRICE_FILTERS.map((f) => ({ id: f.id, label: t(f.labelKey) }))}
              value={price}
              onChange={setPrice}
            />
            <FilterGroup
              label={t("filterFormat")}
              filters={FORMAT_FILTERS.map((f) => ({ id: f.id, label: t(f.labelKey) }))}
              value={format}
              onChange={setFormat}
            />
            <FilterGroup
              label={t("filterLevel")}
              filters={LEVEL_FILTERS.map((f) => ({ id: f.id, label: t(f.labelKey) }))}
              value={level}
              onChange={setLevel}
            />
            {hasFilter && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-1.5 text-[12px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
              >
                <XIcon className="size-3.5" />
                {t("filterReset")}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[color:var(--glass-ink-line)] pt-4">
          <h2 className="text-[16px] font-bold tracking-tight">
            {t("resultCount", { count: filtered.length })}
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <CompassIcon className="size-8 text-[color:var(--glass-ink-faint)]" />
            <p className="text-[14px] font-semibold">
              {t("emptyTitle")}
            </p>
            <p className="max-w-md text-[12.5px] text-[color:var(--glass-ink-soft)]">
              {t("emptyHint")}
            </p>
            <button
              type="button"
              onClick={() => router.push("/formations/boussole")}
              className="glass-cta mt-1 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold"
            >
              <CompassIcon className="size-4" />
              {t("ctaLaunchBoussole")}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((t) => (
              <TrainingCard key={t.id} training={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition"
      style={{
        borderColor: active ? "var(--glass-accent-deep)" : "var(--glass-border)",
        background: active
          ? "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)"
          : "var(--glass-surface)",
        color: active ? "var(--glass-accent-deep)" : "var(--glass-ink-soft)",
      }}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  label,
  filters,
  value,
  onChange,
}: {
  label: string;
  filters: ReadonlyArray<{ id: string; label: string }>;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
        {label}
      </span>
      <div className="flex gap-1.5">
        {filters.map((f) => {
          const active = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(active ? null : f.id)}
              className="rounded-full px-3 py-1 text-[12px] font-semibold transition"
              style={{
                background: active ? "var(--glass-ink)" : "var(--glass-surface)",
                color: active ? "var(--glass-bg-a)" : "var(--glass-ink-soft)",
                border: active ? "0" : "1px solid var(--glass-border)",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
