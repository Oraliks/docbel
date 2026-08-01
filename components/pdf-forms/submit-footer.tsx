"use client";

import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  Loader2Icon,
  SendIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AutoSaveNotice } from "./auto-save-notice";
import { ResetFormButton } from "./reset-form-button";
import { useTranslations } from "next-intl";
import type { PdfFormTrigger } from "@/lib/pdf-forms/types";

/// Pied du formulaire, extrait du `PdfFormRunner` (lot S12) où il vivait en
/// double — une fois par rendu.
///
/// Les deux copies partageaient toute leur LOGIQUE (quand proposer le choix de
/// livraison, quel libellé et quelle icône pour le bouton d'envoi, quand
/// afficher le bloc de signature) mais divergeaient sur le DESSIN : le rendu
/// classique est compact, le rendu macro est taillé pour le doigt. D'où une
/// seule `variant` plutôt que dix réglages : ce n'est pas une unification du
/// design, c'est la logique qu'on cesse d'écrire deux fois. Le JSX de chaque
/// variante est celui d'origine, à l'identique.
export type FooterVariant = "compact" | "confortable";

interface CommonProps {
  variant: FooterVariant;
  t: ReturnType<typeof useTranslations>;
  /// Rendu DANS un dossier : ni choix de livraison, ni destinataire Doccle, et
  /// le bouton final valide au lieu de générer.
  bundleRunId?: string;
  serverSaved: boolean;
  lastSavedAt: Date | null;
  submitting: boolean;
  resetForm: () => void;
  /// Faux sur la première étape : « Précédent » y appellerait `setActive(-1)`.
  canGoPrevious: boolean;
  onPrevious: () => void;
}

interface StepFooterProps extends CommonProps {
  onContinue: () => void;
}

interface SubmitFooterProps extends CommonProps {
  allowDownload: boolean;
  allowDoccle: boolean;
  delivery: "download" | "doccle";
  setDelivery: (d: "download" | "doccle") => void;
  doccleRef: string;
  setDoccleRef: (v: string) => void;
  hasSignature: boolean;
  signerName: string;
  invalidFields: { id: string; label: string }[];
  onJumpToInvalidField: (id: string) => void;
  consent: boolean;
  onConsentChange: (next: boolean) => void;
  consentError: boolean;
  /// Documents que les réponses viennent de déclencher. Affiché par le seul
  /// rendu macro — l'ajouter au rendu classique serait un changement d'écran.
  liveTriggers?: PdfFormTrigger[];
  /// Rendus par l'appelant : ces deux blocs ont leurs propres composants et
  /// leurs propres réglages de compacité.
  invalidSummary: React.ReactNode;
  consentCheckbox: React.ReactNode;
}

/// Icône et libellé du bouton final — quatre états, identiques dans les deux
/// rendus : envoi en cours, validation dans un dossier, envoi Doccle, ou
/// génération et téléchargement.
function submitLabel(
  t: CommonProps["t"],
  submitting: boolean,
  bundleRunId: string | undefined,
  delivery: "download" | "doccle",
) {
  const icon = submitting ? (
    <Loader2Icon className="size-4 animate-spin" />
  ) : bundleRunId ? (
    <CheckCircle2Icon className="size-4" />
  ) : delivery === "doccle" ? (
    <SendIcon className="size-4" />
  ) : (
    <DownloadIcon className="size-4" />
  );
  const texte = submitting
    ? t("runnerGenerating")
    : bundleRunId
      ? t("runnerSubmitValidate")
      : delivery === "doccle"
        ? t("runnerSubmitSignAndSend")
        : t("runnerSubmitSignAndGenerate");
  return { icon, texte };
}

/// Pied d'une étape INTERMÉDIAIRE : navigation seule.
export function StepFooter({
  variant,
  t,
  bundleRunId,
  serverSaved,
  lastSavedAt,
  submitting,
  resetForm,
  canGoPrevious,
  onPrevious,
  onContinue,
}: StepFooterProps) {
  const notice = (
    <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} serverSaved={serverSaved} />
  );
  const reset = <ResetFormButton onConfirm={resetForm} disabled={submitting} />;

  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-3 border-t border-[color:var(--glass-border)] pt-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            {canGoPrevious && (
              <Button type="button" variant="outline" className="rounded-full" onClick={onPrevious}>
                <ChevronLeftIcon className="size-4" /> {t("previous")}
              </Button>
            )}
            <Button type="button" className="rounded-full px-6" onClick={onContinue}>
              {t("continue")} <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          {notice}
          {reset}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[color:var(--glass-ink-line)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {notice}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {canGoPrevious && (
              <Button type="button" variant="outline" className="min-h-12 rounded-full" onClick={onPrevious}>
                <ChevronLeftIcon className="size-4" /> {t("previous")}
              </Button>
            )}
            <Button type="button" className="min-h-12 rounded-full px-6" onClick={onContinue}>
              {t("continue")} <ChevronRightIcon className="size-4" />
            </Button>
          </div>
          {reset}
        </div>
      </div>
    </div>
  );
}

