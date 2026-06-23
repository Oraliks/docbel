import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import {
  getUpcomingSocialDeadlines,
  SOCIAL_CALENDAR_WARNING,
  type SocialDeadlineCategory,
} from "@/lib/employeur/calendar/social-deadlines";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("calMetaTitle"),
    description: t("calMetaDesc"),
  };
}

export const dynamic = "force-dynamic";

const CATEGORY_TONE: Record<SocialDeadlineCategory, "info" | "warning" | "secondary" | "outline"> = {
  ONSS: "info",
  Précompte: "warning",
  TVA: "secondary",
  Autre: "outline",
};

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("fr-BE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export default async function CalendrierPage() {
  const t = await getTranslations("public.pro");
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const deadlines = getUpcomingSocialDeadlines(new Date(), 12);

  return (
    <div className="flex w-full flex-col gap-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" render={<Link href="/employeur" />}>
        <ArrowLeft /> {t("backToDashboard")}
      </Button>

      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CalendarDays className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("calTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("calIntro")}</p>
        </div>
      </div>

      {/* Avertissement officiel : à afficher tel quel */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">{SOCIAL_CALENDAR_WARNING}</p>
      </div>

      <div className="grid gap-3">
        {deadlines.map((d) => {
          const due = new Date(`${d.date}T12:00:00`);
          return (
            <Card key={d.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-muted">
                  <span className="text-lg font-bold leading-none">{due.getDate()}</span>
                  <span className="mt-0.5 text-[10px] uppercase text-muted-foreground">
                    {due.toLocaleDateString("fr-BE", { month: "short" })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{d.title}</p>
                    <Badge variant={CATEGORY_TONE[d.category]}>{d.category}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs capitalize text-muted-foreground">{longDate(d.date)}</p>
                  {d.note ? <p className="mt-1 text-xs text-muted-foreground">{d.note}</p> : null}
                </div>
                {d.sourceUrl ? (
                  <a
                    href={d.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-primary no-underline hover:underline"
                  >
                    {d.sourceLabel ?? t("calSource")} <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
