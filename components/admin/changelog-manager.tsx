"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon, TrashIcon, EditIcon, SaveIcon, Loader2Icon } from "lucide-react";
import {
  CHANGELOG_TYPES,
  type ChangelogType,
} from "@/lib/changelog/validation";
import dynamic from "next/dynamic";

// Tiptap = client-only (DOM nécessaire). On évite l'hydratation SSR.
const RichTextEditor = dynamic(
  () =>
    import("@/components/docbel/rich-text-editor").then((m) => ({
      default: m.RichTextEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-md border bg-muted/30 px-3 py-8 text-center text-sm text-muted-foreground">
        <Loader2Icon className="inline size-4 animate-spin mr-2" />
        Chargement de l&apos;éditeur…
      </div>
    ),
  }
);

interface ChangelogApiEntry {
  id: string;
  version: string;
  publishedAt: string;
  type: ChangelogType;
  title: string;
  description: string;
  changes: unknown;
}

interface FormState {
  version: string;
  date: string;
  time: string;
  type: ChangelogType;
  title: string;
  description: string;
  changes: string[];
}

const typeConfig: Record<
  ChangelogType,
  { label: string; variant: "success" | "destructive" | "info" | "warning" }
> = {
  feature: { label: "Feature", variant: "success" },
  fix: { label: "Fix", variant: "destructive" },
  improvement: { label: "Amélioration", variant: "info" },
  breaking: { label: "Breaking", variant: "warning" },
};

const emptyForm = (): FormState => {
  const now = new Date();
  return {
    version: "",
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
    type: "feature",
    title: "",
    description: "",
    changes: [""],
  };
};

const normalizeChanges = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  return [];
};

/**
 * Convertit le HTML stocké en texte plat pour l'aperçu en table (1 ligne).
 * Pas besoin de DOM — regex simple suffit pour stripper les tags et
 * normaliser les espaces. Sert UNIQUEMENT à un aperçu visuel court ;
 * le rendu réel utilise dangerouslySetInnerHTML sur du contenu déjà
 * sanitisé côté serveur.
 */
const htmlToText = (html: string): string =>
  html
    .replace(/<\s*(br|p|div|li|h\d|ul|ol)[^>]*>/gi, " ") // sauts → espace
    .replace(/<[^>]+>/g, "") // strip tags restants
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Petit wrapper de label cohérent avec l'astérisque rouge pour les champs requis.
 */
