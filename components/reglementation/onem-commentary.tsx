"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { splitOnemCommentary } from "@/lib/reglementation/parse-legal-text";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export function OnemCommentary({ raw }: { raw: string }) {
  const t = useTranslations("public.pro");
  const items = splitOnemCommentary(raw);

  if (items.length === 0) return null;

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
          <AccordionItem key={item.index} value={String(item.index)}>
            <AccordionTrigger className="px-4">
              <span className="flex flex-wrap items-center gap-2">
                <span>{t("reglCommentLabel", { index: item.index })}</span>
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
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {item.text}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Version aplatie pour l'impression (les accordéons fermés ne s'impriment pas). */}
      <div className="hidden space-y-3 print:block">
        {items.map((item) => (
          <div key={item.index} className="break-inside-avoid">
            <p className="text-sm font-semibold">
              {t("reglCommentLabel", { index: item.index })}
              {item.date ? ` — ${item.date}` : ""}
              {item.institution ? ` (${item.institution})` : ""}
            </p>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {item.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
