import { redirect } from "next/navigation";

/// L'espace "Documents" a été consolidé sous "PDF Forms" (`/admin/pdf`).
/// Redirection permanente pour ne pas casser les anciens favoris admin.
export default function LegacyAdminDocumentsRedirect() {
  redirect("/admin/pdf");
}
