import { OrgFormationsEnrollmentsPage } from "@/components/formations/org/server-pages";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrgFormationsEnrollmentsPage segment="employeur" id={id} />;
}
