"use client";

import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { loc, type FieldOption, type Locale } from "@/lib/pdf-forms/types";
import { cn } from "@/lib/utils";

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
  /// Variante en deux cartes séparées, utilisée dans les panneaux
  /// horizontaux comme le mode de paiement.
  variant?: "connected" | "pills";
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
  variant = "connected",
}: YesNoSegmentedControlProps) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-invalid={invalid}
      aria-disabled={disabled}
      className={cn(
        "grid shrink-0 grid-cols-2",
        variant === "connected"
          ? "min-w-56 overflow-hidden rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)]"
          : "w-full min-w-0 gap-2 sm:w-[66%]",
        disabled && "opacity-60",
      )}
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
            className={cn(
              "inline-flex min-h-12 items-center justify-center gap-2 px-5 py-3 text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed [&>svg]:size-4",
              variant === "pills" && "min-h-10 gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold leading-tight [&>svg]:size-3.5",
              variant === "connected" && i > 0 && "border-l border-[color:var(--glass-border)]",
              variant === "connected" && selected && "bg-[color:var(--glass-accent-deep,#5B46E5)] text-white",
              variant === "connected" && !selected && "text-[color:var(--glass-ink-soft)] hover:bg-[color:var(--glass-pop-bg)]",
              variant === "pills" && "border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)]",
              variant === "pills" && selected && "border-[color:var(--glass-accent-deep)] bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]",
              variant === "pills" && !selected && "hover:border-[color:var(--glass-accent-deep)] hover:bg-[color:var(--glass-pop-bg)]",
            )}
          >
            {variant === "pills" && (
              selected
                ? <CheckCircle2Icon data-icon="inline-start" aria-hidden />
                : <CircleIcon data-icon="inline-start" aria-hidden />
            )}
            {loc(opt.label, locale)}
          </button>
        );
      })}
    </div>
  );
}
