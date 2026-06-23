"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { GlobeIcon } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { locales, localeNames, type Locale } from "@/i18n/config";

/**
 * Sélecteur de langue (mode cookie, sans routing URL).
 * <select> natif volontairement : robuste, zéro dépendance à une lib de
 * dropdown, fonctionne dans la sidebar admin comme dans le header glass public.
 *
 * `localeList` limite les langues proposées (ex. `publicLocales` = FR/NL/EN
 * traduites côté front) ; par défaut toutes les locales (usage admin).
 */
export function LocaleSwitcher({
  localeList = locales,
  className = "",
}: {
  localeList?: readonly Locale[];
  className?: string;
} = {}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className={`flex items-center gap-1.5 text-sm ${className}`}>
      <GlobeIcon className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">Langue</span>
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
        className="cursor-pointer bg-transparent outline-none disabled:opacity-50"
      >
        {localeList.map((l) => (
          <option key={l} value={l} className="text-foreground">
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
