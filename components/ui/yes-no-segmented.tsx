"use client";

import { loc, type FieldOption, type Locale } from "@/lib/pdf-forms/types";

interface YesNoSegmentedControlProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: [FieldOption, FieldOption];
  locale: Locale;
  invalid?: boolean;
  /// Verrouille la bascule (champ dérivé, cf. PdfField.derivedValue) : les
  /// boutons restent visibles (valeur lisible) mais n'appellent plus `onChange`.
  disabled?: boolean;
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
  disabled,
}: YesNoSegmentedControlProps) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-invalid={invalid}
      aria-disabled={disabled}
      className={`grid min-w-56 shrink-0 grid-cols-2 overflow-hidden rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] ${disabled ? "opacity-60" : ""}`}
    >
      {options.map((opt, i) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`min-h-12 px-5 py-3 text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed ${i === 0 ? "" : "border-l border-[color:var(--glass-border)]"} ${
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
