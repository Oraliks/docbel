import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
import { AgrDemo } from "@/components/docbel/p/agr-demo";
import { BookingShowcase } from "@/components/docbel/p/booking-showcase";
import { EspacePreview } from "@/components/docbel/p/espace-preview";
import { RoiCalc } from "@/components/docbel/p/roi-calc";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("lpPartnerMetaTitle"),
    description: t("lpPartnerMetaDesc"),
  };
}

// Gradients réutilisés pour les icônes carrées des cards — inspirés du
// VARIANT_BG de `LandingToolCard` (cf. components/docbel/landing/tool-card.tsx).
// On garde une palette glass cohérente : violet (a) → rose (b) → orange (c) →
// vert/bleu (d/e) pour le rythme visuel des 6 outils.
type IconHue = "violet" | "orange" | "rose" | "blue" | "green" | "mauve";
const ICON_BG: Record<IconHue, string> = {
  violet: "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
  orange: "linear-gradient(135deg, var(--glass-accent-d), var(--chart-1))",
  rose: "linear-gradient(135deg, var(--glass-accent-c), var(--chart-5))",
  blue: "linear-gradient(135deg, var(--chart-2), var(--glass-accent-deep))",
  green: "linear-gradient(135deg, var(--chart-3), var(--glass-success))",
  mauve: "linear-gradient(135deg, var(--glass-accent-b), var(--glass-accent-a))",
};
const ICON_SHADOW: Record<IconHue, string> = {
  violet: "0 6px 20px color-mix(in oklab, var(--glass-accent-a) 35%, transparent)",
  orange: "0 6px 20px color-mix(in oklab, var(--glass-accent-d) 35%, transparent)",
  rose: "0 6px 20px color-mix(in oklab, var(--glass-accent-c) 35%, transparent)",
  blue: "0 6px 20px color-mix(in oklab, var(--chart-2) 35%, transparent)",
  green: "0 6px 20px color-mix(in oklab, var(--chart-3) 35%, transparent)",
  mauve: "0 6px 20px color-mix(in oklab, var(--glass-accent-b) 30%, transparent)",
};

interface BenefitItem {
  Icon: LucideIcon;
  hue: IconHue;
  titleKey: string;
  descKey: string;
}

const PRIMARY_BENEFITS: BenefitItem[] = [
  {
    Icon: SearchIcon,
    hue: "violet",
    titleKey: "lpPartnerBenefitSearchTitle",
    descKey: "lpPartnerBenefitSearchDesc",
  },
  {
    Icon: FolderOpenIcon,
    hue: "orange",
    titleKey: "lpPartnerBenefitCentralTitle",
    descKey: "lpPartnerBenefitCentralDesc",
  },
  {
    Icon: UsersIcon,
    hue: "rose",
    titleKey: "lpPartnerBenefitGuideTitle",
    descKey: "lpPartnerBenefitGuideDesc",
  },
  {
    Icon: HeartIcon,
    hue: "blue",
    titleKey: "lpPartnerBenefitSupportTitle",
    descKey: "lpPartnerBenefitSupportDesc",
  },
];

const TOOLS: BenefitItem[] = [
  {
    Icon: Building2Icon,
    hue: "violet",
    titleKey: "lpPartnerToolOfficeTitle",
    descKey: "lpPartnerToolOfficeDesc",
  },
  {
    Icon: ScaleIcon,
    hue: "orange",
    titleKey: "lpPartnerToolU1Title",
    descKey: "lpPartnerToolU1Desc",
  },
  {
    Icon: Users2Icon,
    hue: "rose",
    titleKey: "lpPartnerToolCpasTitle",
    descKey: "lpPartnerToolCpasDesc",
  },
  {
    Icon: BookOpenIcon,
    hue: "violet",
    titleKey: "lpPartnerToolGuidesTitle",
    descKey: "lpPartnerToolGuidesDesc",
  },
  {
    Icon: BookmarkIcon,
    hue: "green",
    titleKey: "lpPartnerToolRefTitle",
    descKey: "lpPartnerToolRefDesc",
  },
  {
    Icon: FileTextIcon,
    hue: "orange",
    titleKey: "lpPartnerToolDocsTitle",
    descKey: "lpPartnerToolDocsDesc",
  },
];

