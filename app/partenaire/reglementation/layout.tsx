import type { ReactNode } from "react";

import { CommandPalette } from "@/components/reglementation/command-palette";

/**
 * Layout du module réglementation : monte la palette de commande (Ctrl+K)
 * pour toutes les pages (liste, fiche, sommaire par loi). Le gating d'accès
 * reste géré par chaque page (requirePartnerOrAdminAuth) et par l'API index.
 */
export default function ReglementationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <CommandPalette />
    </>
  );
}
