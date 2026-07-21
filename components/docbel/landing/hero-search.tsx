"use client";

// Point d'entree recherche de l'accueil. Il ouvre la palette globale deja
// chargee par le shell : aucun second moteur, aucun fetch au premier rendu.

import { useSyncExternalStore } from "react";
import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAppState } from "@/lib/app-state-context";
import { GLASS_INPUT } from "@/lib/glass-classes";

const SEARCH_EXAMPLE_KEYS = [
  "searchExample1",
  "searchExample2",
  "searchExample3",
] as const;

// Detection hydration-safe : le serveur rend Ctrl, puis le navigateur expose
// eventuellement le raccourci Commande sans setState dans un effet.
const subscribeNoop = () => () => {};
function useIsApplePlatform(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent),
    () => false,
  );
}

export function HeroSearch() {
  const t = useTranslations("public.home");
  const { openSearch } = useAppState();
  const isApple = useIsApplePlatform();
  const shortcut = isApple ? "⌘" : "Ctrl";

  return (
    <section
      role="search"
      aria-label={t("searchRegionLabel")}
      className="glass-surface relative overflow-hidden p-3 sm:p-4"
    >
      <div
        aria-hidden
        data-a11y-secondary="true"
        className="pointer-events-none absolute -top-16 right-8 size-36 rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--glass-accent-c)" }}
      />

      <button
        type="button"
        onClick={openSearch}
        aria-label={t("searchOpenLabel", {
          modifier: isApple ? "cmd" : "ctrl",
        })}
        className={`${GLASS_INPUT} search-glow glass-interactive relative flex min-h-16 w-full items-center gap-3 border px-4 py-3 text-left backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] sm:gap-4 sm:px-5`}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--glass-accent-deep)] text-[color:var(--glass-bg-a)] shadow-[0_8px_24px_-12px_var(--glass-accent-deep)]">
          <SearchIcon className="size-5" aria-hidden />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-[color:var(--glass-ink)] sm:text-[15px]">
            {t("searchPrefix")}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-[color:var(--glass-ink-soft)] sm:text-[13px]">
            {SEARCH_EXAMPLE_KEYS.map((key) => t(key)).join(" · ")}
          </span>
        </span>

        <kbd
          aria-hidden
          className="hidden shrink-0 rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] px-2 py-1 text-[11px] font-bold text-[color:var(--glass-ink-soft)] sm:block"
        >
          {shortcut}&nbsp;K
        </kbd>
        <ArrowRightIcon
          className="size-5 shrink-0 text-[color:var(--glass-accent-deep)]"
          aria-hidden
        />
      </button>
    </section>
  );
}
