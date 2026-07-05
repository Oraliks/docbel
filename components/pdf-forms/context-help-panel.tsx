"use client";

import Link from "next/link";
import { ArrowRightIcon, InfoIcon, LifeBuoyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { getSectionHelp } from "@/lib/pdf-forms/section-help";
import type { Locale } from "@/lib/pdf-forms/types";

interface ContextHelpPanelProps {
  /// Clé de section de l'étape active (undefined = étape résumé/repli).
  sectionKey: string | undefined;
  locale: Locale;
}

/// Panneau d'aide contextuelle, contenu dérivé de la section active
/// (dictionnaire trilingue `section-help.ts`). Sticky en desktop (colonne de
/// droite), sous le formulaire en mobile. Le bloc « Besoin d'aide ? » pointe
/// vers la page contact réelle — jamais de coordonnées inventées.
export function ContextHelpPanel({ sectionKey, locale }: ContextHelpPanelProps) {
  const t = useTranslations("public.dossier");
  const help = getSectionHelp(sectionKey, locale);
  return (
    <aside className="flex flex-col gap-4 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] p-5 lg:sticky lg:top-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-soft)]">
        {t("runnerHelpPanelEyebrow")}
      </p>

      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[color:var(--glass-accent-deep,#5B46E5)]"
          style={{ background: "var(--glass-pop-bg)" }}
        >
          <InfoIcon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-semibold text-[color:var(--glass-ink)]">{help.title}</h3>
          <p className="text-[13px] leading-relaxed text-[color:var(--glass-ink-soft)]">{help.body}</p>
        </div>
      </div>

      {help.examples && help.examples.length > 0 && (
        <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4">
          <p className="mb-2 text-xs font-semibold text-[color:var(--glass-ink)]">
            {t("runnerHelpExamplesLabel")}
          </p>
          <ul className="flex flex-col gap-1.5 text-[13px] text-[color:var(--glass-ink-soft)]">
            {help.examples.map((ex) => (
              <li key={ex} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1.5 size-1 shrink-0 rounded-full bg-[color:var(--glass-accent-deep,#5B46E5)]"
                />
                {ex}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-[color:var(--glass-border)] pt-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[color:var(--glass-accent-deep,#5B46E5)]"
            style={{ background: "var(--glass-pop-bg)" }}
          >
            <LifeBuoyIcon className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-[color:var(--glass-ink)]">
              {t("runnerHelpNeedHelpTitle")}
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[color:var(--glass-accent-deep,#5B46E5)] hover:underline"
            >
              {t("runnerHelpContactCta")}
              <ArrowRightIcon className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
