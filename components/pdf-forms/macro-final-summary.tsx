"use client";

import { ChevronRightIcon, FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";
import type { FormPayload, Locale, PdfFormTrigger } from "@/lib/pdf-forms/types";
import { loc } from "@/lib/pdf-forms/types";
import { applyFieldDerivations } from "@/lib/pdf-forms/field-derivations";
import { isAutoField } from "@/lib/pdf-forms/auto-fields";
import { isFieldVisible } from "@/lib/pdf-forms/validation";
import { selectCriticalSummary, resolveRecapValue, isAnswered } from "@/lib/pdf-forms/summary-fields";

interface MacroFinalSummaryProps {
  fields: PublicField[];
  values: FormPayload;
  locale: Locale;
  liveTriggers: PdfFormTrigger[];
}

/// Récapitulatif final allégé (§10.6) affiché EN TÊTE de l'étape finale :
///   (a) une carte compacte « champs critiques » (identité, motif(s), date du
///       changement, organisme de paiement) + une ligne « documents requis »
///       (dérivée des triggers actifs) ;
///   (b) un expander natif `<details>` REPLIÉ par défaut (« Voir toutes mes
///       réponses ») qui déroule la liste lecture seule de TOUS les champs
///       visibles + renseignés (hors champs auto : signature, date auto…).
///
/// Aucun state local (le `<details>` non contrôlé garantit « fermé par
/// défaut » sans effet React). Les dates dérivées (ex. date de naissance ←
/// NISS) sont résolues via `applyFieldDerivations` pour coller à l'affichage.
export function MacroFinalSummary({ fields, values, locale, liveTriggers }: MacroFinalSummaryProps) {
  const t = useTranslations("public.dossier");

  // Réponses avec les dérivations appliquées (date de naissance ← NISS, pays ←
  // code postal…), pour que le récap reflète ce que l'utilisateur a vu à
  // l'écran (champs verrouillés) plutôt que la saisie manuelle antérieure.
  const resolved = applyFieldDerivations(values, fields);

  const critical = selectCriticalSummary(fields, resolved, locale);
  const documents = liveTriggers.map((tr) => tr.reason?.fr || tr.requiresFormSlug).filter(Boolean);
  const recap = fields.filter(
    (f) => !isAutoField(f) && isFieldVisible(f.visibleIf, resolved) && isAnswered(f, resolved)
  );
  const yesNo = { yes: t("yes"), no: t("no") };

  if (critical.length === 0 && documents.length === 0 && recap.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <FileTextIcon aria-hidden className="size-4 text-[color:var(--glass-accent-deep,#5B46E5)]" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
          {t("runnerSummaryCriticalTitle")}
        </h3>
      </div>

      {/* (a) Carte compacte des champs critiques + documents requis. */}
      <dl className="flex flex-col divide-y divide-[color:var(--glass-border)]">
        {critical.map((entry) => (
          <div key={entry.label} className="flex items-start justify-between gap-4 py-2 text-sm">
            <dt className="text-[color:var(--glass-ink-soft)]">{t(entry.label as Parameters<typeof t>[0])}</dt>
            <dd className="text-right font-medium text-[color:var(--glass-ink)]">{entry.value}</dd>
          </div>
        ))}
        {documents.length > 0 && (
          <div className="flex items-start justify-between gap-4 py-2 text-sm">
            <dt className="text-[color:var(--glass-ink-soft)]">{t("runnerSummaryCriticalDocuments")}</dt>
            <dd className="text-right font-medium text-[color:var(--glass-ink)]">{documents.join(", ")}</dd>
          </div>
        )}
      </dl>

      {/* (b) Expander REPLIÉ par défaut : récap complet lecture seule.
          `<details>` non contrôlé — pas de state, pas de setState en effet. */}
      {recap.length > 0 && (
        <details className="group rounded-xl border border-[color:var(--glass-border)]">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-medium text-[color:var(--glass-ink)] [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon aria-hidden className="size-4 transition-transform group-open:rotate-90" />
            {t("runnerSummarySeeAll")}
          </summary>
          <div className="flex flex-col divide-y divide-[color:var(--glass-border)] border-t border-[color:var(--glass-border)] px-3">
            {recap.map((f) => {
              const value = resolveRecapValue(f, resolved, locale, yesNo);
              return (
                <div key={f.id} className="flex items-start justify-between gap-4 py-2 text-sm">
                  <span className="text-[color:var(--glass-ink-soft)]">{loc(f.label, locale) || f.id}</span>
                  <span
                    className={
                      value
                        ? "text-right font-medium text-[color:var(--glass-ink)]"
                        : "text-right italic text-[color:var(--glass-ink-soft)]"
                    }
                  >
                    {value || t("runnerEmptyDash")}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
