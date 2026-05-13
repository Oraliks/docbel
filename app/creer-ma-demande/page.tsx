import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { LifeEventCard } from "@/components/docbel/onboarding/life-event-card";
import { IntentSearch } from "@/components/docbel/onboarding/intent-search";
import { LIFE_EVENT_CATEGORIES } from "@/lib/bundles/types";

export const metadata: Metadata = {
  title: "Quelle est ma situation ? — beldoc",
  description:
    "Démarrez votre dossier administratif belge en partant d'une situation simple : « j'ai perdu mon emploi », « je deviens indépendant », etc.",
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // Bundles flagués pour l'onboarding (showOnOnboarding = true)
  const featured = await prisma.documentBundle.findMany({
    where: { active: true, showOnOnboarding: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      items: { select: { id: true } },
    },
  });

  // Regroupement par catégorie d'événement de vie
  type FeaturedBundle = (typeof featured)[number];
  const groups = new Map<string, FeaturedBundle[]>();
  const uncategorized: FeaturedBundle[] = [];
  for (const b of featured) {
    if (b.lifeEventCategory) {
      const list = groups.get(b.lifeEventCategory) ?? [];
      list.push(b);
      groups.set(b.lifeEventCategory, list);
    } else {
      uncategorized.push(b);
    }
  }

  return (
    <section className="flex flex-col gap-10">
      {/* Hero */}
      <header className="flex flex-col gap-3 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Démarrer un dossier
        </p>
        <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[52px]">
          Quelle est <em>votre situation ?</em>
        </h1>
        <p className="max-w-2xl text-[14px] text-[color:var(--glass-ink-soft)]">
          Décrivez votre situation en langage courant ou choisissez un événement de
          vie ci-dessous. Beldoc vous propose un parcours adapté avec les bons
          documents à préparer.
        </p>
      </header>

      {/* Recherche / intent detection */}
      <div className="px-2">
        <IntentSearch />
      </div>

      {/* Événements de vie */}
      {featured.length === 0 ? (
        <div className="glass-surface mx-2 flex flex-col items-center gap-2 rounded-3xl px-6 py-16 text-center">
          <p className="text-[14px] font-semibold">
            Aucun parcours d&apos;événement de vie n&apos;est encore publié.
          </p>
          <p className="max-w-md text-[12.5px] text-[color:var(--glass-ink-soft)]">
            Les administrateurs n&apos;ont pas encore activé la mise en avant des
            bundles sur cette page. Vous pouvez utiliser la recherche ci-dessus
            ou consulter le catalogue.
          </p>
          <Link
            href="/outils"
            className="mt-3 text-[13px] font-medium text-[color:var(--glass-ink)] underline"
          >
            Voir le catalogue complet
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {LIFE_EVENT_CATEGORIES.map((cat) => {
            const list = groups.get(cat.id);
            if (!list || list.length === 0) return null;
            return (
              <div key={cat.id} className="space-y-3 px-2">
                <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[color:var(--glass-ink)]">
                  <span aria-hidden="true">{cat.emoji}</span>
                  {cat.label}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((b) => (
                    <LifeEventCard
                      key={b.id}
                      slug={b.slug}
                      name={b.name}
                      description={b.description}
                      color={b.color}
                      icon={b.icon}
                      itemCount={b.items.length}
                      emoji={cat.emoji}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Bundles sans catégorie (fallback) */}
          {uncategorized.length > 0 && (
            <div className="space-y-3 px-2">
              <h2 className="text-[16px] font-semibold text-[color:var(--glass-ink)]">
                Autres parcours
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {uncategorized.map((b) => (
                  <LifeEventCard
                    key={b.id}
                    slug={b.slug}
                    name={b.name}
                    description={b.description}
                    color={b.color}
                    icon={b.icon}
                    itemCount={b.items.length}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reprise de dossier */}
      <div className="glass-surface mx-2 flex flex-col gap-3 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-[color:var(--glass-surface-2,#f3f0fa)] p-2.5">
            <KeyRound className="size-5 text-[color:var(--glass-ink)]" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
              Vous avez déjà commencé un dossier ?
            </h3>
            <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
              Reprenez-le avec votre code (format <code>BELDOC-XXXX-XXXX</code>).
            </p>
          </div>
        </div>
        <Link
          href="/reprendre"
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2.5 text-[13px] font-semibold text-[color:var(--glass-ink)] transition-colors hover:bg-white/55"
        >
          Reprendre un dossier
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {/* RGPD notice */}
      <p className="px-2 text-[11px] italic text-[color:var(--glass-ink-faint)]">
        Aucune donnée nominative n&apos;est conservée au-delà du traitement de
        votre dossier. Si vous fermez votre navigateur, conservez bien le code de
        reprise qui s&apos;affichera dès le premier enregistrement —{" "}
        <strong>sans ce code, les données saisies seront perdues.</strong>
      </p>
    </section>
  );
}