/// Pied de la DERNIÈRE étape : livraison, signature, consentement, envoi.
export function SubmitFooter(props: SubmitFooterProps) {
  const {
    variant,
    t,
    bundleRunId,
    allowDownload,
    allowDoccle,
    delivery,
    setDelivery,
    doccleRef,
    setDoccleRef,
    hasSignature,
    signerName,
    liveTriggers,
    invalidSummary,
    consentCheckbox,
    serverSaved,
    lastSavedAt,
    submitting,
    resetForm,
    canGoPrevious,
    onPrevious,
  } = props;

  const compact = variant === "compact";
  const choixLivraison = !bundleRunId && allowDownload && allowDoccle;
  const destinataireDoccle = !bundleRunId && delivery === "doccle";
  const { icon, texte } = submitLabel(t, submitting, bundleRunId, delivery);

  const blocLivraison = choixLivraison && (
    <div className="flex flex-col gap-2">
      <span
        className={
          compact
            ? "text-xs font-medium text-muted-foreground"
            : "text-base font-bold text-muted-foreground"
        }
      >
        {t("runnerDeliveryModeLabel")}
      </span>
      <div className="flex gap-1.5">
        <Button
          type="button"
          {...(compact ? { size: "sm" as const } : { className: "min-h-11" })}
          variant={delivery === "download" ? "default" : "outline"}
          onClick={() => setDelivery("download")}
        >
          <DownloadIcon className="size-4" /> {t("runnerDeliveryDownload")}
        </Button>
        <Button
          type="button"
          {...(compact ? { size: "sm" as const } : { className: "min-h-11" })}
          variant={delivery === "doccle" ? "default" : "outline"}
          onClick={() => setDelivery("doccle")}
        >
          <SendIcon className="size-4" /> {t("runnerDeliveryDoccle")}
        </Button>
      </div>
    </div>
  );

  // Deux `id` distincts : les deux rendus peuvent coexister dans le DOM, et un
  // `htmlFor` ambigu casserait le lien libellé/champ.
  const idDoccle = compact ? "doccle-ref" : "doccle-ref-macro";
  const blocDoccle = destinataireDoccle && (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={idDoccle}>{t("runnerDoccleRecipientLabel")}</Label>
      <Input
        id={idDoccle}
        value={doccleRef}
        placeholder={t("runnerDoccleRecipientPlaceholder")}
        onChange={(e) => setDoccleRef(e.target.value)}
      />
    </div>
  );

  const blocSignature = hasSignature && (
    <div
      className={
        compact
          ? "rounded-lg border border-dashed bg-muted/30 p-3 text-sm"
          : "rounded-2xl border border-dashed bg-muted/30 p-4 text-base"
      }
    >
      <div
        className={
          compact
            ? "text-[11px] uppercase tracking-wide text-muted-foreground"
            : "font-bold text-muted-foreground"
        }
      >
        {t("runnerDigitalSignatureLabel")}
      </div>
      {signerName ? (
        <>
          <div className="mt-1 font-serif text-lg italic">{signerName}</div>
          <div
            className={
              compact
                ? "mt-0.5 text-[11px] text-muted-foreground"
                : "mt-1 text-sm text-muted-foreground"
            }
          >
            {t("runnerDigitalSignatureAutoNote")}
          </div>
        </>
      ) : (
        <div
          className={
            compact
              ? "mt-1 text-xs text-amber-700 dark:text-amber-300"
              : "mt-1 text-sm text-amber-700 dark:text-amber-300"
          }
        >
          {t("runnerDigitalSignatureNameRequired")}
        </div>
      )}
    </div>
  );

  const notice = (
    <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} serverSaved={serverSaved} />
  );
  const reset = <ResetFormButton onConfirm={resetForm} disabled={submitting} />;

  if (compact) {
    return (
      <div className="flex flex-col gap-4">
        {blocLivraison}
        {blocDoccle}
        <Separator />
        {blocSignature}
        {invalidSummary}
        {consentCheckbox}
        <div className="flex items-center justify-between gap-2">
          {notice}
          {reset}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--glass-border)] pt-4">
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            {canGoPrevious && (
              <Button type="button" variant="outline" className="rounded-full" onClick={onPrevious}>
                <ChevronLeftIcon className="size-4" /> {t("previous")}
              </Button>
            )}
            <Button type="submit" disabled={submitting} className="rounded-full px-6">
              {icon}
              {texte}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-t border-[color:var(--glass-ink-line)] pt-4">
      {blocLivraison}
      {blocDoccle}
      {blocSignature}
      {invalidSummary}
      {consentCheckbox}
      {liveTriggers && liveTriggers.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
          {t("runnerLiveTriggerNotice", {
            titles: liveTriggers.map((tr) => tr.reason?.fr || tr.requiresFormSlug).join(", "),
          })}
        </p>
      )}
      {/* Pied de rangée : mention d'auto-save à gauche, paire de boutons à
          droite, « Recommencer » juste SOUS cette paire — discret, aligné à
          droite. Jamais sur la même ligne que la mention, qui l'éloignerait du
          geste auquel il se rapporte. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {notice}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {canGoPrevious && (
              <Button type="button" variant="outline" className="min-h-12 rounded-full" onClick={onPrevious}>
                <ChevronLeftIcon className="size-4" /> {t("previous")}
              </Button>
            )}
            <Button type="submit" disabled={submitting} className="min-h-12 rounded-full px-6">
              {icon}
              {texte}
            </Button>
          </div>
          {reset}
        </div>
      </div>
    </div>
  );
}
