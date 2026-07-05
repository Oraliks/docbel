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

/// Stepper horizontal : numéros (ou coche si l'étape précède l'active),
/// ligne de connexion, libellé court. Remplace la barre d'onglets plate.
export function FormStepper({ steps, activeIndex, onSelect }: FormStepperProps) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto px-1 py-3">
      {steps.map((step, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        const isLast = i === steps.length - 1;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={isActive ? "step" : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--glass-pop-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isActive
                    ? "bg-[color:var(--glass-accent-deep,#5B46E5)] text-white"
                    : isDone
                    ? "bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep,#5B46E5)]"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <CheckIcon className="size-3.5" /> : i + 1}
              </span>
              <span
                className={`truncate text-xs font-semibold ${
                  isActive ? "text-[color:var(--glass-ink)]" : "text-[color:var(--glass-ink-soft)]"
                }`}
              >
                {step.label}
                {step.hasError && (
                  <span className="ml-1 inline-block size-1.5 rounded-full bg-destructive" aria-label="Erreurs dans cette étape" />
                )}
              </span>
            </button>
            {!isLast && <span aria-hidden className="h-px w-4 shrink-0 bg-[color:var(--glass-border)]" />}
          </li>
        );
      })}
    </ol>
  );
}
