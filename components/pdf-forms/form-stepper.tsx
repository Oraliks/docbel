"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface FormStepperItem {
  id: string;
  label: string;
  hasError: boolean;
  complete?: boolean;
  subLabel?: string;
  description?: string;
}

interface FormStepperProps {
  steps: FormStepperItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/** Progression lisible : l'étape active est prioritaire, la navigation complète reste secondaire. */
export function FormStepper({ steps, activeIndex, onSelect }: FormStepperProps) {
  const t = useTranslations("public.dossier");
  const total = steps.length;
  const activeStep = steps[activeIndex];
  const pct = total > 0 ? ((activeIndex + 1) / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 py-3" data-docbel-readable>
      <div className="flex flex-col gap-2">
        <span className="text-base font-bold text-[color:var(--glass-accent-deep)]">
          {t("runnerStepCounter", { current: activeIndex + 1, total })}
        </span>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold leading-tight text-[color:var(--glass-ink)]">
              {activeStep?.label}
            </h2>
            {(activeStep?.subLabel || activeStep?.description) && (
              <p className="text-base leading-relaxed text-[color:var(--glass-ink-soft)]">
                {activeStep.subLabel ?? activeStep.description}
              </p>
            )}
          </div>
          {activeStep?.hasError ? (
            <AlertCircle className="shrink-0 text-destructive" aria-label={t("runnerStepErrorsAria")} />
          ) : activeStep?.complete ? (
            <CheckCircle2 className="shrink-0 text-emerald-600" aria-hidden />
          ) : null}
        </div>
        <span
          className="relative h-2.5 overflow-hidden rounded-full bg-[color:var(--glass-pop-bg)]"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={activeIndex + 1}
          aria-label={t("runnerStepCounter", { current: activeIndex + 1, total })}
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--glass-accent-deep,#5B46E5)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </span>
      </div>

      <ol className="hidden gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-4" data-a11y-secondary="true">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${index + 1}. ${step.label}`}
                className={cn(
                  "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  isActive
                    ? "border-[color:var(--glass-accent-deep)] bg-[color:var(--glass-pop-bg)] font-bold text-[color:var(--glass-ink)]"
                    : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:border-[color:var(--glass-accent-deep)]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    isActive
                      ? "bg-[color:var(--glass-accent-deep)] text-white"
                      : "bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-ink-soft)]",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{step.label}</span>
                {step.hasError ? (
                  <span className="size-2 shrink-0 rounded-full bg-destructive" aria-label={t("runnerStepErrorsAria")} />
                ) : step.complete ? (
                  <CheckCircle2 className="shrink-0 text-emerald-600" aria-hidden />
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
