"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2, GripVertical, HelpCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type {
  EligibilityOption,
  EligibilityQuestion,
  EligibilityVerdict,
} from "@/lib/bundles/eligibility";
import { CANONICAL_KEYS, canonicalValues } from "@/lib/parcours/canonical-keys";

interface Props {
  value: EligibilityQuestion[];
  onChange: (next: EligibilityQuestion[]) => void;
}

const VERDICT_OPTIONS: { value: EligibilityVerdict; labelKey: "verdictEligible" | "verdictNeutral" | "verdictIneligible"; color: string }[] = [
  { value: "eligible", labelKey: "verdictEligible", color: "text-green-700" },
  { value: "neutral", labelKey: "verdictNeutral", color: "text-amber-700" },
  { value: "ineligible", labelKey: "verdictIneligible", color: "text-red-700" },
];

function newQuestion(): EligibilityQuestion {
  return {
    id: `q_${Math.random().toString(36).slice(2, 10)}`,
    label: "",
    type: "boolean",
    verdictTrue: "eligible",
    verdictFalse: "neutral",
  };
}

function newOption(): EligibilityOption {
  return { value: "", label: "", verdict: "neutral" };
}

export function EligibilityQuestionsEditor({ value, onChange }: Props) {
  const t = useTranslations("admin.documents");
  const questions = value || [];

  function updateQ(idx: number, patch: Partial<EligibilityQuestion>) {
    const next = [...questions];
    next[idx] = { ...next[idx], ...patch } as EligibilityQuestion;
    onChange(next);
  }

  function removeQ(idx: number) {
    onChange(questions.filter((_, i) => i !== idx));
  }

  function moveQ(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  function changeType(idx: number, nextType: "boolean" | "select") {
    const q = questions[idx];
    if (nextType === "boolean" && q.type !== "boolean") {
      const updated: EligibilityQuestion = {
        id: q.id,
        label: q.label,
        helpText: q.helpText,
        helpUrl: q.helpUrl,
        canonicalKey: q.canonicalKey,
        type: "boolean",
        verdictTrue: "eligible",
        verdictFalse: "neutral",
      };
      const next = [...questions];
      next[idx] = updated;
      onChange(next);
    } else if (nextType === "select" && q.type !== "select") {
      const updated: EligibilityQuestion = {
        id: q.id,
        label: q.label,
        helpText: q.helpText,
        helpUrl: q.helpUrl,
        canonicalKey: q.canonicalKey,
        type: "select",
        options: [newOption()],
      };
      const next = [...questions];
      next[idx] = updated;
      onChange(next);
    }
  }

  function updateOption(qIdx: number, oIdx: number, patch: Partial<EligibilityOption>) {
    const q = questions[qIdx];
    if (q.type !== "select") return;
    const nextOpts = [...q.options];
    nextOpts[oIdx] = { ...nextOpts[oIdx], ...patch };
    updateQ(qIdx, { ...q, options: nextOpts });
  }

  function addOption(qIdx: number) {
    const q = questions[qIdx];
    if (q.type !== "select") return;
    updateQ(qIdx, { ...q, options: [...q.options, newOption()] });
  }

  function removeOption(qIdx: number, oIdx: number) {
    const q = questions[qIdx];
    if (q.type !== "select") return;
    updateQ(qIdx, { ...q, options: q.options.filter((_, i) => i !== oIdx) });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4" />
          {t("prequalLabel")}
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...questions, newQuestion()])}>
          <Plus className="w-3 h-3 mr-1" />
          {t("addQuestion")}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        {t("prequalHint")}
      </p>

      {questions.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          {t("noQuestion")}
        </p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="border rounded-md p-3 bg-muted/10 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveQ(idx, -1)}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                    title={t("moveUp")}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQ(idx, 1)}
                    disabled={idx === questions.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                    title={t("moveDown")}
                  >
                    ▼
                  </button>
                </div>
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {t("questionN", { n: idx + 1 })}
                </span>
                <Select
                  value={q.type}
                  onValueChange={(v) => changeType(idx, v as "boolean" | "select")}
                >
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boolean">{t("typeBoolean")}</SelectItem>
                    <SelectItem value="select">{t("typeSelect")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQ(idx)}
                  className="text-destructive ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t("questionLabel")}</Label>
                <Input
                  value={q.label}
                  onChange={(e) => updateQ(idx, { label: e.target.value })}
                  placeholder={t("questionPlaceholder")}
                  className="h-8 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("helpTooltipLabel")}</Label>
                  <Textarea
                    value={q.helpText ?? ""}
                    onChange={(e) => updateQ(idx, { helpText: e.target.value || undefined })}
                    placeholder={t("helpTooltipPlaceholder")}
                    rows={2}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("refUrlLabel")}</Label>
                  <Input
                    value={q.helpUrl ?? ""}
                    onChange={(e) => updateQ(idx, { helpUrl: e.target.value || undefined })}
                    placeholder="https://www.actiris.brussels/…"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Clé canonique (optionnel) — pré-remplie depuis l&apos;orientation
                </Label>
                <Select
                  value={q.canonicalKey ?? "__none__"}
                  onValueChange={(k) =>
                    updateQ(idx, { canonicalKey: k && k !== "__none__" ? k : undefined })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">
                      Aucune
                    </SelectItem>
                    {CANONICAL_KEYS.map((d) => (
                      <SelectItem key={d.key} value={d.key} className="text-xs">
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {q.type === "boolean" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("ifAnswerYes")}
                    </Label>
                    <Select
                      value={q.verdictTrue}
                      onValueChange={(v) => updateQ(idx, { verdictTrue: v as EligibilityVerdict })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VERDICT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">
                            {t(o.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("ifAnswerNo")}
                    </Label>
                    <Select
                      value={q.verdictFalse}
                      onValueChange={(v) => updateQ(idx, { verdictFalse: v as EligibilityVerdict })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VERDICT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">
                            {t(o.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Valeur canon. si « oui »
                    </Label>
                    <Select
                      value={q.canonicalTrue ?? ""}
                      onValueChange={(v) => updateQ(idx, { canonicalTrue: v || undefined })}
                      disabled={!q.canonicalKey}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {canonicalValues(q.canonicalKey ?? "").map((val) => (
                          <SelectItem key={val.value} value={val.value} className="text-xs">
                            {val.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Valeur canon. si « non »
                    </Label>
                    <Select
                      value={q.canonicalFalse ?? ""}
                      onValueChange={(v) => updateQ(idx, { canonicalFalse: v || undefined })}
                      disabled={!q.canonicalKey}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {canonicalValues(q.canonicalKey ?? "").map((val) => (
                          <SelectItem key={val.value} value={val.value} className="text-xs">
                            {val.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-1 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t("answerOptions")}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addOption(idx)}
                    >
                      <Plus className="w-3 h-3 mr-1" /> {t("option")}
                    </Button>
                  </div>
                  {q.options.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">
                      {t("addAtLeastOneOption")}
                    </p>
                  )}
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="grid grid-cols-[1fr_1fr_140px_150px_auto] gap-1.5">
                      <Input
                        value={opt.value}
                        onChange={(e) => updateOption(idx, oIdx, { value: e.target.value })}
                        placeholder={t("optionValuePlaceholder")}
                        className="h-7 text-xs font-mono"
                      />
                      <Input
                        value={opt.label}
                        onChange={(e) => updateOption(idx, oIdx, { label: e.target.value })}
                        placeholder={t("optionLabelPlaceholder")}
                        className="h-7 text-xs"
                      />
                      <Select
                        value={opt.verdict}
                        onValueChange={(v) => updateOption(idx, oIdx, { verdict: v as EligibilityVerdict })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VERDICT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">
                              {t(o.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={opt.canonicalValue ?? ""}
                        onValueChange={(v) =>
                          updateOption(idx, oIdx, { canonicalValue: v || undefined })
                        }
                        disabled={!q.canonicalKey}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Valeur canon." />
                        </SelectTrigger>
                        <SelectContent>
                          {canonicalValues(q.canonicalKey ?? "").map((val) => (
                            <SelectItem key={val.value} value={val.value} className="text-xs">
                              {val.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(idx, oIdx)}
                        className="text-destructive h-7"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
