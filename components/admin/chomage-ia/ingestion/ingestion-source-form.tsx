"use client";

/**
 * Dialog create/edit IngestionSource. Form 4 champs : name, kind, url, schedule.
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INGESTION_KINDS,
  INGESTION_SCHEDULES,
  type IngestionKind,
  type IngestionSchedule,
  type IngestionSourceListItem,
} from "@/lib/chomage-ia/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: IngestionSourceListItem | null;
  onSaved: () => void;
}

export function IngestionSourceForm({
  open,
  onOpenChange,
  editing,
  onSaved,
}: Props) {
  const t = useTranslations("admin.chomageIa");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<IngestionKind>("scrape");
  const [url, setUrl] = useState("");
  const [schedule, setSchedule] = useState<IngestionSchedule>("daily");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setKind(editing?.kind ?? "scrape");
      setUrl(editing?.url ?? "");
      setSchedule(editing?.schedule ?? "daily");
    }
  }, [open, editing]);

  const trimmedUrl = url.trim();
  const trimmedName = name.trim();
  const validUrl = /^https?:\/\//i.test(trimmedUrl);
  const canSubmit =
    trimmedName.length >= 2 && validUrl && !pending;

  async function handleSubmit() {
    if (!canSubmit) return;
    setPending(true);
    try {
      const apiUrl = editing
        ? `/api/chomage-ia/ingestion/sources/${editing.id}`
        : "/api/chomage-ia/ingestion/sources";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(apiUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          kind,
          url: trimmedUrl,
          schedule,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success(editing ? t("sourceUpdated") : t("watchSourceCreated"));
      onSaved();
      onOpenChange(false);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("watchSourceEditTitle") : t("watchSourceNewTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("watchSourceFormDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ing-name">{t("nameLabel")}</Label>
            <Input
              id="ing-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value.slice(0, 120))}
              placeholder={t("ingNamePlaceholder")}
              className="h-9 text-[12.5px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ing-kind">{t("typeLabel")}</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as IngestionKind)}
              >
                <SelectTrigger id="ing-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INGESTION_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t("ingestionKind", { kind: k })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ing-schedule">{t("frequencyLabel")}</Label>
              <Select
                value={schedule}
                onValueChange={(v) => setSchedule(v as IngestionSchedule)}
              >
                <SelectTrigger id="ing-schedule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INGESTION_SCHEDULES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t("ingestionSchedule", { schedule: s })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ing-url">{t("urlLabel")}</Label>
            <Input
              id="ing-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value.slice(0, 2000))}
              placeholder="https://www.onem.be/…"
              className="h-9 text-[12.5px]"
            />
            <span className="text-[10.5px] text-muted-foreground">
              {t("watchSourceUrlHint")}
            </span>
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
