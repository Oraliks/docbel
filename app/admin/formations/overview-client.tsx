"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { GraduationCap, Search, ShieldCheck, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TRAINING_STATUSES,
  TRAINING_STATUS_LABELS,
  VISIBILITY_LABELS,
  PRICE_TYPE_LABELS,
  type TrainingStatus,
} from "@/lib/formations/constants";
import type { AdminTrainingRow } from "@/lib/formations/admin-queries";
import { StatusBadge, formatDate, formatPrice } from "./_ui";

interface Props {
  rows: AdminTrainingRow[];
  counts: {
    total: number;
    byStatus: Record<TrainingStatus, number>;
    privateInternal: number;
    organizations: number;
  };
}

type StatusFilter = TrainingStatus | "all";

export function FormationsOverviewClient({ rows, counts }: Props) {
  const t = useTranslations("admin.formations");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.organization?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, status, search]);

  const tabs: StatusFilter[] = ["all", ...TRAINING_STATUSES];

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <GraduationCap className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("overviewSubtitle", { n: counts.total })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            render={<Link href="/admin/formations/validation" prefetch={false} />}
            variant="outline"
            size="sm"
          >
            <ShieldCheck className="size-4" />
            {t("validationQueue")}
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label={t("statTotal")} value={counts.total} />
        <StatCard
          label={t("statPendingReview")}
          value={counts.byStatus.pending_review}
          tone={counts.byStatus.pending_review ? "warn" : "muted"}
          href="/admin/formations/validation"
        />
        <StatCard
          label={t("statPublished")}
          value={counts.byStatus.published}
          tone="success"
        />
        <StatCard
          label={t("statPrivateInternal")}
          value={counts.privateInternal}
          tone="info"
        />
        <StatCard
          label={t("statOrganizations")}
          value={counts.organizations}
          icon={<Building2 className="size-4" />}
          href="/admin/formations/permissions"
        />
      </div>

      {/* Filtres : tabs statut + recherche */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={t("searchTrainingPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((s) => {
              const active = status === s;
              const n =
                s === "all" ? counts.total : counts.byStatus[s as TrainingStatus];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {s === "all" ? t("filterAll") : TRAINING_STATUS_LABELS[s as TrainingStatus]}
                  <span className="tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colTraining")}</TableHead>
              <TableHead>{t("colOrganization")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead>{t("colVisibility")}</TableHead>
              <TableHead>{t("colPrice")}</TableHead>
              <TableHead className="text-right">{t("colSessions")}</TableHead>
              <TableHead>{t("colUpdatedAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {t("noTrainingMatch")}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-[360px]">
                  <Link
                    href="/admin/formations/validation"
                    className="font-medium hover:underline line-clamp-1"
                    prefetch={false}
                  >
                    {r.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {r.isVerifiedByDocbel && (
                      <Badge variant="success" className="text-[10px]">
                        {t("badgeVerifiedDocbel")}
                      </Badge>
                    )}
                    {r.isDocbelRecommended && (
                      <Badge variant="info" className="text-[10px]">
                        {t("badgeRecommended")}
                      </Badge>
                    )}
                    {r.isFeatured && (
                      <Badge variant="warning" className="text-[10px]">
                        {t("badgeFeatured")}
                      </Badge>
                    )}
                    {r.category && (
                      <span className="text-[11px] text-muted-foreground">
                        {r.category.name}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                  {r.organization?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {VISIBILITY_LABELS[
                    r.visibility as keyof typeof VISIBILITY_LABELS
                  ] ?? r.visibility}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.priceType === "free"
                    ? PRICE_TYPE_LABELS.free
                    : formatPrice(r.priceAmount, r.currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {r.sessionsCount}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(r.updatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
  icon,
  href,
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "muted" | "info" | "warn" | "error";
  icon?: React.ReactNode;
  href?: string;
}) {
  const toneClass: Record<NonNullable<typeof tone>, string> = {
    default: "border-border",
    success: "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/10",
    muted: "border-border bg-muted/30",
    info: "border-blue-300 bg-blue-50/40 dark:bg-blue-950/10",
    warn: "border-amber-300 bg-amber-50/40 dark:bg-amber-950/10",
    error: "border-red-300 bg-red-50/40 dark:bg-red-950/10",
  };
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {value.toLocaleString("fr-BE")}
        </div>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </>
  );
  const cls = `block text-left rounded-lg border p-3 transition ${toneClass[tone]} ${
    href ? "hover:border-primary cursor-pointer" : ""
  }`;
  return href ? (
    <Link href={href} prefetch={false} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
