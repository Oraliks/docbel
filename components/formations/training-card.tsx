"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CalendarRangeIcon,
  ClockIcon,
  HeartIcon,
  MapPinIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { TrainingCardData } from "@/lib/formations/queries";
import { resolveIcon } from "./icons";
import {
  deriveChips,
  durationText,
  formatDate,
  levelLabel,
  type ChipTone,
} from "./format";
import { useSavedFormations } from "@/hooks/useSavedFormations";

const TONE_STYLE: Record<ChipTone, React.CSSProperties> = {
  green: { background: "color-mix(in oklab, #16A34A 14%, transparent)", color: "#16A34A" },
  violet: { background: "var(--glass-pop-bg)", color: "var(--glass-pop-fg)" },
  blue: { background: "color-mix(in oklab, #2563EB 14%, transparent)", color: "#2563EB" },
  amber: { background: "color-mix(in oklab, #F59E0B 16%, transparent)", color: "#B45309" },
  neutral: { background: "var(--glass-surface-strong)", color: "var(--glass-ink-soft)" },
};

export function TrainingCard({ training }: { training: TrainingCardData }) {
  const t = useTranslations("public.formations");
  const { isSaved, toggle } = useSavedFormations();
  const Icon = resolveIcon(training.category?.icon);
  const accent = training.category?.color ?? "#7C3AED";
  const chips = deriveChips(training);
  const duration = durationText(training.durationHours, training.durationLabel);
  const saved = isSaved(training.slug);

  return (
    <div className="glass-surface glass-interactive relative flex min-h-[230px] flex-col gap-3 overflow-hidden p-5">
      <Link
        href={`/formations/${training.slug}`}
        className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
        aria-label={training.title}
      />

      {/* Save (au-dessus du lien étiré) */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(training.slug);
        }}
        aria-label={saved ? t("unsaveAria") : t("saveAria")}
        className="absolute right-3 top-3 z-10 rounded-full p-2 transition hover:bg-white/55 dark:hover:bg-white/10"
        style={{ color: saved ? "var(--glass-accent-c)" : "var(--glass-ink-faint)" }}
      >
        <HeartIcon className={`size-4 ${saved ? "fill-current" : ""}`} />
      </button>

      <div className="pointer-events-none relative z-[1] flex flex-1 flex-col gap-3">
        <div className="flex items-start gap-3">
          <span
            className="glass-icon-tile flex size-11 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: `color-mix(in oklab, ${accent} 18%, transparent)`,
              color: accent,
            }}
          >
            <Icon className="size-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1 pr-6">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
              {training.organization.name}
            </p>
            <h3 className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-tight tracking-tight">
              {training.title}
            </h3>
          </div>
        </div>

        {training.shortDescription ? (
          <p className="line-clamp-2 text-[12.5px] leading-[1.45] text-[color:var(--glass-ink-soft)]">
            {training.shortDescription}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {(training.isVerifiedByDocbel || training.isDocbelRecommended) && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em]"
              style={TONE_STYLE.violet}
            >
              {training.isVerifiedByDocbel ? (
                <ShieldCheckIcon className="size-3" />
              ) : (
                <SparklesIcon className="size-3" />
              )}
              {training.isVerifiedByDocbel ? t("badgeVerifiedDocbel") : t("badgeRecommended")}
            </span>
          )}
          {chips.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold"
              style={TONE_STYLE[c.tone]}
            >
              {c.label}
            </span>
          ))}
          <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-bold"
            style={TONE_STYLE.neutral}
          >
            {levelLabel(training.level)}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-[color:var(--glass-ink-line)] pt-3 text-[11.5px] font-semibold text-[color:var(--glass-ink-faint)]">
          <span className="inline-flex items-center gap-1.5">
            {training.nextSessionAt ? (
              <>
                <CalendarRangeIcon className="size-3.5" />
                {formatDate(training.nextSessionAt)}
                {training.nextSessionCity ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="size-3" />
                    {training.nextSessionCity}
                  </span>
                ) : null}
              </>
            ) : duration ? (
              <>
                <ClockIcon className="size-3.5" />
                {duration}
              </>
            ) : (
              <span>{t("datesUpcoming")}</span>
            )}
          </span>
          {training.sessionsCount > 0 ? (
            <span>
              {t("sessionsCount", { count: training.sessionsCount })}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
