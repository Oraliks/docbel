"use client";

import { AlertTriangle, AlertOctagon, Info, ExternalLink } from "lucide-react";
import type { BundleWarning } from "@/lib/bundles/types";

interface Props {
  warnings: BundleWarning[];
}

/// Affiche les avertissements (warnings) d'un bundle en haut du parcours.
/// Trie par sévérité décroissante : critical → warning → info.
export function BundleWarnings({ warnings }: Props) {
  if (!warnings || warnings.length === 0) return null;

  const sorted = [...warnings].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));

  return (
    <div className="space-y-2">
      {sorted.map((w) => (
        <WarningCard key={w.id} warning={w} />
      ))}
    </div>
  );
}

function WarningCard({ warning }: { warning: BundleWarning }) {
  const styles = stylesForSeverity(warning.severity);
  const Icon = styles.Icon;
  return (
    <div
      className={`rounded-md border p-3 text-sm flex items-start gap-2 ${styles.container}`}
      role={warning.severity === "critical" ? "alert" : "status"}
    >
      <Icon className="size-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="font-semibold">{warning.title}</p>
        <p className="text-xs opacity-90 whitespace-pre-line">{warning.message}</p>
        {warning.helpUrl && (
          <a
            href={warning.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs underline mt-1"
          >
            En savoir plus
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function severityWeight(s: BundleWarning["severity"]): number {
  if (s === "critical") return 3;
  if (s === "warning") return 2;
  return 1;
}

function stylesForSeverity(s: BundleWarning["severity"]) {
  if (s === "critical") {
    return {
      Icon: AlertOctagon,
      container:
        "bg-red-50 border-red-300 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-200",
    };
  }
  if (s === "warning") {
    return {
      Icon: AlertTriangle,
      container:
        "bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200",
    };
  }
  return {
    Icon: Info,
    container:
      "bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-950 dark:border-sky-800 dark:text-sky-200",
  };
}
