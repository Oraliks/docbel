import type { ReactNode } from "react";
import { CheckCircle2, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type CompletionFeedbackKind = "step" | "dossier" | "information";

interface CompletionFeedbackProps {
  kind?: CompletionFeedbackKind;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Feedback accessible et non compétitif après une action du parcours. */
export function CompletionFeedback({
  kind = "step",
  title,
  description,
  action,
  className,
}: CompletionFeedbackProps) {
  const Icon =
    kind === "dossier" ? Sparkles : kind === "information" ? Info : CheckCircle2;

  return (
    <section
      className={cn(
        "docbel-completion-feedback glass-feedback flex items-start gap-3",
        className,
      )}
      data-kind={kind}
      data-tone={kind === "information" ? "info" : "success"}
      role="status"
      aria-live="polite"
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        data-feedback-icon
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[color:var(--glass-ink)]">
          {title}
        </span>
        {description ? (
          <span className="mt-1 block text-sm text-[color:var(--glass-ink-soft)]">
            {description}
          </span>
        ) : null}
        {action ? <span className="mt-3 flex flex-wrap gap-2">{action}</span> : null}
      </span>
    </section>
  );
}

