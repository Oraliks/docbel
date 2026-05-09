import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PresetForm, PresetFormState } from "@/components/admin/documents/preset-form";

export const dynamic = "force-dynamic";

export default async function EditPresetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const preset = await prisma.fieldValidationPreset.findUnique({ where: { id } });
  if (!preset) notFound();

  // Compter les usages réels (parcourt les schemas des templates)
  const templates = await prisma.documentTemplate.findMany({
    select: { schema: true },
  });
  let usageCount = 0;
  type FieldWithPreset = { presetId?: string };
  for (const t of templates) {
    const fields = (t.schema as unknown as FieldWithPreset[]) || [];
    for (const f of fields) {
      if (f.presetId === id) usageCount++;
    }
  }

  const cfRule = preset.crossFieldRule as { type: string; fieldId: string } | null;

  const initial: PresetFormState = {
    name: preset.name,
    description: preset.description ?? "",
    category: preset.category,
    fieldType: preset.fieldType,
    regex: preset.regex ?? "",
    regexFlags: preset.regexFlags ?? "",
    minLength: preset.minLength?.toString() ?? "",
    maxLength: preset.maxLength?.toString() ?? "",
    minValue: preset.minValue?.toString() ?? "",
    maxValue: preset.maxValue?.toString() ?? "",
    minDate: preset.minDate ?? "",
    maxDate: preset.maxDate ?? "",
    belgianType: preset.belgianType ?? "",
    crossFieldRuleType: cfRule?.type ?? "",
    crossFieldRuleFieldId: cfRule?.fieldId ?? "",
    errorMsg: preset.errorMsg,
    errorMsgNl: preset.errorMsgNl ?? "",
    helpText: preset.helpText ?? "",
    helpTextNl: preset.helpTextNl ?? "",
    placeholder: preset.placeholder ?? "",
    placeholderNl: preset.placeholderNl ?? "",
    icon: preset.icon ?? "",
  };

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <PresetForm presetId={id} initial={initial} builtin={preset.builtin} usageCount={usageCount} />
    </div>
  );
}
