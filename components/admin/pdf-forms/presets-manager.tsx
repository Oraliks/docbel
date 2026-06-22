"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SEMANTIC_FIELD_TYPES, FIELD_TYPE_LABELS } from "@/lib/pdf-forms/types";

interface Preset {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  regex: string | null;
  maxLength: number | null;
  builtin: boolean;
  usageCount: number;
}

export function PdfPresetsManager() {
  const t = useTranslations("admin.pdf");
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/pdf/presets")
      .then((r) => r.json())
      .then((d) => setPresets(Array.isArray(d) ? d : []))
      .catch(() => setPresets([]));
  }, []);

  useEffect(() => load(), [load]);

  async function remove(p: Preset) {
    const res = await fetch(`/api/admin/pdf/presets/${p.id}`, { method: "DELETE" });
    if (res.ok) { toast.success(t("toastPresetDeleted")); load(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || t("toastFailure")); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><PlusIcon className="size-4" /> {t("newPreset")}</Button>
      </div>

      {presets === null ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colKey")}</TableHead>
                <TableHead>{t("colLabel")}</TableHead>
                <TableHead>{t("colType")}</TableHead>
                <TableHead className="text-right">{t("colUsage")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {presets.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.key}</TableCell>
                  <TableCell>
                    {p.label}{" "}
                    {p.builtin && <Badge variant="outline" className="ml-1 text-[10px]">{t("builtinBadge")}</Badge>}
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{p.fieldType}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{p.usageCount}</TableCell>
                  <TableCell>
                    {!p.builtin && (
                      <Button variant="ghost" size="icon" onClick={() => remove(p)}>
                        <Trash2Icon className="size-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <NewPresetDialog open={open} onOpenChange={setOpen} onCreated={load} />
    </div>
  );
}

function NewPresetDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("admin.pdf");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [regex, setRegex] = useState("");
  const [maxLength, setMaxLength] = useState("");
  const [errorFr, setErrorFr] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() { setKey(""); setLabel(""); setFieldType("text"); setRegex(""); setMaxLength(""); setErrorFr(""); }

  async function submit() {
    if (!key.trim() || !label.trim()) { toast.error(t("toastKeyLabelRequired")); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/pdf/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: key.trim(), label: label.trim(), fieldType,
          regex: regex.trim() || undefined,
          maxLength: maxLength ? Number(maxLength) : undefined,
          errorMsg: errorFr.trim() ? { fr: errorFr.trim() } : undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d.error || t("toastFailure")); return; }
      toast.success(t("toastPresetCreated"));
      reset(); onOpenChange(false); onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("newPreset")}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-key">{t("keyLabel")}</Label>
              <Input id="p-key" value={key} placeholder="be_custom" onChange={(e) => setKey(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("typeLabel")}</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v ?? "text")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEMANTIC_FIELD_TYPES.map((ft) => <SelectItem key={ft} value={ft}>{FIELD_TYPE_LABELS[ft]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-label">{t("labelLabel")}</Label>
            <Input id="p-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-regex">{t("regexOptionalLabel")}</Label>
              <Input id="p-regex" value={regex} onChange={(e) => setRegex(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-max">{t("maxLengthLabel")}</Label>
              <Input id="p-max" type="number" value={maxLength} onChange={(e) => setMaxLength(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-err">{t("errorMsgFrLabel")}</Label>
            <Input id="p-err" value={errorFr} onChange={(e) => setErrorFr(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2Icon className="size-4 animate-spin" />} {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
