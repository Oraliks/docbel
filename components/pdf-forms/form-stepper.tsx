"use client";

import { useTranslations } from "next-intl";

export interface FormStepperItem {
  id: string;
  label: string;
  hasError: boolean;
  /// Vrai quand tous les champs REQUIS de l'étape sont remplis et valides
  /// (indépendant de la position) → coche verte de complétion.
  complete?: boolean;
  /// Libellé secondaire affiché sous le titre de l'étape ACTIVE (ex. « 2
  /// champs restants »). Absent = rien.
  subLabel?: string;
  /// Description courte et STATIQUE de l'étape (ex. « Précise l'objet de ta
  /// demande »), affichée sous le titre pour TOUTES les étapes (pas
  /// seulement l'active), contrairement à `subLabel`. Absent = pas de
  /// description (ex. formulaires sans macro-étapes curées).
  description?: string;
}

interface FormStepperProps {
  steps: FormStepperItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/// Progression UNIQUE du formulaire : un compteur « Étape N sur T » + une
/// barre de remplissage fine, suivis d'une liste numérotée des étapes
/// (navigation au clic). Remplace les indicateurs de progression multiples
/// qui coexistaient (ancienne pastille dégradée + badge + pied d'étape) par
/// cette seule source de vérité — la navigation reste identique.
export function FormStepper({ steps, activeIndex, onSelect }: FormStepperProps) {
  const t = useTranslations("public.dossier");
  const total = steps.length;
  const pct = total > 0 ? ((activeIndex + 1) / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 px-2 py-3">
      {/* Progression unique : compteur « Étape N sur T » + barre fine */}
      <div className="flex items-center gap-3">
        <span className="whitespace-nowrap text-[13px] font-semibold text-[color:var(--glass-ink-soft)]">
          {t("runnerStepCounter", { current: activeIndex + 1, total })}
        </span>
        <span
          className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--glass-pop-bg)]"
          aria-hidden
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--glass-accent-deep,#5B46E5)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </span>
      </div>

      {/* Liste des étapes — sur mobile, juste le numéro (évite le scroll
          horizontal) ; le libellé + la description reviennent à partir de
          sm: (cf. Oraliks, 2026-07-07). */}
      <ol className="flex flex-wrap gap-x-3 gap-y-3 sm:gap-x-6">
        {steps.map((step, i) => {
          const isActive = i === activeIndex;
          return (
            <li key={step.id} className="sm:min-w-[110px] sm:flex-1">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${String(i + 1).padStart(2, "0")}. ${step.label}`}
                className="flex w-full items-center gap-0.5 rounded-lg text-left transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:flex-col sm:items-start"
              >
                <span
                  aria-hidden
                  className={`relative flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors sm:hidden ${
                    isActive
                      ? "bg-gradient-to-r from-[color:var(--glass-accent-deep,#5B46E5)] to-pink-500 text-white"
                      : "bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-ink-soft)]"
                  }`}
                >
                  {i + 1}
                  {step.hasError && (
                    <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-destructive" />
                  )}
                </span>
                <span
                  className={`hidden truncate text-[13px] sm:block ${
                    isActive
                      ? "border-b-2 border-[color:var(--glass-accent-deep,#5B46E5)] pb-0.5 font-bold text-[color:var(--glass-ink)]"
                      : "font-semibold text-[color:var(--glass-ink-soft)]"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}. {step.label}
                  {step.hasError && (
                    <span
                      className="ml-1.5 inline-block size-1.5 rounded-full bg-destructive align-middle"
                      aria-label="Erreurs dans cette étape"
                    />
                  )}
                </span>
                {step.description && (
                  <span className="hidden truncate text-[11px] text-[color:var(--glass-ink-faint)] sm:block">
                    {step.description}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
