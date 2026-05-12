import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { ChangelogAnchorScroll } from "@/components/docbel/changelog-anchor-scroll";
import { ChangelogExpandable } from "@/components/docbel/changelog-expandable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Historique des mises à jour — Docbel",
  description:
    "Suivez les nouveautés, corrections et améliorations apportées à Docbel.",
};

type TypeKey = "feature" | "fix" | "improvement" | "breaking";

const TYPE_CONFIG: Record<
  string,
  { label: string; dot: string; badgeClass: string; textColor: string }
> = {
  feature: {
    label: "Nouveauté",
    dot: "#10B981", // emerald-500
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    textColor: "#10B981",
  },
  fix: {
    label: "Correction",
    dot: "#EF4444", // red-500
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    textColor: "#EF4444",
  },
  improvement: {
    label: "Amélioration",
    dot: "#3B82F6", // blue-500
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    textColor: "#3B82F6",
  },
  breaking: {
    label: "Breaking",
    dot: "#F59E0B", // amber-500
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    textColor: "#F59E0B",
  },
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("fr-BE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default async function ChangelogPage() {
  const entries = await prisma.changelog.findMany({
    orderBy: { publishedAt: "desc" },
    take: 200,
  });

  return (
    <>
      <ChangelogAnchorScroll />
      <section className="flex flex-col gap-8 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-soft)]">
            Journal des modifications
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Historique des mises à jour
          </h1>
          <p className="text-[color:var(--glass-ink-soft)]">
            Toutes les nouveautés, corrections et améliorations livrées sur
            Docbel, classées de la plus récente à la plus ancienne.
          </p>
        </header>

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-10 text-center text-[color:var(--glass-ink-soft)]">
            Aucune mise à jour publiée pour l&apos;instant.
          </div>
        ) : (
          <ol className="relative ml-1 sm:ml-2 pl-6 sm:pl-8">
            {/* Ligne verticale de la timeline */}
            <span
              aria-hidden
              className="absolute left-[5px] sm:left-[7px] top-2 bottom-2 w-px bg-[color:var(--glass-ink-line,var(--border))]"
            />

            {entries.map((entry) => {
              const cfg =
                TYPE_CONFIG[entry.type as TypeKey] ?? TYPE_CONFIG.improvement;
              const changes = Array.isArray(entry.changes)
                ? (entry.changes as string[]).filter(
                    (v) => typeof v === "string",
                  )
                : [];
              return (
                <li
                  key={entry.id}
                  id={`v${entry.version}`}
                  className="relative scroll-mt-28 pb-8 last:pb-0"
                >
                  {/* Pastille colorée */}
                  <span
                    aria-hidden
                    className="absolute -left-[20px] sm:-left-[26px] top-1.5 size-3 rounded-full ring-4 ring-[color:var(--background)]"
                    style={{
                      background: cfg.dot,
                      boxShadow: `0 0 0 2px ${cfg.dot}22`,
                    }}
                  />

                  {/* Méta : date · type */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-2.5">
                    <time
                      dateTime={entry.publishedAt.toISOString()}
                      className="font-semibold text-[color:var(--foreground)]"
                    >
                      {formatDate(entry.publishedAt)}
                    </time>
                    <span
                      aria-hidden
                      className="text-[color:var(--glass-ink-soft)]"
                    >
                      ·
                    </span>
                    <span
                      className="font-semibold"
                      style={{ color: cfg.textColor }}
                    >
                      {cfg.label}
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-auto bg-primary/10 text-primary text-[10px] py-0 px-1.5 h-5"
                    >
                      v{entry.version}
                    </Badge>
                  </div>

                  {/* Card */}
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
        )}
      </section>
    </>
  );
}
