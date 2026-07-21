"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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

/** Panneau lateral de reprise, alimente uniquement par les donnees serveur. */
export function ResumeStrip({ run }: ResumeStripProps) {
  const t = useTranslations("public.home");
  const completed = run.lifecycle === "completed_editable";
  const percentage = completed
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
  const resumeHref = `/d/${encodeURIComponent(run.slug)}?bundleRun=${encodeURIComponent(run.runId)}&demarrer=1`;

  return (
    <Card
      className="h-full rounded-[24px] py-5"
      aria-label={
        completed
          ? t("resumeCompletedAriaLabel", { name: run.name })
          : t("resumeAriaLabel", { name: run.name })
      }
    >
      <CardHeader className="gap-3 px-5">
        <div className="flex items-center gap-2 text-[color:var(--glass-accent-deep)]">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10">
            <FolderOpen aria-hidden />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em]">
            {t("guidedResumeEyebrow")}
          </span>
        </div>
        <CardTitle className="glass-display pr-12 text-[22px] font-semibold leading-tight sm:text-[25px]">
          {completed
            ? t("resumeCompletedTitle", { name: run.name })
            : t("resumeTitle", { name: run.name })}
        </CardTitle>
        <CardDescription>{progressText}</CardDescription>
        <CardAction>
          <Badge variant={completed ? "secondary" : "outline"}>
            {completed ? "100 %" : `${run.completed}/${run.total}`}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5 px-5">
        <Progress
          value={percentage}
          aria-label={t("resumeProgressAria", {
            completed: run.completed,
            total: run.total,
          })}
          className="h-2 [&_[data-slot=progress-indicator]]:bg-[color:var(--glass-accent-deep)]"
        />
        <Separator />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
            {t("guidedResumeNext")}
          </p>
          <p className="mt-2 font-semibold leading-relaxed text-[color:var(--glass-ink)]">
            {completed
              ? t("resumeCompletedProgress")
              : t("guidedResumeNextDescription")}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex-col gap-2 border-0 bg-transparent px-5 pt-0">
        <Link
          href={resumeHref}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          {completed ? t("resumeCompletedCta") : t("resumeCta")}
          <ArrowRight data-icon="inline-end" className="rtl:rotate-180" aria-hidden />
        </Link>
        <Link
          href="/mes-demarches"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full",
          )}
        >
          {t("resumeSeeAllCta")}
        </Link>
      </CardFooter>
    </Card>
  );
}
