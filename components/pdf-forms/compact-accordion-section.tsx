"use client";

import { useState } from "react";
import { Field as BaseField } from "@base-ui/react/field";
import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { OptionalSection } from "@/lib/pdf-forms/build-steps";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";

interface CompactAccordionSectionProps {
  sections: OptionalSection[];
  readOnly?: boolean;
  renderFields: (fields: PublicField[]) => React.ReactNode;
}

/// Regroupe les sections "optional" (cf. buildSteps) dans un accordéon
/// multi-ouverture. Une section s'ouvre par défaut si `defaultOpen` (déjà
/// répondue) — calculé une fois au montage, pas recalculé à chaque frappe
/// pour ne pas re-fermer une section que l'utilisateur vient d'ouvrir.
export function CompactAccordionSection({ sections, renderFields, readOnly = false }: CompactAccordionSectionProps) {
  const [defaultOpenValues] = useState(() => sections.filter((s) => s.defaultOpen).map((s) => s.key));

  return (
    <Accordion type="multiple" defaultValue={defaultOpenValues} className="flex flex-col gap-2">
      {sections.map((s) => (
        <AccordionItem className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4" key={s.key} value={s.key}>
          <AccordionTrigger className="min-h-14 text-base font-bold text-[color:var(--glass-ink)]">
            {s.title}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ReadOnlyFields readOnly={readOnly}><div className="flex flex-col gap-5 pt-2">{renderFields(s.fields)}</div></ReadOnlyFields>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/** Native controls and Base UI controls share the same display-only boundary. */
export function ReadOnlyFields({ readOnly, children }: { readOnly: boolean; children: React.ReactNode }) {
  const t = useTranslations("public.design");
  if (!readOnly) return <>{children}</>;
  return (
    <BaseField.Root disabled render={<fieldset disabled aria-label={t("oldReadOnly")} />} className="m-0 min-w-0 border-0 p-0">
      {children}
    </BaseField.Root>
  );
}
