"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { publicLocales } from "@/i18n/config";
import { LocaleSwitcher } from "@/components/locale-switcher";

// Existing first-visit marker only. The locale cookie remains the source of truth.
const LS_KEY = "beldoc.locale.chosen";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
function needsWelcome() {
  try { return !window.localStorage.getItem(LS_KEY); }
  catch { return false; }
}
const serverSnapshot = () => false;

export function WelcomeLocaleModal() {
  const pathname = usePathname();
  const locale = useLocale();
  const offer = useSyncExternalStore(subscribe, needsWelcome, serverSnapshot);
  const [dismissed, setDismissed] = useState(false);
  if (pathname.startsWith("/admin")) return null;
  return (
    <LocaleSwitcher
      localeList={publicLocales}
      renderTrigger={false}
      open={offer && !dismissed}
      onOpenChange={(open) => {
        if (open) return;
        setDismissed(true);
        try { window.localStorage.setItem(LS_KEY, locale); } catch {}
      }}
    />
  );
}
