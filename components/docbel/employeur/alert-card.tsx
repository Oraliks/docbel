import { Info, TriangleAlert, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertSeverity } from "@/lib/employeur/constants";
import { SourceBadge } from "./badges";

const STYLES: Record<AlertSeverity, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200",
  critical:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200",
};

const ICONS: Record<AlertSeverity, typeof Info> = {
  info: Info,
  warning: TriangleAlert,
  critical: OctagonAlert,
};

export interface AlertCardData {
  severity: AlertSeverity;
  message: string;
  sourceCode?: string;
}

/** Alerte contextuelle (info / attention / critique) avec source optionnelle. */
export function AlertCard({
  severity,
  message,
  sourceCode,
  sourceHref,
  sourceTitle,
}: AlertCardData & { sourceHref?: string; sourceTitle?: string }) {
  const Icon = ICONS[severity] ?? Info;
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", STYLES[severity])}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1.5">
        <p>{message}</p>
        {sourceCode ? (
          <SourceBadge code={sourceCode} href={sourceHref} title={sourceTitle} />
        ) : null}
      </div>
    </div>
  );
}
