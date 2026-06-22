"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Flag, Loader2, PauseCircle, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
} from "@/lib/formations/constants";
import type { AdminReportRow } from "@/lib/formations/admin-queries";
import { formatDate } from "../_ui";

type ReportStatus = "new" | "in_progress" | "resolved" | "rejected";

const STATUS_TAB_KEYS: ("all" | ReportStatus)[] = [
  "all",
  "new",
  "in_progress",
  "resolved",
  "rejected",
];

const STATUS_VARIANT: Record<ReportStatus, "warning" | "info" | "success" | "secondary"> = {
  new: "warning",
  in_progress: "info",
  resolved: "success",
  rejected: "secondary",
};

export function SignalementsClient({
  reports,
  counts,
}: {
  reports: AdminReportRow[];
  counts: Record<string, number>;
}) {
  const t = useTranslations("admin.formations");
  const [status, setStatus] = useState<"all" | ReportStatus>("all");

  const filtered = useMemo(
    () =>
      status === "all"
        ? reports
        : reports.filter((r) => r.status === status),
    [reports, status],
  );

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Flag className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("reportsTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("reportsSubtitle", { n: counts.all ?? 0 })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TAB_KEYS.map((key) => {
          const active = status === key;
          const n = counts[key] ?? 0;
          const label =
            key === "all" ? t("filterAll") : REPORT_STATUS_LABELS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {label}
              <span className="tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t("noReport")}
            </CardContent>
          </Card>
        )}
        {filtered.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: AdminReportRow }) {
  const t = useTranslations("admin.formations");
  const router = useRouter();
  const [note, setNote] = useState(report.adminNote ?? "");
  const [busy, setBusy] = useState(false);

  const patch = async (payload: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/formations/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("actionFailed"));
      toast.success(successMsg);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setBusy(false);
    }
  };

  const suspendTraining = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/formations/${report.trainingId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "suspend",
            note: t("suspendFollowingReport", { id: report.id.slice(0, 8) }),
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("actionFailed"));
      toast.success(t("trainingSuspended"));
      await patch(
        { status: "resolved", actionTaken: t("trainingSuspended"), adminNote: note.trim() || undefined },
        t("reportHandled"),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("genericError"));
      setBusy(false);
    }
  };

  const statusKey = report.status as ReportStatus;

  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={STATUS_VARIANT[statusKey] ?? "secondary"} className="text-[10px]">
                {REPORT_STATUS_LABELS[statusKey] ?? report.status}
              </Badge>
              <span className="font-medium">
                {REPORT_REASON_LABELS[
                  report.reason as keyof typeof REPORT_REASON_LABELS
                ] ?? report.reason}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {report.trainingTitle ? (
                <Link
                  href={`/admin/formations?q=${encodeURIComponent(report.trainingTitle)}`}
                  className="hover:underline inline-flex items-center gap-1"
                  prefetch={false}
                >
                  {report.trainingTitle}
                  <ExternalLink className="size-3" />
                </Link>
              ) : (
                <span className="italic">
                  {t("deletedTraining", { id: report.trainingId.slice(0, 8) })}
                </span>
              )}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground shrink-0">
            {formatDate(report.createdAt)}
            {report.reporterEmail && (
              <div className="mt-0.5">{report.reporterEmail}</div>
            )}
          </div>
        </div>

        {report.message && (
          <p className="text-sm rounded-md bg-muted/50 px-3 py-2">
            {report.message}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("internalNote")}
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("reportNotePlaceholder")}
            rows={2}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              patch(
                { status: "in_progress", adminNote: note.trim() || undefined },
                t("markedInProgress"),
              )
            }
          >
            {t("markInProgress")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              patch(
                { status: "resolved", adminNote: note.trim() || undefined },
                t("markedResolved"),
              )
            }
          >
            {t("markResolved")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              patch(
                { status: "rejected", adminNote: note.trim() || undefined },
                t("reportRejected"),
              )
            }
          >
            {t("reject")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={suspendTraining}
            className="text-destructive"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PauseCircle className="size-4" />
            )}
            {t("suspendTraining")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
