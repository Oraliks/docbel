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
    <Accordion type="multiple" defaultValue={defaultOpenValues} className="flex flex-col gap-1">
      {sections.map((s) => (
        <AccordionItem key={s.key} value={s.key}>
          <AccordionTrigger>{s.title}</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-4 pt-1">{renderFields(s.fields)}</div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
