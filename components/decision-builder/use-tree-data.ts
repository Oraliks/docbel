"use client";

/// Hook d'état + API pour l'éditeur d'arbre (calque `use-form-data.ts` du PDF).
/// Gère : chargement, édition locale du contenu, auto-save débouncé avec verrou
/// optimiste (expectedUpdatedAt → 409 stale_write), validation, publication.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { safeParseTreeContent } from "@/lib/decision-builder/schema";
import type { DecisionTreeContent } from "@/lib/decision-builder/types";
import type { ValidationReport } from "@/lib/decision-builder/validator";

export interface TreeMeta {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  segment: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
  publishedAt: string | null;
}

const AUTOSAVE_MS = 1500;

export interface UseTreeData {
  meta: TreeMeta | null;
  content: DecisionTreeContent | null;
  saving: boolean;
  busy: string | null;
  report: ValidationReport | null;
  load: () => void;
  setContent: (next: DecisionTreeContent) => void;
  patchMeta: (p: Partial<Pick<TreeMeta, "title" | "description" | "segment">>) => void;
  saveNow: () => Promise<void>;
  validate: () => Promise<ValidationReport | null>;
  publish: (changeNotes?: string) => Promise<boolean>;
  unpublish: () => Promise<void>;
}

export function useTreeData(treeId: string): UseTreeData {
  const [meta, setMeta] = useState<TreeMeta | null>(null);
  const [content, setContentState] = useState<DecisionTreeContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);

  // Refs pour l'auto-save (évite les stale closures).
  const contentRef = useRef<DecisionTreeContent | null>(null);
  const metaRef = useRef<TreeMeta | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  contentRef.current = content;
  metaRef.current = meta;

  const load = useCallback(() => {
    fetch(`/api/decision-trees/${treeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setMeta({
          id: d.id,
          slug: d.slug,
          title: d.title,
          description: d.description,
          segment: d.segment,
          status: d.status,
          updatedAt: d.updatedAt,
          publishedAt: d.publishedAt,
        });
        const parsed = safeParseTreeContent(d.draftContent);
        if (parsed) setContentState(parsed);
      })
      .catch(() => toast.error("Impossible de charger l'arbre."));
  }, [treeId]);

  useEffect(() => {
    load();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load]);

  const saveNow = useCallback(async () => {
    const m = metaRef.current;
    const c = contentRef.current;
    if (!m || !c) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/decision-trees/${treeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: m.title,
          description: m.description,
          segment: m.segment,
          draftContent: c,
          expectedUpdatedAt: m.updatedAt,
        }),
      });
      if (res.status === 409) {
        const data = await res.json().catch(() => null);
        if (data?.code === "stale_write") {
          toast.error("Cet arbre a été modifié ailleurs.", {
            description: "Rechargez pour récupérer la dernière version.",
            action: { label: "Recharger", onClick: () => load() },
          });
          return;
        }
      }
      if (res.status === 400) {
        toast.error("Contenu invalide — enregistrement refusé.");
        return;
      }
      if (!res.ok) {
        toast.error("Échec de l'enregistrement.");
        return;
      }
      const updated = await res.json();
      // Resync du jeton de verrou.
      setMeta((prev) => (prev ? { ...prev, updatedAt: updated.updatedAt } : prev));
    } finally {
      setSaving(false);
    }
  }, [treeId, load]);

  // Programme un auto-save débouncé.
  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveNow();
    }, AUTOSAVE_MS);
  }, [saveNow]);

  const setContent = useCallback(
    (next: DecisionTreeContent) => {
      setContentState(next);
      scheduleSave();
    },
    [scheduleSave],
  );

  const patchMeta = useCallback(
    (p: Partial<Pick<TreeMeta, "title" | "description" | "segment">>) => {
      setMeta((prev) => (prev ? { ...prev, ...p } : prev));
      scheduleSave();
    },
    [scheduleSave],
  );

  const validate = useCallback(async () => {
    setBusy("validate");
    try {
      // On sauvegarde d'abord pour valider l'état réellement persisté.
      await saveNow();
      const res = await fetch(`/api/decision-trees/${treeId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentRef.current }),
      });
      if (!res.ok) {
        toast.error("Validation impossible.");
        return null;
      }
      const data = await res.json();
      setReport(data.report as ValidationReport);
      return data.report as ValidationReport;
    } finally {
      setBusy(null);
    }
  }, [treeId, saveNow]);

  const publish = useCallback(
    async (changeNotes?: string) => {
      setBusy("publish");
      try {
        await saveNow();
        const res = await fetch(`/api/decision-trees/${treeId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changeNotes }),
        });
        const data = await res.json().catch(() => null);
        if (res.status === 422) {
          if (data?.report) setReport(data.report as ValidationReport);
          toast.error("Publication impossible : corrigez les erreurs.");
          return false;
        }
        if (!res.ok) {
          toast.error(data?.error || "Échec de la publication.");
          return false;
        }
        toast.success(`Publié (version ${data.version}).`);
        load();
        return true;
      } finally {
        setBusy(null);
      }
    },
    [treeId, saveNow, load],
  );

  const unpublish = useCallback(async () => {
    setBusy("unpublish");
    try {
      const res = await fetch(`/api/decision-trees/${treeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // On repasse en draft via un PATCH dédié de statut.
          status: "draft",
          expectedUpdatedAt: metaRef.current?.updatedAt,
        }),
      });
      if (!res.ok) {
        toast.error("Impossible de dépublier.");
        return;
      }
      toast.success("Repassé en brouillon.");
      load();
    } finally {
      setBusy(null);
    }
  }, [treeId, load]);

  return {
    meta,
    content,
    saving,
    busy,
    report,
    load,
    setContent,
    patchMeta,
    saveNow,
    validate,
    publish,
    unpublish,
  };
}
