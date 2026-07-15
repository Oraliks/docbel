"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  GripVertical,
  Package,
  Save,
  X,
  Loader2,
  Eye,
  GitBranch,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
import type { BundleCondition } from "@/lib/bundles/conditions";
import {
  parseEligibilityQuestions,
  type EligibilityQuestion,
} from "@/lib/bundles/eligibility";
import {
  parseBundleWarnings,
  type BundleWarning,
  LIFE_EVENT_CATEGORIES,
  getLifeEventCategory,
} from "@/lib/bundles/types";
import { parseVocabularyTags } from "@/lib/bundles/vocabulary";
import type { BundleReference } from "@/lib/decision-builder/references";

export interface BundleEditorItem {
  id?: string;
  templateId: string | null;
  pdfFormId: string | null;
  order: number;
  required: boolean;
  condition: BundleCondition;
  template: null;
  pdfForm: {
    id: string;
    slug: string;
    title: string;
    issuer: string | null;
    status: "draft" | "published" | "archived";
    active: boolean;
  } | null;
}

function itemSourceKey(it: BundleEditorItem): string {
  return it.pdfFormId ?? (it.id ?? "");
}
function itemDisplayName(it: BundleEditorItem, fallback: string): string {
  return it.pdfForm?.title ?? fallback;
}
function itemSourceBadge(it: BundleEditorItem): string {
  return it.pdfForm?.issuer ?? "PDF";
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
  status: "draft" | "published" | "archived";
  active: boolean;
}

interface Props {
  initial: BundleEditorData | null;
  /// Conservé pour compat de signature — n'est plus rendu, garder `[]`.
  availableTemplates?: AvailableTemplate[];
  availablePdfForms: AvailablePdfForm[];
  templateSchemas: Record<string, SchemaField[]>;
  /// Arbres d'orientation qui pointent vers ce dossier (intégrité référentielle).
  references?: BundleReference[];
  /// Le questionnaire et l'applicabilité des documents viennent alors du
  /// module `lib/dossiers/<slug>` et ne doivent pas être édités comme du JSON DB.
  codeDriven?: boolean;
}

