import { Fragment } from "react";
import Link from "next/link";

import { parseLegalText, type LegalBlock } from "@/lib/reglementation/parse-legal-text";
import { parseInline, type Inline } from "@/lib/reglementation/parse-amendments";
import { linkifyRefs, type RefContext } from "@/lib/reglementation/resolve-ref";
import { AmendmentChip } from "./amendment-chip";
import { CopyButton } from "./copy-button";

/** Ancre stable d'un § dérivée de son marqueur (« § 1er » → « par-1er »). */
function sectionAnchor(marker: string | undefined): string {
  const m = (marker ?? "").replace(/§\s*/, "").trim().toLowerCase();
  return `par-${m.replace(/[^a-z0-9]+/g, "") || "0"}`;
}

/** Rend une suite de segments inline (texte / amendement / renvoi / {n} / {n}❌). */
function Inlines({ text, refContext }: { text: string; refContext?: RefContext }) {
  let segments = parseInline(text);
  if (refContext) segments = linkifyRefs(segments, refContext);
  return (
    <>
      {segments.map((seg, i) => (
        <Fragment key={i}>{renderInline(seg, i)}</Fragment>
      ))}
    </>
  );
}

function renderInline(seg: Inline, i: number) {
  switch (seg.t) {
    case "text":
      return seg.text;
    case "amendment":
      return <AmendmentChip ref={seg.ref} />;
    case "ref":
      return (
        <Link
          href={`/partenaire/reglementation/${encodeURIComponent(seg.riolexId)}`}
          className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
        >
          {seg.text}
        </Link>
      );
    case "deleted":
      return (
        <span
          className="mx-0.5 inline-flex items-center rounded bg-destructive/10 px-1 align-baseline text-[0.68em] font-medium uppercase tracking-wide text-destructive/80 line-through"
          title="Fragment supprimé — texte retiré sans remplacement (historique non disponible dans le corpus)"
        >
          supprimé
        </span>
      );
    case "modified":
      return (
        <sup
          className="mx-0.5 cursor-help text-[0.7em] font-medium text-primary/70"
          title="Passage modifié — historique de version non disponible dans le corpus"
        >
          ◆{seg.n}
        </sup>
      );
    default:
      return null;
  }
}

/** Wrapper visuel commun (barré rouge lisible pour les alinéas abrogés). */
function blockClass(block: LegalBlock): string {
  return block.struck
    ? "text-destructive/70 line-through decoration-destructive/40"
    : "";
}

export function LegalText({
  raw,
  refContext,
}: {
  raw: string;
  refContext?: RefContext;
}) {
  const blocks = parseLegalText(raw);

  if (blocks.length === 0) {
    return <p className="text-muted-foreground">{/* rien à afficher */}</p>;
  }

  return (
    <div
      className="legal-text max-w-[var(--legal-measure,72ch)] space-y-3.5 text-[length:var(--legal-fs,15px)] leading-[var(--legal-lh,1.7)] print:max-w-none print:text-[12pt]"
      data-slot="legal-text"
    >
      {blocks.map((block, i) => {
        if (block.type === "section") {
          const anchor = sectionAnchor(block.marker);
          return (
            <p
              key={i}
              id={anchor}
              className="group scroll-mt-24 rounded-md pt-1 transition-colors target:bg-primary/5 target:ring-1 target:ring-primary/15 first:pt-0"
            >
              <strong className="mr-1 font-semibold text-primary">
                {block.marker}.
              </strong>
              <Inlines text={block.text} refContext={refContext} />
              <span className="ml-1 inline-flex align-middle">
                <CopyButton anchor={anchor} iconOnly />
              </span>
            </p>
          );
        }

        if (block.type === "list-item") {
          const deep = block.level === 2;
          return (
            <div
              key={i}
              className={`flex gap-2.5 print:break-inside-avoid ${deep ? "ml-6 border-l border-border/60 pl-4" : "pl-4"} ${blockClass(block)}`}
            >
              <span
                className={`shrink-0 tabular-nums ${deep ? "text-muted-foreground/70" : "font-medium text-foreground/70"}`}
              >
                {block.marker}
              </span>
              <span className="min-w-0">
                <Inlines text={block.text} refContext={refContext} />
              </span>
            </div>
          );
        }

        if (block.type === "abroge") {
          // Passage entièrement abrogé : barré rouge mais lisible (demande a).
          return (
            <p
              key={i}
              className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive/80"
            >
              <span className="line-through decoration-destructive/40">
                {block.text}
              </span>
            </p>
          );
        }

        // paragraph (défaut)
        return (
          <p key={i} className={blockClass(block)}>
            <Inlines text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
