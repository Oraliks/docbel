import { redirect } from "next/navigation";

/// Page fusionnée dans /admin/documents/config (tab Bundles).
export default function BundlesRedirect() {
  redirect("/admin/documents/config?tab=bundles");
}