export function BundleEditor({
  initial,
  availablePdfForms,
  templateSchemas,
  references = [],
  codeDriven = false,
}: Props) {
  const router = useRouter();
  const t = useTranslations("admin.documents");
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
  const unavailableDocumentCount = formItems.filter(
    (item) =>
      !item.pdfForm ||
      item.pdfForm.status !== "published" ||
      !item.pdfForm.active,
  ).length;
  const dossierReady =
    formItems.length > 0 && unavailableDocumentCount === 0;

  function addItem(sourceValue: string) {
    const [kind, id] = sourceValue.split(":");
    if (kind !== "pdf" || !id) return;
    const pdf = availablePdfForms.find((p) => p.id === id);
    if (!pdf) return;
    if (formItems.some((it) => it.pdfFormId === id)) {
      toast.warning(t("pdfAlreadyInBundle"));
      return;
    }
    setFormItems((prev) => [
      ...prev,
      { templateId: null, pdfFormId: id, order: prev.length, required: true, condition: null, template: null, pdfForm: pdf },
    ]);
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
      toast.error(t("nameRequired"));
      return;
    }
    if (!isEdit && !formSlug) {
      toast.error(t("slugRequired"));
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
          throw new Error(j.error || t("createFailed"));
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
          ...(!codeDriven
            ? { eligibilityQuestions: formEligibilityQuestions }
            : {}),
          warnings: formWarnings,
          items: formItems.map((it, idx) => ({
            pdfFormId: it.pdfFormId,
            order: idx,
            required: it.required,
            condition: it.condition,
          })),
        }),
      });
      if (!res2.ok) {
        const j = await res2.json().catch(() => ({}));
        throw new Error(j.error || t("saveFailed"));
      }

      toast.success(isEdit ? t("bundleUpdated") : t("bundleCreated"));
      router.push("/admin/pdf/dossiers");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href="/admin/pdf/dossiers" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t("back")}
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
              {isEdit ? t("editBundleTitle", { name: initial?.name || formName }) : t("newBundle")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? t("editBundleSubtitle")
                : t("newBundleSubtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && initial?.id && (
            <Button
              render={
                <Link href={`/d/${initial.slug}`} target="_blank" />
              }
              variant="outline"
              size="sm"
            >
              <Eye className="w-4 h-4 mr-1" />
              {t("citizenPreview")}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !formName}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {t("savingProgress")}
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" />
                {isEdit ? t("saveAction") : t("create")}
              </>
            )}
          </Button>
        </div>
      </div>

      <Alert>
        <GitBranch />
        <AlertTitle className="flex items-center gap-2">
          {codeDriven ? t("codeDrivenTitle") : t("databaseDrivenTitle")}
          <Badge variant="secondary">
            {codeDriven ? t("advancedModeBadge") : t("noCodeModeBadge")}
          </Badge>
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <p>
            {codeDriven
              ? t("codeDrivenDescription")
              : t("databaseDrivenDescription")}
          </p>
          {codeDriven && (
            <p>
              {t("codeDrivenSource")} {" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                lib/dossiers/{initial?.slug}/index.ts
              </code>
            </p>
          )}
        </AlertDescription>
      </Alert>

      <Alert variant={dossierReady ? "default" : "destructive"}>
        {dossierReady ? <CheckCircle2 /> : <AlertTriangle />}
        <AlertTitle>
          {dossierReady ? t("dossierReadyTitle") : t("dossierNotReadyTitle")}
        </AlertTitle>
        <AlertDescription>
          {formItems.length === 0
            ? t("dossierNoDocuments")
            : unavailableDocumentCount > 0
              ? t("dossierUnavailableDocuments", {
                  count: unavailableDocumentCount,
                })
              : t("dossierReadyDescription")}
        </AlertDescription>
      </Alert>

      {/* Intégrité référentielle : arbres d'orientation pointant vers ce dossier.
          Libellés en FR (panneau neuf) — cohérent avec la grammaire admin récente. */}
      {isEdit && references.length > 0 && (
        <Alert>
          <GitBranch />
          <AlertTitle>
            {t("referencedByTrees", { count: references.length })}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>{t("referencedByTreesDescription")}</p>
            <ul className="flex flex-col gap-1.5">
              {references.map((ref) => (
                <li
                  key={ref.treeId}
                  className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium">{ref.treeTitle}</span>
                    {ref.inPublished ? (
                      <Badge variant="success">publié</Badge>
                    ) : ref.inDraft ? (
                      <Badge variant="secondary">brouillon</Badge>
                    ) : null}
                    {ref.asRelated && !ref.asPrimary && (
                      <Badge variant="outline">connexe</Badge>
                    )}
                  </div>
                  <Button
                    render={<Link href={`/admin/decision-trees/${ref.treeId}`} />}
                    variant="ghost"
                    size="sm"
                  >
                    Ouvrir
                    <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Section : Identité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("identitySection")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("slugLabel")}</Label>
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
                {t("publicUrlPrefix")} <code>/d/{formSlug || "<slug>"}</code>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("colorLabel")}</Label>
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
            <Label className="text-xs">{t("nameLabel")}</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t("bundleNamePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("descriptionLabel")}</Label>
            <Textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
              placeholder={t("bundleDescriptionPlaceholder")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section : Documents inclus */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("includedDocuments")}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({formItems.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value="" onValueChange={(v) => v && addItem(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("addDocument")} />
            </SelectTrigger>
            <SelectContent>
              {availablePdfForms
                .filter((p) => !formItems.some((it) => it.pdfFormId === p.id))
                .map((p) => (
                  <SelectItem key={`pdf:${p.id}`} value={`pdf:${p.id}`}>
                    {p.title}
                    {p.issuer ? ` — ${p.issuer}` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {formItems.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              {t("noDocumentYet")}
            </p>
          ) : (
            <div className="space-y-2 border rounded-md p-2 bg-muted/20">
              {formItems.map((it, idx) => {
                const key = itemSourceKey(it);
                const availableSources = formItems
                  .filter((x) => itemSourceKey(x) !== key)
                  .map((x) => ({ id: itemSourceKey(x), name: itemDisplayName(x, t("documentFallback")) }));
                return (
                  <div key={key} className="bg-background rounded border p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                          title={t("moveUp")}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === formItems.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                          title={t("moveDown")}
                        >
                          ▼
                        </button>
                      </div>
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate font-medium">
                        {idx + 1}. {itemDisplayName(it, t("documentFallback"))}
                      </span>
                      <span className="text-[10px] uppercase rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                        {t("pdfSourceBadge", { issuer: itemSourceBadge(it) })}
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
                        {t("required")}
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
            {t("onboardingSection")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("onboardingHintBefore")}
            <code className="mx-1">/creer-ma-demande</code>
            {t("onboardingHintAfter")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("lifeEventCategoryLabel")}</Label>
              <Select
                value={formLifeEventCategory || "__none__"}
                onValueChange={(v) =>
                  setFormLifeEventCategory(!v || v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder={t("noneLabel")}>
                    {(value: string) => {
                      const cat = getLifeEventCategory(
                        value === "__none__" ? null : value
                      );
                      return cat ? `${cat.emoji} ${cat.label}` : t("noneDash");
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("noneDash")}</SelectItem>
                  {LIFE_EVENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.emoji} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("displayLabel")}</Label>
              <label className="flex items-center gap-2 text-sm cursor-pointer h-9 px-3 border rounded-md bg-background">
                <Checkbox
                  checked={formShowOnOnboarding}
                  onCheckedChange={(checked) => setFormShowOnOnboarding(checked === true)}
                />
                {t("showOnCreationPage")}
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
          <CardTitle className="flex items-center gap-2 text-base">
            {t("prequalSection")}
            {codeDriven && (
              <Badge variant="secondary">{t("readOnlyBadge")}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {codeDriven ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("codeDrivenQuestionsHint", {
                  count: formEligibilityQuestions.length,
                })}
              </p>
              {formEligibilityQuestions.length > 0 && (
                <ol className="space-y-2">
                  {formEligibilityQuestions.map((question, index) => (
                    <li
                      key={question.id}
                      className="flex gap-3 rounded-md border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {index + 1}.
                      </span>
                      <span>{question.label}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <EligibilityQuestionsEditor
              value={formEligibilityQuestions}
              onChange={setFormEligibilityQuestions}
            />
          )}
        </CardContent>
      </Card>

      {/* Section : Avertissements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("warningsSection")}</CardTitle>
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
          render={<Link href="/admin/pdf/dossiers" />}
          variant="outline"
        >
          {t("cancel")}
        </Button>
        <Button onClick={handleSave} disabled={saving || !formName}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              {t("savingProgress")}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-1" />
              {isEdit ? t("saveAction") : t("createBundle")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
