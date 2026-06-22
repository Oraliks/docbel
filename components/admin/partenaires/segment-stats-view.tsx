import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeftIcon,
  Building2Icon,
  GlobeIcon,
  UsersIcon,
  CheckCircle2Icon,
  ClockIcon,
  PauseCircleIcon,
  MailCheckIcon,
  TrendingUpIcon,
  LogInIcon,
  FlaskConicalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PartnerStats } from "@/lib/partner-stats";

/**
 * Vue de statistiques partagée par /admin/partenaires/stats et
 * /admin/employeurs/stats. Mêmes métriques, thème (titre / lien retour /
 * accent) piloté par `variant`.
 */
export type StatsVariant = "partenaire" | "employeur";

function formatMonthLabel(key: string, monthLabels: string[]): string {
  const [year, month] = key.split("-").map((p) => parseInt(p, 10));
  return `${monthLabels[month - 1]} ${String(year).slice(2)}`;
}

const THEME: Record<
  StatsVariant,
  {
    backHref: string;
    primaryCard: string;
    bar: string;
    badge: string;
  }
> = {
  partenaire: {
    backHref: "/admin/partenaires",
    primaryCard:
      "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    bar: "bg-violet-500 hover:bg-violet-600 dark:bg-violet-400 dark:hover:bg-violet-300",
    badge:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  employeur: {
    backHref: "/admin/employeurs",
    primaryCard:
      "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
    bar: "bg-teal-500 hover:bg-teal-600 dark:bg-teal-400 dark:hover:bg-teal-300",
    badge:
      "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  },
};

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  accentClass?: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  accentClass = "bg-muted text-muted-foreground",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${accentClass}`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight">{value}</p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export async function SegmentStatsView({
  stats,
  variant,
}: {
  stats: PartnerStats;
  variant: StatsVariant;
}) {
  const t = await getTranslations("admin.partenaires");
  const theme = THEME[variant];
  const monthLabels = [
    t("monthJan"),
    t("monthFeb"),
    t("monthMar"),
    t("monthApr"),
    t("monthMay"),
    t("monthJun"),
    t("monthJul"),
    t("monthAug"),
    t("monthSep"),
    t("monthOct"),
    t("monthNov"),
    t("monthDec"),
  ];
  const maxMonth = Math.max(...stats.signupsByMonth.map((m) => m.count), 1);
  const verifiedRate =
    stats.totalUsers > 0
      ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button render={<Link href={theme.backHref} />} variant="ghost" size="sm">
          <ArrowLeftIcon className="size-4" />
          {t("back")}
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {variant === "employeur" ? t("statsTitleEmployer") : t("statsTitlePartner")}
          </h1>
          <p className="text-muted-foreground">
            {variant === "employeur"
              ? t("statsSubtitleEmployer")
              : t("statsSubtitlePartner")}
          </p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("statCardOrganizations")}
          value={stats.totalOrganizations}
          icon={Building2Icon}
          accentClass={theme.primaryCard}
        />
        <StatCard
          title={t("statCardActiveDomains")}
          value={stats.activeDomains}
          icon={GlobeIcon}
          description={t("statCardActiveDomainsDesc", {
            total: stats.totalDomains,
            test: stats.testDomains,
          })}
          accentClass="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
        />
        <StatCard
          title={t("statCardUsers")}
          value={stats.totalUsers}
          icon={UsersIcon}
          description={t("statCardUsersDesc", {
            active: stats.activeUsers,
            pending: stats.pendingUsers,
          })}
          accentClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
        />
        <StatCard
          title={t("statCardEmailVerified")}
          value={verifiedRate}
          icon={MailCheckIcon}
          description={t("statCardEmailVerifiedDesc", {
            verified: stats.verifiedUsers,
            total: stats.totalUsers,
            rate: verifiedRate,
          })}
          accentClass="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("statCardActiveAccounts")}
          value={stats.activeUsers}
          icon={CheckCircle2Icon}
          accentClass="bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
        />
        <StatCard
          title={t("statCardPendingAccounts")}
          value={stats.pendingUsers}
          icon={ClockIcon}
          accentClass="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        />
        <StatCard
          title={t("statCardDisabledAccounts")}
          value={stats.disabledUsers}
          icon={PauseCircleIcon}
          accentClass="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
        />
        <StatCard
          title={t("statCardTestDomains")}
          value={stats.testDomains}
          icon={FlaskConicalIcon}
          accentClass="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${theme.primaryCard}`}
            >
              <TrendingUpIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("signups7Days")}
              </p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight">
                {stats.recentSignups}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <LogInIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">
                {t("logins7Days")}
              </p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight">
                {stats.recentLogins}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("signupsByMonth")}</CardTitle>
            <CardDescription>{t("last6Months")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {stats.signupsByMonth.map((m) => (
                <div
                  key={m.month}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div className="flex h-32 w-full items-end">
                    <div
                      className={`w-full rounded-t-md transition-all ${theme.bar}`}
                      style={{
                        height: `${(m.count / maxMonth) * 100}%`,
                        minHeight: m.count > 0 ? "4px" : "0",
                      }}
                      title={t("signupsTooltip", { count: m.count })}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold">{m.count}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatMonthLabel(m.month, monthLabels)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("topOrganizations")}
            </CardTitle>
            <CardDescription>{t("top5Active")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topOrganizations.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t("noUsersYet")}
              </p>
            ) : (
              <ol className="space-y-2">
                {stats.topOrganizations.map((o, idx) => (
                  <li
                    key={o.organizationName}
                    className="flex items-center gap-3 rounded-md border bg-muted/20 p-2.5"
                  >
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${theme.badge}`}
                    >
                      {idx + 1}
                    </span>
                    <span className="flex-1 truncate font-medium">
                      {o.organizationName}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {t("userCountShort", { count: o.userCount })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
