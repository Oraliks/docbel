"use client";

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
  const { selectedField, doc, updateField, removeField, isReadOnlyMode } = useVisualEditor();

  if (!selectedField) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Sélectionnez un champ sur le PDF pour modifier ses propriétés. Pour créer un champ, choisissez l’outil
        « Texte » ou « Case », puis dessinez un rectangle.
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
            {f.type === "text" ? "Champ texte" : "Case à cocher"}
          </div>
          <div className="font-medium">{f.name}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeField(f.id)}
          disabled={isReadOnlyMode}
          aria-label="Supprimer le champ"
        >
          <Trash2Icon className="size-4 text-destructive" />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vf-name">Nom AcroForm</Label>
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
        {nameInvalid && <p className="text-xs text-destructive">Nom invalide (a-z, 0-9, _ ou -, max 127).</p>}
        {!nameInvalid && nameTaken && <p className="text-xs text-destructive">Ce nom est déjà utilisé.</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vf-tooltip">Tooltip (info-bulle / TU)</Label>
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
          <Label htmlFor="vf-required" className="text-xs">Requis</Label>
          <Switch
            id="vf-required"
            checked={!!f.required}
            onCheckedChange={(v: boolean) => updateField(f.id, { required: v })}
            disabled={isReadOnlyMode}
          />
        </div>
        <div className="flex items-center justify-between rounded border px-3 py-2">
          <Label htmlFor="vf-readonly" className="text-xs">Lecture seule</Label>
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
            <Label htmlFor="vf-maxlen">Longueur max (MaxLen)</Label>
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
            <Label htmlFor="vf-multiline" className="text-xs">Multiligne</Label>
            <Switch
              id="vf-multiline"
              checked={!!f.multiline}
              onCheckedChange={(v: boolean) => updateField(f.id, { multiline: v })}
              disabled={isReadOnlyMode}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vf-default">Valeur par défaut</Label>
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
          <Label htmlFor="vf-checked" className="text-xs">Cochée par défaut</Label>
          <Switch
            id="vf-checked"
            checked={!!f.defaultChecked}
            onCheckedChange={(v: boolean) => updateField(f.id, { defaultChecked: v })}
            disabled={isReadOnlyMode}
          />
        </div>
      )}

      <div className="rounded border bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
        rect : x={f.rect.x.toFixed(1)} y={f.rect.y.toFixed(1)} w={f.rect.w.toFixed(1)} h={f.rect.h.toFixed(1)} (pt) — page {f.page + 1}
      </div>
    </div>
  );
}
