import { ConfigurationClient } from "@/components/booking/configuration-client";

export const dynamic = "force-dynamic";

export default async function AdminConfigurationPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <ConfigurationClient tenantId={tenantId} />;
}
