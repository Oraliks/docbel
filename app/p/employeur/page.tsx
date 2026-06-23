import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { AlreadyLoggedInBanner } from "@/components/docbel/landing/already-logged-in-banner";
import { CpFinderTeaser } from "@/components/docbel/p/cp-finder-teaser";
import { CtParcours } from "@/components/docbel/p/ct-parcours";
import { EcheancierEmployeur } from "@/components/docbel/p/echeancier-employeur";
import { EmployeurHeroBilingue } from "@/components/docbel/p/employeur-hero-bilingue";
import { PricingEmployeur } from "@/components/docbel/p/pricing-employeur";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("lpEmployerMetaTitle"),
    description: t("lpEmployerMetaDesc"),
  };
}

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
  titleKey: string;
  descKey: string;
}

const PRIMARY_BENEFITS: BenefitItem[] = [
  {
    Icon: FileTextIcon,
    hue: "violet",
    titleKey: "lpEmployerBenefitAdminTitle",
    descKey: "lpEmployerBenefitAdminDesc",
  },
  {
    Icon: EuroIcon,
    hue: "orange",
    titleKey: "lpEmployerBenefitCostTitle",
    descKey: "lpEmployerBenefitCostDesc",
  },
  {
    Icon: ZapIcon,
    hue: "rose",
    titleKey: "lpEmployerBenefitDecisionTitle",
    descKey: "lpEmployerBenefitDecisionDesc",
  },
  {
    Icon: UsersIcon,
    hue: "blue",
    titleKey: "lpEmployerBenefitHrTitle",
    descKey: "lpEmployerBenefitHrDesc",
  },
];

const TOOLS: BenefitItem[] = [
  {
    Icon: PhoneIcon,
    hue: "rose",
    titleKey: "lpEmployerToolGrossNetTitle",
    descKey: "lpEmployerToolGrossNetDesc",
  },
  {
    Icon: ScaleIcon,
    hue: "orange",
    titleKey: "lpEmployerToolNoticeTitle",
    descKey: "lpEmployerToolNoticeDesc",
  },
  {
    Icon: CalculatorIcon,
    hue: "blue",
    titleKey: "lpEmployerToolPayrollCostTitle",
    descKey: "lpEmployerToolPayrollCostDesc",
  },
  {
    Icon: CalendarIcon,
    hue: "green",
    titleKey: "lpEmployerToolLeaveTitle",
    descKey: "lpEmployerToolLeaveDesc",
  },
  {
    Icon: FolderOpenIcon,
    hue: "green",
    titleKey: "lpEmployerToolDocsTitle",
    descKey: "lpEmployerToolDocsDesc",
  },
  {
    Icon: ShieldCheckIcon,
    hue: "rose",
    titleKey: "lpEmployerToolAidsTitle",
    descKey: "lpEmployerToolAidsDesc",
  },
];

const SECONDARY_BENEFITS: BenefitItem[] = [
  {
    Icon: LayersIcon,
    hue: "violet",
    titleKey: "lpEmployerSecCentralizedTitle",
    descKey: "lpEmployerSecCentralizedDesc",
  },
  {
    Icon: SearchIcon,
    hue: "orange",
    titleKey: "lpEmployerSecClearTitle",
    descKey: "lpEmployerSecClearDesc",
  },
  {
    Icon: TimerIcon,
    hue: "mauve",
    titleKey: "lpEmployerSecTimeTitle",
    descKey: "lpEmployerSecTimeDesc",
  },
  {
    Icon: BarChart3Icon,
    hue: "rose",
    titleKey: "lpEmployerSecVisibilityTitle",
    descKey: "lpEmployerSecVisibilityDesc",
  },
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

export default async function EmployeurLandingPage() {
  const t = await getTranslations("public.pro");
  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <AlreadyLoggedInBanner
        targetPath="/employeur"
        label={t("lpEmployerBannerLabel")}
      />

      {/* Section A — Hero (bilingue FR/NL, commutateur en tête) */}
      <EmployeurHeroBilingue />

      {/* Section A2 — Parcours chômage temporaire (obligations en 4 étapes) */}
      <CtParcours />

      {/* Section B — 4 bénéfices */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRIMARY_BENEFITS.map(({ Icon, hue, titleKey, descKey }) => (
          <article
            key={titleKey}
            className="glass-surface flex flex-col gap-3 p-5"
          >
            <IconTile Icon={Icon} hue={hue} />
            <h3 className="text-[15.5px] font-bold tracking-tight">
              {t(titleKey as Parameters<typeof t>[0])}
            </h3>
            <p className="text-[12.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
              {t(descKey as Parameters<typeof t>[0])}
            </p>
          </article>
        ))}
      </section>

      {/* Section C — Outils concrets */}
      <section className="flex flex-col gap-7">
        <h2 className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]">
          {t("lpEmployerToolsTitlePrefix")}{" "}
          <em>{t("lpEmployerToolsTitleEmphasis")}</em>{" "}
          {t("lpEmployerToolsTitleSuffix")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(({ Icon, hue, titleKey, descKey }) => (
            <article
              key={titleKey}
              className="glass-surface glass-interactive flex min-h-[180px] flex-col gap-3.5 p-5 text-left"
            >
              <IconTile Icon={Icon} hue={hue} />
              <h3 className="text-[15.5px] font-bold tracking-tight">
                {t(titleKey as Parameters<typeof t>[0])}
              </h3>
              <p className="flex-1 text-[12.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                {t(descKey as Parameters<typeof t>[0])}
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

        {/* Teaser commissions paritaires — pousse vers l'outil complet (?q=) */}
        <CpFinderTeaser />
      </section>

      {/* Section C2 — Échéancier des obligations employeur (+ export .ics) */}
      <EcheancierEmployeur />

      {/* Section D — 4 bénéfices secondaires */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECONDARY_BENEFITS.map(({ Icon, hue, titleKey, descKey }) => (
          <article
            key={titleKey}
            className="glass-surface flex flex-col gap-3 p-5"
          >
            <RoundIconTile Icon={Icon} hue={hue} />
            <h3 className="text-[14.5px] font-bold tracking-tight">
              {t(titleKey as Parameters<typeof t>[0])}
            </h3>
            <p className="text-[12px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
              {t(descKey as Parameters<typeof t>[0])}
            </p>
          </article>
        ))}
      </section>

      {/* Section D2 — Tarifs (HTVA ⇄ TVAC) */}
      <PricingEmployeur />

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
              {t("lpEmployerCtaTitle")}
            </h3>
            <ul className="flex flex-wrap gap-4 text-[13px] font-semibold">
              {[
                "lpEmployerCtaPointSetup",
                "lpEmployerCtaPointNoCommitment",
                "lpEmployerCtaPointSupport",
              ].map((k) => (
                <li key={k} className="inline-flex items-center gap-2">
                  <span
                    className="flex size-5 items-center justify-center rounded-full bg-white text-emerald-600"
                    aria-hidden
                  >
                    <CheckIcon className="size-3" strokeWidth={3} />
                  </span>
                  {t(k as Parameters<typeof t>[0])}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <Link
              href="/employeur"
              className="glass-cta inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
            >
              {t("lpEmployerCtaPrimary")}
              <ArrowRightIcon className="size-4" strokeWidth={2.4} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/70 bg-white/10 px-6 py-3.5 text-[13.5px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              {t("lpEmployerCtaSecondary")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
