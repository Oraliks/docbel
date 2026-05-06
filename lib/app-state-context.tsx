"use client";

import { createContext, useContext } from "react";
import { useTheme } from "@/components/theme-provider";

interface AppStateContextType {
  dark: boolean;
  setDark: (d: boolean) => void;
  toolsCat: string;
  setToolsCat: (c: string) => void;
}

const AppStateContext = createContext<AppStateContextType>({
  dark: false,
  setDark: () => {},
  toolsCat: "Tous",
  setToolsCat: () => {},
});

export function useAppState() {
  return useContext(AppStateContext);
}

export function useAppTheme() {
  return useTheme();
}

export { AppStateContext };
