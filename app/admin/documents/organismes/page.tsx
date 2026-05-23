import { redirect } from "next/navigation";

/// Page fusionnée dans /admin/documents/config (tab Organismes).
export default function OrganismesRedirect() {
  redirect("/admin/documents/config?tab=organismes");
}
