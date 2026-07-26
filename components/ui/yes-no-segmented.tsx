"use client";

import { useRef, type KeyboardEvent } from "react";
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
  /// Id du libellé de la question. Indispensable : un `<div role="radiogroup">`
  /// n'est PAS un élément labelable, un `<label for>` qui le vise ne l'atteint
  /// jamais. Sans `aria-labelledby`, le groupe n'a aucun nom accessible et un
  /// lecteur d'écran annonce « groupe de boutons radio » sans la question.
  "aria-labelledby"?: string;
  /// Id du message d'erreur rattaché à la question (cf. FieldErrorReport) —
  /// permet d'annoncer la raison du blocage, pas seulement son existence.
  "aria-describedby"?: string;
  /// Champ obligatoire : l'astérisque du libellé est purement visuelle, seul
  /// `aria-required` l'expose aux technologies d'assistance.
  required?: boolean;
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
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  required,
}: YesNoSegmentedControlProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  // Roving tabindex (patron ARIA « radiogroup ») : le groupe entier ne doit
  // coûter QU'UNE tabulation, sinon un utilisateur au clavier traverse autant
  // d'arrêts qu'il y a d'options sur un formulaire qui en compte des dizaines.
  // Tant que rien n'est choisi, c'est la première option qui porte le focus.
  const tabbableIndex = selectedIndex >= 0 ? selectedIndex : 0;

  /// Dans un radiogroup, les flèches CHOISISSENT l'option (elles ne font pas
  /// que déplacer le focus) — d'où le `onChange` en plus du `focus()`.
  function moveTo(index: number) {
    if (disabled) return;
    const next = (index + options.length) % options.length;
    onChange(options[next].value);
    buttons.current[next]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveTo(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveTo(index - 1);
        break;
      case "Home":
        event.preventDefault();
        moveTo(0);
        break;
      case "End":
        event.preventDefault();
        moveTo(options.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-invalid={invalid}
      aria-disabled={disabled}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-required={required || undefined}
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
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === tabbableIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
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
