"use client";

import { Plus, Trash2, GitBranch } from "lucide-react";
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

interface SchemaField {
  id: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
}

export interface ConditionRule {
  sourceTemplateId: string;
  fieldId: string;
  op: string; // equals | notEquals | in | contains | truthy | falsy
  value?: unknown;
}

interface ConditionEditorProps {
  /// Conditions actuelles sur cet item (null = toujours requis)
  value: ConditionRule[] | null;
  onChange: (next: ConditionRule[] | null) => void;
  /// Templates disponibles dans le bundle (sources possibles, hors item courant)
  availableSources: { id: string; name: string }[];
  /// Mapping templateId → schema (pour proposer les fieldId valides)
  templateSchemas: Record<string, SchemaField[]>;
}

const OPS = [
  { value: "equals", label: "=" },
  { value: "notEquals", label: "≠" },
  { value: "in", label: "∈ (dans la liste)" },
  { value: "contains", label: "contient" },
  { value: "truthy", label: "est cochée / vrai" },
  { value: "falsy", label: "n'est pas cochée / faux" },
];

const NEEDS_VALUE_OPS = ["equals", "notEquals", "in", "contains"];

export function BundleConditionEditor({
  value,
  onChange,
  availableSources,
  templateSchemas,
}: ConditionEditorProps) {
  const rules = value || [];

  function updateRule(idx: number, patch: Partial<ConditionRule>) {
    const next = [...rules];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  function removeRule(idx: number) {
    const next = rules.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : null);
  }

  function addRule() {
    const defaultSource = availableSources[0]?.id || "";
    onChange([
      ...rules,
      { sourceTemplateId: defaultSource, fieldId: "", op: "equals", value: "" },
    ]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5" />
          Conditions d&apos;inclusion
          {rules.length > 0 && (
            <span className="text-muted-foreground">({rules.length})</span>
          )}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addRule}
          disabled={availableSources.length === 0}
        >
          <Plus className="w-3 h-3 mr-1" />
          Ajouter
        </Button>
      </div>

      {availableSources.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Ajoutez d&apos;autres documents au bundle pour pouvoir définir des conditions basées sur
          leurs réponses.
        </p>
      )}

      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aucune condition — ce document est toujours inclus.
        </p>
      ) : (
        <div className="space-y-2 border rounded p-2 bg-muted/20">
          {rules.map((rule, idx) => {
            const fields = templateSchemas[rule.sourceTemplateId] || [];
            const selectedField = fields.find((f) => f.id === rule.fieldId);
            const needsValue = NEEDS_VALUE_OPS.includes(rule.op);
            return (
              <div
                key={idx}
                className="flex flex-col gap-1.5 p-2 border rounded bg-background"
              >
                <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                  {idx > 0 && <span className="font-bold">ET</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-1.5">
                  <Select
                    value={rule.sourceTemplateId || "__none__"}
                    onValueChange={(v) =>
                      updateRule(idx, {
                        sourceTemplateId: v === "__none__" ? "" : v,
                        fieldId: "",
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue placeholder="Document source" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSources.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={rule.fieldId || "__none__"}
                    onValueChange={(v) =>
                      updateRule(idx, { fieldId: v === "__none__" ? "" : v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue placeholder="Champ" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          (aucun champ)
                        </SelectItem>
                      ) : (
                        fields.map((f) => (
                          <SelectItem key={f.id} value={f.id} className="text-xs">
                            {f.label}{" "}
                            <span className="text-muted-foreground ml-1">
                              ({f.type})
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRule(idx)}
                    className="text-destructive h-8"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  <Select
                    value={rule.op}
                    onValueChange={(v) => v && updateRule(idx, { op: v })}
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {needsValue && (
                    <>
                      {selectedField?.type === "select" && selectedField.options ? (
                        <Select
                          value={String(rule.value ?? "__empty__")}
                          onValueChange={(v) =>
                            updateRule(idx, { value: v === "__empty__" ? "" : v })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue placeholder="Valeur attendue" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedField.options.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={String(rule.value ?? "")}
                          onChange={(e) => updateRule(idx, { value: e.target.value })}
                          placeholder={
                            rule.op === "in"
                              ? "valeur1,valeur2 (CSV)"
                              : "valeur attendue"
                          }
                          className="h-8 text-xs"
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
