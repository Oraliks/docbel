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
 */
export function useAuthSession() {
  const { initialSession } = useContext(SessionContext);
  const sessionState = authClient.useSession();

  if (sessionState.isPending) {
    return {
      ...sessionState,
      data: initialSession,
      isPending: false,
    };
  }
  return sessionState;
}
