"use client";

import { Fragment } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  splitOnemCommentary,
  type OnemComment,
} from "@/lib/reglementation/parse-legal-text";
import { linkifyCrossRefs } from "@/lib/reglementation/resolve-ref";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

/** Rend une section « Références » avec les renvois « AR/AM art. N » cliquables. */
function ReferencesBody({ text, corpus }: { text: string; corpus: Set<string> }) {
  const segs = linkifyCrossRefs(text, (id) => corpus.has(id));
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">
      {segs.map((s, i) =>
        s.t === "ref" ? (
          <Link
            key={i}
            href={`/partenaire/reglementation/${encodeURIComponent(s.riolexId)}`}
            className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
          >
            {s.text}
          </Link>
        ) : (
          <Fragment key={i}>{s.t === "text" ? s.text : ""}</Fragment>
        ),
      )}
    </div>
  );
}

function SectionBody({ item, corpus }: { item: OnemComment; corpus: Set<string> }) {
  if (item.kind === "schema") {
    return (
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
        {item.text}
      </pre>
    );
  }
  if (item.kind === "references") {
    return <ReferencesBody text={item.text} corpus={corpus} />;
  }
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed">{item.text}</div>
  );
}

export function OnemCommentary({
  raw,
  corpusIds = [],
}: {
  raw: string;
  corpusIds?: string[];
}) {
  const t = useTranslations("public.pro");
  const items = splitOnemCommentary(raw);
  const corpus = new Set(corpusIds);

  if (items.length === 0) return null;

  const label = (item: OnemComment) => {
    if (item.kind === "schema") return t("reglCommentSchema", { index: item.index });
    if (item.kind === "references") return t("reglCommentRefs");
    return t("reglCommentLabel", { index: item.index });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Lock className="size-4 text-amber-600" aria-hidden />
        <span>
          {t("reglCommentCount", { count: items.length })}
          {" · "}
          {t("reglCommentAdminOnly")}
        </span>
      </div>

      <Accordion type="multiple" className="rounded-md border print:hidden">
        {items.map((item) => (
          <AccordionItem key={`${item.kind}-${item.index}`} value={`${item.kind}-${item.index}`}>
            <AccordionTrigger className="px-4">
              <span className="flex flex-wrap items-center gap-2">
                <span>{label(item)}</span>
                {item.kind !== "commentaire" && (
                  <Badge variant="outline" className="font-normal capitalize">
                    {item.kind === "schema" ? t("reglCommentSchemaTag") : t("reglCommentRefsTag")}
                  </Badge>
                )}
                {item.date && (
                  <Badge variant="outline" className="font-normal">
                    {item.date}
                  </Badge>
                )}
                {item.institution && (
                  <Badge variant="secondary" className="font-normal">
                    {item.institution}
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4">
              <SectionBody item={item} corpus={corpus} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Version aplatie pour l'impression (les accordéons fermés ne s'impriment pas). */}
      <div className="hidden space-y-3 print:block">
        {items.map((item) => (
          <div key={`${item.kind}-${item.index}`} className="break-inside-avoid">
            <p className="text-sm font-semibold">
              {label(item)}
              {item.date ? ` — ${item.date}` : ""}
              {item.institution ? ` (${item.institution})` : ""}
            </p>
            <SectionBody item={item} corpus={corpus} />
          </div>
        ))}
      </div>
    </div>
  );
}
