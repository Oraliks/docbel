"use client";

import type { ReactNode } from "react";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ProgressFeedbackState =
  | "current"
  | "done"
  | "available"
  | "attention"
  | "locked";

interface ProgressFeedbackProps {
  label: string;
  value: number;
  max?: number;
  valueText?: ReactNode;
  detail?: ReactNode;
  state?: ProgressFeedbackState;
  compact?: boolean;
  labelMode?: "visible" | "sr-only";
  className?: string;
}

/**
 * Progression partagée du parcours citoyen.
 *
 * La valeur transmise à Base UI reste un pourcentage (0–100), tandis que
 * `valueText` permet d'afficher un compteur métier comme « 2 sur 4 ». Les
 * couleurs viennent uniquement des tokens sémantiques définis dans globals.css.
 */
export function ProgressFeedback({
  label,
  value,
  max = 100,
  valueText,
  detail,
  state = "current",
  compact = false,
  labelMode = "visible",
  className,
}: ProgressFeedbackProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? value : 0;
  const percentage = Math.min(100, Math.max(0, (safeValue / safeMax) * 100));
  const displayValue = valueText ?? `${Math.round(percentage)} %`;

  return (
    <div
      className={cn("docbel-progress-feedback flex min-w-0 flex-col gap-2", className)}
      data-state={state}
    >
      <Progress
        value={percentage}
        className={cn(
          "gap-x-3 gap-y-2",
          compact && "gap-y-1.5",
          state === "done" &&
            "[&_[data-slot=progress-indicator]]:bg-[color:var(--success)]",
          state === "attention" &&
            "[&_[data-slot=progress-indicator]]:bg-[color:var(--attention)]",
          state === "locked" &&
            "[&_[data-slot=progress-indicator]]:bg-[color:var(--glass-ink-faint)]",
          state === "current" &&
            "[&_[data-slot=progress-indicator]]:bg-[color:var(--glass-accent-deep)]",
          state === "available" &&
            "[&_[data-slot=progress-indicator]]:bg-[color:var(--glass-accent-a)]",
        )}
      >
        <ProgressLabel
          className={cn(
            "text-[color:var(--glass-ink)]",
            labelMode === "sr-only" && "sr-only",
          )}
        >
          {label}
        </ProgressLabel>
        <ProgressValue
          className={cn(
            "text-[color:var(--glass-ink-soft)]",
            labelMode === "sr-only" && "sr-only",
          )}
        >
          {() => displayValue}
        </ProgressValue>
      </Progress>
      {detail ? (
        <p className="text-xs text-[color:var(--glass-ink-soft)]">{detail}</p>
      ) : null}
    </div>
  );
}
