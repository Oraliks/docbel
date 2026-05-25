/**
 * Ancienne page du générateur de prompts Claude Code.
 *
 * Le générateur a été intégré directement dans le chat IA via le bouton
 * baguette (Wand2) de la barre d'input. Cette page redirige donc vers
 * `/admin/chomage/ia/chat?mode=prompt` qui ouvre le chat avec la zone input
 * pré-basculée en mode "Brief Claude Code".
 *
 * Conservée pour les anciens liens / signets ; supprimable dans une future
 * itération si plus rien ne pointe ici.
 */

import { redirect } from "next/navigation";

export default function ChomageIaPromptBuilderRedirectPage() {
  redirect("/admin/chomage/ia/chat?mode=prompt");
}
