import { notFound } from "next/navigation";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { tenantAccess } from "@/lib/booking/access";
import { ExceptionsClient } from "./exceptions-client";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export const dynamic = "force-dynamic";

export default async function ExceptionsPage({ params }: PageProps) {
  const { tenantId } = await params;

  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();

  const { tenant, role } = await tenantAccess(
    auth.user.id,
    auth.user.role,
    tenantId
  );
  if (!tenant || !role) notFound();

  return <ExceptionsClient tenantId={tenantId} role={role} />;
}
