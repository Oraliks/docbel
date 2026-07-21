"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { FolderOpen } from "@phosphor-icons/react";

const DISMISS_KEY = "docbel-resume-dismissed";

/**
 * Type local afin de ne jamais importer le loader serveur (headers/prisma)
 * dans ce composant client.
 */
export interface ResumeStripRun {
  runId: string;
  slug: string;
  name: string;
  color: string;
  completed: number;
  total: number;
  startedAt: string;
  lifecycle: "in_progress" | "completed_editable";
}

interface ResumeStripProps {
  run: ResumeStripRun;
}

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * La reprise met l'action suivante avant la metrique. Les donnees restent
 * celles preparees au serveur et la fermeture ne dure que la session.
 */
export function ResumeStrip({ run }: ResumeStripProps) {
  const t = useTranslations("public.home");
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, []);

  if (dismissed) return null;

  const completed = run.lifecycle === "completed_editable";
  const pct = completed
    ? 100
    : run.total > 0
      ? Math.min(100, Math.round((run.completed / run.total) * 100))
      : 0;
  const progressText = completed
    ? t("resumeCompletedProgress")
    : t("resumeProgress", {
        completed: run.completed,
        total: run.total,
      });

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Le masquage React reste effectif si le stockage est indisponible.
    }
    document.cookie = `${DISMISS_KEY}=1; path=/; SameSite=Lax`;
  };

  return (
    <aside
      aria-label={
        completed
          ? t("resumeCompletedAriaLabel", { name: run.name })
          : t("resumeAriaLabel", { name: run.name })
      }
      className="glass-surface relative grid w-full animate-[fadeInUp_0.35s_ease] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-4 motion-reduce:animate-none sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-x-4 sm:px-5"
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--glass-border)]"
        style={{
          background:
            "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
        }}
      >
        <FolderOpen
          weight="duotone"
          size={22}
          color="var(--glass-accent-deep)"
        />
      </span>

      <div className="min-w-0">
        <p className="pr-8 text-[13px] font-bold leading-snug text-[color:var(--glass-ink)] sm:pr-0 sm:text-[14px]">
          {completed
            ? t("resumeCompletedTitle", { name: run.name })
            : t("resumeTitle", { name: run.name })}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-[color:var(--glass-ink-soft)]">
          {progressText}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={Math.max(run.total, 1)}
          aria-valuenow={completed ? Math.max(run.total, 1) : run.completed}
          aria-label={t("resumeProgressAria", {
            completed: run.completed,
            total: run.total,
          })}
          className="mt-2 h-1.5 w-full max-w-[460px] overflow-hidden rounded-full"
          style={{
            background:
              "color-mix(in oklab, var(--glass-accent-deep) 14%, transparent)",
          }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{
              width: entered ? `${pct}%` : "0%",
              background: "var(--glass-accent-deep)",
            }}
          />
        </div>
      </div>

      <div className="col-span-2 flex min-w-0 flex-col gap-2 sm:col-span-1 sm:items-end">
        <Link
          href={`/d/${run.slug}?bundleRun=${encodeURIComponent(run.runId)}&demarrer=1`}
          className="glass-cta glass-interactive inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold"
        >
          {completed ? t("resumeCompletedCta") : t("resumeCta")}
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
        <Link
          href="/mes-demarches"
          className="self-center text-[11px] font-semibold text-[color:var(--glass-ink-faint)] underline-offset-2 transition-colors hover:text-[color:var(--glass-ink)] hover:underline motion-reduce:transition-none sm:self-auto"
        >
          {t("resumeSeeAllCta")}
        </Link>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label={t("resumeDismiss")}
        className="absolute top-2.5 right-2.5 inline-flex size-8 items-center justify-center rounded-full text-[color:var(--glass-ink-faint)] transition-colors hover:bg-[color:var(--glass-surface-strong)] hover:text-[color:var(--glass-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:outline-none motion-reduce:transition-none sm:static sm:col-start-4 sm:row-start-1 sm:-ml-2"
      >
        <XIcon className="size-4" aria-hidden />
      </button>
    </aside>
  );
}
