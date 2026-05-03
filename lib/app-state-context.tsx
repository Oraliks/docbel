"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useTheme } from "next-themes";

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
