"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import {
  locales,
  localeNames,
  type Locale,
} from "@/i18n/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const localeFlags: Record<Locale, string> = {
  fr: "\u{1F1EB}\u{1F1F7}",
  nl: "\u{1F1F3}\u{1F1F1}",
  de: "\u{1F1E9}\u{1F1EA}",
  en: "\u{1F1EC}\u{1F1E7}",
  ar: "\u{1F1F8}\u{1F1E6}",
  tr: "\u{1F1F9}\u{1F1F7}",
  ro: "\u{1F1F7}\u{1F1F4}",
  bg: "\u{1F1E7}\u{1F1EC}",
};

export function LocaleSwitcher({
  localeList = locales,
  className = "",
}: {
  localeList?: readonly Locale[];
  className?: string;
} = {}) {
  const current = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === current) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${className}`}
          disabled={pending}
        >
          <span className="text-base leading-none" aria-hidden>
            {localeFlags[current]}
          </span>
          <span>{localeNames[current]}</span>
          {pending && (
            <LoaderCircleIcon className="size-3.5 animate-spin opacity-60" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="min-w-[160px]">
          {localeList.map((l) => (
            <DropdownMenuItem
              key={l}
              className="gap-2.5 px-2.5 py-2"
              onSelect={() => switchTo(l)}
            >
              <span className="text-base leading-none">{localeFlags[l]}</span>
              <span className="flex-1">{localeNames[l]}</span>
              {l === current && (
                <CheckIcon className="size-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {pending && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity">
          <div className="flex items-center gap-3 rounded-xl bg-card px-5 py-3 shadow-lg ring-1 ring-border">
            <LoaderCircleIcon className="size-5 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {current === "fr"
                ? "Changement de langue…"
                : current === "nl"
                  ? "Taal wijzigen…"
                  : "Switching language…"}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
