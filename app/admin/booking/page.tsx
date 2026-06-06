import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminBookingList } from "./admin-booking-list";

export const dynamic = "force-dynamic";

// Espace admin de provisionnement & supervision des guichets de RDV.
// (L'accès admin est garanti par app/admin/layout.tsx.)
export default async function AdminBookingPage() {
  const tenants = await prisma.bookingTenant.findMany({ orderBy: { name: "asc" } });
  const ids = tenants.map((t) => t.id);
  const pending = ids.length
    ? await prisma.booking.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: ids }, status: BookingStatus.pending_approval },
        _count: { _all: true },
      })
    : [];
  const pendingMap = new Map(pending.map((p) => [p.tenantId, p._count._all]));

  const rows = tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    category: t.category as string,
    partnerOrganization: t.partnerOrganization,
    active: t.active,
    pendingCount: pendingMap.get(t.id) ?? 0,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rendez-vous — Guichets</h1>
        <p className="text-muted-foreground mt-1">
          Créez et gérez la prise de rendez-vous pour les organismes, entreprises
          et employeurs. Chaque guichet a sa page publique <code>/[slug]/rendez-vous</code>.
        </p>
      </div>
      <AdminBookingList tenants={rows} />
    </div>
  );
}
