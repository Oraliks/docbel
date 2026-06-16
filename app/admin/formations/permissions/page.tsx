import { listOrganizationsWithPermission } from "@/lib/formations/admin-queries";
import { PermissionsClient } from "./permissions-client";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  const orgs = await listOrganizationsWithPermission();
  return <PermissionsClient orgs={orgs} />;
}
