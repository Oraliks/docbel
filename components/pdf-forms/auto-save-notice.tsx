"use client";

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
  if (!serverSaved) {
    return (
      <p className="text-xs text-[color:var(--glass-ink-soft)]">
        Vos réponses restent sur cet appareil pendant la saisie et ne sont pas encore enregistrées.
      </p>
    );
  }
  return (
    <p className="text-xs text-[color:var(--glass-ink-soft)]">
      Vos réponses sont enregistrées automatiquement
      {lastSavedAt && ` (dernier enregistrement à ${lastSavedAt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })})`}
      {isPartOfBundle && " — retrouvez votre code de reprise sur la page du dossier"}.
    </p>
  );
}
