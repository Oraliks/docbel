"use client";

import { createContext, useContext } from "react";
import { useTheme } from "@/components/theme-provider";

interface AppStateContextType {
  dark: boolean;
  setDark: (d: boolean) => void;
  toolsCat: string;
  setToolsCat: (c: string) => void;
  /// Ouvre la palette de recherche globale (LandingCommandPalette). Fournie
  /// par AppLayoutClient ; no-op par défaut hors du chrome public.
  openSearch: () => void;
}

const AppStateContext = createContext<AppStateContextType>({
  dark: false,
  setDark: () => {},
  toolsCat: "Tous",
  setToolsCat: () => {},
  openSearch: () => {},
});

export function useAppState() {
  return useContext(AppStateContext);
}

export function useAppTheme() {
  return useTheme();
}

export { AppStateContext };
