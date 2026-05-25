"use client";

/**
 * Drawer droit (Shadcn Sheet, side="right") qui affiche le détail complet
 * d'une source de la KB avec édition inline.
 *
 * Lors de l'ouverture (open=true + sourceId), on fetch GET /sources/[id]
 * qui retourne déjà le `content` complet (cf. route existante).
 *
 * Edition contrôlée :
 *   - Titre, URL source, Tags (parse virgules + chips), Summary, Content
 *   - Switch enabled
 *   - Kind affiché en lecture seule (pas de changement de kind en édit ;
 *     on doit re-uploader pour ça)
 *
 * Le footer expose : "Enregistrer" (dirty), "Réindexer", "Supprimer".
 * Si l'utilisateur ferme le drawer avec des modifs non sauvées, un confirm
 * AlertDialog s'affiche (`unsavedConfirmOpen`).
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { KnowledgeSourceListItem } from "@/lib/chomage-ia/types";
import { getKindIcon, getKindLabel, getKindColor, fmtRelative } from "../../_shared";
import { ConfirmDeleteDialog } from "../../_shared-alerts";
import { getValidityMeta } from "./_shared-table";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ID de la source courante. Si null → drawer vide (transition de fermeture). */
  sourceId: string | null;
  /** Item liste cached (sert d'affichage instant pendant le fetch). */
  cachedItem?: KnowledgeSourceListItem | null;
  /** Appelé après save / reindex / delete. Le parent refresh la liste. */
  onSaved: () => void;
  onDeleted: () => void;
}

interface DetailState {
  id: string;
  title: string;
  kind: string;
  content: string;
  summary: string;
  sourceUrl: string;
  tags: string[];
  enabled: boolean;
  indexedAt: string | null;
  indexError: string | null;
  validityStatus: KnowledgeSourceListItem["validityStatus"];
  lastValidatedAt: string | null;
}

