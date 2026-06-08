import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  BarChart3Icon,
  BookOpenIcon,
  BookmarkIcon,
  Building2Icon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  FolderOpenIcon,
  HandshakeIcon,
  HeartIcon,
  LayersIcon,
  LightbulbIcon,
  type LucideIcon,
  ScaleIcon,
  SearchIcon,
  ShieldCheckIcon,
  Users2Icon,
  UsersIcon,
} from "lucide-react";
import { AlreadyLoggedInBanner } from "@/components/docbel/landing/already-logged-in-banner";

export const metadata: Metadata = {
  title: "Espace Partenaire | Docbel",
  description:
    "L'espace partenaire qui facilite votre travail et l'accès à l'information juridique : outils, ressources et contacts centralisés pour mieux accompagner vos publics.",
};

// Gradients réutilisés pour les icônes carrées des cards — inspirés du
// VARIANT_BG de `LandingToolCard` (cf. components/docbel/landing/tool-card.tsx).
// On garde une palette glass cohérente : violet (a) → rose (b) → orange (c) →
// vert/bleu (d/e) pour le rythme visuel des 6 outils.
type IconHue = "violet" | "orange" | "rose" | "blue" | "green" | "mauve";
const ICON_BG: Record<IconHue, string> = {
  violet: "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
  orange: "linear-gradient(135deg, var(--glass-accent-d), #FF8050)",
  rose: "linear-gradient(135deg, var(--glass-accent-c), #E060A0)",
  blue: "linear-gradient(135deg, #80B0FF, #5060FF)",
  green: "linear-gradient(135deg, #80E0C0, #40C0A0)",
  mauve: "linear-gradient(135deg, #D08CFF, var(--glass-accent-a))",
};
const ICON_SHADOW: Record<IconHue, string> = {
  violet: "0 6px 20px rgba(159,124,255,0.35)",
  orange: "0 6px 20px rgba(255,176,112,0.35)",
  rose: "0 6px 20px rgba(255,140,192,0.35)",
  blue: "0 6px 20px rgba(128,176,255,0.35)",
  green: "0 6px 20px rgba(128,224,192,0.35)",
  mauve: "0 6px 20px rgba(208,140,255,0.30)",
};

interface BenefitItem {
  Icon: LucideIcon;
  hue: IconHue;
  title: string;
  desc: string;
}

const PRIMARY_BENEFITS: BenefitItem[] = [
  {
    Icon: SearchIcon,
    hue: "violet",
    title: "Moins de recherches",
    desc: "Trouvez rapidement les bons outils et informations sans perdre de temps.",
  },
  {
    Icon: FolderOpenIcon,
    hue: "orange",
    title: "Information centralisée",
    desc: "Accédez à toutes les ressources officielles en un seul endroit, fiables et à jour.",
  },
  {
    Icon: UsersIcon,
    hue: "rose",
    title: "Orientation plus simple",
    desc: "Orientez vos publics vers les bonnes démarches et les bons interlocuteurs.",
  },
  {
    Icon: HeartIcon,
    hue: "blue",
    title: "Meilleur accompagnement",
    desc: "Apportez des réponses claires, précises et adaptées à chaque situation.",
  },
];

const TOOLS: BenefitItem[] = [
  {
    Icon: Building2Icon,
    hue: "violet",
    title: "Trouver un bureau",
    desc: "CPAS, Commune, ONEM, syndicats : trouvez le bureau compétent près de chez vous.",
  },
  {
    Icon: ScaleIcon,
    hue: "orange",
    title: "Institutions U1 (EEE)",
    desc: "Trouvez l'institution compétente dans chaque pays de l'EEE et en Suisse.",
  },
  {
    Icon: Users2Icon,
    hue: "rose",
    title: "CPAS & organismes",
    desc: "Annuaire complet des CPAS et organismes utiles pour vos publics.",
  },
  {
    Icon: BookOpenIcon,
    hue: "violet",
    title: "Guides pratiques",
    desc: "Guides pas à pas pour comprendre les démarches et les droits.",
  },
  {
    Icon: BookmarkIcon,
    hue: "green",
    title: "Référentiels",
    desc: "Textes légaux, modèles et référentiels classés par thématique.",
  },
  {
    Icon: FileTextIcon,
    hue: "orange",
    title: "Documents utiles",
    desc: "Formulaires, attestations et documents officiels téléchargeables.",
  },
];

