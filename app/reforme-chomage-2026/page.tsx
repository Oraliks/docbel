/// Page publique « Ce qui a changé au 1er mars 2026 » — synthèse pédagogique
/// de la réforme du chômage (contenu fourni par Oraliks, doc ONEM 2026).
/// Informatif : ne calcule pas les droits, renvoie aux sources officielles.

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ExternalLink,
  GraduationCap,
  Hourglass,
  Info,
  Timer,
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.landing");
  return {
    title: t("reformeMetaTitle"),
    description: t("reformeMetaDesc"),
  };
}

interface Change {
  icon: typeof Timer;
  titleKey: "reformeChange1Title" | "reformeChange2Title" | "reformeChange3Title" | "reformeChange4Title";
  bodyKey: "reformeChange1Body" | "reformeChange2Body" | "reformeChange3Body" | "reformeChange4Body";
}

const CHANGES: Change[] = [
  { icon: Timer, titleKey: "reformeChange1Title", bodyKey: "reformeChange1Body" },
  { icon: GraduationCap, titleKey: "reformeChange2Title", bodyKey: "reformeChange2Body" },
  { icon: Hourglass, titleKey: "reformeChange3Title", bodyKey: "reformeChange3Body" },
  { icon: CalendarClock, titleKey: "reformeChange4Title", bodyKey: "reformeChange4Body" },
];

const SOURCES: { titleKey: "reformeSource1" | "reformeSource2" | "reformeSource3" | "reformeSource4"; url: string }[] = [
  {
    titleKey: "reformeSource1",
    url: "https://www.onem.be/reforme-de-la-reglementation-du-chomage",
  },
  {
    titleKey: "reformeSource2",
    url: "https://www.onem.be/actualites/2026/03/02/nouvelle-reglementation-chomage-en-vigueur-depuis-le-1er-mars-2026",
  },
  {
    titleKey: "reformeSource3",
    url: "https://www.onem.be/page/avez-vous-droit-aux-allocations-de-chomage-apres-une-occupation---situation-a-partir-du-01.03.2026-",
  },
  {
    titleKey: "reformeSource4",
    url: "https://www.onem.be/page/avez-vous-droit-aux-allocations-apres-des-etudes-allocations-dinsertion-et-pendant-combien-de-temps",
  },
];

export default async function ReformeChomage2026Page() {
  const t = await getTranslations("public.landing");
  return (
    <section className="relative isolate mx-auto flex max-w-3xl flex-col gap-7 py-8">
      <header className="flex flex-col gap-3 px-1">
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-1 text-[11.5px] font-semibold text-[color:var(--glass-ink-soft)]">
          <CalendarClock className="size-3.5" aria-hidden /> {t("reformeBadge")}
        </p>
        <h1 className="glass-display text-[34px] font-semibold leading-[1.06] sm:text-[42px]">
          {t.rich("reformeTitle", {
            em: (chunks) => <em>{chunks}</em>,
          })}
        </h1>
        <p className="max-w-2xl text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          {t("reformeIntro")}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {CHANGES.map((c) => (
          <article key={c.titleKey} className="glass-surface flex flex-col gap-2 p-5">
            <span
              className="glass-icon-tile flex size-9 items-center justify-center rounded-xl text-[color:var(--glass-accent-deep)]"
              style={{
                background:
                  "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
                "--tile-hue": "var(--glass-accent-deep)",
              } as React.CSSProperties}
              aria-hidden
            >
              <c.icon className="size-4" />
            </span>
            <h2 className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink)]">
              {t(c.titleKey)}
            </h2>
            <p className="text-[13px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
              {t(c.bodyKey)}
            </p>
          </article>
        ))}
      </div>

      {/* Avertissement informatif */}
      <div
        className="flex items-start gap-3 rounded-2xl border p-4"
        style={{
          borderColor: "color-mix(in oklab, var(--glass-accent-c) 35%, transparent)",
          background: "color-mix(in oklab, var(--glass-accent-c) 10%, transparent)",
        }}
      >
        <Info
          className="mt-0.5 size-4 shrink-0 text-[color:var(--glass-pop-fg)]"
          aria-hidden
        />
        <p className="text-[12.5px] leading-snug text-[color:var(--glass-ink-soft)]">
          {t("reformeDisclaimer")}
        </p>
      </div>

      {/* CTA vers l'orientation */}
      <div className="glass-surface flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
            {t("reformeCtaTitle")}
          </p>
          <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
            {t("reformeCtaSubtitle")}
          </p>
        </div>
        <Link
          href="/mon-dossier"
          className="glass-cta inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-[13.5px] font-bold"
        >
          {t("reformeCtaButton")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      {/* Sources */}
      <div className="space-y-1.5 px-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
          {t("reformeSourcesTitle")}
        </p>
        <ul className="space-y-1">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-[12.5px] text-[color:var(--glass-accent-deep)] underline-offset-2 hover:underline"
              >
                <ExternalLink className="size-3 shrink-0" aria-hidden />
                {t(s.titleKey)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
