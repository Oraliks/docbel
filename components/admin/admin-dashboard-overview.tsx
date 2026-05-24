"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart as RBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  FileText,
  Handshake,
  MapPin,
  Newspaper,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { type ActivityItem } from "@/components/admin/activity-log";
import { ApiHealthCheck } from "@/components/admin/api-health-check";
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

// ─────────────────────────────────────────────────────────────────
// Utilitaires temps
// ─────────────────────────────────────────────────────────────────

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
    series.push({ label: d.getDate().toString(), count });
  }
  return series;
}

function relativeShort(dateString: string): string {
  const date = new Date(dateString);
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function getInitials(name: string, email: string): string {
  const source = name?.trim() || email;
  return (
    source
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

// ─────────────────────────────────────────────────────────────────
// Sous-composants visuels
// ─────────────────────────────────────────────────────────────────

/** Grosse stat sans description — juste le chiffre + label discret. */
function MetricTile({
  value,
  label,
  trend,
  accent = "primary",
}: {
  value: number | string;
  label: string;
  trend?: number;
  accent?: "primary" | "emerald" | "blue" | "amber";
}) {
  const accentBg = {
    primary: "from-primary/20 via-primary/5 to-transparent",
    emerald: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    blue: "from-blue-500/20 via-blue-500/5 to-transparent",
    amber: "from-amber-500/20 via-amber-500/5 to-transparent",
  }[accent];
  const accentText = {
    primary: "text-primary",
    emerald: "text-emerald-500",
    blue: "text-blue-500",
    amber: "text-amber-500",
  }[accent];
  return (
    <Card className="relative overflow-hidden border-border/60">
      <div
        aria-hidden
        className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", accentBg)}
      />
      <CardContent className="relative p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight tabular-nums">{value}</span>
          {typeof trend === "number" && trend !== 0 && (
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                trend > 0 ? "text-emerald-500" : "text-rose-500",
              )}
            >
              {trend > 0 ? "+" : ""}
              {trend}%
            </span>
          )}
        </div>
        <div className={cn("mt-3 h-1 w-12 rounded-full", accentText, "bg-current opacity-60")} />
      </CardContent>
    </Card>
  );
}

/** Tuile d'action vers une section admin — visuelle, cliquable, mini-stat optionnelle. */
function ActionTile({
  href,
  icon: Icon,
  label,
  count,
  accent = "primary",
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number | string;
  accent?: "primary" | "emerald" | "blue" | "amber" | "rose" | "violet" | "cyan";
}) {
  const accentClasses = {
    primary: "bg-primary/10 text-primary group-hover:bg-primary/20",
    emerald: "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20",
    blue: "bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20",
    amber: "bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20",
    rose: "bg-rose-500/10 text-rose-500 group-hover:bg-rose-500/20",
    violet: "bg-violet-500/10 text-violet-500 group-hover:bg-violet-500/20",
    cyan: "bg-cyan-500/10 text-cyan-500 group-hover:bg-cyan-500/20",
  }[accent];
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-border hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            accentClasses,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">{label}</p>
        {count !== undefined && (
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground/90">{count}</p>
        )}
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────
// Dashboard principal
// ─────────────────────────────────────────────────────────────────

export function AdminDashboardOverview({ pages, users, sections, activities }: Props) {
  const [period, setPeriod] = useState<Period>("14d");

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.status === "active").length;
    const publishedPages = pages.filter((p) => p.status === "published").length;
    const totalTools = sections.reduce((sum, s) => sum + s.tools.length, 0);

    const since7 = daysAgo(7);
    const since14 = daysAgo(14);
    const usersLast7 = countSince(users, since7);
    const usersPrev7 = Math.max(0, countSince(users, since14) - usersLast7);
    const usersDelta =
      usersPrev7 === 0
        ? usersLast7 > 0
          ? 100
          : 0
        : Math.round(((usersLast7 - usersPrev7) / usersPrev7) * 100);

    return {
      totalUsers,
      activeUsers,
      publishedPages,
      totalTools,
      usersLast7,
      usersDelta,
    };
  }, [users, pages, sections]);

  const series = useMemo(
    () => buildSignupSeries(users, PERIOD_DAYS[period]),
    [users, period],
  );

  // Compteurs pour les tuiles d'action
  const counts = useMemo(
    () => ({
      pages: pages.length,
      users: users.length,
      tools: stats.totalTools,
    }),
    [pages, users, stats.totalTools],
  );

  return (
    <div className="space-y-6">
      {/* Header minimaliste : juste le titre, le statut "Live" est désormais
          porté par le bandeau ApiHealthCheck juste en dessous (plus précis :
          overall vert/orange/rouge basé sur l'état réel des endpoints). */}
      <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>

      {/* Bandeau API status — refresh auto 30 s, dots colorés par endpoint */}
      <ApiHealthCheck />

      {/* Metrics — gros chiffres, labels mini, gradient subtil par accent */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricTile
          value={stats.totalUsers}
          label="Utilisateurs"
          trend={stats.usersDelta}
          accent="primary"
        />
        <MetricTile value={stats.activeUsers} label="Actifs" accent="emerald" />
        <MetricTile value={stats.publishedPages} label="Pages publiées" accent="blue" />
        <MetricTile value={stats.totalTools} label="Outils actifs" accent="amber" />
      </div>

      {/* Tuiles d'action — accès direct visuel aux sections. Hover micro-interactions. */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sections
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <ActionTile href="/admin/bureaux" icon={MapPin} label="Bureaux" accent="violet" />
          <ActionTile
            href="/admin/pages"
            icon={FileText}
            label="Pages"
            count={counts.pages}
            accent="blue"
          />
          <ActionTile href="/admin/documents" icon={FileText} label="Documents" accent="cyan" />
          <ActionTile
            href="/admin/chomage/outils"
            icon={Wrench}
            label="Outils"
            count={counts.tools}
            accent="amber"
          />
          <ActionTile
            href="/admin/chomage/lookup"
            icon={Search}
            label="Lookup ONEM"
            accent="emerald"
          />
          <ActionTile
            href="/admin/partenaires"
            icon={Handshake}
            label="Partenaires"
            accent="rose"
          />
          <ActionTile href="/admin/news" icon={Newspaper} label="Actualités" accent="primary" />
        </div>
      </div>

      {/* Chart + activité — densité visuelle, peu de texte explicatif */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Inscriptions : chart prend 3/5, tabs période en haut */}
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Inscriptions
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">+{stats.usersLast7}</p>
                <p className="text-xs text-muted-foreground">sur 7 jours</p>
              </div>
              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-[11px]">
                {(["7d", "14d", "30d"] as Period[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition-colors",
                      period === p
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <RBarChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
                <defs>
                  <linearGradient id="signups-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 11,
                    padding: "4px 8px",
                  }}
                  labelStyle={{ color: "var(--muted-foreground)" }}
                  formatter={(value) => [value as number, ""]}
                />
                <Bar
                  dataKey="count"
                  fill="url(#signups-gradient)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </RBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activité : 2/5, scroll si beaucoup d'items, texte compact */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Activité
              </p>
              <Link
                href="/admin?view=activity"
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
              >
                Tout <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            {activities.length > 0 ? (
              <ul className="space-y-2.5">
                {activities.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center gap-2.5 text-[12px]">
                    <Avatar size="sm">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(a.user, a.user)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{a.user}</span>{" "}
                      <span className="text-muted-foreground">{a.action}</span>{" "}
                      <span className="font-medium text-foreground/80">{a.resourceName}</span>
                    </p>
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {relativeShort(a.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">Pas d&apos;activité</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
