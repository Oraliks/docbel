"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRightIcon,
  FileTextIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { type ActivityItem } from "@/components/admin/activity-log";
import { cn } from "@/lib/utils";

interface Page {
  id: string;
  title: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Tool {
  id: string;
  name: string;
  slug: string;
}

interface ToolSection {
  id: string;
  name: string;
  tools: Tool[];
}

interface Props {
  pages: Page[];
  users: User[];
  sections: ToolSection[];
  activities: ActivityItem[];
}

type Period = "7d" | "14d" | "30d";
const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "14d": 14, "30d": 30 };

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
}

function countSince(items: { createdAt: string }[], since: Date): number {
  return items.filter((i) => new Date(i.createdAt) >= since).length;
}

function trendDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function buildSignupSeries(users: { createdAt: string }[], days: number) {
  const today = startOfDay(new Date());
  const series: { label: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const count = users.filter((u) => {
      const c = new Date(u.createdAt);
      return c >= d && c < next;
    }).length;
    const label =
      days <= 14
        ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
        : d.getDate().toString();
    series.push({ label, count });
  }
  return series;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)}j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function getInitials(name: string, email: string): string {
  const source = name?.trim() || email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

interface KpiCardProps {
  label: string;
  value: number | string;
  hint?: string;
  delta?: number;
  deltaSuffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass?: string;
}

function KpiCard({ label, value, hint, delta, deltaSuffix, icon: Icon, iconClass }: KpiCardProps) {
  const showTrend = typeof delta === "number";
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </CardDescription>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            iconClass ?? "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight tabular-nums">{value}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        {showTrend && (
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
                up
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
              )}
            >
              {up ? (
                <TrendingUpIcon className="h-3 w-3" />
              ) : (
                <TrendingDownIcon className="h-3 w-3" />
              )}
              {up ? "+" : ""}
              {delta}%
            </span>
            <span className="text-muted-foreground">{deltaSuffix ?? "vs période préc."}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminDashboardOverview({ pages, users, sections, activities }: Props) {
  const [period, setPeriod] = useState<Period>("14d");

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.status === "active").length;
    const totalPages = pages.length;
    const publishedPages = pages.filter((p) => p.status === "published").length;
    const draftPages = pages.filter((p) => p.status === "draft").length;
    const totalTools = sections.reduce((sum, s) => sum + s.tools.length, 0);

    const since7 = daysAgo(7);
    const since14 = daysAgo(14);
    const usersLast7 = countSince(users, since7);
    const usersPrev7 = countSince(users, since14) - usersLast7;
    const pagesLast7 = countSince(pages, since7);
    const pagesPrev7 = countSince(pages, since14) - pagesLast7;

    return {
      totalUsers,
      activeUsers,
      totalPages,
      publishedPages,
      draftPages,
      totalTools,
      usersLast7,
      pagesLast7,
      usersDelta: trendDelta(usersLast7, usersPrev7),
      pagesDelta: trendDelta(pagesLast7, pagesPrev7),
    };
  }, [users, pages, sections]);

  const series = useMemo(
    () => buildSignupSeries(users, PERIOD_DAYS[period]),
    [users, period],
  );

  const recentUsers = useMemo(
    () =>
      [...users]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [users],
  );

  const recentPages = useMemo(
    () =>
      [...pages]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [pages],
  );

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const activeRatio = stats.totalUsers
    ? Math.round((stats.activeUsers / stats.totalUsers) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vue d&apos;ensemble</h1>
          <p className="text-sm text-muted-foreground capitalize">{today}</p>
        </div>
        <Badge variant="outline" className="gap-1.5 self-start font-normal sm:self-end">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Système opérationnel
        </Badge>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Utilisateurs"
          value={stats.totalUsers}
          hint={`+${stats.usersLast7} cette semaine`}
          delta={stats.usersDelta}
          icon={UsersIcon}
        />
        <KpiCard
          label="Actifs"
          value={stats.activeUsers}
          hint={`${activeRatio}% du total`}
          icon={UsersIcon}
          iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          label="Pages publiées"
          value={stats.publishedPages}
          hint={`${stats.draftPages} brouillon${stats.draftPages > 1 ? "s" : ""}`}
          delta={stats.pagesDelta}
          icon={FileTextIcon}
          iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          label="Outils"
          value={stats.totalTools}
          hint={`${sections.length} section${sections.length > 1 ? "s" : ""}`}
          icon={WrenchIcon}
          iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Inscriptions</CardTitle>
                <CardDescription>
                  {stats.usersLast7} nouveaux utilisateurs sur les 7 derniers jours
                </CardDescription>
              </div>
              <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <TabsList className="h-8">
                  <TabsTrigger value="7d" className="text-xs">7j</TabsTrigger>
                  <TabsTrigger value="14d" className="text-xs">14j</TabsTrigger>
                  <TabsTrigger value="30d" className="text-xs">30j</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <RBarChart
                data={series}
                margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              >
                  <defs>
                    <linearGradient id="signups-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                      padding: "6px 10px",
                    }}
                    labelStyle={{ color: "var(--muted-foreground)", marginBottom: 2 }}
                    formatter={(value) => [value as number, "Inscriptions"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#signups-gradient)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                  />
              </RBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Activité récente</CardTitle>
              <CardDescription>Dernières actions</CardDescription>
            </div>
            <Link
              href="/admin?view=activity"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Tout voir
              <ArrowUpRightIcon className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {activities.length > 0 ? (
              <ul className="space-y-3">
                {activities.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <Avatar size="sm">
                      <AvatarFallback>{getInitials(a.user, a.user)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">
                        <span className="font-medium">{a.user}</span>{" "}
                        <span className="text-muted-foreground">
                          a {a.action} {a.resource}
                        </span>{" "}
                        <span className="font-medium">{a.resourceName}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(a.timestamp)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty className="border-0 p-0 text-left items-start">
                <EmptyHeader className="items-start">
                  <EmptyTitle className="text-sm">Aucune activité</EmptyTitle>
                  <EmptyDescription className="text-xs">
                    Les actions admin apparaîtront ici.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent users + pages */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Nouveaux utilisateurs</CardTitle>
              <CardDescription>Les 5 dernières inscriptions</CardDescription>
            </div>
            <Link
              href="/admin?view=users"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Tous
              <ArrowUpRightIcon className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentUsers.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentUsers.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <Avatar>
                      <AvatarFallback>{getInitials(u.name, u.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name || u.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={u.role === "admin" ? "default" : "outline"} className="text-[10px]">
                        {u.role}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(u.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty className="border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UsersIcon />
                  </EmptyMedia>
                  <EmptyTitle>Aucun utilisateur</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Pages récentes</CardTitle>
              <CardDescription>Dernières modifications</CardDescription>
            </div>
            <Link
              href="/admin/pages"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Toutes
              <ArrowUpRightIcon className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentPages.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentPages.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileTextIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/pages/${p.id}`}
                        className="block truncate text-sm font-medium hover:text-primary"
                      >
                        {p.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={p.status === "published" ? "default" : "secondary"}
                        className="gap-1 text-[10px]"
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            p.status === "published" ? "bg-emerald-400" : "bg-muted-foreground/60",
                          )}
                        />
                        {p.status === "published" ? "Publiée" : "Brouillon"}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatRelativeTime(p.updatedAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty className="border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileTextIcon />
                  </EmptyMedia>
                  <EmptyTitle>Aucune page</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
