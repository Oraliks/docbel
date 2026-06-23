"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { ChangelogExpandable } from "./changelog-expandable";

/**
 * Entrée changelog sérialisée pour transport server → client.
 * `publishedAt` est en ISO 8601 (string) côté wire ; on le re-instancie
 * en `Date` au moment du formatage.
 */
export type ChangelogFeedEntry = {
  id: string;
  version: string;
  publishedAt: string;
  type: string;
  title: string;
  description: string;
  changes: unknown;
};

type Props = {
  /** Première page rendue côté serveur (pour SEO + first paint). */
  initialEntries: ChangelogFeedEntry[];
  /** Indique si l'API a plus d'entrées à charger après `initialEntries`. */
  initialHasMore: boolean;
  /** Taille de page pour les chargements suivants. */
  pageSize?: number;
};

/**
 * Couleurs/pastilles par type (non traduisibles). Le libellé affiché est
 * résolu via i18n (`public.changelog.type.*`) au moment du rendu.
 */
const TYPE_CONFIG: Record<
  string,
  { labelKey: string; dot: string; textColor: string }
> = {
  feature: { labelKey: "feature", dot: "#10B981", textColor: "#10B981" },
  fix: { labelKey: "fix", dot: "#EF4444", textColor: "#EF4444" },
  improvement: { labelKey: "improvement", dot: "#3B82F6", textColor: "#3B82F6" },
  breaking: { labelKey: "breaking", dot: "#F59E0B", textColor: "#F59E0B" },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-BE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const normalizeChanges = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string");
  }
  return [];
};

export function ChangelogFeed({
  initialEntries,
  initialHasMore,
  pageSize = 10,
}: Props) {
  const t = useTranslations("public.changelog");
  const [entries, setEntries] = useState<ChangelogFeedEntry[]>(initialEntries);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  // Verrou anti-doublons (si l'observer se déclenche pendant que la requête tourne)
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setErr(null);
    try {
      const oldest = entries[entries.length - 1];
      if (!oldest) return;
      const url = `/api/changelog?limit=${pageSize}&before=${encodeURIComponent(
        oldest.publishedAt
      )}`;
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(t("errNetwork"));
      const j = (await r.json()) as {
        entries: ChangelogFeedEntry[];
        hasMore: boolean;
      };
      setEntries((prev) => [...prev, ...j.entries]);
      setHasMore(j.hasMore);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("errGeneric"));
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [entries, hasMore, pageSize, t]);

  // IntersectionObserver : charge la page suivante quand le sentinel devient visible
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "300px 0px" } // déclenche 300px avant d'arriver au bas
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore]);

  return (
    <>
      <ol className="relative ml-1 sm:ml-2 pl-6 sm:pl-8">
        {/* Ligne verticale */}
        <span
          aria-hidden
          className="absolute left-[5px] sm:left-[7px] top-2 bottom-2 w-px bg-[color:var(--glass-ink-line,var(--border))]"
        />

        {entries.map((entry) => {
          const cfg = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.improvement;
          const changes = normalizeChanges(entry.changes);
          return (
            <li
              key={entry.id}
              id={`v${entry.version}`}
              className="relative scroll-mt-28 pb-8 last:pb-0"
            >
              <span
                aria-hidden
                className="absolute -left-[20px] sm:-left-[26px] top-1.5 size-3 rounded-full ring-4 ring-[color:var(--background)]"
                style={{
                  background: cfg.dot,
                  boxShadow: `0 0 0 2px ${cfg.dot}22`,
                }}
              />

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-2.5">
                <time
                  dateTime={entry.publishedAt}
                  className="font-semibold text-[color:var(--foreground)]"
                >
                  {formatDate(entry.publishedAt)}
                </time>
                <span aria-hidden className="text-[color:var(--glass-ink-soft)]">
                  ·
                </span>
                <span className="font-semibold" style={{ color: cfg.textColor }}>
                  {t(`type.${cfg.labelKey}` as Parameters<typeof t>[0])}
                </span>
                <Badge
                  variant="outline"
                  className="ml-auto bg-primary/10 text-primary text-[10px] py-0 px-1.5 h-5"
                >
                  v{entry.version}
                </Badge>
              </div>

              <div
                className="overflow-hidden rounded-2xl border bg-[color:var(--glass-surface,var(--card))] p-5 transition-shadow target:ring-2"
                style={{
                  borderColor: "var(--glass-border, var(--border))",
                  borderLeft: `3px solid ${cfg.dot}`,
                }}
              >
                <h2 className="font-bold text-lg leading-snug">
                  {entry.title}
                </h2>

                {(entry.description || changes.length > 0) && (
                  <div className="mt-2 text-[color:var(--glass-ink,var(--foreground))]">
                    <ChangelogExpandable
                      accent={cfg.textColor}
                      collapsedHeight={110}
                    >
                      {entry.description ? (
                        <div
                          className="article-content text-sm"
                          dangerouslySetInnerHTML={{
                            __html: entry.description,
                          }}
                        />
                      ) : null}

                      {changes.length > 0 && (
                        <ul
                          className={`flex flex-col gap-1.5 text-sm ${
                            entry.description ? "mt-3" : ""
                          }`}
                        >
                          {changes.map((change, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span
                                aria-hidden
                                className="mt-1.5 size-1.5 shrink-0 rounded-full"
                                style={{ background: cfg.dot }}
                              />
                              <span>{change}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </ChangelogExpandable>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Sentinel + état de chargement */}
      <div
        ref={sentinelRef}
        className="flex items-center justify-center py-6 text-xs text-[color:var(--glass-ink-soft)]"
      >
        {loading && (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            {t("loading")}
          </span>
        )}
        {!loading && !hasMore && entries.length > 0 && (
          <span className="opacity-60">{t("endOfHistory")}</span>
        )}
        {!loading && err && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="text-destructive underline-offset-2 hover:underline"
          >
            {t("retryWithError", { error: err })}
          </button>
        )}
      </div>
    </>
  );
}
