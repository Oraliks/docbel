"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FlagIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useReportSubmit } from "@/components/reports/use-report-submit";
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
  /// Id posé sur le message d'erreur lui-même (et PAS sur le lien
  /// « Signaler »), pour que le contrôle fautif le référence via
  /// `aria-describedby` : au focus, le lecteur d'écran énonce alors la raison
  /// du blocage et pas seulement le nom du champ.
  messageId?: string;
}

/// Vrai si le citoyen a écrit QUELQUE CHOSE dans ce champ — la seule
/// situation où « Vous êtes sûr de votre saisie ? » a un sens.
///
/// Un champ obligatoire resté vide déclenche aussi une erreur, mais il n'y a
/// alors aucune saisie à défendre : proposer de la signaler n'apprend rien à
/// l'administrateur, et l'étape Identité du C1 affichait dix fois le lien au
/// premier « Continuer » à blanc (2026-08-02).
///
/// On regarde À L'INTÉRIEUR des valeurs composées : un `fullname` vierge est
/// un objet (que `JSON.stringify` rendrait « {} », donc non vide), et le
/// tableau des cohabitants crée une ligne blanche au clic sur « Ajouter ».
export function aUneSaisieSignalable(valeur: unknown): boolean {
  if (valeur === null || valeur === undefined) return false;
  if (typeof valeur === "string") return valeur.trim() !== "";
  if (typeof valeur === "boolean") return valeur;
  if (typeof valeur === "number") return true; // 0 € est une réponse.
  if (Array.isArray(valeur)) return valeur.some((v) => aUneSaisieSignalable(v));
  if (typeof valeur === "object") {
    return Object.values(valeur as Record<string, unknown>).some((v) => aUneSaisieSignalable(v));
  }
  return false;
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
  messageId,
}: Props) {
  if (!error) return null;

  return (
    <div className="flex flex-col gap-1">
      {/* `role="alert"` est déjà porté par <FieldError> (components/ui/field) :
          l'apparition du message est donc annoncée d'office. On n'ajoute ici
          que l'ancre `id` du `aria-describedby` — un `aria-live` en plus
          rétrograderait la politesse de la région. */}
      <FieldError id={messageId}>{error}</FieldError>
      {aUneSaisieSignalable(rejectedValue) && (
        <ReportDialogTrigger
          fieldId={fieldId}
          fieldType={fieldType}
          rejectedValue={rejectedValue}
          errorMessage={error}
          formId={formId}
          formSlug={formSlug}
          locale={locale}
        />
      )}
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
  const t = useTranslations("public.dossier");
  const [open, setOpen] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(true);
  const [done, setDone] = useState(false);
  const { submit: submitReport, status } = useReportSubmit("form_validation");
  const submitting = status === "submitting";

  const valueAsString = stringifyValue(rejectedValue);

  async function submit() {
    if (!consent) {
      toast.error(t("ferConsentRequired"));
      return;
    }
    const result = await submitReport({
      targetId: formId,
      message: userMessage.trim() || undefined,
      payload: { fieldId, fieldType, rejectedValue: valueAsString, errorMessage, formSlug, locale },
      reporterEmail: email.trim() || undefined,
    });
    if (!result.ok) {
      if (result.error.includes("Trop de signalements")) {
        toast.error(t("ferRateLimited"));
      } else {
        toast.error(result.error || t("ferSendFailed"));
      }
      return;
    }
    setDone(true);
    toast.success(t("ferSendSuccess"));
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
            {t("ferTriggerLabel")}
          </button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("ferDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("ferDialogDescription")}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-3 text-sm text-green-800 dark:text-green-300">
            {t("ferDoneMessage")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span className="text-muted-foreground">{t("ferLabelField")}</span>
                <code className="text-[11px]">{fieldId} ({fieldType})</code>
                <span className="text-muted-foreground">{t("ferLabelYourInput")}</span>
                <code className="text-[11px] break-all">{valueAsString || t("ferEmptyValue")}</code>
                <span className="text-muted-foreground">{t("ferLabelShownError")}</span>
                <span>{errorMessage}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="report-message" className="text-xs">
                {t("ferDetailsLabel")}
              </Label>
              <Textarea
                id="report-message"
                rows={3}
                maxLength={1000}
                placeholder={t("ferDetailsPlaceholder")}
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="report-email" className="text-xs">
                {t("ferEmailLabel")}
              </Label>
              <Input
                id="report-email"
                type="email"
                placeholder={t("ferEmailPlaceholder")}
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
                {t("ferConsentText", { fieldType })}
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button type="button" onClick={() => setOpen(false)}>
              {t("ferBtnClose")}
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("ferBtnCancel")}
              </Button>
              <Button type="button" onClick={submit} disabled={submitting || !consent}>
                {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <FlagIcon className="size-4" />}
                {t("ferBtnSend")}
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
