import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type DisclaimerContext =
  | "general"
  | "simulation"
  | "checklist"
  | "document"
  | "controle";

const DISCLAIMER_KEYS: Record<DisclaimerContext, string> = {
  general: "disclaimerGeneral",
  simulation: "disclaimerSimulation",
  checklist: "disclaimerChecklist",
  document: "disclaimerDocument",
  controle: "disclaimerControle",
};

/** Encart d'avertissement juridique contextuel (spec §7.3). Informatif, jamais bloquant. */
export function LegalDisclaimerBox({
  context = "general",
  className,
}: {
  context?: DisclaimerContext;
  className?: string;
}) {
  const t = useTranslations("public.pro");
  const key: string = DISCLAIMER_KEYS[context];
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground",
        className
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
      <p>{t(key as Parameters<typeof t>[0])}</p>
    </div>
  );
}
