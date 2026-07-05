"use client";

import { CheckIcon, type LucideIcon } from "lucide-react";

interface OptionCardProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  icon?: LucideIcon;
}

/// Carte cliquable pour un choix visuel (ex. "type de changement" du C1).
/// Le mode single-select vs multi-select est décidé par l'appelant (qui
/// gère la logique de bascule via `onToggle` — ce composant est purement
/// présentationnel et ne connaît pas le type de champ sous-jacent).
export function OptionCard({ label, selected, onToggle, icon: Icon }: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
        selected
          ? "border-[color:var(--glass-accent-deep,#5B46E5)] bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep,#5B46E5)]"
          : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink)] hover:border-[color:var(--glass-accent-deep,#5B46E5)]"
      }`}
    >
      {Icon && <Icon className="size-4 shrink-0" />}
      <span>{label}</span>
      {selected && <CheckIcon className="ml-auto size-4 shrink-0" />}
    </button>
  );
}
