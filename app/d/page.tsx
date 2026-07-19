import { redirect } from "next/navigation";

/**
 * Redirection de /d/ vers /mes-demarches.
 * /d/ est une URL "parent" invalide (tous les dossiers ont /d/[slug]).
 * L'utilisateur qui accède à /d/ est probablement perdu — /d désigne ses
 * propres démarches (pas le catalogue) : on le redirige vers ses démarches
 * en cours.
 */
export default function DRedirect() {
  redirect("/mes-demarches");
}
