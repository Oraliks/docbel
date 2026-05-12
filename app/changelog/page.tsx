import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ChangelogAnchorScroll } from "@/components/docbel/changelog-anchor-scroll";
import {
  ChangelogFeed,
  type ChangelogFeedEntry,
} from "@/components/docbel/changelog-feed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Historique des mises à jour — Docbel",
  description:
    "Suivez les nouveautés, corrections et améliorations apportées à Docbel.",
};

/** Taille de la première page rendue côté serveur (pour SEO + first paint). */
const FIRST_PAGE_SIZE = 10;

export default async function ChangelogPage() {
  // On charge `FIRST_PAGE_SIZE + 1` pour savoir s'il y en a d'autres
  // après — même technique que l'API.
  const rows = await prisma.changelog.findMany({
    orderBy: { publishedAt: "desc" },
    take: FIRST_PAGE_SIZE + 1,
  });
  const initialHasMore = rows.length > FIRST_PAGE_SIZE;
  const visibleRows = initialHasMore ? rows.slice(0, FIRST_PAGE_SIZE) : rows;
  const initialEntries: ChangelogFeedEntry[] = visibleRows.map((r) => ({
    id: r.id,
    version: r.version,
    publishedAt: r.publishedAt.toISOString(),
    type: r.type,
    title: r.title,
    description: r.description,
    changes: r.changes,
  }));

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

        {initialEntries.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-10 text-center text-[color:var(--glass-ink-soft)]">
            Aucune mise à jour publiée pour l&apos;instant.
          </div>
        ) : (
          <ChangelogFeed
            initialEntries={initialEntries}
            initialHasMore={initialHasMore}
            pageSize={FIRST_PAGE_SIZE}
          />
        )}
      </section>
    </>
  );
}
