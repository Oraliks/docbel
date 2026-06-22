"use client";

import { useTranslations } from "next-intl";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useVisualEditor } from "./provider/visual-editor-context";
import { FIELD_NAME_RE, isNameAvailable } from "@/lib/pdf-forms/visual/validation";

/// Panel propriétés du champ sélectionné. Si rien n'est sélectionné, affiche
/// une aide rapide à la place. Les saisies sont appliquées on-blur pour ne
/// pas spammer le reducer à chaque keystroke.
export function VisualFieldProperties() {
  const t = useTranslations("admin.pdf");
  const { selectedField, doc, updateField, removeField, isReadOnlyMode } = useVisualEditor();

  if (!selectedField) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {t("propsEmptyHint")}
      </div>
    );
  }

  const f = selectedField;
  const nameInvalid = !FIELD_NAME_RE.test(f.name);
  const nameTaken = !isNameAvailable(doc, f.name, f.id);

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {f.type === "text" ? t("fieldTypeText") : t("fieldTypeCheckbox")}
          </div>
          <div className="font-medium">{f.name}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeField(f.id)}
          disabled={isReadOnlyMode}
          aria-label={t("removeFieldAria")}
        >
          <Trash2Icon className="size-4 text-destructive" />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vf-name">{t("acroFormName")}</Label>
        <Input
          id="vf-name"
          defaultValue={f.name}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== f.name) updateField(f.id, { name: next });
          }}
          disabled={isReadOnlyMode}
          aria-invalid={nameInvalid || nameTaken}
        />
        {nameInvalid && <p className="text-xs text-destructive">{t("nameInvalid")}</p>}
        {!nameInvalid && nameTaken && <p className="text-xs text-destructive">{t("nameTaken")}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vf-tooltip">{t("tooltipLabel")}</Label>
        <Textarea
          id="vf-tooltip"
          rows={2}
          defaultValue={f.tooltip ?? ""}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== (f.tooltip ?? "")) updateField(f.id, { tooltip: next || undefined });
          }}
          disabled={isReadOnlyMode}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded border px-3 py-2">
          <Label htmlFor="vf-required" className="text-xs">{t("requiredShort")}</Label>
          <Switch
            id="vf-required"
            checked={!!f.required}
            onCheckedChange={(v: boolean) => updateField(f.id, { required: v })}
            disabled={isReadOnlyMode}
          />
        </div>
        <div className="flex items-center justify-between rounded border px-3 py-2">
          <Label htmlFor="vf-readonly" className="text-xs">{t("readOnlyLabel")}</Label>
          <Switch
            id="vf-readonly"
            checked={!!f.readOnly}
            onCheckedChange={(v: boolean) => updateField(f.id, { readOnly: v })}
            disabled={isReadOnlyMode}
          />
        </div>
      </div>

      {f.type === "text" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vf-maxlen">{t("maxLenLabel")}</Label>
            <Input
              id="vf-maxlen"
              type="number"
              min={1}
              max={10000}
              defaultValue={f.maxLen ?? ""}
              onBlur={(e) => {
                const v = e.target.value === "" ? undefined : Math.max(1, Math.min(10000, parseInt(e.target.value, 10) || 1));
                updateField(f.id, { maxLen: v });
              }}
              disabled={isReadOnlyMode}
            />
          </div>
          <div className="flex items-center justify-between rounded border px-3 py-2">
            <Label htmlFor="vf-multiline" className="text-xs">{t("multilineLabel")}</Label>
            <Switch
              id="vf-multiline"
              checked={!!f.multiline}
              onCheckedChange={(v: boolean) => updateField(f.id, { multiline: v })}
              disabled={isReadOnlyMode}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vf-default">{t("defaultValueLabel")}</Label>
            <Input
              id="vf-default"
              defaultValue={f.defaultValue ?? ""}
              onBlur={(e) => updateField(f.id, { defaultValue: e.target.value || undefined })}
              disabled={isReadOnlyMode}
            />
          </div>
        </>
      )}

      {f.type === "checkbox" && (
        <div className="flex items-center justify-between rounded border px-3 py-2">
          <Label htmlFor="vf-checked" className="text-xs">{t("defaultCheckedLabel")}</Label>
          <Switch
            id="vf-checked"
            checked={!!f.defaultChecked}
            onCheckedChange={(v: boolean) => updateField(f.id, { defaultChecked: v })}
            disabled={isReadOnlyMode}
          />
        </div>
      )}

      <div className="rounded border bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
        {t("rectReadout", {
          x: f.rect.x.toFixed(1),
          y: f.rect.y.toFixed(1),
          w: f.rect.w.toFixed(1),
          h: f.rect.h.toFixed(1),
          page: f.page + 1,
        })}
      </div>
    </div>
  );
}
