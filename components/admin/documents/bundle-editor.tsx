"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  GripVertical,
  Package,
  Save,
  X,
  Loader2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BundleConditionEditor } from "./bundle-condition-editor";
import { EligibilityQuestionsEditor } from "./eligibility-questions-editor";
import { BundleWarningsEditor } from "./bundle-warnings-editor";
import { VocabularyTagsEditor } from "./vocabulary-tags-editor";
import type { BundleCondition } from "@/lib/documents/bundle-conditions";
import {
  parseEligibilityQuestions,
  type EligibilityQuestion,
} from "@/lib/bundles/eligibility";
import {
  parseBundleWarnings,
  type BundleWarning,
  LIFE_EVENT_CATEGORIES,
} from "@/lib/bundles/types";
import { parseVocabularyTags } from "@/lib/bundles/vocabulary";

export interface BundleEditorItem {
  id?: string;
  /// EXACTEMENT UN des deux est défini.
  templateId: string | null;
  pdfFormId: string | null;
  order: number;
  required: boolean;
  condition: BundleCondition;
  template: {
    id: string;
    toolId: string;
    toolName: string;
    toolSlug: string;
    organisme: { id: string; shortName: string | null; color: string } | null;
  } | null;
  pdfForm: {
    id: string;
    slug: string;
    title: string;
    issuer: string | null;
  } | null;
}

/// Helpers pour traiter les deux sources uniformément.
function itemSourceKey(it: BundleEditorItem): string {
  return (it.templateId ?? it.pdfFormId)!;
}
function itemDisplayName(it: BundleEditorItem): string {
  return it.template?.toolName ?? it.pdfForm?.title ?? "Document";
}
function itemSourceBadge(it: BundleEditorItem): string {
  if (it.template?.organisme?.shortName) return it.template.organisme.shortName;
  if (it.pdfForm?.issuer) return it.pdfForm.issuer;
  return it.template ? "Document" : "PDF";
}

interface SchemaField {
  id: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
}

export interface BundleEditorData {
  id?: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  active: boolean;
  lifeEventCategory: string | null;
  showOnOnboarding: boolean;
  vocabularyTags: unknown;
  eligibilityQuestions: unknown;
  warnings: unknown;
  items: BundleEditorItem[];
}

export interface AvailableTemplate {
  id: string;
  toolId: string;
  toolName: string;
  toolSlug: string;
  organisme: { id: string; shortName: string | null; color: string } | null;
}

export interface AvailablePdfForm {
  id: string;
  slug: string;
  title: string;
  issuer: string | null;
}

interface Props {
  /// Bundle existant si en mode édition, null si création.
  initial: BundleEditorData | null;
  availableTemplates: AvailableTemplate[];
  availablePdfForms: AvailablePdfForm[];
  templateSchemas: Record<string, SchemaField[]>;
}

