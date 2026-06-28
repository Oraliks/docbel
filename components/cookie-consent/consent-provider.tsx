"use client";

// Provider de consentement cookies (RGPD_QUEUE §1).
// Source de vérité côté client : le cookie `docbel-consent`. L'état initial vient
// du SERVEUR (prop `initialConsent` lue dans app/layout.tsx) → zéro flash et,
// surtout, aucun traceur monté tant que le consentement n'est pas accordé.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  consentCookieString,
  hasDecision,
  makeAcceptAll,
  makeRejectAll,
  type ConsentState,
} from "@/lib/cookie-consent/consent";

type ConsentContextValue = {
  /** État courant, ou `null` si aucune décision (bannière à afficher). */
  consent: ConsentState | null;
  /** L'utilisateur a-t-il déjà tranché ? */
  decided: boolean;
  /** Mesure d'audience autorisée ? (false si pas de décision). */
  analyticsAllowed: boolean;
  /** Bannière visible (pas de décision encore). */
  bannerOpen: boolean;
  /** Panneau « Personnaliser » ouvert. */
  prefsOpen: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  /** Enregistre des choix granulaires depuis le panneau préférences. */
  save: (choices: { analytics: boolean }) => void;
  /** Rouvre le panneau préférences (lien footer « Gérer mes cookies »). */
  openPreferences: () => void;
  closePreferences: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function CookieConsentProvider({
  initialConsent,
  children,
}: {
  initialConsent: ConsentState | null;
  children: ReactNode;
}) {
  const [consent, setConsent] = useState<ConsentState | null>(initialConsent);
  const [prefsOpen, setPrefsOpen] = useState(false);
  // Ref miroir du consentement pour comparer ancien/nouveau sans dépendances.
  const consentRef = useRef<ConsentState | null>(initialConsent);

  const persist = useCallback((next: ConsentState) => {
    const prev = consentRef.current;
    consentRef.current = next;
    try {
      document.cookie = consentCookieString(next);
    } catch {
      // ignore : le consentement reste en mémoire pour la session courante
    }
    setConsent(next);
    // RETRAIT d'un consentement déjà accordé (analytics true → false) : démonter
    // <Analytics/> ne « décharge » pas le script tiers Vercel déjà injecté. Pour
    // que le retrait prenne effet IMMÉDIATEMENT (exigence RGPD), on recharge la
    // page → la gate repart de zéro et plus aucun traceur n'est monté.
    if (prev?.analytics === true && next.analytics === false) {
      try {
        window.location.reload();
      } catch {
        // ignore : au pire le traceur s'arrête au prochain chargement
      }
    }
  }, []);

  const acceptAll = useCallback(() => {
    persist(makeAcceptAll(new Date().toISOString()));
    setPrefsOpen(false);
  }, [persist]);

  const rejectAll = useCallback(() => {
    persist(makeRejectAll(new Date().toISOString()));
    setPrefsOpen(false);
  }, [persist]);

  const save = useCallback(
    (choices: { analytics: boolean }) => {
      persist({
        v: makeRejectAll("").v,
        analytics: choices.analytics,
        ts: new Date().toISOString(),
      });
      setPrefsOpen(false);
    },
    [persist],
  );

  const value = useMemo<ConsentContextValue>(() => {
    const decided = hasDecision(consent);
    return {
      consent,
      decided,
      analyticsAllowed: decided && consent.analytics,
      bannerOpen: !decided,
      prefsOpen,
      acceptAll,
      rejectAll,
      save,
      openPreferences: () => setPrefsOpen(true),
      closePreferences: () => setPrefsOpen(false),
    };
  }, [consent, prefsOpen, acceptAll, rejectAll, save]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

/** Hook d'accès au consentement. Renvoie un fallback inerte hors provider
 *  (ex. arbres de test) plutôt que de jeter. */
export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (ctx) return ctx;
  return {
    consent: null,
    decided: false,
    analyticsAllowed: false,
    bannerOpen: false,
    prefsOpen: false,
    acceptAll: () => {},
    rejectAll: () => {},
    save: () => {},
    openPreferences: () => {},
    closePreferences: () => {},
  };
}
