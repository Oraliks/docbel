"use client";

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

const SEVERITY_OPTIONS: { value: WarningSeverity; label: string; emoji: string }[] = [
  { value: "info", label: "Information", emoji: "ℹ️" },
  { value: "warning", label: "Avertissement", emoji: "⚠️" },
  { value: "critical", label: "Critique", emoji: "🚨" },
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
          Avertissements
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...warnings, newWarning()])}
        >
          <Plus className="w-3 h-3 mr-1" />
          Ajouter un avertissement
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        Affichés en haut du parcours. Utile pour les pièges courants (ex. EC32
        à installer dans le mois).
      </p>

      {warnings.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucun avertissement.</p>
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
                        {o.emoji} {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={w.title}
                  onChange={(e) => update(idx, { title: e.target.value })}
                  placeholder="Délai critique — carte EC32"
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
                placeholder="Installez l'application EC32 dès le démarrage du dossier — sinon l'indemnisation rétroactive est limitée à 1 mois."
                rows={3}
                className="text-xs"
              />
              <Input
                value={w.helpUrl ?? ""}
                onChange={(e) => update(idx, { helpUrl: e.target.value || undefined })}
                placeholder="URL d'aide (optionnel)"
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
