import { prisma } from "@/lib/prisma";
import { PresetsAdmin } from "@/components/admin/documents/presets-admin";

export const dynamic = "force-dynamic";

export default async function PresetsAdminPage() {
  const presets = await prisma.fieldValidationPreset.findMany({
    orderBy: [{ builtin: "desc" }, { category: "asc" }, { name: "asc" }],
  });

  const serialized = presets.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    fieldType: p.fieldType,
    regex: p.regex,
    regexFlags: p.regexFlags,
    minLength: p.minLength,
    maxLength: p.maxLength,
    minValue: p.minValue,
    maxValue: p.maxValue,
    minDate: p.minDate,
    maxDate: p.maxDate,
    belgianType: p.belgianType,
    crossFieldRule: p.crossFieldRule as { type: string; fieldId: string } | null,
    errorMsg: p.errorMsg,
    errorMsgNl: p.errorMsgNl,
    helpText: p.helpText,
    helpTextNl: p.helpTextNl,
    placeholder: p.placeholder,
    placeholderNl: p.placeholderNl,
    builtin: p.builtin,
    icon: p.icon,
    color: p.color,
    usageCount: p.usageCount,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <PresetsAdmin initial={serialized} />
    </div>
  );
}
