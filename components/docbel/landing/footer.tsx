"use client";

import Link from "next/link";

export function LandingFooter() {
  return (
    <footer
      // `mt-auto` plus the parent <main>'s `min-h-svh` flex column pins the
      // footer to the bottom of the viewport on short pages, while letting it
      // ride down naturally when content overflows.
      className="mt-auto flex flex-col items-start justify-between gap-2 border-t px-6 py-5 text-[12px] text-[color:var(--glass-ink-faint)] sm:flex-row sm:items-center"
      style={{ borderTopColor: "var(--glass-ink-line)" }}
    >
      <span>© 2026 Docbel — Plateforme d&apos;informations &amp; d&apos;outils légaux</span>
      <nav className="flex flex-wrap gap-4">
        <Link
          href="/glossaire"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          Glossaire
        </Link>
        <Link
          href="/contact"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          Contact
        </Link>
        <a
          href="#"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          Mentions légales
        </a>
        <a
          href="#"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          Confidentialité
        </a>
        <a
          href="#"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          Accessibilité
        </a>
        <a
          href="#"
          className="font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
        >
          FR · NL
        </a>
      </nav>
    </footer>
  );
}