const SECONDARY_BENEFITS: BenefitItem[] = [
  {
    Icon: LayersIcon,
    hue: "violet",
    titleKey: "lpPartnerSecCentralTitle",
    descKey: "lpPartnerSecCentralDesc",
  },
  {
    Icon: ClockIcon,
    hue: "orange",
    titleKey: "lpPartnerSecUptodateTitle",
    descKey: "lpPartnerSecUptodateDesc",
  },
  {
    Icon: LightbulbIcon,
    hue: "mauve",
    titleKey: "lpPartnerSecExplainTitle",
    descKey: "lpPartnerSecExplainDesc",
  },
  {
    Icon: BarChart3Icon,
    hue: "rose",
    titleKey: "lpPartnerSecTrackTitle",
    descKey: "lpPartnerSecTrackDesc",
  },
];

const REASSURANCE_BADGES: { Icon: LucideIcon; labelKey: string }[] = [
  { Icon: ShieldCheckIcon, labelKey: "lpPartnerBadgeReliable" },
  { Icon: BookOpenIcon, labelKey: "lpPartnerBadgeCentral" },
  { Icon: HandshakeIcon, labelKey: "lpPartnerBadgePartners" },
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

export default async function PartenaireLandingPage() {
  const t = await getTranslations("public.pro");
  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <AlreadyLoggedInBanner
        targetPath="/partenaire"
        label={t("lpPartnerBannerLabel")}
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
            {t("lpPartnerHeroEyebrow")}
          </span>

          <h1 className="glass-display text-[40px] leading-[1.05] font-semibold tracking-tight sm:text-[52px] lg:text-[58px]">
            {t("lpPartnerHeroTitlePre")}{" "}
            <em>{t("lpPartnerHeroTitleEm1")}</em> {t("lpPartnerHeroTitleMid")}{" "}
            <em>{t("lpPartnerHeroTitleEm2")}</em>.
          </h1>

          <p className="max-w-[560px] text-[15.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            {t("lpPartnerHeroLead")}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/partenaire"
              className="glass-cta inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
            >
              {t("lpPartnerHeroCta")}
              <ArrowRightIcon className="size-4" strokeWidth={2.4} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-6 py-3.5 text-[13.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 hover:text-[color:var(--glass-ink)] dark:hover:bg-white/10"
            >
              {t("lpPartnerCtaDemo")}
            </Link>
          </div>

          <ul className="flex flex-wrap gap-2 pt-2">
            {REASSURANCE_BADGES.map(({ Icon, labelKey }) => (
              <li
                key={labelKey}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 py-2 text-[12px] font-semibold text-[color:var(--glass-ink-soft)]"
              >
                <Icon
                  className="size-3.5"
                  style={{ color: "var(--glass-accent-deep)" }}
                  strokeWidth={2.4}
                />
                {t(labelKey as Parameters<typeof t>[0])}
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
              {/* Illustration 3D (asset CC0) en lévitation — remplace l'icône
                  plate ; drop-shadow violet pour l'harmoniser au fond mauve. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/3d/folder.png"
                alt=""
                aria-hidden
                className="hero-float h-20 w-20 object-contain sm:h-24 sm:w-24"
                style={{
                  filter:
                    "drop-shadow(0 14px 22px rgba(20,10,45,0.45)) drop-shadow(0 0 18px color-mix(in oklab, var(--glass-accent-deep) 50%, transparent))",
                }}
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
                {t("lpPartnerHeroCardLabel")}
              </span>
            </div>
          </div>
        </div>
      </section>

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

      {/* Section C — Outils utiles */}
      <section className="flex flex-col gap-7">
        <h2 className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]">
          {t("lpPartnerToolsHeadingPre")} <em>{t("lpPartnerToolsHeadingEm")}</em>{" "}
          {t("lpPartnerToolsHeadingPost")}
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
      </section>

      {/* Section C2 — Démo interactive du Calcul AGR (vrai moteur lib/agr) */}
      <AgrDemo />

      {/* Section C3 — Calculette retour sur investissement */}
      <RoiCalc />

      {/* Section C4 — Visite guidée de l'espace (aperçu à onglets) */}
      <EspacePreview />

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

      {/* Section D2 — Vitrine du parcours rendez-vous */}
      <BookingShowcase />

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
              {t("lpPartnerFinalTitle")}
            </h3>
            <ul className="flex flex-wrap gap-4 text-[13px] font-semibold">
              {[
                "lpPartnerFinalPoint1",
                "lpPartnerFinalPoint2",
                "lpPartnerFinalPoint3",
              ].map((k) => (
                <li key={k} className="inline-flex items-center gap-2">
                  <span
                    className="flex size-5 items-center justify-center rounded-full bg-white text-[color:var(--glass-success)]"
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
              href="/partenaire"
              className="glass-cta inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
            >
              {t("lpPartnerHeroCta")}
              <ArrowRightIcon className="size-4" strokeWidth={2.4} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-white/70 bg-white/10 px-6 py-3.5 text-[13.5px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              {t("lpPartnerCtaDemo")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
