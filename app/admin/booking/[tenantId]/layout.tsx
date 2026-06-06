import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BookingTabs } from "@/components/booking/booking-tabs";

interface LayoutProps {
  params: Promise<{ tenantId: string }>;
  children: React.ReactNode;
}

// Gestion admin d'un guichet (chrome admin via app/admin/layout). L'admin a
// tous les droits → role="owner" pour les composants partagés.
export default async function AdminTenantLayout({ params, children }: LayoutProps) {
  const { tenantId } = await params;
  const tenant = await prisma.bookingTenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });
  if (!tenant) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 py-6 lg:px-6 pb-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Gestion admin du guichet
            </p>
          </div>
          <a
            href={`/${tenant.slug}/rendez-vous`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            <ExternalLink className="size-4" />
            Page publique
          </a>
        </div>
      </div>

      <BookingTabs tenantId={tenantId} role="owner" basePath="/admin/booking" />

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
