import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { labelReliability, type ReliabilityLevel } from "@/lib/employeur/constants";

/** Source officielle : badge cliquable (code + lien) avec titre en infobulle. */
export function SourceBadge({
  code,
  href,
  title,
}: {
  code: string;
  href?: string;
  title?: string;
}) {
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={title ?? code}
        className="no-underline"
      >
        <Badge variant="outline" className="gap-1">
          {code}
          <ExternalLink className="size-3 opacity-60" aria-hidden />
        </Badge>
      </a>
    );
  }
  return (
    <Badge variant="outline" title={title ?? code}>
      {code}
    </Badge>
  );
}

const RELIABILITY_VARIANT: Record<
  ReliabilityLevel,
  "success" | "info" | "warning" | "destructive"
> = {
  high: "success",
  medium: "info",
  low: "warning",
  needs_human_validation: "destructive",
};

/** Badge de fiabilité (faible / moyenne / bonne / à valider). */
export function ReliabilityBadge({ level }: { level: ReliabilityLevel }) {
  return (
    <Badge variant={RELIABILITY_VARIANT[level] ?? "info"}>
      Fiabilité&nbsp;: {labelReliability(level).toLowerCase()}
    </Badge>
  );
}
