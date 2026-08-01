"use client";

import { useTranslations } from "next-intl";
import { Accordion } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FieldEditor } from "../field-editor";
import { VisualEditor } from "../visual/visual-editor";
import type { UseFormData } from "../use-form-data";

/// Onglet « Champs » : sous-tabs Schéma enrichi vs éditeur visuel d'AcroForms.
/// On distingue un AcroForm « étranger » (présent à l'upload) de celui que
/// nous matérialisons via l'éditeur visuel — seul le premier désactive
/// l'onglet Visuel (la fusion d'AcroForm tiers est out-of-scope v1).
export function TabChamps({ data }: { data: UseFormData }) {
  const t = useTranslations("admin.pdf");
  const { form, hasForeignAcroForm, setFields, load, loadIssues } = data;
  if (!form) return null;
  // Formulaires ONEM semés (S5) : consultation conservée, édition verrouillée
  // (le serveur refuse de toute façon — cf. seed-lock.ts). `inert` bloque
  // aussi le focus clavier, pas seulement le clic.
  const locked = form.seedManaged;

  return (
    <Tabs defaultValue="schema" className="w-full">
      <TabsList variant="line">
        <TabsTrigger value="schema">{t("subTabSchema", { count: form.fields.length })}</TabsTrigger>
        <TabsTrigger
          value="visual"
          disabled={hasForeignAcroForm}
          title={
            hasForeignAcroForm
              ? t("visualDisabledForeign")
              : t("visualEditorHint")
          }
        >
          {t("subTabVisual")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="schema">
        <div className={locked ? "opacity-60" : undefined} inert={locked}>
          <Accordion type="multiple" className="flex flex-col gap-2">
            {form.fields.map((field, i) => (
              <FieldEditor
                key={field.id}
                field={field}
                locales={form.locales}
                allFields={form.fields}
                onChange={(next) => setFields(form.fields.map((f, j) => (j === i ? next : f)))}
                onRemove={() => setFields(form.fields.filter((_, j) => j !== i))}
              />
            ))}
          </Accordion>
        </div>
      </TabsContent>

      <TabsContent value="visual">
        {/* Régression critique : sans ce câblage, après matérialisation le
            schéma + materializedNames ne se rafraîchissent pas. */}
        <div className={locked ? "opacity-60" : undefined} inert={locked}>
          <VisualEditor formId={form.id} onMaterialized={() => { load(); loadIssues(); }} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
