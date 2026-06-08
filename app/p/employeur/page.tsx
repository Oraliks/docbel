import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  BarChart3Icon,
  CalculatorIcon,
  CalendarIcon,
  CheckIcon,
  EuroIcon,
  FileTextIcon,
  FolderOpenIcon,
  LayersIcon,
  type LucideIcon,
  PhoneIcon,
  ScaleIcon,
  SearchIcon,
  ShieldCheckIcon,
  TimerIcon,
  UserCheckIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { AlreadyLoggedInBanner } from "@/components/docbel/landing/already-logged-in-banner";

export const metadata: Metadata = {
  title: "Espace Employeur | Docbel",
  description:
    "L'espace employeur qui vous fait gagner du temps et de l'argent : outils RH, simulations et informations fiables pour simplifier votre gestion au quotidien.",
};

// Mêmes gradients d'icônes que la landing partenaire (palette glass cohérente).
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
    Icon: FileTextIcon,
    hue: "violet",
    title: "Moins d'administratif",
    desc: "Centralisez vos tâches et automatisez les calculs pour gagner un temps précieux.",
  },
  {
    Icon: EuroIcon,
    hue: "orange",
    title: "Réduisez les coûts",
    desc: "Évitez les erreurs, optimisez vos charges et identifiez les aides disponibles.",
  },
  {
    Icon: ZapIcon,
    hue: "rose",
    title: "Décisions plus rapides",
    desc: "Simulez, comparez et décidez en toute confiance avec des données fiables.",
  },
  {
    Icon: UsersIcon,
    hue: "blue",
    title: "Outils RH au quotidien",
    desc: "Tout ce dont vous avez besoin, dans un seul espace simple et intuitif.",
  },
];

const TOOLS: BenefitItem[] = [
  {
    Icon: PhoneIcon,
    hue: "rose",
    title: "Brut ↔ Net",
    desc: "Convertissez les salaires bruts en nets.",
  },
  {
    Icon: ScaleIcon,
    hue: "orange",
    title: "Calcul du préavis",
    desc: "Estimez les délais légaux et indemnités.",
  },
  {
    Icon: CalculatorIcon,
    hue: "blue",
    title: "Coût salarial",
    desc: "Calculez le coût complet d'un collaborateur.",
  },
  {
    Icon: CalendarIcon,
    hue: "green",
    title: "Absences & congés",
    desc: "Gérez les droits, soldes et report facilement.",
  },
  {
    Icon: FolderOpenIcon,
    hue: "green",
    title: "Documents RH",
    desc: "Accédez à des modèles et guides prêts à l'emploi.",
  },
  {
    Icon: ShieldCheckIcon,
    hue: "rose",
    title: "Aides & obligations",
    desc: "Identifiez vos obligations et les aides disponibles.",
  },
];

const SECONDARY_BENEFITS: BenefitItem[] = [
  {
    Icon: LayersIcon,
    hue: "violet",
    title: "Tout est centralisé",
    desc: "Outils, documents et actualités, au même endroit.",
  },
  {
    Icon: SearchIcon,
    hue: "orange",
    title: "Tout est clair",
    desc: "Des explications simples, rédigées pour les employeurs.",
  },
  {
    Icon: TimerIcon,
    hue: "mauve",
    title: "Un vrai gain de temps",
    desc: "Moins de recherches, plus d'actions et moins d'erreurs.",
  },
  {
    Icon: BarChart3Icon,
    hue: "rose",
    title: "Une meilleure visibilité",
    desc: "Pilotez vos RH et vos coûts avec des indicateurs clairs.",
  },
];

const REASSURANCE_BADGES: { Icon: LucideIcon; label: string }[] = [
  { Icon: ShieldCheckIcon, label: "Informations fiables & à jour" },
  { Icon: UserCheckIcon, label: "Outils validés par des experts" },
  { Icon: ScaleIcon, label: "Conforme au droit belge" },
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

export default function EmployeurLandingPage() {
  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <AlreadyLoggedInBanner
        targetPath="/employeur"
        label="votre espace employeur"
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
            Plateforme RH &amp; administrative
          </span>

          <h1 className="glass-display text-[40px] leading-[1.05] font-semibold tracking-tight sm:text-[52px] lg:text-[58px]">
            L&apos;espace employeur qui vous fait{" "}
            <em>gagner du temps</em> et de <em>l&apos;argent.</em>
          </h1>

          <p className="max-w-[560px] text-[15.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            Docbel centralise outils pratiques, simulations et informations
            fiables pour simplifier votre gestion RH et administrative au
            quotidien.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/employeur"
              className="glass-cta inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
            >
              Découvrir l&apos;espace employeur
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

        {/* Illustration placeholder — à raffiner par la session design. */}
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
              <CalculatorIcon className="size-16 text-white sm:size-20" strokeWidth={1.6} />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
                Espace employeur
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

      {/* Section C — Outils concrets */}
      <section className="flex flex-col gap-7">
        <h2 className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]">
          Des <em>outils concrets</em> pour chaque situation
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
              Rejoignez les entreprises qui simplifient leur gestion RH avec
              Docbel.
            </h3>
            <ul className="flex flex-wrap gap-4 text-[13px] font-semibold">
              {[
                "Mise en place rapide",
                "Sans engagement",
                "Support réactif",
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
              href="/employeur"
              className="glass-cta inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
            >
              Découvrir l&apos;espace employeur
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
