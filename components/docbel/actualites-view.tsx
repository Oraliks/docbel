"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import type { NewsItem } from "@/lib/docbel-data";
import { AcronymText } from "@/components/docbel/acronym";
import { SmartImage } from "@/components/ui/smart-image";

const MONTH_LABELS = [
  "JAN",
  "FÉV",
  "MARS",
  "AVR",
  "MAI",
  "JUIN",
  "JUIL",
  "AOÛT",
  "SEPT",
  "OCT",
  "NOV",
  "DÉC",
];

function splitDate(date: string) {
  const parsed = new Date(date);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      day: String(parsed.getDate()).padStart(2, "0"),
      month: MONTH_LABELS[parsed.getMonth()],
    };
  }
  const tokens = date.split(/\s+/);
  return {
    day: tokens[0] ?? "—",
    month: (tokens[1] ?? "").toUpperCase().slice(0, 4),
  };
}

export function ActualitesView({
  initialArticles,
}: {
  initialArticles: NewsItem[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string>("Tous");

  const tags = useMemo(() => {
    const set = new Set<string>();
    initialArticles.forEach((article) => {
      if (article.tag) set.add(article.tag);
    });
    return ["Tous", ...Array.from(set).sort()];
  }, [initialArticles]);

  const filtered = initialArticles.filter((article) => {
    const lower = search.toLowerCase();
    const matchesSearch =
      article.title.toLowerCase().includes(lower) ||
      article.desc.toLowerCase().includes(lower);
    const matchesTag = activeTag === "Tous" || article.tag === activeTag;
    return matchesSearch && matchesTag;
  });

  const featured = filtered.find((article) => article.popular) ?? filtered[0];
  const rest = filtered.filter((article) => article.id !== featured?.id);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Salle de presse
        </p>
        <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[48px]">
          Actualités <em>récentes.</em>
        </h1>
        <p className="max-w-2xl text-[14px] text-[color:var(--glass-ink-soft)]">
          Annonces ONEM, réformes du chômage, mises à jour CPAS et autres
          changements administratifs belges.
        </p>
      </header>

      <div className="flex flex-col gap-3 px-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un article…"
            className="glass-surface h-11 w-full rounded-2xl border-0 pr-4 pl-11 text-[13px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => {
            const active = tag === activeTag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? "border-transparent text-[color:var(--glass-bg-a)]"
                    : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:bg-white/55"
                }`}
                style={active ? { background: "var(--glass-ink)" } : undefined}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-surface flex flex-col items-center gap-2 px-6 py-16 text-center">
          <p className="text-[14px] font-semibold">Aucun article ne correspond.</p>
          <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
            Essayez une autre catégorie ou un mot-clé plus court.
          </p>
        </div>
      ) : (
        <>
          {featured ? (
            <button
              type="button"
              onClick={() =>
                router.push(`/actualites/${featured.slug ?? featured.id}`)
              }
              className="glass-surface group grid gap-6 overflow-hidden p-7 text-left lg:grid-cols-[1.4fr_1fr] lg:items-center"
            >
              <div className="flex flex-col gap-4">
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
                  À la une · {featured.tag}
                </span>
                <h2 className="glass-display text-[28px] font-semibold leading-[1.1] lg:text-[34px]">
                  <AcronymText>{featured.title}</AcronymText>
                </h2>
                <p className="text-[14px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
                  <AcronymText>{featured.desc}</AcronymText>
                </p>
                <span className="mt-2 inline-flex items-center gap-2 text-[13px] font-semibold text-[color:var(--glass-ink)]">
                  Lire l&apos;article
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div
                className="relative h-[240px] overflow-hidden rounded-[20px]"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse at 30% 30%, var(--glass-accent-d) 0%, transparent 60%), linear-gradient(135deg, var(--glass-accent-c) 0%, var(--glass-accent-a) 60%, var(--glass-accent-deep) 100%)",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle at 80% 80%, rgba(255,255,255,0.4) 0%, transparent 50%)",
                  }}
                />
                <SmartImage
                  src={featured.image}
                  alt=""
                  fallbackMode="hide"
                  className="absolute inset-0 size-full"
                  imgClassName="mix-blend-luminosity opacity-90"
                />
              </div>
            </button>
          ) : null}

          <div className="glass-surface p-7">
            <h3 className="glass-display mb-2 text-[22px] font-semibold leading-none">
              Tous les articles
            </h3>
            <p className="mb-5 text-[12.5px] text-[color:var(--glass-ink-soft)]">
              {rest.length} article{rest.length > 1 ? "s" : ""} dans le fil
            </p>
            <div className="flex flex-col">
              {rest.map((article, index) => {
                const { day, month } = splitDate(article.date);
                return (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() =>
                      router.push(`/actualites/${article.slug ?? article.id}`)
                    }
                    className={`grid grid-cols-[60px_1fr_auto] items-center gap-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                      index < rest.length - 1
                        ? "border-b border-[color:var(--glass-ink-line)]"
                        : ""
                    }`}
                  >
                    <div className="text-center">
                      <div className="glass-display text-[22px] font-semibold leading-none">
                        {day}
                      </div>
                      <div
                        className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.05em]"
                        style={{ color: "var(--glass-accent-deep)" }}
                      >
                        {month}
                      </div>
                    </div>
                    <div>
                      <div className="text-[14.5px] font-bold tracking-tight">
                        <AcronymText>{article.title}</AcronymText>
                      </div>
                      <div className="mt-1 line-clamp-1 text-[12px] text-[color:var(--glass-ink-faint)]">
                        <AcronymText>{article.desc}</AcronymText>
                      </div>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-soft)]"
                      style={{ background: "var(--glass-surface)" }}
                    >
                      {article.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
