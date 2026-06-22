"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, GitBranch, AlertTriangle } from "lucide-react";
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
  type BundleCondition,
  type ConditionGroup,
  type ConditionLeaf,
  type ConditionOp,
  type GroupOp,
  normalizeCondition,
  isFlatAndCondition,
  emptyLeaf,
  emptyGroup,
} from "@/lib/bundles/conditions";

interface SchemaField {
  id: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
}

/// Conservé pour la rétro-compatibilité du composant parent (bundles-admin)
/// qui en importe le type. Représente une feuille V1 (legacy).
export interface ConditionRule {
  sourceTemplateId: string;
  fieldId: string;
  op: string;
  value?: unknown;
}

interface ConditionEditorProps {
  /// Conditions actuelles. Accepte les deux formats (V1 legacy et V2).
  value: BundleCondition;
  /// Toujours réécrit en V2 (groupe AND/OR de feuilles).
  /// `null` signifie "pas de condition" (toujours requis).
  onChange: (next: BundleCondition) => void;
  /// Templates disponibles dans le bundle (sources possibles, hors item courant)
  availableSources: { id: string; name: string }[];
  /// Mapping templateId → schema (pour proposer les fieldId valides)
  templateSchemas: Record<string, SchemaField[]>;
}

const OPS: { value: ConditionOp; labelKey: `op_${ConditionOp}`; needsValue: boolean }[] = [
  { value: "equals", labelKey: "op_equals", needsValue: true },
  { value: "notEquals", labelKey: "op_notEquals", needsValue: true },
  { value: "in", labelKey: "op_in", needsValue: true },
  { value: "notIn", labelKey: "op_notIn", needsValue: true },
  { value: "contains", labelKey: "op_contains", needsValue: true },
  { value: "gt", labelKey: "op_gt", needsValue: true },
  { value: "lt", labelKey: "op_lt", needsValue: true },
  { value: "gte", labelKey: "op_gte", needsValue: true },
  { value: "lte", labelKey: "op_lte", needsValue: true },
  { value: "truthy", labelKey: "op_truthy", needsValue: false },
  { value: "falsy", labelKey: "op_falsy", needsValue: false },
  { value: "isEmpty", labelKey: "op_isEmpty", needsValue: false },
  { value: "isNotEmpty", labelKey: "op_isNotEmpty", needsValue: false },
];

