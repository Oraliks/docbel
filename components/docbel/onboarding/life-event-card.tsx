"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Clock, Layers } from "lucide-react";
import { IconDisplay } from "@/components/admin/documents/icon-picker";

interface Props {
  slug: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  itemCount: number;
  emoji?: string;
}

export function LifeEventCard({
  slug,
  name,
  description,
  color,
  icon,
  itemCount,
  emoji,
}: Props) {
  const t = useTranslations("public.dossier");
  return (
    <Link
      href={`/d/${slug}`}
      className="glass-surface glass-interactive group relative flex flex-col gap-3 rounded-3xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm"
          style={{
            background: `color-mix(in oklab, ${color} 18%, transparent)`,
            color,
          }}
          aria-hidden
        >
          {icon ? (
            <IconDisplay value={icon} className="size-6" />
          ) : emoji ? (
            <span>{emoji}</span>
          ) : (
            <Layers className="size-5" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-[15px] font-semibold leading-tight text-[color:var(--glass-ink)]">
            {name}
          </h3>
          <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
            <Clock aria-hidden />
            {t("documentsCount", { count: itemCount })}
          </span>
        </div>
      </div>

      {description && (
        <p className="line-clamp-3 text-[13px] leading-snug text-[color:var(--glass-ink-soft)]">
          {description}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-[12px] font-medium text-[color:var(--glass-ink-soft)] group-hover:text-[color:var(--glass-ink)]">
          {t("startFlow")}
        </span>
        <ArrowRight className="text-[color:var(--glass-ink-faint)] group-hover:text-[color:var(--glass-ink)] rtl:rotate-180" aria-hidden />
      </div>
    </Link>
  );
}
