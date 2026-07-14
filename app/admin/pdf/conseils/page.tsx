import { prisma } from "@/lib/prisma";
import {
  getFormContextTipsDictUncached,
  getFormContextTipsMeta,
} from "@/lib/form-context-tips.server";
import type { PdfFormField, Localized } from "@/lib/pdf-forms/types";
import { ConseilsClient, type FormEditorMeta } from "./conseils-client";

export const dynamic = "force-dynamic";

function labelFr(l: Localized | undefined, fallback: string): string {
  return l?.fr || l?.nl || l?.de || fallback;
}

/**
 * Éditeur admin des « infos importantes » contextuelles du panneau d'aide des
 * formulaires PDF (cf. `lib/form-context-tips.ts`). L'auth admin est garantie
 * par `app/admin/layout.tsx`. Zéro migration : tout vit sous la clé AppSetting
 * `form_context_tips`.
 */
export default async function ConseilsPage() {
  const [dict, meta, forms] = await Promise.all([
    getFormContextTipsDictUncached(),
    getFormContextTipsMeta(),
    prisma.pdfForm.findMany({
      where: { status: "published", active: true },
      select: { slug: true, title: true, fields: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const formMetas: FormEditorMeta[] = forms.map((f) => {
    // `fields` est du JSON Prisma : ne jamais présumer un tableau (un objet
    // malformé ferait planter TOUTE la page via `.filter`).
    const fields = Array.isArray(f.fields) ? (f.fields as unknown as PdfFormField[]) : [];
    // `field-checked` ne s'applique qu'à des cases (valeur booléenne `true`).
    const checkboxFields = fields
      .filter((fld) => fld.type === "checkbox")
      .map((fld) => ({ id: fld.id, label: labelFr(fld.label, fld.id) }));
    const sections = [
      ...new Set(fields.map((fld) => fld.section).filter((s): s is string => !!s)),
    ].sort();
    return { slug: f.slug, title: f.title, fields: checkboxFields, sections };
  });

  // Un formulaire référencé dans le dict mais non publié reste éditable.
  const known = new Set(formMetas.map((m) => m.slug));
  for (const slug of Object.keys(dict)) {
    if (!known.has(slug)) formMetas.push({ slug, title: slug, fields: [], sections: [] });
  }

  let updatedByName: string | null = null;
  if (meta.updatedBy) {
    const u = await prisma.user
      .findUnique({ where: { id: meta.updatedBy }, select: { name: true } })
      .catch(() => null);
    updatedByName = u?.name ?? null;
  }

  return (
    <ConseilsClient
      initialDict={dict}
      forms={formMetas}
      updatedAt={meta.updatedAt ? meta.updatedAt.toISOString() : null}
      updatedByName={updatedByName}
    />
  );
}
