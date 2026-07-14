"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Lightbulb,
  Save,
  RotateCcw,
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Locale } from "@/lib/pdf-forms/types";
import type {
  FormContextTips,
  LocalizedText,
  TipCondition,
  TipEntry,
} from "@/lib/form-context-tips";

export type FormEditorMeta = {
  slug: string;
  title: string;
  /// Champs cases à cocher (seuls valides pour une condition `field-checked`).
  fields: { id: string; label: string }[];
  /// Clés de section distinctes du formulaire (pour une condition `section`).
  sections: string[];
};

type Props = {
  initialDict: FormContextTips;
  forms: FormEditorMeta[];
  updatedAt: string | null;
  updatedByName: string | null;
};

const LOCALES: Locale[] = ["fr", "nl", "de"];
const LOCALE_LABEL: Record<Locale, string> = { fr: "FR", nl: "NL", de: "DE" };

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return `tip-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function emptyEntry(defaultFieldId: string | undefined): TipEntry {
  return {
    id: newId(),
    when: defaultFieldId
      ? { type: "field-checked", fieldId: defaultFieldId }
      : { type: "always" },
    title: { fr: "" },
    reminders: [],
  };
}

export function ConseilsClient({
  initialDict,
  forms,
  updatedAt,
  updatedByName,
}: Props) {
  const [base, setBase] = useState<FormContextTips>(initialDict);
  const [draft, setDraft] = useState<FormContextTips>(initialDict);
  const [saving, setSaving] = useState(false);
  const [activeLocale, setActiveLocale] = useState<Locale>("fr");
  const [meta, setMeta] = useState<{ at: string | null; by: string | null }>({
    at: updatedAt,
    by: updatedByName,
  });

  // Formulaire sélectionné : par défaut le premier qui a déjà des conseils,
  // sinon le premier de la liste.
  const [selectedSlug, setSelectedSlug] = useState<string>(() => {
    const withEntries = forms.find((f) => (initialDict[f.slug]?.entries?.length ?? 0) > 0);
    return withEntries?.slug ?? forms[0]?.slug ?? "";
  });

  const dirty = useMemo(
    () => JSON.stringify(base) !== JSON.stringify(draft),
    [base, draft],
  );

  const selectedForm = forms.find((f) => f.slug === selectedSlug);
  const entries = draft[selectedSlug]?.entries ?? [];

  // ---- updaters immuables sur le formulaire sélectionné -------------------
  function setEntries(next: TipEntry[]) {
    setDraft((d) => ({ ...d, [selectedSlug]: { entries: next } }));
  }
  function updateEntry(idx: number, next: TipEntry) {
    setEntries(entries.map((e, i) => (i === idx ? next : e)));
  }
  function addEntry() {
    setEntries([...entries, emptyEntry(selectedForm?.fields[0]?.id)]);
  }
  function deleteEntry(idx: number) {
    setEntries(entries.filter((_, i) => i !== idx));
  }
  function moveEntry(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[idx], next[target]] = [next[target], next[idx]];
    setEntries(next);
  }

  function validate(): string | null {
    for (const [slug, form] of Object.entries(draft)) {
      for (const e of form.entries) {
        if (!e.title.fr?.trim()) return `Un conseil de « ${slug} » n'a pas de titre (FR).`;
        if (e.when.type === "field-checked" && !e.when.fieldId?.trim())
          return `Un conseil de « ${slug} » (condition « motif coché ») n'a pas de champ.`;
        if (e.when.type === "section" && !e.when.sectionKey?.trim())
          return `Un conseil de « ${slug} » (condition « étape ») n'a pas de clé de section.`;
      }
    }
    return null;
  }

  async function save() {
    if (!dirty || saving) return;
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/form-context-tips", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Échec de l'enregistrement");
      const saved = data.tips as FormContextTips;
      setBase(saved);
      setDraft(saved);
      setMeta({ at: new Date().toISOString(), by: meta.by ?? "vous" });
      toast.success("Conseils enregistrés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  const metaLine =
    meta.at != null
      ? `Modifié ${meta.by ? `par ${meta.by} ` : ""}le ${new Date(meta.at).toLocaleString(
          "fr-BE",
          { dateStyle: "long", timeStyle: "short" },
        )}`
      : "Aucune modification enregistrée (contenu par défaut du code).";

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6 pb-24">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lightbulb className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Conseils des formulaires</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{metaLine}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {LOCALES.map((l) => (
            <Button
              key={l}
              size="sm"
              variant={l === activeLocale ? "default" : "outline"}
              className="h-8 px-3"
              onClick={() => setActiveLocale(l)}
            >
              {LOCALE_LABEL[l]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Ces blocs s’affichent dans le panneau d’aide (à gauche) du formulaire, selon la
          condition choisie : un <strong>motif coché</strong>, une <strong>étape</strong>, ou{" "}
          <strong>toujours</strong>. Les textes sont édités dans la langue active (
          <strong>{LOCALE_LABEL[activeLocale]}</strong>) ; le <strong>FR est obligatoire</strong>,
          NL/DE sont optionnels (repli sur le FR).
        </p>
      </div>

      {/* Sélecteur de formulaire */}
      <div className="flex flex-col gap-1.5 max-w-md">
        <Label htmlFor="form-select" className="text-sm font-medium">
          Formulaire
        </Label>
        <Select value={selectedSlug} onValueChange={(v) => setSelectedSlug(v ?? "")}>
          <SelectTrigger id="form-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {forms.map((f) => {
              const count = draft[f.slug]?.entries?.length ?? 0;
              return (
                <SelectItem key={f.slug} value={f.slug}>
                  {f.title} {count > 0 ? `(${count})` : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {!selectedForm ? (
        <p className="text-sm text-muted-foreground">Aucun formulaire publié disponible.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun conseil pour ce formulaire. Ajoutez-en un ci-dessous.
            </p>
          )}
          {entries.map((entry, idx) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={idx}
              total={entries.length}
              form={selectedForm}
              activeLocale={activeLocale}
              onChange={(next) => updateEntry(idx, next)}
              onDelete={() => deleteEntry(idx)}
              onMove={(dir) => moveEntry(idx, dir)}
            />
          ))}
          <div>
            <Button variant="outline" onClick={addEntry}>
              <Plus className="size-4" /> Ajouter un conseil
            </Button>
          </div>
        </div>
      )}

      {/* Barre de sauvegarde collante */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
            <span className="text-sm text-muted-foreground">Modifications non enregistrées</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setDraft(base)} disabled={saving}>
                <RotateCcw className="size-4" /> Annuler
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte d'un conseil
// ---------------------------------------------------------------------------

function EntryCard({
  entry,
  index,
  total,
  form,
  activeLocale,
  onChange,
  onDelete,
  onMove,
}: {
  entry: TipEntry;
  index: number;
  total: number;
  form: FormEditorMeta;
  activeLocale: Locale;
  onChange: (next: TipEntry) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const set = (patch: Partial<TipEntry>) => onChange({ ...entry, ...patch });

  const setLoc = (key: "eyebrow" | "title" | "intro", value: string) => {
    const cur = (entry[key] as LocalizedText | undefined) ?? { fr: "" };
    set({ [key]: { ...cur, [activeLocale]: value } } as Partial<TipEntry>);
  };

  const setCondition = (next: TipCondition) => set({ when: next });

  const conditionSummary =
    entry.when.type === "field-checked"
      ? `Motif : ${form.fields.find((f) => f.id === (entry.when as { fieldId: string }).fieldId)?.label ?? (entry.when as { fieldId: string }).fieldId}`
      : entry.when.type === "section"
        ? `Étape : ${entry.when.sectionKey}`
        : "Toujours affiché";

  return (
    <Card>
      <CardHeader className="border-b flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Badge variant="secondary" className="font-mono text-[11px]">
            #{index + 1}
          </Badge>
          <span className="text-sm text-muted-foreground font-normal truncate">
            {entry.title.fr || conditionSummary}
          </span>
        </CardTitle>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Monter"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label="Descendre"
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            onClick={onDelete}
            aria-label="Supprimer"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Condition */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Condition d'affichage">
            <Select
              value={entry.when.type}
              onValueChange={(v) => {
                if (v === "field-checked")
                  setCondition({ type: "field-checked", fieldId: form.fields[0]?.id ?? "" });
                else if (v === "section")
                  setCondition({ type: "section", sectionKey: form.sections[0] ?? "" });
                else setCondition({ type: "always" });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="field-checked">Quand un motif est coché</SelectItem>
                <SelectItem value="section">Sur une étape</SelectItem>
                <SelectItem value="always">Toujours</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {entry.when.type === "field-checked" && (
            <Field label="Motif (case cochée)">
              {form.fields.length > 0 ? (
                <Select
                  value={entry.when.type === "field-checked" ? entry.when.fieldId : ""}
                  onValueChange={(v) => setCondition({ type: "field-checked", fieldId: v ?? "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un champ" />
                  </SelectTrigger>
                  <SelectContent>
                    {form.fields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={entry.when.type === "field-checked" ? entry.when.fieldId : ""}
                  placeholder="id du champ"
                  onChange={(e) =>
                    setCondition({ type: "field-checked", fieldId: e.target.value })
                  }
                />
              )}
            </Field>
          )}

          {entry.when.type === "section" && (
            <Field label="Clé de section (étape)">
              <Input
                list={`sections-${entry.id}`}
                value={entry.when.type === "section" ? entry.when.sectionKey : ""}
                placeholder="ex. identite, adresse"
                onChange={(e) => setCondition({ type: "section", sectionKey: e.target.value })}
              />
              <datalist id={`sections-${entry.id}`}>
                {form.sections.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          )}
        </div>

        {/* Textes localisés */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pastille (facultatif)" hint="Ex. « Adresse » — petit badge en tête du bloc.">
            <Input
              value={entry.eyebrow?.[activeLocale] ?? ""}
              onChange={(e) => setLoc("eyebrow", e.target.value)}
            />
          </Field>
          <Field label="Titre" hint="Obligatoire en FR.">
            <Input
              value={entry.title[activeLocale] ?? ""}
              onChange={(e) => setLoc("title", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Introduction (facultatif)" hint="Phrase courte sous le titre.">
          <Textarea
            rows={2}
            value={entry.intro?.[activeLocale] ?? ""}
            onChange={(e) => setLoc("intro", e.target.value)}
          />
        </Field>

        <BulletEditor
          label="Rappels importants"
          hint="Obligations / avertissements (une puce par ligne)."
          items={entry.reminders}
          activeLocale={activeLocale}
          multiline
          onChange={(next) => set({ reminders: next })}
        />

        <BulletEditor
          label="À vérifier (checklist)"
          hint="Éléments à préparer avant de continuer."
          items={entry.checklist ?? []}
          activeLocale={activeLocale}
          onChange={(next) => set({ checklist: next.length ? next : undefined })}
        />

        {/* Lien « En savoir plus » */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lien — libellé (facultatif)">
            <Input
              value={entry.link?.label?.[activeLocale] ?? ""}
              onChange={(e) =>
                set({
                  link: {
                    href: entry.link?.href ?? "",
                    label: { ...(entry.link?.label ?? { fr: "" }), [activeLocale]: e.target.value },
                  },
                })
              }
            />
          </Field>
          <Field label="Lien — URL (facultatif)" hint="Vide = lien masqué.">
            <Input
              value={entry.link?.href ?? ""}
              placeholder="https://…"
              onChange={(e) =>
                set({
                  link: { label: entry.link?.label ?? { fr: "" }, href: e.target.value },
                })
              }
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Éditeur de liste de puces localisées
// ---------------------------------------------------------------------------

function BulletEditor({
  label,
  hint,
  items,
  activeLocale,
  multiline,
  onChange,
}: {
  label: string;
  hint?: string;
  items: LocalizedText[];
  activeLocale: Locale;
  multiline?: boolean;
  onChange: (next: LocalizedText[]) => void;
}) {
  const editItem = (idx: number, value: string) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, [activeLocale]: value } : it)));
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => onChange([...items, { fr: "" }]);

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-col gap-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-start gap-2">
            {multiline ? (
              <Textarea
                rows={2}
                className="flex-1"
                value={it[activeLocale] ?? ""}
                onChange={(e) => editItem(idx, e.target.value)}
              />
            ) : (
              <Input
                className="flex-1"
                value={it[activeLocale] ?? ""}
                onChange={(e) => editItem(idx, e.target.value)}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-destructive"
              onClick={() => removeItem(idx)}
              aria-label="Retirer"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Champ de présentation (aligné sur parametres-client)
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
