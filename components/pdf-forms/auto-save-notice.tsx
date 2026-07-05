"use client";

interface AutoSaveNoticeProps {
  lastSavedAt: Date | null;
  /// true si ce formulaire fait partie d'un dossier multi-documents (a un
  /// bundleRunId) — dans ce cas, le code de reprise du dossier existe déjà
  /// ailleurs (ResumeCodeBanner) ; on s'y réfère au lieu de dupliquer le
  /// mécanisme.
  isPartOfBundle: boolean;
}

/// Surface visuelle de l'auto-save déjà existant (debounce 1500ms côté
/// PdfFormRunner) — n'introduit AUCUNE nouvelle logique de sauvegarde.
export function AutoSaveNotice({ lastSavedAt, isPartOfBundle }: AutoSaveNoticeProps) {
  return (
    <p className="text-xs text-[color:var(--glass-ink-soft)]">
      Vos réponses sont enregistrées automatiquement
      {lastSavedAt && ` (dernier enregistrement à ${lastSavedAt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })})`}
      {isPartOfBundle && " — retrouve ton code de reprise sur la page du dossier"}.
    </p>
  );
}
