"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { GlobeIcon } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { locales, localeNames } from "@/i18n/config";

/**
 * Sélecteur de langue (mode cookie, sans routing URL).
 * <select> natif volontairement : robuste, zéro dépendance à une lib de
 * dropdown, fonctionne dans la sidebar admin comme ailleurs.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70">
      <GlobeIcon className="size-4 shrink-0" />
      <select
        aria-label="Langue"
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLocale(next);
            router.refresh();
          });
        }}
        className="w-full cursor-pointer bg-transparent outline-none disabled:opacity-50"
      >
        {locales.map((l) => (
          <option key={l} value={l} className="text-foreground">
            {localeNames[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
