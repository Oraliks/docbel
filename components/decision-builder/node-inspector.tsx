"use client";

/// Inspecteur du nœud sélectionné dans l'éditeur d'arbre. Édite les propriétés
/// + actions structurelles (ajouter/câbler/supprimer), via les helpers PURS de
/// `lib/decision-builder/mutations.ts`. Réutilise `BundleConditionEditor` pour
/// les conditions (les sources = questions ancêtres, valeurs = options).

import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { BundleConditionEditor } from "@/components/admin/documents/bundle-condition-editor";
import { ResultPicker } from "./result-picker";
import {
  addOption,
  AVAILABILITIES,
  branchOptionToNewQuestion,
  branchOptionToNewResult,
  buildConditionSchemas,
  deleteNode,
  listQuestions,
  MATCH_LEVELS,
  patchNode,
  setNodeConditions,
  setOptionNext,
} from "@/lib/decision-builder/mutations";
import {
  CANONICAL_KEYS,
  canonicalValues,
} from "@/lib/parcours/canonical-keys";
import type {
  BundleCondition,
  DecisionTreeContent,
  OptionNode,
  QuestionNode,
  ResultNode,
} from "@/lib/decision-builder/types";

interface Props {
  content: DecisionTreeContent;
  selectedId: string | null;
  onChange: (next: DecisionTreeContent) => void;
  onSelect: (id: string | null) => void;
}

