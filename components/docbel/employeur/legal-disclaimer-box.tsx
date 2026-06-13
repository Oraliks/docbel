import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type DisclaimerContext =
  | "general"
  | "simulation"
  | "checklist"
  | "document"
  | "controle";

const TEXTS: Record<DisclaimerContext, string> = {
  general:
    "Docbel est un outil d'aide administrative, de simulation et de préparation. Il ne remplace pas un conseil juridique individualisé, un secrétariat social agréé ni les déclarations officielles obligatoires de l'employeur.",
  simulation:
    "Cette simulation est indicative et ne constitue pas un calcul payroll officiel.",
  checklist:
    "Cette checklist est une aide administrative. Elle doit être adaptée à votre situation exacte.",
  document:
    "Ce document est préparatoire. Faites-le valider avant usage officiel.",
  controle:
    "Docbel détecte des incohérences potentielles mais ne certifie pas la conformité d'une fiche de paie.",
};

/** Encart d'avertissement juridique contextuel (spec §7.3). Informatif, jamais bloquant. */
export function LegalDisclaimerBox({
  context = "general",
  className,
}: {
  context?: DisclaimerContext;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground",
        className
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
      <p>{TEXTS[context]}</p>
    </div>
  );
}
