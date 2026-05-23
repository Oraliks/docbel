import { redirect } from "next/navigation";

/// Page fusionnée dans /admin/documents/config (tab Sections).
export default function SectionsRedirect() {
  redirect("/admin/documents/config");
}
