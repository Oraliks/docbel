import Link from "next/link";
import { Search, ArrowRight, Compass, Briefcase, UserMinus, MapPinned, Clock, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { GLASS_CARD } from "@/lib/glass-classes";
import { DossierWizard } from "@/components/docbel/onboarding/dossier-wizard";
import { WIZARD_SITUATIONS } from "@/lib/dossier-wizard/config";

export const dynamic = "force-dynamic";

interface DossierCard {
  slug: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  category: string;
}

const ICON_MAP: Record<string, typeof Briefcase> = {
  Briefcase,
  UserMinus,
  MapPinned,
  Clock,
  Sparkles,
};

/// Heuristique d'icône : on cherche d'abord un mapping explicite par slug
/// (les dossiers seed connus), sinon fallback générique. À enrichir au fur
/// et à mesure que de nouveaux dossiers arrivent.
const SLUG_ICON: Record<string, string> = {
  "chomage-temporaire": "Briefcase",
  "chomage-complet": "UserMinus",
  "chomage-frontalier": "MapPinned",
  prepension: "Clock",
};

/// Couleur de fallback si le bundle DB n'a pas de couleur définie.
const FALLBACK_COLOR = "#7C3AED";

/// Page d'orientation principale du citoyen. À gauche : wizard 4 étapes
/// (situation → besoin → affinements → résultat). À droite : grille d'accès
/// direct aux dossiers déjà disponibles. Les deux mènent au même endroit
/// (/d/<slug>) — le wizard guide les indécis, la grille sert les autres.
export default async function MonDossierPage() {
  const bundles = await prisma.documentBundle.findMany({
    where: { active: true },
    orderBy: [{ showOnOnboarding: "desc" }, { order: "asc" }, { name: "asc" }],
    select: {
      slug: true,
      name: true,
      description: true,
      color: true,
      lifeEventCategory: true,
    },
  });

  const cards: DossierCard[] = bundles.map((b) => ({
    slug: b.slug,
    name: b.name,
    description: b.description,
    color: b.color || FALLBACK_COLOR,
    icon: SLUG_ICON[b.slug] ?? "Sparkles",
    category: b.lifeEventCategory ?? "autre",
  }));

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <nav
        className="mb-4 flex items-center gap-1 text-xs text-[color:var(--glass-ink-soft)]"
        aria-label="Fil d'Ariane"
      >
        <Link href="/" className="hover:underline">Accueil</Link>
        <span aria-hidden>›</span>
        <span className="text-[color:var(--glass-ink)]">Mon dossier</span>
      </nav>

      <header className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold lg:text-3xl">
          Créer ou retrouver le bon dossier
        </h1>
        <p className="max-w-3xl text-sm text-[color:var(--glass-ink-soft)]">
          Tu ne sais pas par où commencer ? Suis le guide à gauche. Tu sais
          déjà ce que tu cherches ? Accède directement à la liste des dossiers
          à droite.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,_5fr)_minmax(0,_7fr)]">
        {/* Colonne gauche : wizard d'orientation */}
        <section
          className={`${GLASS_CARD} flex flex-col gap-4 p-5 lg:p-6`}
          aria-labelledby="wizard-title"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]">
              <Compass className="size-5" />
            </span>
            <div>
              <h2 id="wizard-title" className="text-base font-semibold">
                Trouver le bon dossier
              </h2>
              <p className="text-xs text-[color:var(--glass-ink-soft)]">
                Réponds à quelques questions simples. On t&apos;oriente vers le
                dossier qui colle à ta situation.
              </p>
            </div>
          </div>
          <DossierWizard situations={WIZARD_SITUATIONS} />
        </section>

        {/* Colonne droite : accès direct au catalogue */}
        <section
          className={`${GLASS_CARD} flex flex-col gap-4 p-5 lg:p-6`}
          aria-labelledby="direct-title"
        >
          <header className="flex flex-col gap-2">
            <h2 id="direct-title" className="text-base font-semibold">
              Accès direct
            </h2>
            <DirectAccessSearch />
          </header>

          {cards.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              Aucun dossier disponible pour le moment.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {cards.map((card) => (
                <li key={card.slug}>
                  <DossierGridCard card={card} />
                </li>
              ))}
            </ul>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--glass-border)] pt-3 text-xs text-[color:var(--glass-ink-soft)]">
            <span>D&apos;autres catégories arrivent (logement, santé, famille…).</span>
            <Link href="/aidez-moi" className="underline hover:no-underline">
              Tu ne trouves pas ton dossier ?
            </Link>
          </footer>
        </section>
      </div>
    </div>
  );
}

/// Barre de recherche statique pour cette première passe — pas de filtrage
/// réel encore. Affichée pour cohérence avec le mockup et pour ne pas casser
/// l'a11y (input présent, sera connecté quand on aura > 6 dossiers).
function DirectAccessSearch() {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[color:var(--glass-ink-faint)]" />
      <input
        type="search"
        placeholder="Rechercher un dossier (ex. chômage, frontalier…)"
        className="w-full rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] py-2 pl-9 pr-3 text-sm text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:border-[color:var(--glass-accent-deep)] focus:outline-none"
        aria-label="Rechercher un dossier"
      />
    </div>
  );
}

function DossierGridCard({ card }: { card: DossierCard }) {
  const Icon = ICON_MAP[card.icon] ?? Sparkles;
  return (
    <Link
      href={`/d/${card.slug}`}
      className="group flex h-full flex-col gap-2 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 transition hover:border-[color:var(--glass-accent-deep)] hover:bg-white/70 dark:hover:bg-white/5"
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex size-10 items-center justify-center rounded-xl"
          style={{ background: `${card.color}22`, color: card.color }}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <h3 className="text-sm font-semibold text-[color:var(--glass-ink)]">
        {card.name}
      </h3>
      {card.description && (
        <p className="line-clamp-3 text-xs text-[color:var(--glass-ink-soft)]">
          {card.description}
        </p>
      )}
      <span
        className="mt-auto inline-flex items-center gap-1 text-xs font-medium transition group-hover:gap-2"
        style={{ color: card.color }}
      >
        Ouvrir ce dossier
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
