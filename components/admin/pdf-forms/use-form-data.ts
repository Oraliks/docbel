"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PdfFormField, Locale, AcroFieldRaw } from "@/lib/pdf-forms/types";
import type { PublishIssue } from "@/lib/pdf-forms/publish-checks";

export interface EditorForm {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  issuer: string | null;
  organismeId: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  defaultLocale: Locale;
  locales: Locale[];
  allowDownload: boolean;
  allowDoccle: boolean;
  allowItsme: boolean;
  /// Disponibilité publique (publié mais "en pause" si false).
  active: boolean;
  /// Message custom affiché aux utilisateurs quand active=false. null = message générique.
  disabledMessage: string | null;
  fields: PdfFormField[];
  pageCount: number;
  technicalSchema?: AcroFieldRaw[];
  visualFields?: { version?: number; fields?: unknown[]; materializedNames?: string[] };
}

export interface UseFormData {
  form: EditorForm | null;
  issues: PublishIssue[];
  presets: { key: string; label: string }[];
  saving: boolean;
  busy: string | null;
  /// Un AcroForm « étranger » est présent dès qu'un champ technique du PDF
  /// n'a pas été matérialisé par notre éditeur visuel. Il désactive l'onglet
  /// Visuel (la fusion d'AcroForm tiers est out-of-scope v1).
  hasForeignAcroForm: boolean;
  load: () => void;
  loadIssues: () => void;
  save: () => Promise<void>;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
  testPdf: () => Promise<void>;
  reparse: () => Promise<void>;
  setFields: (fields: PdfFormField[]) => void;
  patchForm: (p: Partial<EditorForm>) => void;
}

export function useFormData(formId: string): UseFormData {
  const [form, setForm] = useState<EditorForm | null>(null);
  const [presets, setPresets] = useState<{ key: string; label: string }[]>([]);
  const [issues, setIssues] = useState<PublishIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

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
      .then((d) =>
        setPresets(
          Array.isArray(d) ? d.map((p: { key: string; label: string }) => ({ key: p.key, label: p.label })) : []
        )
      )
      .catch(() => {});
  }, [load, loadIssues]);

  const setFields = useCallback((fields: PdfFormField[]) => setForm((f) => (f ? { ...f, fields } : f)), []);
  const patchForm = useCallback((p: Partial<EditorForm>) => setForm((f) => (f ? { ...f, ...p } : f)), []);

  const save = useCallback(async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pdf/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, description: form.description,
          issuer: form.issuer, organismeId: form.organismeId,
          locales: form.locales, defaultLocale: form.defaultLocale,
          allowDownload: form.allowDownload, allowDoccle: form.allowDoccle, allowItsme: form.allowItsme,
          active: form.active, disabledMessage: form.disabledMessage,
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
  }, [form, formId, patchForm, loadIssues]);

  const publish = useCallback(async () => {
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
  }, [formId, patchForm]);

  const unpublish = useCallback(async () => {
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
  }, [formId, patchForm]);

  const testPdf = useCallback(async () => {
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
  }, [form, formId]);

  const reparse = useCallback(async () => {
    setBusy("reparse");
    try {
      const res = await fetch(`/api/admin/pdf/forms/${formId}/reparse`, { method: "POST" });
      if (!res.ok) { toast.error("Échec de la ré-analyse."); return; }
      const data = await res.json();
      setFields(data.form.fields);
      const total = Array.isArray(data.form.fields) ? data.form.fields.length : 0;
      toast.success(
        `Ré-analyse OK : ${total} champ${total > 1 ? "s" : ""} détecté${total > 1 ? "s" : ""} (${data.diff.added.length} ajout${data.diff.added.length > 1 ? "s" : ""}, ${data.diff.removed.length} retrait${data.diff.removed.length > 1 ? "s" : ""}).`
      );
      loadIssues();
    } finally {
      setBusy(null);
    }
  }, [formId, setFields, loadIssues]);

  const hasForeignAcroForm = useMemo(() => {
    if (!form) return false;
    const materialized = new Set(form.visualFields?.materializedNames ?? []);
    const tech = form.technicalSchema ?? [];
    return tech.some((t) => !materialized.has(t.pdfFieldName));
  }, [form]);

  return {
    form, issues, presets, saving, busy, hasForeignAcroForm,
    load, loadIssues, save, publish, unpublish, testPdf, reparse, setFields, patchForm,
  };
}
