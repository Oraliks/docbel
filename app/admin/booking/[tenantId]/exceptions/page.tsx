import { ExceptionsClient } from "@/components/booking/exceptions-client";

export const dynamic = "force-dynamic";

export default async function AdminExceptionsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <ExceptionsClient tenantId={tenantId} role="owner" />;
}