/// Éditeur de conditions d'inclusion d'un item de bundle.
///
/// Mode supporté nativement : groupe **plat** de feuilles, opérateur `AND`
/// ou `OR` au choix. Les conditions imbriquées (mélange AND + OR à plusieurs
/// niveaux) sont gérées par le moteur d'évaluation mais l'édition se fait via
/// un éditeur JSON brut affiché en repli (fallback) — à compléter plus tard.
export function BundleConditionEditor({
  value,
  onChange,
  availableSources,
  templateSchemas,
}: ConditionEditorProps) {
  const t = useTranslations("admin.documents");
  const normalized = useMemo(() => normalizeCondition(value), [value]);
  const isFlat = useMemo(() => isFlatAndCondition(value) || isFlatOrCondition(value), [value]);

  const groupOp: GroupOp = normalized?.type === "or" ? "or" : "and";
  const leaves: ConditionLeaf[] = useMemo(() => {
    if (!normalized) return [];
    if (!isFlat) return [];
    return normalized.rules.filter(
      (r): r is ConditionLeaf => r.type === "leaf"
    );
  }, [normalized, isFlat]);

  function setLeaves(next: ConditionLeaf[], nextOp: GroupOp = groupOp) {
    if (next.length === 0) {
      onChange(null);
      return;
    }
    const group: ConditionGroup = { type: nextOp, rules: next };
    onChange(group);
  }

  function updateLeaf(idx: number, patch: Partial<ConditionLeaf>) {
    const next = [...leaves];
    next[idx] = { ...next[idx], ...patch };
    setLeaves(next);
  }

  function removeLeaf(idx: number) {
    setLeaves(leaves.filter((_, i) => i !== idx));
  }

  function addLeaf() {
    const defaultSource = availableSources[0]?.id || "";
    setLeaves([...leaves, emptyLeaf(defaultSource, "")]);
  }

  function switchGroupOp(nextOp: GroupOp) {
    setLeaves(leaves, nextOp);
  }

  function resetToSimple() {
    onChange(emptyGroup("and"));
  }

  // Fallback : édition JSON brute pour conditions imbriquées
  if (!isFlat && normalized) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t("nestedConditions")}
          </Label>
          <Button type="button" variant="ghost" size="sm" onClick={resetToSimple}>
            {t("convertToSimple")}
          </Button>
        </div>
        <textarea
          value={JSON.stringify(normalized, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              onChange(parsed);
            } catch {
              // ignore parse errors during typing
            }
          }}
          className="font-mono text-xs w-full min-h-[140px] rounded border bg-background p-2"
          spellCheck={false}
        />
        <p className="text-[11px] text-muted-foreground">
          {t("nestedConditionsHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-xs flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5" />
          {t("inclusionConditions")}
          {leaves.length > 0 && (
            <span className="text-muted-foreground">({leaves.length})</span>
          )}
        </Label>
        <div className="flex items-center gap-2">
          {leaves.length >= 2 && (
            <div className="inline-flex rounded-md border bg-background overflow-hidden">
              <button
                type="button"
                onClick={() => switchGroupOp("and")}
                className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  groupOp === "and"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                aria-pressed={groupOp === "and"}
              >
                {t("opAndAll")}
              </button>
              <button
                type="button"
                onClick={() => switchGroupOp("or")}
                className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  groupOp === "or"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
                aria-pressed={groupOp === "or"}
              >
                {t("opOrAny")}
              </button>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLeaf}
            disabled={availableSources.length === 0}
          >
            <Plus className="w-3 h-3 mr-1" />
            {t("add")}
          </Button>
        </div>
      </div>

      {availableSources.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          {t("noSourceHint")}
        </p>
      )}

      {leaves.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("noConditionAlwaysIncluded")}
        </p>
      ) : (
        <div className="space-y-2 border rounded p-2 bg-muted/20">
          {leaves.map((leaf, idx) => {
            const fields = templateSchemas[leaf.sourceTemplateId] || [];
            const selectedField = fields.find((f) => f.id === leaf.fieldId);
            const opSpec = OPS.find((o) => o.value === leaf.op);
            const needsValue = opSpec ? opSpec.needsValue : true;
            return (
              <div
                key={idx}
                className="flex flex-col gap-1.5 p-2 border rounded bg-background"
              >
                <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                  {idx > 0 && <span className="font-bold">{groupOp === "or" ? t("orShort") : t("andShort")}</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-1.5">
                  <Select
                    value={leaf.sourceTemplateId || "__none__"}
                    onValueChange={(v) =>
                      updateLeaf(idx, {
                        sourceTemplateId: !v || v === "__none__" ? "" : v,
                        fieldId: "",
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue placeholder={t("sourceDocument")} />
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
                    value={leaf.fieldId || "__none__"}
                    onValueChange={(v) =>
                      updateLeaf(idx, { fieldId: !v || v === "__none__" ? "" : v })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue placeholder={t("field")} />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          {t("noField")}
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
                    onClick={() => removeLeaf(idx)}
                    className="text-destructive h-8"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  <Select
                    value={leaf.op}
                    onValueChange={(v) => v && updateLeaf(idx, { op: v as ConditionOp })}
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {t(o.labelKey as Parameters<typeof t>[0])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {needsValue && (
                    <>
                      {selectedField?.type === "select" && selectedField.options ? (
                        <Select
                          value={String(leaf.value ?? "__empty__")}
                          onValueChange={(v) =>
                            updateLeaf(idx, { value: !v || v === "__empty__" ? "" : v })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue placeholder={t("expectedValue")} />
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
                          value={String(leaf.value ?? "")}
                          onChange={(e) => updateLeaf(idx, { value: e.target.value })}
                          placeholder={
                            leaf.op === "in" || leaf.op === "notIn"
                              ? t("csvValuePlaceholder")
                              : t("expectedValuePlaceholder")
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

function isFlatOrCondition(condition: BundleCondition): boolean {
  if (!condition) return true;
  if (Array.isArray(condition)) return false;
  const group = normalizeCondition(condition);
  if (!group) return true;
  if (group.type !== "or") return false;
  return group.rules.every((r) => r.type === "leaf");
}
