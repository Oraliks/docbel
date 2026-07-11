"use client";

import { createContext, useContext } from "react";
import type { PublicSiteSettings } from "@/lib/site-settings";

/**
 * Expose au client la tranche PUBLIQUE des paramètres globaux (identité,
 * maintenance, annonce, version de consentement) — lue côté serveur dans le
 * layout racine et passée en valeur initiale, comme `CookieConsentProvider` /
 * `AuthSessionProvider`. Aucun secret ne transite ici.
 */
const SiteSettingsContext = createContext<PublicSiteSettings | null>(null);

export function SiteSettingsProvider({
  value,
  children,
}: {
  value: PublicSiteSettings;
  children: React.ReactNode;
}) {
  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

/** `null` si le provider n'est pas monté (les consommateurs doivent gérer ce cas). */
export function useSiteSettings(): PublicSiteSettings | null {
  return useContext(SiteSettingsContext);
}
