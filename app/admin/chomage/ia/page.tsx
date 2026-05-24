/**
 * Racine du module Assistant IA Chômage.
 *
 * Redirige systématiquement vers /admin/chomage/ia/sources qui est l'écran
 * d'atterrissage logique (on commence par alimenter la KB).
 */

import { redirect } from "next/navigation";

export default function ChomageIaIndexPage() {
  redirect("/admin/chomage/ia/sources");
}
