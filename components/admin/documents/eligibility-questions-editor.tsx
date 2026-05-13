"use client";

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

interface Props {
  value: EligibilityQuestion[];
  onChange: (next: EligibilityQuestion[]) => void;
}

const VERDICT_OPTIONS: { value: EligibilityVerdict; label: string; color: string }[] = [
  { value: "eligible", label: "→ Éligible", color: "text-green-700" },
  { value: "neutral", label: "→ Neutre", color: "text-amber-700" },
  { value: "ineligible", label: "→ Non éligible", color: "text-red-700" },
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
          Pré-qualification (informatif)
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...questions, newQuestion()])}>
          <Plus className="w-3 h-3 mr-1" />
          Ajouter une question
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        Questions posées AVANT le parcours pour orienter le citoyen. Le résultat
        est purement indicatif — le parcours est toujours accessible même en
        verdict défavorable.
      </p>

      {questions.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Aucune question. Ce bundle ne montrera pas de pré-qualification.
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
                    title="Monter"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQ(idx, 1)}
                    disabled={idx === questions.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                    title="Descendre"
                  >
                    ▼
                  </button>
                </div>
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Question {idx + 1}
                </span>
                <Select
                  value={q.type}
                  onValueChange={(v) => changeType(idx, v as "boolean" | "select")}
                >
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boolean">Oui / Non</SelectItem>
                    <SelectItem value="select">Choix multiple</SelectItem>
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
                <Label className="text-xs">Question</Label>
                <Input
                  value={q.label}
                  onChange={(e) => updateQ(idx, { label: e.target.value })}
                  placeholder="Êtes-vous inscrit comme demandeur d'emploi chez Actiris ?"
                  className="h-8 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Aide (info-bulle)</Label>
                  <Textarea
                    value={q.helpText ?? ""}
                    onChange={(e) => updateQ(idx, { helpText: e.target.value || undefined })}
                    placeholder="Vous devez être inscrit sur actiris.brussels…"
                    rows={2}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">URL référence (optionnel)</Label>
                  <Input
                    value={q.helpUrl ?? ""}
                    onChange={(e) => updateQ(idx, { helpUrl: e.target.value || undefined })}
                    placeholder="https://www.actiris.brussels/…"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {q.type === "boolean" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Si réponse = Oui
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
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Si réponse = Non
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
                            {o.label}
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
                      Options de réponse
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addOption(idx)}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Option
                    </Button>
                  </div>
                  {q.options.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Ajoutez au moins une option.
                    </p>
                  )}
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="grid grid-cols-[1fr_1fr_140px_auto] gap-1.5">
                      <Input
                        value={opt.value}
                        onChange={(e) => updateOption(idx, oIdx, { value: e.target.value })}
                        placeholder="valeur"
                        className="h-7 text-xs font-mono"
                      />
                      <Input
                        value={opt.label}
                        onChange={(e) => updateOption(idx, oIdx, { label: e.target.value })}
                        placeholder="Libellé"
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
                              {o.label}
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
