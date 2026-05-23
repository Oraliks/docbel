import { prisma } from "@/lib/prisma";
import { DocumentsConfigTabs } from "@/components/admin/documents/documents-config-tabs";
import type { BundleRow } from "@/components/admin/documents/bundles-list";

export const dynamic = "force-dynamic";

export default async function DocumentsConfigPage() {
  // Fetch parallèle des 4 référentiels : ils sont tous petits (<100 lignes
  // chacun) donc on charge tout côté serveur d'un coup.
  const [sectionsRaw, organismesRaw, presetsRaw, bundlesRaw] = await Promise.all([
    prisma.toolSection.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: { _count: { select: { tools: true } } },
    }),
    prisma.organisme.findMany({
      orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
      include: { _count: { select: { templates: true } } },
    }),
    prisma.fieldValidationPreset.findMany({
      orderBy: [{ builtin: "desc" }, { category: "asc" }, { name: "asc" }],
    }),
    prisma.documentBundle.findMany({
      orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const sections = sectionsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    icon: s.icon,
    order: s.order,
    toolCount: s._count.tools,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const organismes = organismesRaw.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    shortName: o.shortName,
    type: o.type,
    color: o.color,
    logoUrl: o.logoUrl,
    website: o.website,
    description: o.description,
    active: o.active,
    order: o.order,
    templateCount: o._count.templates,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));

  const presets = presetsRaw.map((p) => ({
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

  const bundles: BundleRow[] = bundlesRaw.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    color: b.color,
    active: b.active,
    order: b.order,
    lifeEventCategory: b.lifeEventCategory,
    showOnOnboarding: b.showOnOnboarding,
    itemsCount: b._count.items,
    updatedAt: b.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <DocumentsConfigTabs
        sections={sections}
        organismes={organismes}
        presets={presets}
        bundles={bundles}
      />
    </div>
  );
}
