import { Info } from "lucide-react";
import type { MethodologyBriefItem } from "@/lib/calculators/_methodology";
import { getSectionIcon } from "./_icons";

interface MethodologyBriefProps {
  description: string;
  items?: MethodologyBriefItem[];
}

/**
 * Bloc "En bref" : une description (paragraphe pédagogique) + une grille
 * de mini-items meta (Méthode / Régularisation / Unités / etc.).
 *
 * Si `items` est absent ou vide, on n'affiche que la description.
 * La description supporte du markdown allégé (**bold** uniquement).
 */
export function MethodologyBrief({ description, items }: MethodologyBriefProps) {
  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        En bref
      </h2>
      <p className="text-[13.5px] leading-relaxed text-foreground/90">
        {renderInlineMarkdown(description)}
      </p>

      {hasItems ? (
        <ul className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {items!.map((item, i) => {
            const Icon = getSectionIcon(item.icon) ?? Info;
            return (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-3.5" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="text-[12.5px] font-medium text-foreground">
                    {item.value}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Mini-renderer Markdown : `**bold**` → <strong>. Pas de protection XSS,
 * la source est statique (fichier .ts sous git).
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
