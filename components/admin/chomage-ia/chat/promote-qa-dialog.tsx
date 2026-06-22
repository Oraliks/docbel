"use client";

/**
 * Dialog "Valider cette réponse comme source" (Feature 2).
 *
 * Affiché depuis le ContextMenu d'un message assistant. Permet à l'admin de
 * convertir un échange Q&A pertinent en KnowledgeSource permanente :
 *   - Question utilisateur d'origine (prefilled, lecture seule)
 *   - Réponse Claude (prefilled, lecture seule)
 *   - Titre éditable (initialement vide — l'admin doit le donner)
 *   - Tags simples (séparés par virgules)
 *   - Notes admin (libre, optionnel)
 *
 * À l'enregistrement, POST /api/chomage-ia/sources/from-qa qui crée la source
 * avec kind="qa", déclenche l'indexing RAG + l'auto-tag en background.
 *
 * Le folderId est volontairement omis du dialog pour simplifier le MVP — la
 * source est créée à la racine et l'admin peut la déplacer ensuite via la
 * vue Sources si besoin.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ChatMessage assistant à valider. */
  assistantMessageId: string;
  /** Contenu user message en amont (déjà extrait par le parent). */
  userQuestion: string;
  /** Contenu de la réponse assistant. */
  assistantAnswer: string;
  /** Callback après succès (parent refresh ou toast supplémentaire). */
  onCreated?: (sourceId: string) => void;
}

export function PromoteQaDialog({
  open,
  onOpenChange,
  assistantMessageId,
  userQuestion,
  assistantAnswer,
  onCreated,
}: Props) {
  const t = useTranslations("admin.chomageIa");
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  // Reset / pré-remplit le titre quand le dialog s'ouvre.
  // Suggestion de titre = premiers mots de la question, max ~80 chars.
  useEffect(() => {
    if (open) {
      const suggestion = userQuestion
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      setTitle(suggestion);
      setTagsInput("");
      setNotes("");
    }
  }, [open, userQuestion]);

  const trimmedTitle = title.trim();
  const tags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 50)
        .slice(0, 20),
    [tagsInput],
  );

  const canSubmit =
    trimmedTitle.length >= 2 && trimmedTitle.length <= 200 && !pending;

  async function handleSubmit() {
    if (!canSubmit) return;
    setPending(true);
    try {
      const res = await fetch("/api/chomage-ia/sources/from-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatMessageId: assistantMessageId,
          title: trimmedTitle,
          tags,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      toast.success(t("qaSourceCreated"), {
        description: data.title,
      });
      onCreated?.(data.id);
      onOpenChange(false);
    } catch (e) {
      toast.error(t("qaCreateError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("qaDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("qaDialogDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-title">{t("qaTitleLabel")}</Label>
            <Input
              id="qa-title"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              placeholder={t("qaTitlePlaceholder")}
              className="h-9 text-[12.5px]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("qaQuestionLabel")}
              </Label>
              <p className="max-h-24 overflow-y-auto rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[12px] leading-relaxed">
                {userQuestion}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("qaAnswerLabel")}
              </Label>
              <p className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[12px] leading-relaxed whitespace-pre-wrap">
                {assistantAnswer}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-tags">{t("qaTagsLabel")}</Label>
            <Input
              id="qa-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value.slice(0, 500))}
              placeholder={t("qaTagsPlaceholder")}
              className="h-9 text-[12.5px]"
            />
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qa-notes">{t("qaNotesLabel")}</Label>
            <Textarea
              id="qa-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 4000))}
              rows={3}
              placeholder={t("qaNotesPlaceholder")}
              className="text-[12.5px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {pending ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t("creating")}
              </>
            ) : (
              t("qaCreateSource")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
