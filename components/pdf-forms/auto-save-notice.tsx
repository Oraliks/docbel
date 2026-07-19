"use client";

import { useTranslations } from "next-intl";

interface AutoSaveNoticeProps {
  lastSavedAt: Date | null;
  /// true si ce formulaire fait partie d'un dossier multi-documents (a un
  /// bundleRunId) — dans ce cas, le code de reprise du dossier existe déjà
  /// ailleurs (ResumeCodeBanner) ; on s'y réfère au lieu de dupliquer le
  /// mécanisme.
  isPartOfBundle: boolean;
  /// true quand les réponses sont RÉELLEMENT persistées côté serveur : dossier
  /// (brouillon serveur `draftPayloads`, même anonyme) OU utilisateur connecté.
  /// false pour un formulaire autonome anonyme : rien n'est enregistré tant que
  /// le PDF n'est pas généré — on ne le prétend donc pas (message honnête).
  serverSaved: boolean;
}

/// Surface visuelle de l'auto-save (debounce 1500ms côté PdfFormRunner) —
/// n'introduit AUCUNE nouvelle logique de sauvegarde. Le texte s'adapte à la
/// réalité : « enregistrées automatiquement » seulement quand c'est vrai.
export function AutoSaveNotice({ lastSavedAt, isPartOfBundle, serverSaved }: AutoSaveNoticeProps) {
  const t = useTranslations("public.contenu");

  if (!serverSaved) {
    return (
      <p className="text-xs text-[color:var(--glass-ink-soft)]">
        {t("autoSaveLocalOnly")}
      </p>
    );
  }
  const time = lastSavedAt
    ? lastSavedAt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })
    : "none";
  return (
    <p className="text-xs text-[color:var(--glass-ink-soft)]">
      {t("autoSaveSaved", { time })}
      {isPartOfBundle && ` ${t("autoSaveBundleHint")}`}
    </p>
  );
}