export function BundleEditor({
  initial,
  availableTemplates,
  availablePdfForms,
  templateSchemas,
}: Props) {
  const router = useRouter();
  const isEdit = !!initial;

  const [saving, setSaving] = useState(false);

  // État du formulaire
  const [formSlug, setFormSlug] = useState(initial?.slug ?? "");
  const [formName, setFormName] = useState(initial?.name ?? "");
  const [formDescription, setFormDescription] = useState(initial?.description ?? "");
  const [formColor, setFormColor] = useState(initial?.color ?? "#7C3AED");
  const [formItems, setFormItems] = useState<BundleEditorItem[]>(initial?.items ?? []);

  // Onboarding (migration 12)
  const [formLifeEventCategory, setFormLifeEventCategory] = useState<string>(
    initial?.lifeEventCategory ?? ""
  );
  const [formShowOnOnboarding, setFormShowOnOnboarding] = useState(
    initial?.showOnOnboarding ?? false
  );
  const [formVocabularyTags, setFormVocabularyTags] = useState<string[]>(
    initial ? parseVocabularyTags(initial.vocabularyTags) : []
  );
  const [formEligibilityQuestions, setFormEligibilityQuestions] = useState<EligibilityQuestion[]>(
    initial ? parseEligibilityQuestions(initial.eligibilityQuestions) : []
  );
  const [formWarnings, setFormWarnings] = useState<BundleWarning[]>(
    initial ? parseBundleWarnings(initial.warnings) : []
  );

  /// Ajoute un item à partir d'une valeur du type `tpl:<id>` ou `pdf:<id>`,
  /// produite par le select unifié ci-dessous.
  function addItem(sourceValue: string) {
    const [kind, id] = sourceValue.split(":");
    if (!kind || !id) return;
    if (kind === "tpl") {
      const tpl = availableTemplates.find((t) => t.id === id);
      if (!tpl) return;
      if (formItems.some((it) => it.templateId === id)) {
        toast.warning("Document déjà dans le dossier");
        return;
      }
      setFormItems((prev) => [
        ...prev,
        { templateId: id, pdfFormId: null, order: prev.length, required: true, condition: null, template: tpl, pdfForm: null },
      ]);
    } else if (kind === "pdf") {
      const pdf = availablePdfForms.find((p) => p.id === id);
      if (!pdf) return;
      if (formItems.some((it) => it.pdfFormId === id)) {
        toast.warning("PDF déjà dans le dossier");
        return;
      }
      setFormItems((prev) => [
        ...prev,
        { templateId: null, pdfFormId: id, order: prev.length, required: true, condition: null, template: null, pdfForm: pdf },
      ]);
    }
  }

  function removeItem(key: string) {
    setFormItems((prev) => prev.filter((it) => itemSourceKey(it) !== key));
  }

  function moveItem(idx: number, direction: -1 | 1) {
    const target = idx + direction;
    if (target < 0 || target >= formItems.length) return;
    setFormItems((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((it, i) => ({ ...it, order: i }));
    });
  }

  async function handleSave() {
    if (!formName) {
      toast.error("Nom requis");
      return;
    }
    if (!isEdit && !formSlug) {
      toast.error("Slug requis");
      return;
    }

    setSaving(true);
    try {
      let bundleId = initial?.id;

      // Create first if needed
      if (!isEdit) {
        const res = await fetch("/api/documents/bundles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: formSlug,
            name: formName,
            description: formDescription,
            color: formColor,
            lifeEventCategory: formLifeEventCategory || null,
            showOnOnboarding: formShowOnOnboarding,
            vocabularyTags: formVocabularyTags,
            eligibilityQuestions: formEligibilityQuestions,
            warnings: formWarnings,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Échec de création");
        }
        const created = await res.json();
        bundleId = created.id;
      }

      // Update items + meta in PUT
      const res2 = await fetch(`/api/documents/bundles/${bundleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          color: formColor,
          lifeEventCategory: formLifeEventCategory || null,
          showOnOnboarding: formShowOnOnboarding,
          vocabularyTags: formVocabularyTags,
          eligibilityQuestions: formEligibilityQuestions,
          warnings: formWarnings,
          items: formItems.map((it, idx) => ({
            templateId: it.templateId,
            pdfFormId: it.pdfFormId,
            order: idx,
            required: it.required,
            condition: it.condition,
          })),
        }),
      });
      if (!res2.ok) {
        const j = await res2.json().catch(() => ({}));
        throw new Error(j.error || "Échec d'enregistrement");
      }

      toast.success(isEdit ? "Bundle mis à jour" : "Bundle créé");
      router.push("/admin/documents/config?tab=bundles");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href="/admin/documents/config?tab=bundles" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center text-white"
            style={{ backgroundColor: formColor }}
          >
            <Package className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">
              {isEdit ? `Modifier « ${initial?.name || formName} »` : "Nouveau bundle"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? "Un bundle regroupe plusieurs documents liés en un parcours."
                : "Créer un nouveau parcours regroupant plusieurs documents."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && initial?.id && (
            <Button
              render={
                <Link href={`/outils/bundles/${initial.slug}`} target="_blank" />
              }
              variant="outline"
              size="sm"
            >
              <Eye className="w-4 h-4 mr-1" />
              Aperçu citoyen
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !formName}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                {isEdit ? "Enregistrer" : "Créer"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Section : Identité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Slug *</Label>
              <Input
                value={formSlug}
                onChange={(e) =>
                  setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
                placeholder="dossier-chomage-complet"
                disabled={isEdit}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                URL publique : <code>/outils/bundles/{formSlug || "<slug>"}</code>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Couleur</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="h-9 w-12 rounded border"
                />
                <Input
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="font-mono w-28"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nom *</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Dossier complet de demande de chômage"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
              placeholder="Affichée sur la carte d'onboarding et en tête du parcours citoyen."
            />
          </div>
        </CardContent>
      </Card>

      {/* Section : Documents inclus */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Documents inclus
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({formItems.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value="" onValueChange={(v) => v && addItem(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="+ Ajouter un document" />
            </SelectTrigger>
            <SelectContent>
              {availablePdfForms.filter((p) => !formItems.some((it) => it.pdfFormId === p.id)).length > 0 && (
                <>
                  <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    PDF Forms (AcroForm)
                  </div>
                  {availablePdfForms
                    .filter((p) => !formItems.some((it) => it.pdfFormId === p.id))
                    .map((p) => (
                      <SelectItem key={`pdf:${p.id}`} value={`pdf:${p.id}`}>
                        {p.title}
                        {p.issuer ? ` — ${p.issuer}` : ""}
                      </SelectItem>
                    ))}
                </>
              )}
              {availableTemplates.filter((t) => !formItems.some((it) => it.templateId === t.id)).length > 0 && (
                <>
                  <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Documents (legacy)
                  </div>
                  {availableTemplates
                    .filter((t) => !formItems.some((it) => it.templateId === t.id))
                    .map((t) => (
                      <SelectItem key={`tpl:${t.id}`} value={`tpl:${t.id}`}>
                        {t.toolName}
                        {t.organisme?.shortName ? ` — ${t.organisme.shortName}` : ""}
                      </SelectItem>
                    ))}
                </>
              )}
            </SelectContent>
          </Select>

          {formItems.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Aucun document. Ajoutez-en au moins un pour activer ce bundle.
            </p>
          ) : (
            <div className="space-y-2 border rounded-md p-2 bg-muted/20">
              {formItems.map((it, idx) => {
                const key = itemSourceKey(it);
                const availableSources = formItems
                  .filter((x) => itemSourceKey(x) !== key)
                  .map((x) => ({ id: itemSourceKey(x), name: itemDisplayName(x) }));
                return (
                  <div key={key} className="bg-background rounded border p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                          title="Monter"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === formItems.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                          title="Descendre"
                        >
                          ▼
                        </button>
                      </div>
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate font-medium">
                        {idx + 1}. {itemDisplayName(it)}
                      </span>
                      <span className="text-[10px] uppercase rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                        {it.pdfFormId ? "PDF" : "Doc"} · {itemSourceBadge(it)}
                      </span>
                      <label className="flex items-center gap-1 text-xs">
                        <Checkbox
                          checked={it.required}
                          onCheckedChange={(checked) =>
                            setFormItems((prev) =>
                              prev.map((x) =>
                                itemSourceKey(x) === key
                                  ? { ...x, required: checked === true }
                                  : x
                              )
                            )
                          }
                        />
                        Obligatoire
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(key)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="pl-7">
                      <BundleConditionEditor
                        value={it.condition}
                        onChange={(next) =>
                          setFormItems((prev) =>
                            prev.map((x) =>
                              itemSourceKey(x) === key ? { ...x, condition: next } : x
                            )
                          )
                        }
                        availableSources={availableSources}
                        templateSchemas={templateSchemas}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section : Onboarding (migration 12) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Onboarding « Quelle est ma situation ? »
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Configure comment ce bundle apparaît sur la page d&apos;accueil
            <code className="mx-1">/creer-ma-demande</code>
            et comment la recherche libre le trouve.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Catégorie événement de vie</Label>
              <Select
                value={formLifeEventCategory || "__none__"}
                onValueChange={(v) =>
                  setFormLifeEventCategory(!v || v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Aucune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucune —</SelectItem>
                  {LIFE_EVENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.emoji} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Affichage</Label>
              <label className="flex items-center gap-2 text-sm cursor-pointer h-9 px-3 border rounded-md bg-background">
                <Checkbox
                  checked={formShowOnOnboarding}
                  onCheckedChange={(checked) => setFormShowOnOnboarding(checked === true)}
                />
                Afficher sur la page de création
              </label>
            </div>
          </div>
          <VocabularyTagsEditor
            value={formVocabularyTags}
            onChange={setFormVocabularyTags}
          />
        </CardContent>
      </Card>

      {/* Section : Pré-qualification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pré-qualification</CardTitle>
        </CardHeader>
        <CardContent>
          <EligibilityQuestionsEditor
            value={formEligibilityQuestions}
            onChange={setFormEligibilityQuestions}
          />
        </CardContent>
      </Card>

      {/* Section : Avertissements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avertissements</CardTitle>
        </CardHeader>
        <CardContent>
          <BundleWarningsEditor
            value={formWarnings}
            onChange={setFormWarnings}
          />
        </CardContent>
      </Card>

      {/* Footer action bar (sticky) */}
      <div className="sticky bottom-0 z-10 -mx-4 lg:-mx-6 border-t bg-background/95 backdrop-blur px-4 lg:px-6 py-3 flex items-center justify-end gap-2">
        <Button
          render={<Link href="/admin/documents/config?tab=bundles" />}
          variant="outline"
        >
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={saving || !formName}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Enregistrement…
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-1" />
              {isEdit ? "Enregistrer" : "Créer le bundle"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
