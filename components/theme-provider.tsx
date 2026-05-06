"use client"

import * as React from "react"

type Theme = "light" | "dark"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme | "system"
  attribute?: string
  disableTransitionOnChange?: boolean
}

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: Theme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = "docbel-theme"

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  attribute = "class",
}: ThemeProviderProps) {
  const fallbackTheme = defaultTheme === "system" ? "light" : defaultTheme
  const getThemeSnapshot = React.useCallback((): Theme => {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY)

    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme
    }

    return defaultTheme === "system" ? getSystemTheme() : fallbackTheme
  }, [defaultTheme, fallbackTheme])

  const subscribe = React.useCallback((onStoreChange: () => void) => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => onStoreChange()

    window.addEventListener("storage", handleChange)
    window.addEventListener("docbel-theme-change", handleChange)
    mediaQuery.addEventListener("change", handleChange)

    return () => {
      window.removeEventListener("storage", handleChange)
      window.removeEventListener("docbel-theme-change", handleChange)
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  const theme = React.useSyncExternalStore(subscribe, getThemeSnapshot, () => fallbackTheme)

  React.useEffect(() => {
    const root = document.documentElement

    if (attribute === "class") {
      root.classList.toggle("dark", theme === "dark")
    } else {
      root.setAttribute(attribute, theme)
    }

    root.style.colorScheme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [attribute, theme])

  const setTheme = React.useCallback((value: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, value)
    window.dispatchEvent(new Event("docbel-theme-change"))
  }, [])

  const contextValue = React.useMemo(
    () => ({
      theme,
      resolvedTheme: theme,
      setTheme,
    }),
    [theme, setTheme]
  )

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = React.useContext(ThemeContext)

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }

  return context
}
