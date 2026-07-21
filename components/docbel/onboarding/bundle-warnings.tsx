"use client";

import { useTranslations } from "next-intl";
import {
  AlertOctagon,
  AlertTriangle,
  ExternalLink,
  Info,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { BundleWarning } from "@/lib/bundles/types";

interface Props {
  warnings: BundleWarning[];
}

/** Affiche les avertissements par severite, sans changer leur contenu. */
export function BundleWarnings({ warnings }: Props) {
  if (!warnings || warnings.length === 0) return null;

  const sorted = [...warnings].sort(
    (left, right) =>
      severityWeight(right.severity) - severityWeight(left.severity),
  );

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((warning) => (
        <WarningAlert key={warning.id} warning={warning} />
      ))}
    </div>
  );
}

function WarningAlert({ warning }: { warning: BundleWarning }) {
  const t = useTranslations("public.dossier");
  const presentation = presentationForSeverity(warning.severity);
  const Icon = presentation.Icon;

  return (
    <Alert
      variant={warning.severity === "critical" ? "destructive" : "default"}
      role={warning.severity === "critical" ? "alert" : "status"}
      className={cn(presentation.className, "rounded-2xl p-3")}
    >
      <Icon aria-hidden />
      <AlertTitle>{warning.title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2 text-current/90">
        <p className="whitespace-pre-line">{warning.message}</p>
        {warning.helpUrl ? (
          <a
            href={warning.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-current"
          >
            {t("learnMore")}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function severityWeight(severity: BundleWarning["severity"]): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function presentationForSeverity(severity: BundleWarning["severity"]) {
  if (severity === "critical") {
    return { Icon: AlertOctagon, className: undefined };
  }
  if (severity === "warning") {
    return {
      Icon: AlertTriangle,
      className:
        "border-[color:var(--attention-border)] bg-[color:var(--attention-subtle)] text-[color:var(--attention-subtle-foreground)]",
    };
  }
  return {
    Icon: Info,
    className:
      "border-[color:var(--info-border)] bg-[color:var(--info-subtle)] text-[color:var(--info-subtle-foreground)]",
  };
}
