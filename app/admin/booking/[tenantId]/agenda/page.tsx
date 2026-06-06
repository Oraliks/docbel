import { AgendaClient } from "@/components/booking/agenda-client";

export const dynamic = "force-dynamic";

export default async function AdminAgendaPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <AgendaClient tenantId={tenantId} role="owner" />;
}
