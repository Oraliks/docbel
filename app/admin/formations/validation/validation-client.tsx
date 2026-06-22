"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ShieldCheck,
  CheckCircle2,
  Send,
  PencilLine,
  XCircle,
  PauseCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  VISIBILITY_LABELS,
  PRICE_TYPE_LABELS,
} from "@/lib/formations/constants";
import type { AdminTrainingRow } from "@/lib/formations/admin-queries";
import { StatusBadge, formatDate, formatPrice } from "../_ui";

type ReviewAction =
  | "approve"
  | "publish"
  | "request_changes"
  | "reject"
  | "suspend";

/** Action → clé i18n du libellé de bouton. */
const ACTION_LABEL_KEYS: Record<ReviewAction, string> = {
  approve: "actionApprove",
  publish: "actionPublish",
  request_changes: "actionRequestChanges",
  reject: "actionReject",
  suspend: "actionSuspend",
};

/** Actions qui exigent une note (obligatoire en prod). */
const NOTE_REQUIRED: ReviewAction[] = ["request_changes", "reject"];

export function ValidationClient({ rows }: { rows: AdminTrainingRow[] }) {
  const t = useTranslations("admin.formations");
  const router = useRouter();
  const [items, setItems] = useState(rows);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <Header count={0} />
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <ShieldCheck className="mx-auto mb-3 size-8 opacity-40" />
            {t("validationEmpty")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <Header count={items.length} />
      <div className="flex flex-col gap-4">
        {items.map((t) => (
          <ReviewCard
            key={t.id}
            training={t}
            onDone={(id) => {
              setItems((prev) => prev.filter((x) => x.id !== id));
              router.refresh();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Header({ count }: { count: number }) {
  const t = useTranslations("admin.formations");
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ShieldCheck className="size-5" />
      </span>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("validationQueue")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("validationSubtitle", { n: count })}
        </p>
      </div>
    </div>
  );
}

function ReviewCard({
  training,
  onDone,
}: {
  training: AdminTrainingRow;
  onDone: (id: string) => void;
}) {
  const t = useTranslations("admin.formations");
  const [activeAction, setActiveAction] = useState<ReviewAction | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const actionLabel = (action: ReviewAction) =>
    t(ACTION_LABEL_KEYS[action] as Parameters<typeof t>[0]);

  const submit = async (action: ReviewAction) => {
    if (NOTE_REQUIRED.includes(action) && !note.trim()) {
      toast.error(t("noteRequiredError"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/formations/${training.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("actionFailed"));
      toast.success(t("actionDone", { action: actionLabel(action) }));
      onDone(training.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const ACTIONS: { action: ReviewAction; icon: React.ReactNode; variant: "default" | "outline" | "destructive" }[] = [
    { action: "approve", icon: <CheckCircle2 className="size-4" />, variant: "outline" },
    { action: "publish", icon: <Send className="size-4" />, variant: "default" },
    { action: "request_changes", icon: <PencilLine className="size-4" />, variant: "outline" },
    { action: "reject", icon: <XCircle className="size-4" />, variant: "destructive" },
    { action: "suspend", icon: <PauseCircle className="size-4" />, variant: "outline" },
  ];

  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-3">
        {/* Titre + meta */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold leading-tight">{training.title}</h2>
              <StatusBadge status={training.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {training.organization?.name ?? t("unknownOrganization")}
              {training.category ? ` · ${training.category.name}` : ""}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground shrink-0">
            {t("submittedOn", { date: formatDate(training.submittedAt) })}
          </div>
        </div>

        {/* Détails */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">
            {t("visibilityLabel")}{" "}
            {VISIBILITY_LABELS[
              training.visibility as keyof typeof VISIBILITY_LABELS
            ] ?? training.visibility}
          </Badge>
          <Badge variant="secondary">
            {training.priceType === "free"
              ? PRICE_TYPE_LABELS.free
              : formatPrice(training.priceAmount, training.currency)}
          </Badge>
          <Badge variant="secondary">
            {t("sessionsCount", { n: training.sessionsCount })}
          </Badge>
          {training.tags.map((tag) => (
            <Badge key={tag.slug} variant="outline">
              {tag.name}
            </Badge>
          ))}
        </div>

        {training.adminReviewNote && (
          <p className="text-xs rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-2.5 py-1.5 text-amber-800 dark:text-amber-300">
            {t("lastReviewNote", { note: training.adminReviewNote })}
          </p>
        )}

        {/* Note (visible quand une action est sélectionnée) */}
        {activeAction && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {NOTE_REQUIRED.includes(activeAction)
                ? t("noteLabelRequired")
                : t("noteLabelOptional")}
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                activeAction === "reject"
                  ? t("notePlaceholderReject")
                  : activeAction === "request_changes"
                    ? t("notePlaceholderRequestChanges")
                    : t("notePlaceholderInternal")
              }
              rows={3}
            />
          </div>
        )}

        {/* Boutons d'action */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {ACTIONS.map(({ action, icon, variant }) => {
            const isActive = activeAction === action;
            return (
              <Button
                key={action}
                size="sm"
                variant={isActive ? variant : "outline"}
                disabled={submitting}
                onClick={() => {
                  if (isActive) {
                    void submit(action);
                  } else {
                    setActiveAction(action);
                  }
                }}
                className={
                  variant === "destructive" && isActive
                    ? "text-destructive"
                    : undefined
                }
              >
                {icon}
                {isActive
                  ? t("confirmAction", { action: actionLabel(action) })
                  : actionLabel(action)}
              </Button>
            );
          })}
          {activeAction && (
            <Button
              size="sm"
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                setActiveAction(null);
                setNote("");
              }}
            >
              {t("cancel")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
