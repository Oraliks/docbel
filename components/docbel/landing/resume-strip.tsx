"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      className="h-full"
      aria-label={
        completed
          ? t("resumeCompletedAriaLabel", { name: run.name })
          : t("resumeAriaLabel", { name: run.name })
      }
    >
      <CardHeader>
        <div className="flex items-center gap-2 text-[color:var(--glass-accent-deep)]">
          <FolderOpen className="size-5" aria-hidden />
          <Badge variant="secondary">{t("guidedResumeEyebrow")}</Badge>
        </div>
        <CardTitle>
          {completed
            ? t("resumeCompletedTitle", { name: run.name })
            : t("resumeTitle", { name: run.name })}
        </CardTitle>
        <CardDescription>{progressText}</CardDescription>
        <CardAction>
          <Badge variant="outline">
            {completed ? "100 %" : `${run.completed}/${run.total}`}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Progress
          value={percentage}
          aria-label={t("resumeProgressAria", {
            completed: run.completed,
            total: run.total,
          })}
          className="[&_[data-slot=progress-indicator]]:bg-[color:var(--glass-accent-deep)]"
        />
        <Separator />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
            {t("guidedResumeNext")}
          </p>
          <p className="mt-2 font-semibold text-[color:var(--glass-ink)]">
            {completed
              ? t("resumeCompletedProgress")
              : t("guidedResumeNextDescription")}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button
          render={<Link href={resumeHref} />}
          nativeButton={false}
          className="min-h-10 flex-1"
        >
          {completed ? t("resumeCompletedCta") : t("resumeCta")}
          <ArrowRight
            data-icon="inline-end"
            className="rtl:rotate-180"
            aria-hidden
          />
        </Button>
        <Button
          render={<Link href="/mes-demarches" />}
          nativeButton={false}
          variant="outline"
          className="min-h-10"
        >
          {t("resumeSeeAllCta")}
        </Button>
      </CardFooter>
    </Card>
  );
}
