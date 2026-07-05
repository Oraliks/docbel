"use client";

import { loc, type FieldOption, type Locale } from "@/lib/pdf-forms/types";

interface YesNoSegmentedControlProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: [FieldOption, FieldOption];
  locale: Locale;
  invalid?: boolean;
}

/// Bascule à 2 boutons pour un champ radio à exactement 2 options (souvent
/// oui/non). Remplace le rendu en liste déroulante par défaut — plus rapide
/// à lire et à répondre pour un choix binaire.
export function YesNoSegmentedControl({
  id,
  value,
  onChange,
  options,
  locale,
  invalid,
}: YesNoSegmentedControlProps) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-invalid={invalid}
      className="inline-flex shrink-0 overflow-hidden rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)]"
    >
      {options.map((opt, i) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${i === 0 ? "" : "border-l border-[color:var(--glass-border)]"} ${
              selected
                ? "bg-[color:var(--glass-accent-deep,#5B46E5)] text-white"
                : "text-[color:var(--glass-ink-soft)] hover:bg-[color:var(--glass-pop-bg)]"
            }`}
          >
            {loc(opt.label, locale)}
          </button>
        );
      })}
    </div>
  );
}
