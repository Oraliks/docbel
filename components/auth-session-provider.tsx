"use client";

import { createContext, useContext, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import type { AuthSession } from "@/lib/auth";

/**
 * Hydrate la session SSR côté client pour éviter le flash "Invité → Compte".
 *
 * Le root layout lit la session via getServerAuthSession() puis la passe
 * ici. Tant que le hook useSession() de Better Auth n'a pas encore
 * résolu sa propre fetch, on sert la session SSR comme "vérité" — donc
 * le 1er render client a déjà le bon état (connecté ou non).
 *
 * Dès que le hook client résout, on bascule sur sa valeur, ce qui couvre
 * les flux dynamiques (signOut, signIn dans un autre onglet, refresh).
 */
const SessionContext = createContext<{ initialSession: AuthSession }>({
  initialSession: null,
});

export function AuthSessionProvider({
  initialSession,
  children,
}: {
  initialSession: AuthSession;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={{ initialSession }}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Drop-in remplacement de authClient.useSession() : retourne la même
 * shape mais avec isPending=false dès le 1er render quand on a une
 * session SSR (qu'elle soit null ou pleine — null veut dire "vérifié,
 * pas connecté", c'est une réponse valide).
 *
 * Ordre de priorité :
 *   1. data client présent → c'est la vérité la plus fraîche (signIn dans un
 *      autre onglet, ré-hydratation post-refetch).
 *   2. data client null mais isPending → 1er render, on sert initialSession
 *      pour éviter le flash "Invité → Compte".
 *   3. data client null + pas pending + erreur de fetch → on garde
 *      initialSession comme filet (cf. bug "actualise trop vite" : un re-fetch
 *      raté pendant un cold-start Neon faisait passer un user connecté
 *      en "Invité" côté UI alors que la session DB était toujours valide).
 *   4. data client null légitime (signOut explicite, pas de session) → on
 *      laisse passer null.
 */
export function useAuthSession() {
  const { initialSession } = useContext(SessionContext);
  const sessionState = authClient.useSession();

  if (sessionState.data) return sessionState;

  if (sessionState.isPending) {
    return {
      ...sessionState,
      data: initialSession,
      isPending: false,
    };
  }

  // Pas pending, pas de data client. Si initialSession existe ET qu'on a
  // une erreur de fetch ou une indication de refetch en cours, on garde
  // l'initialSession plutôt que d'afficher "Invité" à tort. C'est correct
  // tant que l'user n'a pas signOut (auquel cas le cookie a disparu et le
  // prochain refresh montrera bien null).
  if (
    initialSession &&
    ((sessionState as { error?: unknown }).error ||
      (sessionState as { isRefetching?: boolean }).isRefetching)
  ) {
    return { ...sessionState, data: initialSession };
  }

  return sessionState;
}