export function NodeInspector({ content, selectedId, onChange, onSelect }: Props) {
  const confirm = useConfirm();
  const node = selectedId ? content.nodes[selectedId] : null;

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Sélectionnez un nœud dans l'arbre pour le modifier.
      </div>
    );
  }

  async function handleDelete() {
    if (!node) return;
    const ok = await confirm({
      title: "Supprimer ce nœud ?",
      description:
        "Les liens qui pointaient vers lui devront être recâblés. Cette action est réversible tant que vous n'avez pas publié.",
      destructive: true,
    });
    if (!ok) return;
    onChange(deleteNode(content, node.id));
    onSelect(null);
  }

  const isRoot = content.rootNodeId === node.id;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {node.type === "question"
            ? "Question"
            : node.type === "option"
              ? "Réponse"
              : "Résultat"}
          {isRoot ? " · racine" : ""}
        </span>
        {!isRoot && (
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {node.type === "question" && (
          <QuestionFields
            content={content}
            node={node}
            onChange={onChange}
            onSelect={onSelect}
          />
        )}
        {node.type === "option" && (
          <OptionFields
            content={content}
            node={node}
            onChange={onChange}
            onSelect={onSelect}
          />
        )}
        {node.type === "result" && (
          <ResultFields content={content} node={node} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Question

function QuestionFields({
  content,
  node,
  onChange,
  onSelect,
}: {
  content: DecisionTreeContent;
  node: QuestionNode;
  onChange: (c: DecisionTreeContent) => void;
  onSelect: (id: string) => void;
}) {
  function update(patch: Partial<QuestionNode>) {
    onChange(patchNode(content, node.id, patch));
  }
  function handleAddOption() {
    const res = addOption(content, node.id, "Nouvelle réponse");
    if (res) onChange(res.content);
  }

  return (
    <>
      <Field label="Question">
        <Textarea
          value={node.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={2}
          placeholder="Quelle est votre situation ?"
        />
      </Field>
      <Field label="Texte d'aide (optionnel)">
        <Textarea
          value={node.helpText ?? ""}
          onChange={(e) => update({ helpText: e.target.value || undefined })}
          rows={2}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Icône (Lucide)">
          <Input
            value={node.icon ?? ""}
            onChange={(e) => update({ icon: e.target.value || undefined })}
            placeholder="Briefcase"
          />
        </Field>
        <Field label="Sous-titre">
          <Input
            value={node.description ?? ""}
            onChange={(e) => update({ description: e.target.value || undefined })}
          />
        </Field>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Réponses ({node.optionIds.length})
          </Label>
          <Button variant="outline" size="sm" onClick={handleAddOption}>
            <Plus className="size-4" /> Ajouter
          </Button>
        </div>
        <div className="space-y-1.5">
          {node.optionIds.map((oid) => {
            const opt = content.nodes[oid];
            if (!opt || opt.type !== "option") return null;
            const target = content.nodes[opt.nextId];
            return (
              <button
                key={oid}
                type="button"
                onClick={() => onSelect(oid)}
                className="group flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-accent/40"
              >
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <ArrowRight className="size-3" />
                  {target
                    ? target.type === "result"
                      ? (target as ResultNode).title
                      : (target as QuestionNode).text
                    : "—"}
                </span>
              </button>
            );
          })}
          {node.optionIds.length === 0 && (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              Aucune réponse. Ajoutez-en une pour créer une branche.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Option

function OptionFields({
  content,
  node,
  onChange,
  onSelect,
}: {
  content: DecisionTreeContent;
  node: OptionNode;
  onChange: (c: DecisionTreeContent) => void;
  onSelect: (id: string) => void;
}) {
  function update(patch: Partial<OptionNode>) {
    onChange(patchNode(content, node.id, patch));
  }

  // Cibles existantes possibles (questions + résultats, sauf via cycle évident).
  const targets = Object.values(content.nodes).filter(
    (n) => n.type === "question" || n.type === "result",
  );

  return (
    <>
      <Field label="Libellé de la réponse">
        <Input
          value={node.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder="J'ai perdu mon emploi"
        />
      </Field>
      <Field label="Texte d'aide (optionnel)">
        <Input
          value={node.helpText ?? ""}
          onChange={(e) => update({ helpText: e.target.value || undefined })}
        />
      </Field>
      <Field label="Icône (Lucide) — réponses de 1er niveau uniquement">
        <Input
          value={node.icon ?? ""}
          onChange={(e) => update({ icon: e.target.value || undefined })}
          placeholder="Briefcase"
        />
      </Field>

      <Field label="Clé canonique (optionnel) — pré-remplit la pré-qualification">
        <div className="flex gap-2">
          <Select
            value={node.canonical?.key ?? ""}
            onValueChange={(k) =>
              update({
                canonical:
                  k && k !== "__none__"
                    ? { key: k, value: canonicalValues(k)[0]?.value ?? "" }
                    : undefined,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Aucune" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Aucune</SelectItem>
              {CANONICAL_KEYS.map((d) => (
                <SelectItem key={d.key} value={d.key}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {node.canonical?.key && (
            <Select
              value={node.canonical.value}
              onValueChange={(v) =>
                update({
                  canonical: { key: node.canonical!.key, value: v ?? "" },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canonicalValues(node.canonical.key).map((val) => (
                  <SelectItem key={val.value} value={val.value}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Field>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Mène à
        </Label>
        <Select
          value={node.nextId}
          onValueChange={(v) => {
            if (v) onChange(setOptionNext(content, node.id, v));
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {targets.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.type === "result"
                  ? `🎯 ${(t as ResultNode).title}`
                  : `❓ ${(t as QuestionNode).text}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              const r = branchOptionToNewQuestion(content, node.id);
              if (r) {
                onChange(r.content);
                onSelect(r.questionId);
              }
            }}
          >
            <Plus className="size-4" /> Nouvelle question
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              const r = branchOptionToNewResult(content, node.id);
              if (r) {
                onChange(r.content);
                onSelect(r.resultId);
              }
            }}
          >
            <Plus className="size-4" /> Nouveau résultat
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelect(node.nextId)}
          className="w-full text-muted-foreground"
        >
          Aller au nœud cible <ArrowRight className="size-3.5" />
        </Button>
      </div>

      <Separator />

      <ConditionsField
        content={content}
        value={node.conditions ?? null}
        onChange={(c) => onChange(setNodeConditions(content, node.id, c))}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result

function ResultFields({
  content,
  node,
  onChange,
}: {
  content: DecisionTreeContent;
  node: ResultNode;
  onChange: (c: DecisionTreeContent) => void;
}) {
  function update(patch: Partial<ResultNode>) {
    onChange(patchNode(content, node.id, patch));
  }

  return (
    <>
      <Field label="Disponibilité">
        <Select
          value={node.availability ?? "disponible"}
          onValueChange={(v) => {
            if (v) update({ availability: v as ResultNode["availability"] });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABILITIES.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Dossier ciblé">
        <ResultPicker
          value={node.bundleSlug}
          onChange={(slug) => update({ bundleSlug: slug })}
        />
      </Field>
      <Field label="Titre du résultat">
        <Input
          value={node.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </Field>
      <Field label="Pourquoi ce dossier ? (explication)">
        <Textarea
          value={node.rationale}
          onChange={(e) => update({ rationale: e.target.value })}
          rows={3}
        />
      </Field>
      <Field label="Étape suivante (optionnel)">
        <Textarea
          value={node.nextStep ?? ""}
          onChange={(e) => update({ nextStep: e.target.value || undefined })}
          rows={2}
          placeholder="Ex. Adressez-vous à votre organisme de paiement…"
        />
      </Field>
      <Field label="Niveau de correspondance">
        <Select
          value={node.matchLevel}
          onValueChange={(v) => {
            if (v) update({ matchLevel: v as ResultNode["matchLevel"] });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATCH_LEVELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <label className="flex items-center justify-between gap-2 rounded-md border px-3 py-2.5">
        <span className="text-sm">Afficher l'estimation d'allocation</span>
        <Switch
          checked={node.allocationEstimate ?? false}
          onCheckedChange={(v) => update({ allocationEstimate: v || undefined })}
        />
      </label>

      <Separator />

      <ConditionsField
        content={content}
        value={node.conditions ?? null}
        onChange={(c) => onChange(setNodeConditions(content, node.id, c))}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Conditions (réutilise BundleConditionEditor)

function ConditionsField({
  content,
  value,
  onChange,
}: {
  content: DecisionTreeContent;
  value: BundleCondition;
  onChange: (c: BundleCondition) => void;
}) {
  const availableSources = listQuestions(content).map((q) => ({
    id: q.id,
    name: q.text,
  }));
  const templateSchemas = buildConditionSchemas(content);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Conditions (optionnel)
      </Label>
      <p className="text-xs text-muted-foreground">
        N'activer ce nœud que si les réponses précédentes correspondent.
      </p>
      <BundleConditionEditor
        value={value}
        onChange={onChange}
        availableSources={availableSources}
        templateSchemas={templateSchemas}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
