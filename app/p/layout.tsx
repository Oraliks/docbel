import type { ReactNode } from "react";

/**
 * Layout pour la section `/p/*` — landings marketing publiques qui vendent
 * les espaces pros (partenaire, employeur) à des visiteurs ou des utilisateurs
 * déjà connectés.
 *
 * Le chrome (LandingHeader glass + LandingFooter + .glass-root wrapper) est
 * déjà fourni par `app-layout-client.tsx`. Le `resolveProSegment()` y détecte
 * `/p/*` et force le LandingHeader même si l'utilisateur est partner/employer
 * connecté (les landings doivent rester accessibles à tous).
 *
 * Ce layout est donc volontairement minimal : il sert juste de point d'ancrage
 * pour la route group `/p/*`.
 */
export default function PublicLandingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
