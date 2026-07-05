"use client";

import { CheckIcon } from "lucide-react";

export interface FormStepperItem {
  id: string;
  label: string;
  hasError: boolean;
}

interface FormStepperProps {
  steps: FormStepperItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/// Stepper horizontal : cercles généreux (numéro → coche une fois l'étape
/// passée), connecteurs qui s'étirent sur la largeur disponible (violets
/// pour le chemin déjà parcouru), libellés courts. États : passé = teinte
/// lilas + coche ; actif = violet plein ; à venir = discret.
export function FormStepper({ steps, activeIndex, onSelect }: FormStepperProps) {
  return (
    <ol className="flex items-center overflow-x-auto px-2 py-4">
      {steps.map((step, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        const isLast = i === steps.length - 1;
        return (
          <li key={step.id} className={`flex min-w-fit items-center ${isLast ? "" : "flex-1"}`}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={isActive ? "step" : undefined}
              className="flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3 transition-colors hover:bg-[color:var(--glass-pop-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                  isActive
                    ? "bg-[color:var(--glass-accent-deep,#5B46E5)] text-white shadow-[0_6px_16px_-6px_rgba(91,70,229,0.55)]"
                    : isDone
                    ? "bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep,#5B46E5)]"
                    : "border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)]"
                }`}
              >
                {isDone ? <CheckIcon className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`max-w-[150px] truncate text-[13px] leading-tight ${
                  isActive
                    ? "font-bold text-[color:var(--glass-ink)]"
                    : isDone
                    ? "font-semibold text-[color:var(--glass-ink)]"
                    : "font-medium text-[color:var(--glass-ink-soft)]"
                }`}
              >
                {step.label}
                {step.hasError && (
                  <span
                    className="ml-1.5 inline-block size-1.5 rounded-full bg-destructive align-middle"
                    aria-label="Erreurs dans cette étape"
                  />
                )}
              </span>
            </button>
            {!isLast && (
              <span
                aria-hidden
                className={`mx-1 h-px min-w-5 flex-1 transition-colors ${
                  i < activeIndex
                    ? "bg-[color:var(--glass-accent-deep,#5B46E5)]"
                    : "bg-[color:var(--glass-border)]"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