export function SourceDetailDrawer({
  open,
  onOpenChange,
  sourceId,
  cachedItem,
  onSaved,
  onDeleted,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [state, setState] = useState<DetailState | null>(null);
  const [initial, setInitial] = useState<DetailState | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Charge le détail complet à chaque (re)open.
  useEffect(() => {
    if (!open || !sourceId) return;
    let cancelled = false;
    setLoading(true);
    setState(null);
    setInitial(null);
    (async () => {
      try {
        const res = await fetch(`/api/chomage-ia/sources/${sourceId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const next: DetailState = {
          id: data.id,
          title: data.title ?? "",
          kind: data.kind ?? "text",
          content: data.content ?? "",
          summary: data.summary ?? "",
          sourceUrl: data.sourceUrl ?? "",
          tags: Array.isArray(data.tags) ? data.tags : [],
          enabled: !!data.enabled,
          indexedAt: data.indexedAt ?? null,
          indexError: data.indexError ?? null,
          validityStatus: (data.validityStatus ??
            "unknown") as KnowledgeSourceListItem["validityStatus"],
          lastValidatedAt: data.lastValidatedAt ?? null,
        };
        setState(next);
        setInitial(next);
      } catch (e) {
        toast.error("Impossible de charger la source", {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sourceId]);

  const dirty = useMemo(() => {
    if (!state || !initial) return false;
    if (state.title !== initial.title) return true;
    if (state.content !== initial.content) return true;
    if (state.summary !== initial.summary) return true;
    if (state.sourceUrl !== initial.sourceUrl) return true;
    if (state.enabled !== initial.enabled) return true;
    if (state.tags.length !== initial.tags.length) return true;
    if (!state.tags.every((t, i) => t === initial.tags[i])) return true;
    return false;
  }, [state, initial]);

  function update<K extends keyof DetailState>(
    key: K,
    value: DetailState[K]
  ) {
    setState((s) => (s ? { ...s, [key]: value } : s));
  }

  function commitTag(raw: string) {
    if (!state) return;
    const v = raw.trim().slice(0, 50);
    if (!v) return;
    if (state.tags.includes(v)) {
      setTagInput("");
      return;
    }
    update("tags", [...state.tags, v].slice(0, 20));
    setTagInput("");
  }
  function removeTag(t: string) {
    if (!state) return;
    update(
      "tags",
      state.tags.filter((x) => x !== t)
    );
  }

  async function handleSave() {
    if (!state) return;
    if (state.title.trim().length < 2) {
      toast.error("Titre trop court (2 caractères minimum)");
      return;
    }
    if (state.content.trim().length < 10) {
      toast.error("Contenu trop court (10 caractères minimum)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/chomage-ia/sources/${state.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title.trim(),
          content: state.content,
          summary: state.summary.trim() || null,
          sourceUrl: state.sourceUrl.trim() || null,
          tags: state.tags,
          enabled: state.enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast.success("Source mise à jour");
      setInitial(state);
      onSaved();
    } catch (e) {
      toast.error("Échec de l'enregistrement", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleReindex() {
    if (!state || reindexing) return;
    setReindexing(true);
    try {
      const res = await fetch(
        `/api/chomage-ia/sources/${state.id}/reindex`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data.indexError) {
        toast.warning("Indexation partielle", { description: data.indexError });
      } else {
        toast.success(
          `Indexation OK · ${data.reindexedCount ?? 0} chunk(s) (re)embeddés`
        );
      }
      onSaved();
    } catch (e) {
      toast.error("Échec indexation", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setReindexing(false);
    }
  }

  async function handleDelete() {
    if (!state) return;
    try {
      const res = await fetch(`/api/chomage-ia/sources/${state.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Source supprimée");
      onDeleted();
      onOpenChange(false);
    } catch (e) {
      toast.error("Échec de la suppression", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Affichage : si pas encore loadé, on montre la cached card pour éviter
  // le flash blanc.
  const display = state ?? (cachedItem
    ? {
        id: cachedItem.id,
        title: cachedItem.title,
        kind: cachedItem.kind,
        content: "",
        summary: cachedItem.summary ?? "",
        sourceUrl: cachedItem.sourceUrl ?? "",
        tags: cachedItem.tags,
        enabled: cachedItem.enabled,
        indexedAt: cachedItem.indexedAt,
        indexError: cachedItem.indexError,
        validityStatus: cachedItem.validityStatus,
        lastValidatedAt: cachedItem.lastValidatedAt,
      }
    : null);

  async function handleRevalidate() {
    if (!state) return;
    try {
      const res = await fetch(
        `/api/chomage-ia/sources/${state.id}/revalidate`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const next: DetailState = {
        ...state,
        validityStatus: data.validityStatus ?? "fresh",
        lastValidatedAt: data.lastValidatedAt ?? new Date().toISOString(),
      };
      setState(next);
      setInitial(next);
      toast.success("Source marquée comme à jour");
      onSaved();
    } catch (e) {
      toast.error("Échec de la revalidation", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-[440px] max-w-[90vw] sm:max-w-[440px] flex flex-col gap-0 p-0"
        >
          <SheetHeader className="flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2 truncate text-[13.5px]">
              {display ? (
                <KindBadge kind={display.kind} />
              ) : null}
              <span className="truncate">
                {display?.title || "Détail de la source"}
              </span>
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpenChange(false)}
              aria-label="Fermer"
              className="shrink-0"
            >
              <X className="size-4" />
            </Button>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {loading && !state ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : state ? (
              <div className="flex flex-col gap-3">
                {/* Switch enabled */}
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-semibold">
                      {state.enabled ? "Active" : "Désactivée"}
                    </span>
                    <span className="text-[10.5px] text-muted-foreground">
                      {state.enabled
                        ? "Cette source est envoyée à l'IA."
                        : "Ignorée par l'IA tant que désactivée."}
                    </span>
                  </div>
                  <Switch
                    checked={state.enabled}
                    onCheckedChange={(c) => update("enabled", c)}
                  />
                </div>

                {/* Fraîcheur (Feature 3) */}
                <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="flex flex-col">
                    <span
                      className={`text-[12px] font-semibold ${getValidityMeta(state.validityStatus).className}`}
                    >
                      {getValidityMeta(state.validityStatus).emoji}{" "}
                      {getValidityMeta(state.validityStatus).label}
                    </span>
                    <span className="text-[10.5px] text-muted-foreground">
                      {state.lastValidatedAt
                        ? `Revalidée ${fmtRelative(state.lastValidatedAt)}`
                        : "Jamais revalidée manuellement"}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevalidate}
                    className="shrink-0"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Toujours en vigueur
                  </Button>
                </div>

                {/* Titre */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="drawer-title" className="text-[11px]">
                    Titre
                  </Label>
                  <Input
                    id="drawer-title"
                    value={state.title}
                    onChange={(e) => update("title", e.target.value)}
                    className="h-8 text-[12.5px]"
                  />
                </div>

                {/* Kind (read-only) */}
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px]">Type</Label>
                  <div className="flex h-8 items-center rounded-md border border-border bg-muted/30 px-2.5 text-[12px] text-muted-foreground">
                    {getKindLabel(state.kind)}{" "}
                    <span className="ml-1 text-[10.5px] opacity-70">
                      (re-uploader pour changer)
                    </span>
                  </div>
                </div>

                {/* URL source */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="drawer-url" className="text-[11px]">
                    URL source
                  </Label>
                  <div className="relative">
                    <Input
                      id="drawer-url"
                      type="url"
                      value={state.sourceUrl}
                      onChange={(e) => update("sourceUrl", e.target.value)}
                      placeholder="https://www.onem.be/…"
                      className="h-8 pr-8 text-[12px]"
                    />
                    {state.sourceUrl ? (
                      <a
                        href={state.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                        title="Ouvrir"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="drawer-tags" className="text-[11px]">
                    Tags
                  </Label>
                  <div className="flex min-h-[34px] flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1">
                    {state.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground"
                      >
                        {t}
                        <button
                          type="button"
                          aria-label={`Retirer ${t}`}
                          onClick={() => removeTag(t)}
                          className="rounded-sm hover:bg-foreground/10"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))}
                    <Input
                      id="drawer-tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          commitTag(tagInput);
                        } else if (
                          e.key === "Backspace" &&
                          tagInput === "" &&
                          state.tags.length > 0
                        ) {
                          const last = state.tags[state.tags.length - 1];
                          update("tags", state.tags.slice(0, -1));
                          setTagInput(last);
                        }
                      }}
                      onBlur={() => commitTag(tagInput)}
                      placeholder={
                        state.tags.length === 0
                          ? "ONEM, admissibilité, …"
                          : ""
                      }
                      className="h-6 flex-1 min-w-[80px] border-0 px-1 text-[12px] shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="drawer-summary" className="text-[11px]">
                    Résumé court (optionnel)
                  </Label>
                  <Textarea
                    id="drawer-summary"
                    value={state.summary}
                    onChange={(e) => update("summary", e.target.value)}
                    rows={3}
                    className="text-[12.5px]"
                  />
                </div>

                {/* Content full */}
                <div className="flex flex-col gap-1">
                  <Label htmlFor="drawer-content" className="text-[11px]">
                    Contenu (envoyé à l&apos;IA)
                  </Label>
                  <Textarea
                    id="drawer-content"
                    value={state.content}
                    onChange={(e) => update("content", e.target.value)}
                    rows={15}
                    className="font-mono text-[11.5px] max-h-[420px]"
                  />
                  <p className="text-[10.5px] text-muted-foreground">
                    {state.content.length} caractères (~
                    {Math.ceil(state.content.length / 4)} tokens)
                  </p>
                </div>

                {/* Index status hint */}
                {state.indexError ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                    Indexation : {state.indexError}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                disabled={!state || saving}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Supprimer
              </Button>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!state || reindexing || saving}
                  onClick={handleReindex}
                >
                  {reindexing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCcw className="size-3.5" />
                  )}
                  Réindexer
                </Button>
                <Button
                  size="sm"
                  disabled={!state || saving || !dirty}
                  onClick={handleSave}
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer cette source ?"
        description={
          state
            ? `« ${state.title.slice(0, 80)}${
                state.title.length > 80 ? "…" : ""
              } » sera supprimée définitivement.`
            : ""
        }
        onConfirm={async () => {
          await handleDelete();
        }}
      />
    </>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const Icon = getKindIcon(kind);
  const color = getKindColor(kind);
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-md"
      style={{ background: `${color}1A`, color }}
      title={getKindLabel(kind)}
    >
      <Icon className="size-3" />
    </span>
  );
}
