"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { PdfField } from "@/components/pdf-forms/pdf-field";
import { toPublicField, type PublicField } from "@/lib/pdf-forms/public-serializer";
import { isFieldVisible } from "@/lib/pdf-forms/validation";
import { sectionLabel } from "@/lib/pdf-forms/section-labels";
import { PdfFormField, FormPayload, Locale, FieldValue } from "@/lib/pdf-forms/types";

/// Aperçu interactif "comme l'utilisateur le verra". Reçoit le schéma en
/// cours d'édition et permet de tester la saisie + visibilité conditionnelle
/// sans poster, sans autosave, sans réseau.
export function FormPreview({
  fields, locale,
}: {
  fields: PdfFormField[];
  locale: Locale;
}) {
  const [values, setValues] = useState<FormPayload>({});

  const publicFields = useMemo<PublicField[]>(
    () => fields.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(toPublicField),
    [fields]
  );

  const sections = useMemo(() => {
    const visible = publicFields.filter((f) => isFieldVisible(f.visibleIf, values));
    const groups: Array<{ key: string | undefined; fields: PublicField[] }> = [];
    for (const f of visible) {
      const last = groups[groups.length - 1];
      if (last && last.key === f.section) last.fields.push(f);
      else groups.push({ key: f.section, fields: [f] });
    }
    return groups;
  }, [publicFields, values]);

  const setValue = (id: string, value: FieldValue) => setValues((prev) => ({ ...prev, [id]: value }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">Aperçu</Badge>
        <span className="text-xs text-muted-foreground">
          Pas de soumission, pas d&apos;autosave. Reflète l&apos;état actuel de l&apos;éditeur.
        </span>
      </div>
      {sections.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aucun champ visible.</CardContent></Card>
      ) : (
        sections.map((group, gi) => (
          <Card key={gi}>
            {group.key !== undefined && (
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {sectionLabel(group.key, locale)}
                </CardTitle>
              </CardHeader>
            )}
            <CardContent className="pt-5">
              <FieldGroup>
                {group.fields.map((f) => (
                  <PdfField
                    key={f.id}
                    field={f}
                    value={values[f.id] ?? ""}
                    locale={locale}
                    onChange={(v) => setValue(f.id, v)}
                  />
                ))}
              </FieldGroup>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
