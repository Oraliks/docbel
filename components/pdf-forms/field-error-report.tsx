"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FlagIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field";

interface Props {
  /// Le message d'erreur à afficher. Si vide, on n'affiche rien.
  error?: string;
  /// Identité du champ pour le report.
  fieldId: string;
  fieldType: string;
  /// Valeur exacte saisie par l'utilisateur (sera envoyée si signalement).
  rejectedValue: unknown;
  /// Contexte du formulaire (optionnel : null si pas dans un PdfForm).
  formId?: string;
  formSlug?: string;
  locale?: string;
}

/// Remplace `<FieldError>` : affiche l'erreur + un petit lien « Signaler »
/// qui ouvre une dialog pour transmettre un faux positif à l'admin.
export function FieldErrorReport({
  error,
  fieldId,
  fieldType,
  rejectedValue,
  formId,
  formSlug,
  locale,
}: Props) {
  if (!error) return null;

  return (
    <div className="flex flex-col gap-1">
      <FieldError>{error}</FieldError>
      <ReportDialogTrigger
        fieldId={fieldId}
        fieldType={fieldType}
        rejectedValue={rejectedValue}
        errorMessage={error}
        formId={formId}
        formSlug={formSlug}
        locale={locale}
      />
    </div>
  );
}

interface TriggerProps extends Omit<Props, "error"> {
  errorMessage: string;
}

function ReportDialogTrigger({
  fieldId,
  fieldType,
  rejectedValue,
  errorMessage,
  formId,
  formSlug,
  locale,
}: TriggerProps) {
  const [open, setOpen] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const valueAsString = stringifyValue(rejectedValue);

  async function submit() {
    if (!consent) {
      toast.error("Cochez la case pour autoriser l'envoi de votre saisie.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/form-validation/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId,
          formSlug,
          fieldId,
          fieldType,
          rejectedValue: valueAsString,
          errorMessage,
          locale,
          userMessage: userMessage.trim() || undefined,
          reporterEmail: email.trim() || undefined,
        }),
      });
      if (res.status === 429) {
        toast.error("Trop de signalements envoyés. Réessayez dans une heure.");
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? "Échec de l'envoi du signalement.");
        return;
      }
      setDone(true);
      toast.success("Signalement envoyé. Merci !");
    } catch {
      toast.error("Réseau indisponible. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          // reset lifecycle when the dialog closes
          setTimeout(() => {
            setDone(false);
            setUserMessage("");
            setEmail("");
          }, 200);
        }
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="self-start text-[11px] text-muted-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
          >
            <FlagIcon className="size-3" />
            Vous êtes sûr de votre saisie ? Signaler un problème
          </button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Signaler un problème de validation</DialogTitle>
          <DialogDescription>
            Vous pensez que votre saisie est correcte mais le site la refuse ?
            Envoyez-nous le détail, on regarde de notre côté.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-800 dark:text-green-300">
            Merci ! Votre signalement a bien été envoyé. Si vous avez laissé
            votre email, on vous répond dès qu&apos;on a investigué.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span className="text-muted-foreground">Champ</span>
                <code className="text-[11px]">{fieldId} ({fieldType})</code>
                <span className="text-muted-foreground">Votre saisie</span>
                <code className="text-[11px] break-all">{valueAsString || "(vide)"}</code>
                <span className="text-muted-foreground">Erreur affichée</span>
                <span>{errorMessage}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="report-message" className="text-xs">
                Détails (optionnel)
              </Label>
              <Textarea
                id="report-message"
                rows={3}
                maxLength={1000}
                placeholder="Ex. : c'est bien mon NISS, je l'ai vérifié au dos de ma carte d'identité…"
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="report-email" className="text-xs">
                Votre email (optionnel — pour qu&apos;on vous réponde)
              </Label>
              <Input
                id="report-email"
                type="email"
                placeholder="vous@exemple.be"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                J&apos;autorise la transmission de ma saisie ({fieldType}) pour
                permettre à l&apos;équipe technique de reproduire et corriger
                le problème. Ces données ne sont conservées que pour le suivi
                du signalement.
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button type="button" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={submit} disabled={submitting || !consent}>
                {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <FlagIcon className="size-4" />}
                Envoyer le signalement
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}
