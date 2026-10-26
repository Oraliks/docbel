"use client";

import { useLocale, useTranslations } from "next-intl";
import { isStagingTestPersistenceEnabled, PUBLIC_WRITES_PAUSED } from "@/lib/public-access";
import { TemporaryClosureNotice } from "@/components/docbel/temporary-closure-notice";

import { formatDateTime } from "@/lib/i18n/format";

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

/// Mention factuelle : une capacité ou une session ne vaut jamais confirmation
/// de sauvegarde. En V1 publique, le runner fournit toujours serverSaved=false.
export function AutoSaveNotice({ lastSavedAt, isPartOfBundle, serverSaved }: AutoSaveNoticeProps) {
  const t = useTranslations("public.contenu");
  const design = useTranslations("public.design");
  const locale = useLocale();

  if (PUBLIC_WRITES_PAUSED && !isStagingTestPersistenceEnabled()) {
    return <TemporaryClosureNotice kind={isPartOfBundle ? "existing" : "ephemeral"} compact />;
  }

  if (!serverSaved || !lastSavedAt) {
    return (
      <p className="text-xs text-[color:var(--glass-ink-soft)]">
        {design("ephemeralTitle")}
      </p>
    );
  }
  const time = formatDateTime(lastSavedAt, locale);
  return (
    <p className="text-xs text-[color:var(--glass-ink-soft)]">
      {t("autoSaveSaved", { time })}
      {isPartOfBundle && ` ${t("autoSaveBundleHint")}`}
    </p>
  );
}