function FieldLabel({
  children,
  required = false,
  className = "",
}: {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium mb-2 ${className}`}>
      {children}
      {required && (
        <span className="ml-0.5 text-destructive" aria-label="requis">
          *
        </span>
      )}
    </label>
  );
}

const formatPublishedAt = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("fr-BE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
};

export function ChangelogManager() {
  const confirm = useConfirm();
  const [entries, setEntries] = useState<ChangelogApiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/changelog?limit=100", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { entries: ChangelogApiEntry[] };
      setEntries(data.entries);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de charger le changelog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isFormOpen = isAdding || editingVersion !== null;

  const resetForm = () => {
    setForm(emptyForm());
    setIsAdding(false);
    setEditingVersion(null);
  };

  const handleNewClick = () => {
    setForm(emptyForm());
    setIsAdding(true);
    setEditingVersion(null);
  };

  const handleEditClick = (entry: ChangelogApiEntry) => {
    const dt = new Date(entry.publishedAt);
    setForm({
      version: entry.version,
      date: dt.toISOString().slice(0, 10),
      time: dt.toTimeString().slice(0, 5),
      type: entry.type,
      title: entry.title,
      description: entry.description,
      changes: normalizeChanges(entry.changes).length
        ? normalizeChanges(entry.changes)
        : [""],
    });
    setIsAdding(false);
    setEditingVersion(entry.version);
  };

  const handleSave = async () => {
    if (!form.version.trim() || !form.title.trim()) {
      toast.error("Version et titre sont requis");
      return;
    }

    // Combine date + time into an ISO string (local → UTC).
    const local = new Date(`${form.date}T${form.time || "00:00"}:00`);
    if (Number.isNaN(local.getTime())) {
      toast.error("Date / heure invalide");
      return;
    }

    const payload = {
      version: form.version.trim(),
      publishedAt: local.toISOString(),
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      changes: form.changes.map((c) => c.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      const url = editingVersion
        ? `/api/changelog/${encodeURIComponent(editingVersion)}`
        : "/api/changelog";
      const method = editingVersion ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Récupère détails Zod si dispo pour un message plus utile que "Invalid payload".
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          issues?: Array<{ path: (string | number)[]; message: string }>;
        };
        const detail =
          data.issues && data.issues.length > 0
            ? data.issues
                .map((i) => `${i.path.join(".") || "champ"} : ${i.message}`)
                .join(" — ")
            : data.error ?? "save failed";
        throw new Error(detail);
      }
      toast.success(editingVersion ? "Version mise à jour" : "Version créée");
      resetForm();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: ChangelogApiEntry) => {
    const ok = await confirm({
      title: `Supprimer la version ${entry.version} ?`,
      description: "Cette action est irréversible.",
      confirmText: "Supprimer",
      destructive: true,
      requireText: entry.version,
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/changelog/${encodeURIComponent(entry.version)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Version supprimée");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la suppression");
    }
  };

  const updateChange = (idx: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.changes];
      next[idx] = value;
      return { ...prev, changes: next };
    });
  };

  const addChange = () =>
    setForm((prev) => ({ ...prev, changes: [...prev.changes, ""] }));

  const removeChange = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      changes: prev.changes.filter((_, i) => i !== idx),
    }));

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      ),
    [entries],
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {!isFormOpen && (
          <Button onClick={handleNewClick} className="gap-2">
            <PlusIcon size={18} />
            Nouvelle version
          </Button>
        )}
      </div>

      {isFormOpen && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>
              {editingVersion ? "Modifier" : "Créer"} une version
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Version</FieldLabel>
                <Input
                  placeholder="2.1.0"
                  value={form.version}
                  disabled={editingVersion !== null}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel required>Type</FieldLabel>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    v && setForm({ ...form, type: v as ChangelogType })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANGELOG_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {typeConfig[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Date</FieldLabel>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel required>Heure</FieldLabel>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <FieldLabel required>Titre</FieldLabel>
              <Input
                placeholder="Titre du changement"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <FieldLabel className="mb-0">Description</FieldLabel>
                <span className="text-xs text-muted-foreground">
                  {form.description.length}/10 000
                </span>
              </div>
              <RichTextEditor
                value={form.description}
                onChange={(html) =>
                  setForm((prev) => ({ ...prev, description: html }))
                }
                placeholder="Rédigez la description (titres, listes, gras, liens, etc.). Tapez « / » pour ouvrir le menu d'insertion…"
                showVersionHistory={false}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Changements</label>
              <div className="space-y-2">
                {form.changes.map((change, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder={`Changement ${idx + 1}`}
                      value={change}
                      onChange={(e) => updateChange(idx, e.target.value)}
                    />
                    {form.changes.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeChange(idx)}
                      >
                        <TrashIcon size={16} />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addChange}
                  className="gap-1 w-full"
                >
                  <PlusIcon size={16} />
                  Ajouter un changement
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2 flex-1"
              >
                {saving ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SaveIcon size={18} />
                )}
                Enregistrer
              </Button>
              <Button
                variant="outline"
                onClick={resetForm}
                disabled={saving}
                className="flex-1"
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2Icon className="size-5 animate-spin" />
        </div>
      ) : sortedEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune version enregistrée pour le moment.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[88px]">Version</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead className="w-[180px]">Publié le</TableHead>
                <TableHead>Titre &amp; aperçu</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEntries.map((entry) => {
                const cfg = typeConfig[entry.type];
                const changes = normalizeChanges(entry.changes);
                const preview = entry.description
                  ? htmlToText(entry.description)
                  : changes.join(" · ");
                const meta: string[] = [];
                if (changes.length > 0) meta.push(`${changes.length} bullet${changes.length > 1 ? "s" : ""}`);
                return (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => handleEditClick(entry)}
                  >
                    <TableCell className="font-mono">
                      <Badge variant="outline" className="bg-primary/10 text-primary">
                        v{entry.version}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant}>
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatPublishedAt(entry.publishedAt)}
                    </TableCell>
                    <TableCell className="max-w-0">
                      <div className="font-medium truncate">{entry.title}</div>
                      {(preview || meta.length > 0) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {preview}
                          {preview && meta.length > 0 ? " · " : ""}
                          {meta.length > 0 && (
                            <span className="italic">{meta.join(" · ")}</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      // Empêche le clic sur les boutons de propager au row (éviter ouverture édition).
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEditClick(entry)}
                          title="Modifier"
                        >
                          <EditIcon size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(entry)}
                          title="Supprimer"
                        >
                          <TrashIcon size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
