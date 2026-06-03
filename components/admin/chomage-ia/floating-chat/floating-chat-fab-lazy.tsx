"use client";

import dynamic from "next/dynamic";

/**
 * Wrapper client pour différer le chargement du FloatingChatFab.
 *
 * Le FAB mini-chat embarque le client SSE + le thread markdown + les icônes :
 * lourd, fermé par défaut, rarement ouvert. Comme app/admin/layout.tsx est un
 * Server Component (où `dynamic({ ssr:false })` est interdit), on passe par ce
 * petit wrapper client. Résultat : le code du FAB sort du bundle initial de
 * TOUTES les pages /admin/* et se charge à la demande après hydratation
 * (le bouton n'est pas critique au premier paint).
 */
export const FloatingChatFabLazy = dynamic(
  () =>
    import("./floating-chat-fab").then((m) => ({ default: m.FloatingChatFab })),
  { ssr: false, loading: () => null }
);
