import { redirect } from "next/navigation";

/**
 * Redirection de /d/ vers /mon-dossier.
 * /d/ est une URL "parent" invalide (tous les dossiers ont /d/[slug]).
 * L'utilisateur qui accède à /d/ est probablement perdu — on le redirige
 * vers le catalogue complet des dossiers.
 */
export default function DRedirect() {
  redirect("/mon-dossier");
}
