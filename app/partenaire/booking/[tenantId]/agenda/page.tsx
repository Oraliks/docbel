import { notFound } from "next/navigation";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { tenantAccess } from "@/lib/booking/access";
import { AgendaClient } from "./agenda-client";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export const dynamic = "force-dynamic";

export default async function AgendaPage({ params }: PageProps) {
  const { tenantId } = await params;

  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();

  const { tenant, role } = await tenantAccess(
    auth.user.id,
    auth.user.role,
    tenantId
  );
  if (!tenant || !role) notFound();

  return <AgendaClient tenantId={tenantId} role={role} />;
}
