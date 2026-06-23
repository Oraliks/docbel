"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ITEM_STATUSES,
  labelPriority,
  type ItemPriority,
  type ItemStatus,
} from "@/lib/employeur/constants";
import { SourceBadge } from "./badges";

const PRIORITY_VARIANT: Record<ItemPriority, "default" | "secondary" | "outline"> = {
  obligatoire: "default",
  recommande: "secondary",
  optionnel: "outline",
};

export interface ChecklistItemRowProps {
  id: string;
  title: string;
  description?: string | null;
  priority: ItemPriority;
  initialStatus: ItemStatus;
  tooltip?: string | null;
  sourceCode?: string | null;
  sourceHref?: string;
  sourceTitle?: string;
}

export function ChecklistItemRow({
  id,
  title,
  description,
  priority,
  initialStatus,
  tooltip,
  sourceCode,
  sourceHref,
  sourceTitle,
}: ChecklistItemRowProps) {
  const t = useTranslations("public.pro");
  const [status, setStatus] = useState<ItemStatus>(initialStatus);
  const [saving, setSaving] = useState(false);

  async function updateStatus(next: ItemStatus) {
    const previous = status;
    setStatus(next); // optimiste
    setSaving(true);
    try {
      const res = await fetch(`/api/employeur/checklist-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setStatus(previous); // rollback
      toast.error(t("checklistSaveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start"
      data-status={status}
    >
      <div className="w-full shrink-0 sm:w-44">
        <Select
          value={status}
          onValueChange={(v: string | null) => v && updateStatus(v as ItemStatus)}
          disabled={saving}
        >
          <SelectTrigger size="sm" aria-label={t("checklistStatusAria")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ITEM_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{title}</span>
          <Badge variant={PRIORITY_VARIANT[priority]}>{labelPriority(priority)}</Badge>
          {sourceCode ? (
            <SourceBadge code={sourceCode} href={sourceHref} title={sourceTitle} />
          ) : null}
          {tooltip ? (
            <span title={tooltip} className="inline-flex cursor-help text-muted-foreground">
              <HelpCircle className="size-3.5" aria-label={tooltip} />
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
