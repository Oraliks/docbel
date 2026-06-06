import { notFound } from "next/navigation";
import { requireBookingActorAuth } from "@/lib/auth-check";
import { tenantAccess } from "@/lib/booking/access";
import { AgendaClient } from "@/components/booking/agenda-client";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export const dynamic = "force-dynamic";

export default async function AgendaPage({ params }: PageProps) {
  const { tenantId } = await params;

  const auth = await requireBookingActorAuth();
  if (!auth.isAuthorized) notFound();

  const { tenant, role } = await tenantAccess(
    auth.user.id,
    auth.user.role,
    tenantId
  );
  if (!tenant || !role) notFound();

  return (
    <AgendaClient
      tenantId={tenantId}
      role={role}
      isAdmin={auth.user.role === "admin"}
    />
  );
}
