"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  SaveIcon, UploadCloudIcon, FileDownIcon, HistoryIcon, RefreshCwIcon,
  CheckCircle2Icon, AlertTriangleIcon, Loader2Icon, ExternalLinkIcon, EyeIcon,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableField } from "./sortable-field";
import { FormSettings } from "./form-settings";
import { FormPreview } from "./form-preview";
import { VersionDialog } from "./version-dialog";
import { RevisionsDialog } from "./revisions-dialog";
import { PdfFormField, Locale } from "@/lib/pdf-forms/types";
import type { PublishIssue } from "@/lib/pdf-forms/publish-checks";

interface EditorForm {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  issuer: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  defaultLocale: Locale;
  locales: Locale[];
  allowDownload: boolean;
  allowDoccle: boolean;
  allowItsme: boolean;
  fields: PdfFormField[];
  pageCount: number;
}

export function PdfFormEditor({ formId }: { formId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<EditorForm | null>(null);
  const [presets, setPresets] = useState<{ key: string; label: string }[]>([]);
  const [issues, setIssues] = useState<PublishIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [revsOpen, setRevsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !form) return;
    const oldIndex = form.fields.findIndex((f) => f.id === active.id);
    const newIndex = form.fields.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(form.fields, oldIndex, newIndex).map((f, i) => ({ ...f, order: i }));
    setFields(reordered);
  }

  const loadIssues = useCallback(() => {
    fetch(`/api/admin/pdf/forms/${formId}/publish`)
      .then((r) => r.json())
      .then((d) => setIssues(d.issues ?? []))
      .catch(() => {});
  }, [formId]);

  const load = useCallback(() => {
    fetch(`/api/admin/pdf/forms/${formId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setForm(d))
      .catch(() => {});
  }, [formId]);

  useEffect(() => {
    load();
    loadIssues();
    fetch("/api/admin/pdf/presets")
      .then((r) => r.json())
      .then((d) => setPresets(Array.isArray(d) ? d.map((p: { key: string; label: string }) => ({ key: p.key, label: p.label })) : []))
      .catch(() => {});
  }, [load, loadIssues]);

  const setFields = (fields: PdfFormField[]) => setForm((f) => (f ? { ...f, fields } : f));
  const patchForm = (p: Partial<EditorForm>) => setForm((f) => (f ? { ...f, ...p } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pdf/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, description: form.description, issuer: form.issuer,
          locales: form.locales, defaultLocale: form.defaultLocale,
          allowDownload: form.allowDownload, allowDoccle: form.allowDoccle, allowItsme: form.allowItsme,
          fields: form.fields,
        }),
      });
      if (!res.ok) { toast.error("Échec de l'enregistrement."); return; }
      const updated = await res.json();
      patchForm({ version: updated.version });
      toast.success("Enregistré.");
      loadIssues();
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setBusy("publish");
    try {
      const res = await fetch(`/api/admin/pdf/forms/${formId}/publish`, { method: "POST" });
      const data = await res.json();
      setIssues(data.issues ?? []);
      if (!res.ok) { toast.error("Corrigez les erreurs avant de publier."); return; }
      patchForm({ status: "published" });
      toast.success("Formulaire publié.");
    } finally {
      setBusy(null);
    }
  }

  async function unpublish() {
    setBusy("unpublish");
    try {
      const res = await fetch(`/api/admin/pdf/forms/${formId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (res.ok) { patchForm({ status: "draft" }); toast.success("Dépublié."); }
    } finally {
      setBusy(null);
    }
  }

  async function testPdf() {
    if (!form) return;
    setBusy("test");
    try {
      const res = await fetch(`/api/admin/pdf/forms/${formId}/test-generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: form.fields }),
      });
      if (!res.ok) { toast.error("Échec du test."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `test-${form.slug}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  async function reparse() {
    setBusy("reparse");
    try {
      const res = await fetch(`/api/admin/pdf/forms/${formId}/reparse`, { method: "POST" });
      if (!res.ok) { toast.error("Échec de la ré-analyse."); return; }
      const data = await res.json();
      setFields(data.form.fields);
      toast.success(`Ré-analyse OK (${data.diff.added.length} ajout(s), ${data.diff.removed.length} retrait(s)).`);
      loadIssues();
    } finally {
      setBusy(null);
    }
  }

  if (!form) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <div className="p-6">
      {/* Barre d'action collante */}
      <div className="sticky top-0 z-10 -mx-6 mb-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <div className="mr-auto flex items-center gap-2">
          <button onClick={() => router.push("/admin/pdf")} className="text-sm text-muted-foreground hover:text-foreground">← Formulaires</button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{form.title}</span>
          <Badge variant={form.status === "published" ? "default" : "secondary"}>
            {form.status === "published" ? "Publié" : form.status === "draft" ? "Brouillon" : "Archivé"}
          </Badge>
          <span className="text-xs text-muted-foreground">v{form.version}</span>
          {form.status === "published" && (
            <a href={`/pdf/${form.slug}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
              <ExternalLinkIcon className="size-4" />
            </a>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
          <EyeIcon className="size-4" /> {showPreview ? "Masquer l'aperçu" : "Aperçu"}
        </Button>
        <Button variant="outline" size="sm" onClick={testPdf} disabled={busy === "test"}>
          {busy === "test" ? <Loader2Icon className="size-4 animate-spin" /> : <FileDownIcon className="size-4" />} PDF test
        </Button>
        <Button variant="outline" size="sm" onClick={() => setRevsOpen(true)}><HistoryIcon className="size-4" /> Historique</Button>
        <Button variant="outline" size="sm" onClick={() => setVersionOpen(true)}><UploadCloudIcon className="size-4" /> Remplacer le PDF</Button>
        <Button variant="outline" size="sm" onClick={reparse} disabled={busy === "reparse"}>
          {busy === "reparse" ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />} Ré-analyser
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />} Enregistrer
        </Button>
        {form.status === "published" ? (
          <Button variant="secondary" size="sm" onClick={unpublish} disabled={busy === "unpublish"}>Dépublier</Button>
        ) : (
          <Button size="sm" onClick={publish} disabled={busy === "publish" || errors.length > 0}>
            {busy === "publish" ? <Loader2Icon className="size-4 animate-spin" /> : <CheckCircle2Icon className="size-4" />} Publier
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {/* Contrôles de publication */}
        {(errors.length > 0 || warnings.length > 0) && (
          <Card>
            <CardContent className="flex flex-col gap-1.5 py-4 text-sm">
              {errors.map((i, k) => (
                <div key={`e${k}`} className="flex items-center gap-2 text-destructive">
                  <AlertTriangleIcon className="size-4 shrink-0" /> {i.message}
                </div>
              ))}
              {warnings.map((i, k) => (
                <div key={`w${k}`} className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangleIcon className="size-4 shrink-0" /> {i.message}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <FormSettings form={form} onChange={patchForm} />

        {/* Layout : éditeur seul ou éditeur + aperçu côte-à-côte (>= xl). */}
        <div className={showPreview ? "grid gap-4 xl:grid-cols-2" : ""}>
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Champs ({form.fields.length}) — glisser-déposer pour réordonner
            </h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={form.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <Accordion type="multiple" className="flex flex-col gap-2">
                  {form.fields.map((field, i) => (
                    <SortableField
                      key={field.id}
                      field={field}
                      locales={form.locales}
                      presets={presets}
                      allFields={form.fields}
                      onChange={(next) => setFields(form.fields.map((f, j) => (j === i ? next : f)))}
                      onRemove={() => setFields(form.fields.filter((_, j) => j !== i))}
                    />
                  ))}
                </Accordion>
              </SortableContext>
            </DndContext>
          </div>

          {showPreview && (
            <div className="xl:sticky xl:top-20 xl:self-start">
              <FormPreview fields={form.fields} locale={form.defaultLocale} />
            </div>
          )}
        </div>
      </div>

      <VersionDialog
        formId={formId}
        open={versionOpen}
        onOpenChange={setVersionOpen}
        onApplied={() => { load(); loadIssues(); }}
      />
      <RevisionsDialog
        formId={formId}
        open={revsOpen}
        onOpenChange={setRevsOpen}
        onRestored={() => { load(); loadIssues(); }}
      />
    </div>
  );
}