const SECONDARY_BENEFITS: BenefitItem[] = [
  {
    Icon: LayersIcon,
    hue: "violet",
    title: "Tout est centralisé",
    desc: "Outils, guides et contacts au même endroit, accessibles à tout moment.",
  },
  {
    Icon: ClockIcon,
    hue: "orange",
    title: "Toujours à jour",
    desc: "Informations officielles actualisées en continu par nos experts.",
  },
  {
    Icon: LightbulbIcon,
    hue: "mauve",
    title: "Plus simple à expliquer",
    desc: "Des contenus clairs pour répondre facilement aux questions.",
  },
  {
    Icon: BarChart3Icon,
    hue: "rose",
    title: "Un meilleur suivi",
    desc: "Retrouvez l'historique et les ressources consultées en un clin d'œil.",
  },
];

const REASSURANCE_BADGES: { Icon: LucideIcon; label: string }[] = [
  { Icon: ShieldCheckIcon, label: "Informations fiables & à jour" },
  { Icon: BookOpenIcon, label: "Ressources centralisées" },
  { Icon: HandshakeIcon, label: "Pensé pour les partenaires" },
];

function IconTile({
  Icon,
  hue,
  size = "lg",
}: {
  Icon: LucideIcon;
  hue: IconHue;
  size?: "lg" | "md";
}) {
  const isLg = size === "lg";
  return (
    <span
      className={`flex items-center justify-center rounded-2xl text-white ${
        isLg ? "size-12" : "size-10"
      }`}
      style={{
        backgroundImage: ICON_BG[hue],
        boxShadow: ICON_SHADOW[hue],
      }}
    >
      <Icon className={isLg ? "size-5" : "size-[18px]"} strokeWidth={2.2} />
    </span>
  );
}

function RoundIconTile({ Icon, hue }: { Icon: LucideIcon; hue: IconHue }) {
  return (
    <span
      className="flex size-10 items-center justify-center rounded-full text-white"
      style={{
        backgroundImage: ICON_BG[hue],
        boxShadow: ICON_SHADOW[hue],
      }}
    >
      <Icon className="size-[18px]" strokeWidth={2.2} />
    </span>
  );
}

