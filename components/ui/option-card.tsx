"use client";

import { type LucideIcon } from "lucide-react";

interface OptionCardProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  icon?: LucideIcon;
  /// Bordure rouge — champ REQUIS individuellement et actuellement invalide
  /// (vide). N'a pas vocation à s'appliquer à une contrainte de GROUPE
  /// ("au moins un parmi N") : dans ce cas, l'appelant affiche un message
  /// partagé sous le groupe plutôt que de rougir une carte en particulier
  /// (aucune n'est individuellement "fausse").
  invalid?: boolean;
}

/// Carte de choix cliquable (ex. "type de changement" du C1) : pastille
/// radio à gauche, bordure + fond lilas à la sélection. Le mode
/// single-select vs multi-select est décidé par l'appelant via `onToggle` —
/// composant purement présentationnel.
export function OptionCard({ label, selected, onToggle, icon: Icon, invalid }: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-invalid={invalid || undefined}
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
        selected
          ? "border-[color:var(--glass-accent-deep,#5B46E5)] bg-[color:var(--glass-pop-bg)] font-semibold text-[color:var(--glass-ink)] shadow-[0_10px_24px_-16px_rgba(91,70,229,0.55)]"
          : invalid
          ? "border-destructive bg-[color:var(--glass-surface)] font-medium text-[color:var(--glass-ink)]"
          : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] font-medium text-[color:var(--glass-ink)] hover:border-[color:var(--glass-accent-deep,#5B46E5)]"
      }`}
    >
      <span
        aria-hidden
        className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          selected
            ? "border-[color:var(--glass-accent-deep,#5B46E5)]"
            : "border-[color:var(--glass-border)]"
        }`}
      >
        {selected && <span className="size-2 rounded-full bg-[color:var(--glass-accent-deep,#5B46E5)]" />}
      </span>
      {Icon && <Icon className="size-4 shrink-0 text-[color:var(--glass-accent-deep,#5B46E5)]" />}
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}
