import { redirect } from "next/navigation";

export default async function AdminTenantPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(`/admin/booking/${tenantId}/agenda`);
}
