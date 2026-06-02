import { prisma } from "@/lib/prisma";
import { OrganismesAdmin } from "@/components/admin/documents/organismes-admin";

export const dynamic = "force-dynamic";

/// Gestion des organismes émetteurs (ONEM, CPAS, SPF…) — référentiel
/// partagé. Un PdfForm peut désormais être rattaché à un organisme via
/// PdfForm.organismeId.
export default async function PdfOrganismesPage() {
  const organismesRaw = await prisma.organisme.findMany({
    orderBy: [{ active: "desc" }, { order: "asc" }, { name: "asc" }],
    include: { _count: { select: { pdfForms: true } } },
  });

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
    // Le composant attend un champ `templateCount` (legacy) — on y met le
    // décompte de PdfForm rattachés à cet organisme.
    templateCount: o._count.pdfForms,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <OrganismesAdmin initial={organismes} />
    </div>
  );
}
