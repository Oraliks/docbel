"use client";

/**
 * Modal de création / édition d'une KnowledgeSource (texte / URL / tutoriel / transcript).
 *
 * Pour l'upload PDF/image, voir `upload-dialog.tsx` (route séparée).
 *
 * En mode édition, la modal récupère la source complète au mount (GET /sources/[id]).
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KIND_LABELS } from "../_shared";

interface SourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  domain: string;
  sourceId?: string | null;
  onSuccess: () => void;
}

interface FormState {
  title: string;
  kind: string;
  content: string;
  summary: string;
  sourceUrl: string;
  tagsRaw: string;
  enabled: boolean;
}

// Kinds éditables via cette modal (pdf/image_caption passent par UploadDialog).
const EDITABLE_KINDS = ["text", "url", "tutorial", "video_transcript"] as const;

const EMPTY: FormState = {
  title: "",
  kind: "text",
  content: "",
  summary: "",
  sourceUrl: "",
  tagsRaw: "",
  enabled: true,
};

export function SourceFormDialog({
  open,
  onOpenChange,
  mode,
  domain,
  sourceId,
  onSuccess,
}: SourceFormDialogProps) {
  const [state, setState] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Pour les sources non-éditables (pdf/image_caption), on autorise l'édition
  // mais on ne propose pas le sélecteur de kind.
  const [lockedKind, setLockedKind] = useState<string | null>(null);

  // Reset à chaque open en mode create.
  useEffect(() => {
    if (open && mode === "create") {
      setState(EMPTY);
      setLockedKind(null);
    }
  }, [open, mode]);

  // Charge la source en mode edit.
  useEffect(() => {
    if (!open || mode !== "edit" || !sourceId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/chomage-ia/sources/${sourceId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const isEditable = (EDITABLE_KINDS as readonly string[]).includes(
          data.kind
        );
        setState({
          title: data.title ?? "",
          kind: data.kind ?? "text",
          content: data.content ?? "",
          summary: data.summary ?? "",
          sourceUrl: data.sourceUrl ?? "",
          tagsRaw: Array.isArray(data.tags) ? data.tags.join(", ") : "",
          enabled: !!data.enabled,
        });
        setLockedKind(isEditable ? null : data.kind);
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
  }, [open, mode, sourceId]);

  async function save() {
    if (state.title.trim().length < 2) {
      toast.error("Titre trop court (2 caractères minimum)");
      return;
    }
    if (state.content.trim().length < 10) {
      toast.error("Contenu trop court (10 caractères minimum)");
      return;
    }
    const tags = state.tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 50)
      .slice(0, 20);

    const body = {
      title: state.title.trim(),
      kind: state.kind,
      content: state.content,
      summary: state.summary.trim() || null,
      sourceUrl: state.sourceUrl.trim() || null,
      tags,
      enabled: state.enabled,
      domain,
    };

    setSaving(true);
    try {
      const url =
        mode === "create"
          ? "/api/chomage-ia/sources"
          : `/api/chomage-ia/sources/${sourceId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast.success(
        mode === "create" ? "Source créée" : "Source mise à jour"
      );
      onSuccess();
    } catch (e) {
      toast.error("Échec de l'enregistrement", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Nouvelle source de connaissance"
              : "Éditer la source"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Ajoute un contenu (texte, URL, tutoriel, transcript) qui alimentera l'IA chômage."
              : "Modifie le contenu, les tags ou désactive temporairement."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Titre */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ks-title">Titre *</Label>
              <Input
                id="ks-title"
                value={state.title}
                onChange={(e) =>
                  setState((s) => ({ ...s, title: e.target.value }))
                }
                placeholder="Ex: AR du 25/11/1991 — art. 110 : conditions d'admissibilité"
              />
            </div>

            {/* Kind (sélecteur seulement si kind n'est pas un PDF/image édité) */}
            {!lockedKind ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ks-kind">Type *</Label>
                <Select
                  value={state.kind}
                  onValueChange={(v) =>
                    v && setState((s) => ({ ...s, kind: v }))
                  }
                >
                  <SelectTrigger id="ks-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(EDITABLE_KINDS as readonly string[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  PDF / image : utilise le bouton « Upload » de la page.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[12px] text-muted-foreground">
                Type : <strong>{KIND_LABELS[lockedKind] ?? lockedKind}</strong>{" "}
                (modifiable uniquement par re-upload).
              </div>
            )}

            {/* URL source */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ks-url">URL source (optionnel)</Label>
              <Input
                id="ks-url"
                type="url"
                value={state.sourceUrl}
                onChange={(e) =>
                  setState((s) => ({ ...s, sourceUrl: e.target.value }))
                }
                placeholder="https://www.onem.be/..."
              />
            </div>

            {/* Contenu */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ks-content">Contenu *</Label>
              <Textarea
                id="ks-content"
                value={state.content}
                onChange={(e) =>
                  setState((s) => ({ ...s, content: e.target.value }))
                }
                placeholder="Texte brut, markdown ou étapes structurées. L'IA lira ce contenu intégralement."
                rows={10}
                className="font-mono text-[12.5px]"
              />
              <p className="text-[11px] text-muted-foreground">
                {state.content.length} caractères (~
                {Math.ceil(state.content.length / 4)} tokens)
              </p>
            </div>

            {/* Summary */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ks-summary">Résumé court (optionnel)</Label>
              <Textarea
                id="ks-summary"
                value={state.summary}
                onChange={(e) =>
                  setState((s) => ({ ...s, summary: e.target.value }))
                }
                placeholder="Une ou deux phrases. Laisse vide pour générer via IA."
                rows={2}
              />
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ks-tags">Tags (séparés par des virgules)</Label>
              <Input
                id="ks-tags"
                value={state.tagsRaw}
                onChange={(e) =>
                  setState((s) => ({ ...s, tagsRaw: e.target.value }))
                }
                placeholder="ex: ONEM, admissibilité, AR, art-110"
              />
            </div>

            {/* Enabled */}
            <label className="inline-flex items-center gap-2 text-[12.5px] font-medium">
              <Checkbox
                checked={state.enabled}
                onCheckedChange={(checked) =>
                  setState((s) => ({ ...s, enabled: checked === true }))
                }
              />
              Activée (envoyée à l&apos;IA)
            </label>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Enregistrement…
              </>
            ) : mode === "create" ? (
              "Créer"
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
