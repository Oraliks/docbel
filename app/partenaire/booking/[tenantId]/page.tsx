import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function TenantIndexPage({ params }: PageProps) {
  const { tenantId } = await params;
  redirect(`/partenaire/booking/${tenantId}/agenda`);
}
