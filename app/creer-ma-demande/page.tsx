import { redirect } from "next/navigation";

// Conserver les anciens liens vers le guichet désormais disponible sur /mon-dossier.
export default function CreerMaDemandePage() {
  redirect("/mon-dossier");
}