export default function PartenaireLandingPage() {
  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <AlreadyLoggedInBanner
        targetPath="/partenaire"
        label="votre espace partenaire"
      />

      {/* Section A — Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-7">
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderColor: "color-mix(in oklab, var(--glass-accent-deep) 30%, transparent)",
              background: "color-mix(in oklab, var(--glass-accent-a) 12%, var(--glass-surface))",
              color: "var(--glass-accent-deep)",
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: "var(--glass-accent-deep)" }}
            />
            Plateforme d&apos;accompagnement &amp; d&apos;information
          </span>

          <h1 className="glass-display text-[40px] leading-[1.05] font-semibold tracking-tight sm:text-[52px] lg:text-[58px]">
            L&apos;espace partenaire qui facilite{" "}
            <em>votre travail</em> et l&apos;accès à{" "}
            <em>l&apos;information</em>.
          </h1>

          <p className="max-w-[560px] text-[15.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            Centralisez vos outils, ressources et informations juridiques
            vérifiées pour mieux orienter, informer et accompagner vos publics
            au quotidien.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/partenaire"
              className="glass-cta inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
            >
              Découvrir l&apos;espace partenaire
              <ArrowRightIcon className="size-4" strokeWidth={2.4} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-6 py-3.5 text-[13.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 hover:text-[color:var(--glass-ink)] dark:hover:bg-white/10"
            >
              Demander une démo
            </Link>
          </div>

          <ul className="flex flex-wrap gap-2 pt-2">
            {REASSURANCE_BADGES.map(({ Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 py-2 text-[12px] font-semibold text-[color:var(--glass-ink-soft)]"
              >
                <Icon
                  className="size-3.5"
                  style={{ color: "var(--glass-accent-deep)" }}
                  strokeWidth={2.4}
                />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Illustration placeholder — à raffiner par la session design.
            On garde un gradient mauve/rose riche + carte verre dépoli centrale
            pour suggérer la « centralisation des documents partenaires ». */}
        <div
          className="relative aspect-square w-full overflow-hidden rounded-[28px]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 30% 20%, var(--glass-accent-d) 0%, transparent 55%), linear-gradient(135deg, var(--glass-accent-c) 0%, var(--glass-accent-a) 55%, var(--glass-accent-deep) 100%)",
          }}
        >
          <div
            className="absolute top-1/2 left-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
            aria-hidden
          />
          <div className="relative flex h-full items-center justify-center">
            <div className="flex size-[200px] flex-col items-center justify-center gap-3 rounded-3xl border border-white/30 bg-white/15 p-6 shadow-[0_30px_80px_rgba(20,10,45,0.45),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-xl sm:size-[240px]">
              <FolderOpenIcon className="size-16 text-white sm:size-20" strokeWidth={1.6} />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
                Espace partenaire
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section B — 4 bénéfices */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRIMARY_BENEFITS.map(({ Icon, hue, title, desc }) => (
          <article
            key={title}
            className="glass-surface flex flex-col gap-3 p-5"
          >
            <IconTile Icon={Icon} hue={hue} />
            <h3 className="text-[15.5px] font-bold tracking-tight">{title}</h3>
            <p className="text-[12.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
              {desc}
            </p>
          </article>
        ))}
      </section>

      {/* Section C — Outils utiles */}
      <section className="flex flex-col gap-7">
        <h2 className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]">
          Des <em>outils utiles</em> pour mieux accompagner
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(({ Icon, hue, title, desc }) => (
            <article
              key={title}
              className="glass-surface glass-interactive flex min-h-[180px] flex-col gap-3.5 p-5 text-left"
            >
              <IconTile Icon={Icon} hue={hue} />
              <h3 className="text-[15.5px] font-bold tracking-tight">{title}</h3>
              <p className="flex-1 text-[12.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                {desc}
              </p>
              <div className="flex items-center justify-end border-t border-[color:var(--glass-ink-line)] pt-3">
                <span
                  className="flex size-7 items-center justify-center rounded-full"
                  style={{
                    background: "var(--glass-ink)",
                    color: "var(--glass-bg-a)",
                  }}
                  aria-hidden
                >
                  <ArrowRightIcon className="size-3.5" strokeWidth={2.4} />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Section D — 4 bénéfices secondaires */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECONDARY_BENEFITS.map(({ Icon, hue, title, desc }) => (
          <article
            key={title}
            className="glass-surface flex flex-col gap-3 p-5"
          >
            <RoundIconTile Icon={Icon} hue={hue} />
            <h3 className="text-[14.5px] font-bold tracking-tight">{title}</h3>
            <p className="text-[12px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
              {desc}
            </p>
          </article>
        ))}
      </section>

      {/* Section E — CTA banner final */}
      <section
        className="relative overflow-hidden rounded-3xl p-8 sm:p-12"
        style={{
          backgroundImage:
            "linear-gradient(135deg, color-mix(in oklab, var(--glass-accent-a) 80%, transparent) 0%, color-mix(in oklab, var(--glass-accent-c) 60%, transparent) 55%, color-mix(in oklab, var(--glass-accent-d) 40%, transparent) 100%)",
        }}
      >
        <span
          className="absolute -top-32 -right-20 size-80 rounded-full"
          style={{
            background: "rgba(255,255,255,0.35)",
            filter: "blur(60px)",
          }}
          aria-hidden
        />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-6 text-white">
            <h3 className="glass-display max-w-2xl text-[26px] leading-[1.15] font-semibold sm:text-[32px]">
              Rejoignez les partenaires qui informent et accompagnent mieux
              avec Docbel.
            </h3>
            <ul className="flex flex-wrap gap-4 text-[13px] font-semibold">
              {[
                "Mise en place rapide",
                "Support réactif",
                "Accès simple aux ressources",
              ].map((label) => (
                <li key={label} className="inline-flex items-center gap-2">
                  <span
                    className="flex size-5 items-center justify-center rounded-full bg-white text-emerald-600"
                    aria-hidden
                  >
                    <CheckIcon className="size-3" strokeWidth={3} />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <Link
              href="/partenaire"
              className="glass-cta inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
            >
              Découvrir l&apos;espace partenaire
              <ArrowRightIcon className="size-4" strokeWidth={2.4} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/70 bg-white/10 px-6 py-3.5 text-[13.5px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Demander une démo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
