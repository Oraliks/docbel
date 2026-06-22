"use client";

/**
 * Dialog de création / édition d'une ChatMemory.
 *
 * Form simple : importance (3 options) + textarea content + toggle enabled.
 * Si `editing` est fourni → PATCH, sinon POST.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ChatMemoryListItem,
  MemoryImportance,
} from "@/lib/chomage-ia/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  editing?: ChatMemoryListItem | null;
  onCreated: () => void;
}

export function MemoryFormDialog({
  open,
  onOpenChange,
  domain,
  editing,
  onCreated,
}: Props) {
  const t = useTranslations("admin.chomageIa");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState<MemoryImportance>("medium");
  const [enabled, setEnabled] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setContent(editing?.content ?? "");
      setImportance(editing?.importance ?? "medium");
      setEnabled(editing?.enabled ?? true);
    }
  }, [open, editing]);

  const trimmed = content.trim();
  const canSubmit = trimmed.length >= 3 && trimmed.length <= 2000 && !pending;

  async function handleSubmit() {
    if (!canSubmit) return;
    setPending(true);
    try {
      const url = editing
        ? `/api/chomage-ia/memory/${editing.id}`
        : "/api/chomage-ia/memory";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          importance,
          enabled,
          domain,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success(editing ? t("factUpdated") : t("factAdded"));
      onCreated();
    } catch (e) {
      toast.error(t("saveError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("memoryEditTitle") : t("memoryNewTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("memoryFormDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="memory-content">{t("contentLabel")}</Label>
            <Textarea
              id="memory-content"
              value={content}
              autoFocus
              onChange={(e) => setContent(e.target.value.slice(0, 2000))}
              rows={4}
              placeholder={t("memoryContentPlaceholder")}
              className="min-h-[96px] max-h-64 resize-y text-[13px] leading-relaxed"
            />
            <span className="text-[10.5px] text-muted-foreground tabular-nums text-right">
              {t("charCounter", { count: trimmed.length, max: 2000 })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memory-importance">{t("importanceLabelField")}</Label>
              <Select
                value={importance}
                onValueChange={(v) => setImportance(v as MemoryImportance)}
              >
                <SelectTrigger id="memory-importance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{t("importanceHighNeverTruncated")}</SelectItem>
                  <SelectItem value="medium">{t("importanceMedium")}</SelectItem>
                  <SelectItem value="low">{t("importanceLow")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("statusLabel")}</Label>
              <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className="text-[12px] text-muted-foreground">
                  {enabled ? t("statusEnabled") : t("statusDisabled")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t("saving")}
              </>
            ) : editing ? (
              t("update")
            ) : (
              t("create")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
