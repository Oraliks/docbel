"use client";

/**
 * Drawer (Shadcn Sheet) côté gauche pour gérer les snippets — phrases /
 * templates réutilisables insérables via le command palette `/<shortcut>`
 * dans la textarea chat ou prompt brief.
 *
 * Fonctionnalités :
 *   - Liste avec recherche fuzzy (shortcut + title)
 *   - Création inline (form en haut de la liste)
 *   - Édition inline (un snippet en mode édition à la fois)
 *   - Suppression avec confirmation
 *
 * Pas de modal de création séparé pour rester rapide et léger — la même Sheet
 * gère tout via des sections collapsibles.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Code2,
  Loader2,
  MessageSquareWarning,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fmtRelative, truncate } from "../_shared";
import { ConfirmDeleteDialog } from "../_shared-alerts";
import { cn } from "@/lib/utils";

export interface SnippetItem {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  domain: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  /** Notifie le parent qu'une liste a changé — utilisé pour invalider le cache
   *  du command palette dans le chat-input-bar. */
  onSnippetsChange?: () => void;
}

const SHORTCUT_REGEX = /^[a-zA-Z0-9_-]{1,40}$/;

export function SnippetsSheet({
  open,
  onOpenChange,
  domain,
  onSnippetsChange,
}: Props) {
  const [items, setItems] = useState<SnippetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // État du formulaire de création (collapsé par défaut).
  const [creating, setCreating] = useState(false);
  const [newShortcut, setNewShortcut] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // État de l'édition inline (id du snippet en cours d'édition).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShortcut, setEditShortcut] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const deleteTarget = useMemo(
    () => items.find((it) => it.id === deleteTargetId) ?? null,
    [items, deleteTargetId]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/chomage-ia/snippets?domain=${encodeURIComponent(domain)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: SnippetItem[] };
      setItems(data.items);
    } catch (e) {
      toast.error("Impossible de charger les snippets", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (it) =>
        it.shortcut.toLowerCase().includes(t) ||
        it.title.toLowerCase().includes(t) ||
        it.content.toLowerCase().includes(t)
    );
  }, [items, q]);

  function resetCreate() {
    setNewShortcut("");
    setNewTitle("");
    setNewContent("");
    setCreating(false);
  }

  function resetEdit() {
    setEditingId(null);
    setEditShortcut("");
    setEditTitle("");
    setEditContent("");
  }

  function startEdit(item: SnippetItem) {
    setEditingId(item.id);
    setEditShortcut(item.shortcut);
    setEditTitle(item.title);
    setEditContent(item.content);
  }

  async function createSnippet() {
    if (submitting) return;
    const shortcut = newShortcut.trim();
    const title = newTitle.trim();
    const content = newContent;
    if (!shortcut || !title || !content.trim()) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (!SHORTCUT_REGEX.test(shortcut)) {
      toast.error("Shortcut invalide", {
        description: "Lettres, chiffres, tirets et underscores uniquement",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/chomage-ia/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortcut, title, content, domain }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Snippet créé");
      resetCreate();
      refresh();
      onSnippetsChange?.();
    } catch (e) {
      toast.error("Échec de la création", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (savingEdit || !editingId) return;
    const shortcut = editShortcut.trim();
    const title = editTitle.trim();
    const content = editContent;
    if (!shortcut || !title || !content.trim()) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (!SHORTCUT_REGEX.test(shortcut)) {
      toast.error("Shortcut invalide");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/chomage-ia/snippets/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortcut, title, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      toast.success("Snippet enregistré");
      resetEdit();
      refresh();
      onSnippetsChange?.();
    } catch (e) {
      toast.error("Échec de l'enregistrement", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteSnippet(id: string) {
    try {
      const res = await fetch(`/api/chomage-ia/snippets/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Snippet supprimé");
      refresh();
      onSnippetsChange?.();
    } catch (e) {
      toast.error("Échec de la suppression", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[420px] sm:max-w-[420px] flex flex-col"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Code2 className="size-4" />
            Snippets ({items.length})
          </SheetTitle>
          <SheetDescription>
            Phrases et templates fréquents insérables via{" "}
            <kbd className="rounded border border-border bg-muted px-1 py-px font-mono text-[10.5px]">
              /
            </kbd>{" "}
            dans la textarea du chat ou du brief.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b border-border bg-background/60 px-3 py-2 flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrer (shortcut, titre, contenu)…"
              className="pl-8"
            />
          </div>
          {!creating ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreating(true)}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Nouveau snippet
            </Button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-300/40 bg-amber-50/40 p-2 dark:border-amber-500/30 dark:bg-amber-950/15">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                  Nouveau snippet
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={resetCreate}
                  aria-label="Annuler"
                >
                  <X className="size-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label
                    htmlFor="new-shortcut"
                    className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Shortcut <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-shortcut"
                    value={newShortcut}
                    onChange={(e) => setNewShortcut(e.target.value)}
                    placeholder="calc-pattern"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="new-title"
                    className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Titre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Pattern Calculateur"
                    disabled={submitting}
                  />
                </div>
              </div>
              <div>
                <Label
                  htmlFor="new-content"
                  className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Contenu <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="new-content"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Le texte qui sera inséré dans la textarea quand tu tapes /shortcut…"
                  rows={5}
                  disabled={submitting}
                  className="text-[12px]"
                />
              </div>
              <Button
                onClick={createSnippet}
                disabled={submitting}
                className="gap-1.5"
                size="sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Création…
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    Créer le snippet
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <ul className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <li className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </li>
          ) : items.length === 0 ? (
            <li className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-muted-foreground">
              <MessageSquareWarning className="size-6 opacity-50" />
              <p className="max-w-xs text-[11.5px] leading-relaxed">
                Pas encore de snippet. Crée ton premier pour pouvoir l&apos;insérer
                via <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10.5px]">/</kbd> dans le chat.
              </p>
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-[11.5px] text-muted-foreground">
              Aucun résultat pour « {q} »
            </li>
          ) : (
            filtered.map((it) => {
              const isEditing = it.id === editingId;
              if (isEditing) {
                return (
                  <li
                    key={it.id}
                    className="border-b border-border/50 bg-primary/5 px-3 py-2 last:border-b-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary">
                        Édition
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={resetEdit}
                        aria-label="Annuler"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <Input
                        value={editShortcut}
                        onChange={(e) => setEditShortcut(e.target.value)}
                        placeholder="shortcut"
                        disabled={savingEdit}
                      />
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Titre"
                        disabled={savingEdit}
                      />
                    </div>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={4}
                      disabled={savingEdit}
                      className="text-[12px] mb-2"
                    />
                    <Button
                      onClick={saveEdit}
                      disabled={savingEdit}
                      size="sm"
                      className="gap-1.5"
                    >
                      {savingEdit ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Enregistrement…
                        </>
                      ) : (
                        <>
                          <Save className="size-3.5" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                  </li>
                );
              }
              return (
                <li
                  key={it.id}
                  className={cn(
                    "group flex items-start gap-2 border-b border-border/50 px-3 py-2 last:border-b-0 transition-colors hover:bg-muted/40"
                  )}
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    /
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[12px] font-semibold leading-snug text-foreground">
                      <code className="rounded bg-muted px-1 py-px font-mono text-[10.5px] text-indigo-700 dark:text-indigo-300">
                        /{it.shortcut}
                      </code>
                      <span className="truncate">{it.title}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground whitespace-pre-wrap">
                      {truncate(it.content.replace(/\s+/g, " "), 160)}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">
                      {fmtRelative(it.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => startEdit(it)}
                      title="Éditer"
                      aria-label="Éditer"
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteTargetId(it.id)}
                      title="Supprimer"
                      aria-label="Supprimer"
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <ConfirmDeleteDialog
          open={!!deleteTarget}
          onOpenChange={(v) => !v && setDeleteTargetId(null)}
          title="Supprimer ce snippet ?"
          description={
            deleteTarget
              ? `« /${deleteTarget.shortcut} — ${truncate(deleteTarget.title, 60)} » sera supprimé définitivement.`
              : "Cette action est irréversible."
          }
          onConfirm={async () => {
            if (deleteTargetId) {
              await deleteSnippet(deleteTargetId);
              setDeleteTargetId(null);
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
