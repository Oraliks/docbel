"use client";

import { CheckIcon, type LucideIcon } from "lucide-react";

interface OptionCardProps {
  label: string;
  /// Version courte du libellé pour l'affichage mobile (< 640px). Absent =
  /// utiliser `label` sur tous les breakpoints. Rendu SANS media-query hook
  /// (deux <span> sm:hidden / hidden sm:inline) pour éviter le flicker au
  /// SSR/hydratation — Phase 4 du plan bindings-canonical-ux.
  labelShort?: string;
  selected: boolean;
  onToggle: () => void;
  icon?: LucideIcon;
  /// Bordure rouge — champ REQUIS individuellement et actuellement invalide
  /// (vide). N'a pas vocation à s'appliquer à une contrainte de GROUPE
  /// ("au moins un parmi N") : dans ce cas, l'appelant affiche un message
  /// partagé sous le groupe plutôt que de rougir une carte en particulier
  /// (aucune n'est individuellement "fausse").
  invalid?: boolean;
  /// Forme de l'indicateur de sélection. `"radio"` (défaut) = pastille ronde
  /// + point plein (choix unique). `"check"` = case CARRÉE arrondie + coche
  /// (choix multiple) — règle produit : un cercle se lit comme un radio
  /// (single-select), donc un multi-select DOIT être un carré. L'appelant
  /// pilote strictement par cette prop (cf. FieldsCluster : radio vs checkbox).
  indicator?: "radio" | "check";
}

/// Carte de choix cliquable (ex. "type de changement" du C1) : indicateur de
/// sélection à gauche (rond pour un choix unique, carré + coche pour un choix
/// multiple, via `indicator`), bordure + fond lilas à la sélection. Le mode
/// single-select vs multi-select est décidé par l'appelant via `onToggle` +
/// `indicator` — composant purement présentationnel.
export function OptionCard({ label, labelShort, selected, onToggle, icon: Icon, invalid, indicator = "radio" }: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-invalid={invalid || undefined}
      onClick={onToggle}
      className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
        selected
          ? "border-[color:var(--glass-accent-deep,#5B46E5)] bg-[color:var(--glass-pop-bg)] font-semibold text-[color:var(--glass-ink)] shadow-[0_10px_24px_-16px_rgba(91,70,229,0.55)]"
          : invalid
          ? "border-destructive bg-[color:var(--glass-surface)] font-medium text-[color:var(--glass-ink)]"
          : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] font-medium text-[color:var(--glass-ink)] hover:border-[color:var(--glass-accent-deep,#5B46E5)]"
      }`}
    >
      {indicator === "check" ? (
        <span
          aria-hidden
          className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            selected
              ? "border-[color:var(--glass-accent-deep,#5B46E5)] bg-[color:var(--glass-accent-deep,#5B46E5)]"
              : "border-[color:var(--glass-border)]"
          }`}
        >
          {selected && <CheckIcon className="size-4 text-white" strokeWidth={3} />}
        </span>
      ) : (
        <span
          aria-hidden
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            selected
              ? "border-[color:var(--glass-accent-deep,#5B46E5)]"
              : "border-[color:var(--glass-border)]"
          }`}
        >
          {selected && <span className="size-3 rounded-full bg-[color:var(--glass-accent-deep,#5B46E5)]" />}
        </span>
      )}
      {Icon && <Icon className="size-4 shrink-0 text-[color:var(--glass-accent-deep,#5B46E5)]" />}
      <span className="min-w-0 flex-1">
        {labelShort && labelShort !== label ? (
          <>
            <span className="sm:hidden">{labelShort}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </span>
    </button>
  );
}
