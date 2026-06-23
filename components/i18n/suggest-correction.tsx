"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { Languages, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface SuggestCorrectionProps {
  /** Locale cible. Si non fournie, on lit la locale active (next-intl). */
  locale?: string;
  /** Cible contenu DB (les 3 ensemble) OU uiKey. */
  model?: string;
  recordId?: string;
  field?: string;
  uiKey?: string;
  /** Texte source FR (référence, lecture seule). */
  sourceText: string;
  /** Traduction actuelle affichée au visiteur (pré-remplit la correction). */
  currentText?: string;
}

/**
 * Déclencheur discret « Proposer une correction » → ouvre un dialog glass.
 * Ne s'affiche QUE si la locale active n'est pas le FR (rien à corriger sur la
 * langue source). Réutilisable : sur le contenu DB (model+recordId+field) ou
 * une clé d'UI (uiKey). POST public vers /api/translation-suggestions.
 */
export function SuggestCorrection({
  locale,
  model,
  recordId,
  field,
  uiKey,
  sourceText,
  currentText,
}: SuggestCorrectionProps) {
  const activeLocale = useLocale();
  const targetLocale = locale ?? activeLocale;

  const [open, setOpen] = useState(false);
  const [suggested, setSuggested] = useState(currentText ?? "");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Langue source → aucune correction possible : on ne rend rien.
  if (targetLocale.toLowerCase().startsWith("fr")) return null;

  async function handleSubmit() {
    const value = suggested.trim();
    if (!value) {
      toast.error("Merci de saisir votre correction.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/translation-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: targetLocale,
          model: uiKey ? undefined : model,
          recordId: uiKey ? undefined : recordId,
          field: uiKey ? undefined : field,
          uiKey,
          sourceText,
          currentText: currentText || undefined,
          suggestedText: value,
          comment: comment.trim() || undefined,
          submittedBy: email.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("request failed");
      toast.success("Merci ! Votre proposition a bien été envoyée.");
      setOpen(false);
      setComment("");
      setEmail("");
    } catch {
      toast.error("Échec de l'envoi. Réessayez plus tard.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[color:var(--glass-ink-soft)] outline-none transition-colors hover:text-[color:var(--glass-accent-deep)] focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] rounded-md"
          />
        }
      >
        <Languages className="size-3.5" aria-hidden />
        Proposer une correction
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Proposer une correction</DialogTitle>
          <DialogDescription>
            Améliorez la traduction ({targetLocale.toUpperCase()}). Votre
            proposition sera relue avant publication.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Texte source (FR)
            </Label>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-input bg-muted/40 px-2.5 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {sourceText}
            </div>
          </div>

          {currentText ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Traduction actuelle
              </Label>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-input bg-muted/40 px-2.5 py-2 text-sm text-muted-foreground whitespace-pre-wrap">
                {currentText}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sc-suggested">Votre correction</Label>
            <Textarea
              id="sc-suggested"
              value={suggested}
              onChange={(e) => setSuggested(e.target.value)}
              rows={4}
              placeholder="Proposez une meilleure traduction…"
              maxLength={20000}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sc-comment">Commentaire (optionnel)</Label>
            <Textarea
              id="sc-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Un contexte utile pour la relecture ?"
              maxLength={2000}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sc-email">E-mail (optionnel)</Label>
            <Input
              id="sc-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.be"
              maxLength={200}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Envoyer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SuggestCorrection;
