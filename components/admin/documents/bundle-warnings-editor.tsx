"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BundleWarning, WarningSeverity } from "@/lib/bundles/types";

interface Props {
  value: BundleWarning[];
  onChange: (next: BundleWarning[]) => void;
}

const SEVERITY_OPTIONS: { value: WarningSeverity; labelKey: "severityInfo" | "severityWarning" | "severityCritical"; emoji: string }[] = [
  { value: "info", labelKey: "severityInfo", emoji: "ℹ️" },
  { value: "warning", labelKey: "severityWarning", emoji: "⚠️" },
  { value: "critical", labelKey: "severityCritical", emoji: "🚨" },
];

function newWarning(): BundleWarning {
  return {
    id: `w_${Math.random().toString(36).slice(2, 10)}`,
    title: "",
    message: "",
    severity: "warning",
  };
}

export function BundleWarningsEditor({ value, onChange }: Props) {
  const t = useTranslations("admin.documents");
  const warnings = value || [];

  function update(idx: number, patch: Partial<BundleWarning>) {
    const next = [...warnings];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  function remove(idx: number) {
    onChange(warnings.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" />
          {t("warningsLabel")}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...warnings, newWarning()])}
        >
          <Plus className="w-3 h-3 mr-1" />
          {t("addWarning")}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        {t("warningsHint")}
      </p>

      {warnings.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t("noWarning")}</p>
      ) : (
        <div className="space-y-2">
          {warnings.map((w, idx) => (
            <div key={w.id} className="border rounded-md p-3 bg-muted/10 space-y-2">
              <div className="flex items-center gap-2">
                <Select
                  value={w.severity}
                  onValueChange={(v) => update(idx, { severity: v as WarningSeverity })}
                >
                  <SelectTrigger className="h-7 text-xs w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.emoji} {t(o.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={w.title}
                  onChange={(e) => update(idx, { title: e.target.value })}
                  placeholder={t("warningTitlePlaceholder")}
                  className="h-7 text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(idx)}
                  className="text-destructive h-7"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Textarea
                value={w.message}
                onChange={(e) => update(idx, { message: e.target.value })}
                placeholder={t("warningMessagePlaceholder")}
                rows={3}
                className="text-xs"
              />
              <Input
                value={w.helpUrl ?? ""}
                onChange={(e) => update(idx, { helpUrl: e.target.value || undefined })}
                placeholder={t("helpUrlPlaceholder")}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
