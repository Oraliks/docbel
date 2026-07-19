"use client";

import Link from "next/link";
import { ArrowRightIcon, CheckIcon, InfoIcon, LifeBuoyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { getSectionHelp } from "@/lib/pdf-forms/section-help";
import type { Locale, Localized } from "@/lib/pdf-forms/types";
import { pickFieldHelp } from "@/lib/pdf-forms/field-help";
import {
  getDefaultTipsForForm,
  pickLocalized,
  resolveTips,
  type TipEntry,
} from "@/lib/form-context-tips";

interface ContextHelpPanelProps {
  /// Slug du formulaire — pour retomber sur les défauts (code) si `entries`
  /// n'est pas fourni côté serveur.
  formSlug: string;
  /// Clés des sections/étapes actives (une macro-étape en regroupe plusieurs).
  /// La 1re sert de repli d'aide générique ; toutes servent au matching des
  /// conseils conditionnés sur une section.
  sectionKeys: string[];
  /// Ids des motifs cochés dans les réponses courantes (déclencheurs contextuels).
  checkedFieldIds: string[];
  /// Entrées « infos importantes » servies par le serveur (DB sur défauts).
  /// Absent = repli sur les défauts purs (`getDefaultTipsForForm`).
  entries?: TipEntry[];
  /// Id du champ actuellement focalisé (§10.4, Lot 4d). Quand il est renseigné
  /// ET que le champ correspondant porte une aide, on affiche « À propos de ce
  /// champ » EN TÊTE du panneau, au-dessus des infos importantes. Absent / sans
  /// aide = panneau strictement inchangé.
  activeFieldId?: string;
  /// Champs du formulaire (au minimum `{ id, help }`) — sert à résoudre l'aide
  /// du champ focalisé via `pickFieldHelp`. Ignoré si `activeFieldId` absent.
  fields?: { id: string; help?: Localized }[];
  locale: Locale;
  /// true = rendu SANS chrome propre (bordure/fond/sticky) : le panneau est
  /// embarqué dans le rail de démarche qui porte déjà la surface glass.
  embedded?: boolean;
}

/// Panneau d'aide contextuelle (colonne de GAUCHE). Affiche les « infos
/// importantes » contextuelles au motif coché / à l'étape active
/// (`form-context-tips.ts`) ; à défaut d'entrée applicable, retombe sur l'aide
/// générique de section (`section-help.ts`) — jamais de panneau vide. Le bloc
/// « Besoin d'aide ? » pointe vers la page contact réelle.
export function ContextHelpPanel({
  formSlug,
  sectionKeys,
  checkedFieldIds,
  entries,
  activeFieldId,
  fields,
  locale,
  embedded = false,
}: ContextHelpPanelProps) {
  const t = useTranslations("public.dossier");
  const source = entries ?? getDefaultTipsForForm(formSlug);
  const shown = resolveTips(source, { sectionKeys, checkedFieldIds });
  const help = getSectionHelp(sectionKeys[0], locale);
  // Couche focus (§10.4) AU-DESSUS du système existant : aide propre du champ
  // focalisé, résolue via le sélecteur pur `pickFieldHelp`. N'altère ni
  // `resolveTips`, ni le repli de section, ni le contact.
  const activeField = activeFieldId ? fields?.find((f) => f.id === activeFieldId) : undefined;
  const fieldHelp = activeField ? pickFieldHelp(activeField, locale) : null;

  return (
    <aside
      className={
        embedded
          ? "flex flex-col gap-3.5"
          : "flex flex-col gap-3.5 rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface-strong)] p-4 lg:sticky lg:top-6"
      }
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-soft)]">
        {t("runnerHelpPanelEyebrow")}
      </p>

      {/* Aide du champ focalisé (§10.4, Lot 4d) — surface EN TÊTE, au-dessus des
          infos importantes. Rendu seulement si un champ focalisé porte une aide ;
          sinon le panneau reste identique (tips → repli section → contact). */}
      {fieldHelp && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-accent-deep,#5B46E5)]">
            {t("runnerFieldHelpEyebrow")}
          </span>
          <p className="text-[13px] leading-relaxed text-[color:var(--glass-ink-soft)]">
            {fieldHelp}
          </p>
        </div>
      )}

      {shown.length > 0 ? (
        shown.map((entry) => {
          // Le contenu peut venir du CMS admin : on filtre les textes vides pour
          // ne jamais rendre une pastille / puce / lien creux.
          const eyebrow = entry.eyebrow ? pickLocalized(entry.eyebrow, locale) : "";
          const intro = entry.intro ? pickLocalized(entry.intro, locale) : "";
          const reminders = entry.reminders
            .map((r) => pickLocalized(r, locale))
            .filter(Boolean);
          const checklist = (entry.checklist ?? [])
            .map((c) => pickLocalized(c, locale))
            .filter(Boolean);
          const linkLabel = entry.link ? pickLocalized(entry.link.label, locale) : "";
          const linkHref = entry.link?.href ?? "";
          return (
            <div key={entry.id} className="flex flex-col gap-3">
              {eyebrow && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[color:var(--glass-pop-bg)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--glass-accent-deep,#5B46E5)]">
                  <InfoIcon className="size-3.5" aria-hidden />
                  {eyebrow}
                </span>
              )}

              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-semibold text-[color:var(--glass-ink)]">
                  {pickLocalized(entry.title, locale)}
                </h3>
                {intro && (
                  <p className="text-[13px] leading-relaxed text-[color:var(--glass-ink-soft)]">
                    {intro}
                  </p>
                )}
              </div>

              {reminders.length > 0 && (
                <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-[color:var(--glass-ink-soft)]">
                  {reminders.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[color:var(--glass-accent-deep,#5B46E5)]"
                      />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              )}

              {checklist.length > 0 && (
                <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3.5">
                  <p className="mb-2 text-xs font-semibold text-[color:var(--glass-ink)]">
                    {t("runnerHelpChecklistLabel")}
                  </p>
                  <ul className="flex flex-col gap-1.5 text-[13px] text-[color:var(--glass-ink-soft)]">
                    {checklist.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckIcon
                          className="mt-0.5 size-3.5 shrink-0 text-[color:var(--glass-accent-deep,#5B46E5)]"
                          strokeWidth={3}
                          aria-hidden
                        />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {linkHref && linkLabel && (
                <Link
                  href={linkHref}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[color:var(--glass-accent-deep,#5B46E5)] hover:underline"
                >
                  {linkLabel}
                  <ArrowRightIcon className="size-3.5" aria-hidden />
                </Link>
              )}
            </div>
          );
        })
      ) : (
        <>
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
            <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3.5">
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
        </>
      )}

      <div className="border-t border-[color:var(--glass-border)] pt-3.5">
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
