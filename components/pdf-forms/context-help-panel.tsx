"use client";

import { getSectionHelp } from "@/lib/pdf-forms/section-help";
import type { Locale } from "@/lib/pdf-forms/types";

interface ContextHelpPanelProps {
  /// Clé de section de l'étape active (undefined = étape résumé/repli).
  sectionKey: string | undefined;
  locale: Locale;
}

/// Panneau d'aide contextuelle, contenu dérivé de la section active.
/// Sticky en desktop (colonne de droite), sous le formulaire en mobile.
export function ContextHelpPanel({ sectionKey, locale }: ContextHelpPanelProps) {
  const help = getSectionHelp(sectionKey, locale);
  return (
    <aside className="flex flex-col gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-5 lg:sticky lg:top-6">
      <h3 className="text-sm font-semibold text-[color:var(--glass-ink)]">{help.title}</h3>
      <p className="text-sm leading-relaxed text-[color:var(--glass-ink-soft)]">{help.body}</p>
      {help.examples && help.examples.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm text-[color:var(--glass-ink-soft)]">
          {help.examples.map((ex) => (
            <li key={ex} className="flex items-start gap-2">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-[color:var(--glass-accent-deep,#5B46E5)]" />
              {ex}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
