import { redirect } from "next/navigation";

/// La page « Modèles » a été retirée en PR2 (l'édition de DocumentTemplate
/// passe désormais par « PDF Forms »). On redirige vers la config Bundles
/// pour ne pas casser les liens existants.
export default function LegacyAdminDocumentsRedirect() {
  redirect("/admin/documents/config");
}
