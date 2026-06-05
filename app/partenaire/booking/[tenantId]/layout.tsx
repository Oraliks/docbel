import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { tenantAccess } from "@/lib/booking/access";
import { BookingTabs } from "./booking-tabs";

interface LayoutProps {
  params: Promise<{ tenantId: string }>;
  children: React.ReactNode;
}

export default async function TenantLayout({ params, children }: LayoutProps) {
  const { tenantId } = await params;

  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();

  const { tenant, role } = await tenantAccess(
    auth.user.id,
    auth.user.role,
    tenantId
  );
  if (!tenant || !role) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-4 py-6 lg:px-6 pb-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{tenant.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Espace de gestion du guichet
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

      <BookingTabs tenantId={tenantId} role={role} />

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
