"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useTheme } from "next-themes";

interface AppStateContextType {
  toolsCat: string;
  setToolsCat: (c: string) => void;
}

const AppStateContext = createContext<AppStateContextType>({
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
