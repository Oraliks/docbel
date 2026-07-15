"use client";

import { useState } from "react";
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
  renderFields: (fields: PublicField[]) => React.ReactNode;
}

/// Regroupe les sections "optional" (cf. buildSteps) dans un accordéon
/// multi-ouverture. Une section s'ouvre par défaut si `defaultOpen` (déjà
/// répondue) — calculé une fois au montage, pas recalculé à chaque frappe
/// pour ne pas re-fermer une section que l'utilisateur vient d'ouvrir.
export function CompactAccordionSection({ sections, renderFields }: CompactAccordionSectionProps) {
  const [defaultOpenValues] = useState(() => sections.filter((s) => s.defaultOpen).map((s) => s.key));

  return (
    <Accordion type="multiple" defaultValue={defaultOpenValues} className="flex flex-col gap-2">
      {sections.map((s) => (
        <AccordionItem className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4" key={s.key} value={s.key}>
          <AccordionTrigger className="min-h-14 text-base font-bold text-[color:var(--glass-ink)]">
            {s.title}
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex flex-col gap-5 pt-2">{renderFields(s.fields)}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
