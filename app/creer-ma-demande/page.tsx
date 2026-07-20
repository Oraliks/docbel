import { redirect } from "next/navigation";

/// `/creer-ma-demande` a fusionné dans le guichet `/mon-dossier` (Task 4.3 —
/// refonte parcours citoyen). Redirect permanent côté route ; les composants
/// que cette page était seule à monter (LifeEventCard…) restent en place sur
/// le disque (nettoyage éventuel via CLEANUP_QUEUE, hors périmètre ici).
export default function CreerMaDemandePage() {
  redirect("/mon-dossier");
}
