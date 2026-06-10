"use client";

import Link from "next/link";
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
  return (
    <Link
      href={`/d/${slug}`}
      className="glass-surface group relative flex flex-col gap-3 rounded-3xl p-5 transition-all hover:translate-y-[-2px] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex size-12 items-center justify-center rounded-2xl text-2xl text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          {icon ? (
            <IconDisplay value={icon} className="size-6" />
          ) : emoji ? (
            <span>{emoji}</span>
          ) : (
            <Layers className="size-5" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight text-[color:var(--glass-ink)]">
            {name}
          </h3>
          <span className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)] inline-flex items-center gap-1">
            <Clock className="size-3" />
            {itemCount} document{itemCount > 1 ? "s" : ""}
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
          Démarrer le parcours
        </span>
        <ArrowRight className="size-4 text-[color:var(--glass-ink-faint)] transition-transform group-hover:translate-x-1 group-hover:text-[color:var(--glass-ink)]" />
      </div>
    </Link>
  );
}
