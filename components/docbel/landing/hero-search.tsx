"use client";

// Barre de recherche héroïque de la home.
//
// C'est volontairement un BOUTON stylisé comme un champ dépoli, pas un vrai
// <input> : la saisie se fait dans la palette de recherche globale
// (LandingCommandPalette, ouverte via `openSearch()` du contexte). On évite
// ainsi une double gestion du focus champ → palette. Clic / Entrée / Espace
// ouvrent la palette ; le focus seul ne déclenche rien (un changement de
// contexte au focus piégerait la navigation clavier — WCAG 3.2.1).

import { useEffect, useState, useSyncExternalStore } from "react";
import { SearchIcon } from "lucide-react";
import { useAppState } from "@/lib/app-state-context";
import { GLASS_INPUT } from "@/lib/glass-classes";

/// Exemples réels du domaine — le « placeholder » alterne doucement entre eux
/// pour montrer ce que la recherche sait trouver (outils, documents, notions).
const SEARCH_EXAMPLES = [
  "chômage temporaire",
  "C4",
  "calcul AGR",
  "commission paritaire",
];

/// Intervalle de rotation du placeholder (assez lent pour rester lisible).
const ROTATE_INTERVAL_MS = 3600;

// Détection de plateforme Apple (⌘K vs Ctrl K) hydration-safe : le serveur
// rend « Ctrl K » (snapshot serveur), React resynchronise après hydratation —
// sans warning de mismatch ni setState synchrone dans un effet.
const subscribeNoop = () => () => {};
function useIsApplePlatform(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent),
    () => false,
  );
}

export function HeroSearch() {
  const { openSearch } = useAppState();
  const isApple = useIsApplePlatform();
  const [exampleIndex, setExampleIndex] = useState(0);

  // Rotation douce des exemples. Coupée si l'utilisateur préfère moins
  // d'animations (le texte reste alors sur le premier exemple). setState
  // uniquement dans le callback du timer (asynchrone — lint OK).
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = window.setInterval(
      () => setExampleIndex((i) => (i + 1) % SEARCH_EXAMPLES.length),
      ROTATE_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  const shortcut = isApple ? "⌘" : "Ctrl";

  return (
    <div role="search" aria-label="Recherche sur tout le site" className="w-full">
      <button
        type="button"
        onClick={openSearch}
        aria-label={`Ouvrir la recherche — raccourci ${isApple ? "Commande" : "Contrôle"} K`}
        className={`${GLASS_INPUT} search-glow flex h-14 w-full items-center gap-3 border px-5 text-left backdrop-blur-xl transition-colors hover:bg-white/55 sm:h-16 sm:gap-4 sm:px-6 dark:hover:bg-white/8`}
      >
        <SearchIcon
          className="size-5 shrink-0 text-[color:var(--glass-ink-faint)]"
          aria-hidden
        />

        {/* Pseudo-placeholder : préfixe stable + exemple qui tourne (fondu
            via fadeInUp re-déclenché par la key ; statique en reduced-motion). */}
        <span
          aria-hidden
          className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[14px] sm:text-[15px]"
        >
          <span className="shrink-0 text-[color:var(--glass-ink-soft)]">
            Rechercher
          </span>
          <span
            key={exampleIndex}
            className="truncate animate-[fadeInUp_0.4s_ease] font-semibold text-[color:var(--glass-ink)] motion-reduce:animate-none"
          >
            «&nbsp;{SEARCH_EXAMPLES[exampleIndex]}&nbsp;»
          </span>
        </span>

        <kbd
          aria-hidden
          className="hidden shrink-0 items-center gap-1 rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] px-2 py-1 text-[11px] font-bold text-[color:var(--glass-ink-soft)] sm:inline-flex"
        >
          {shortcut}&nbsp;K
        </kbd>
      </button>
    </div>
  );
}
