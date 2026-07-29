"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ProgressFeedback } from "@/components/docbel/progress-feedback";
import { cn } from "@/lib/utils";

export interface FormStepperItem {
  id: string;
  label: string;
  hasError: boolean;
  complete?: boolean;
  subLabel?: string;
  description?: string;
}

interface FormStepperProps {
  steps: FormStepperItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  showNavigation?: boolean;
}

/// Mouvement réduit : la préférence système NE SUFFIT PAS ici, le projet
/// expose aussi un réglage maison `data-docbel-motion="reduced"` (cf.
/// DESIGN_RULES). Les deux doivent couper le défilement animé.
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return (
    document.documentElement.dataset.docbelMotion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Progression lisible : l'étape active est prioritaire, la navigation complète reste secondaire. */
export function FormStepper({ steps, activeIndex, onSelect, showNavigation = true }: FormStepperProps) {
  const t = useTranslations("public.dossier");
  const total = steps.length;
  const activeStep = steps[activeIndex];
  const pct = total > 0 ? ((activeIndex + 1) / total) * 100 : 0;

  const navRef = useRef<HTMLOListElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);

  // Sous 640 px la liste d'étapes devient une rangée qui DÉFILE : après un
  // « Continuer », l'étape courante peut se retrouver hors du champ visible et
  // l'usager croit n'avoir pas avancé. On recentre donc la pastille active.
  // `scrollBy` sur le conteneur (et non `scrollIntoView`) parce que ce dernier
  // ferait aussi remonter/descendre la PAGE, ce qui déplacerait le formulaire
  // sous le doigt. Le calcul passe par les rects : le `<li>` n'a pas l'`<ol>`
  // pour `offsetParent` (aucun `position` posé), donc `offsetLeft` mentirait.
  useEffect(() => {
    const list = navRef.current;
    const item = activeItemRef.current;
    // La grille desktop ne défile pas : scrollWidth === clientWidth → no-op.
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    const listBox = list.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    const delta = itemBox.left - listBox.left - (listBox.width - itemBox.width) / 2;
    list.scrollBy({ left: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [activeIndex, steps.length]);

  // Le C1 simplifié masque la navigation complète : son en-tête peut donc
  // tenir sur une seule ligne desktop, comme sur la maquette, sans conserver
  // l'espace vertical prévu pour le stepper détaillé. Sur mobile, la consigne
  // et la progression repassent naturellement sur toute la largeur.
  if (!showNavigation) {
    // Ligne unique compacte (C1/C1A) : puce + titre + coche + barre, la barre
    // absorbant tout l'espace restant. Le titre peut être une question entière
    // (granularité « une étape par question », cf. PDF_FORMS_RULES) : il porte
    // donc son propre `flex-1`/`min-w-0` sous 640 px pour ne JAMAIS être éjecté
    // sur sa propre rangée par l'algorithme de wrap (base flex nulle → tient
    // toujours sur la 1ʳᵉ ligne avec la puce et l'icône), puis redevient
    // `flex-initial` à partir de `sm:` pour ne pas voler la place que la barre
    // doit « prendre en restante ». La barre, elle, est `w-full` sous 640 px :
    // seul un item à 100 % est garanti de démarrer sa propre rangée, ce qui
    // donne les deux rangées attendues à 375 px sans jamais déborder.
    // Le séparateur fin sous la ligne existe déjà : `border-b` posé par le
    // parent (pdf-form-runner.tsx) directement sous ce composant.
    return (
      <div className="flex flex-col gap-2 py-3" data-docbel-readable>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-nowrap sm:gap-x-5">
          <span className="shrink-0 rounded-full bg-[color:var(--glass-pop-bg)] px-4 py-2 text-sm font-bold text-[color:var(--glass-accent-deep)]">
            {t("runnerStepCounter", { current: activeIndex + 1, total })}
          </span>
          <h2 className="min-w-0 flex-1 truncate text-xl font-bold leading-tight text-[color:var(--glass-ink)] sm:flex-initial">
            {activeStep?.label}
          </h2>
          {activeStep?.hasError ? (
            <AlertCircle className="shrink-0 text-destructive" aria-label={t("runnerStepErrorsAria")} />
          ) : activeStep?.complete ? (
            <CheckCircle2 className="shrink-0 text-[color:var(--success)]" aria-hidden />
          ) : null}
          <ProgressFeedback
            label={t("runnerStepCounter", { current: activeIndex + 1, total })}
            value={pct}
            compact
            labelMode="sr-only"
            className="w-full min-w-24 sm:w-auto sm:flex-1"
          />
        </div>
        {(activeStep?.description || activeStep?.subLabel) && (
          // `line-clamp-2` : la description peut venir de l'aide d'un champ
          // (cf. MacroRunnerBody, question seule sur son étape) — un texte
          // recopié du PDF officiel peut être long, et le bandeau compact n'a
          // pas la hauteur d'une étape détaillée.
          <p className="line-clamp-2 text-base leading-relaxed text-[color:var(--glass-ink-soft)]">
            {activeStep.description ?? activeStep.subLabel}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-3" data-docbel-readable>
      <div className="flex flex-col gap-2">
        <span className="text-base font-bold text-[color:var(--glass-accent-deep)]">
          {t("runnerStepCounter", { current: activeIndex + 1, total })}
        </span>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold leading-tight text-[color:var(--glass-ink)]">
              {activeStep?.label}
            </h2>
            {(activeStep?.subLabel || activeStep?.description) && (
              <p className="text-base leading-relaxed text-[color:var(--glass-ink-soft)]">
                {activeStep.subLabel ?? activeStep.description}
              </p>
            )}
          </div>
          {activeStep?.hasError ? (
            <AlertCircle className="shrink-0 text-destructive" aria-label={t("runnerStepErrorsAria")} />
          ) : activeStep?.complete ? (
            <CheckCircle2 className="shrink-0 text-[color:var(--success)]" aria-hidden />
          ) : null}
        </div>
        <ProgressFeedback
          label={t("runnerStepCounter", { current: activeIndex + 1, total })}
          value={pct}
          labelMode="sr-only"
        />
      </div>

      {showNavigation && (
        // UNE seule liste pour les deux tailles d'écran : sous 640 px la grille
        // ne tenait pas en largeur et était donc `hidden`, ce qui privait TOUS
        // les mobiles de navigation entre étapes. Elle devient ici une rangée
        // de pastilles qui défile horizontalement ; à partir de `sm` la grille
        // d'origine reprend. Une liste unique = un seul `aria-current` exposé,
        // et le même `onSelect` (qui gère déjà le blocage de l'avance).
        // `p-1` réserve la place de l'anneau de focus, sinon `overflow-x-auto`
        // le rognerait ; `sm:p-0` rend son espacement d'origine au desktop.
        <ol
          ref={navRef}
          className="flex gap-2 overflow-x-auto p-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:p-0 lg:grid-cols-4"
          data-a11y-secondary="true"
        >
          {steps.map((step, index) => {
            const isActive = index === activeIndex;
            // L'état ne repose JAMAIS sur la seule couleur (DESIGN_RULES) :
            // une icône porte la forme pour l'œil, et ce libellé rejoint le nom
            // accessible du bouton pour le lecteur d'écran. On n'annonce que ce
            // qu'on sait vraiment : une étape sans exigence n'a ni `complete`
            // ni erreur, la dire « à venir » serait faux une fois dépassée.
            const status = step.hasError
              ? t("runnerStepErrorsAria")
              : step.complete
                ? t("railStepStateDone")
                : undefined;
            return (
              <li key={step.id} ref={isActive ? activeItemRef : undefined} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={status ? `${index + 1}. ${step.label} — ${status}` : `${index + 1}. ${step.label}`}
                  className={cn(
                    // min-h-11 = 44 px : cible tactile minimale sur mobile.
                    "flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:min-h-12 sm:w-full sm:gap-3 sm:text-base",
                    isActive
                      ? "border-[color:var(--glass-accent-deep)] bg-[color:var(--glass-pop-bg)] font-bold text-[color:var(--glass-ink)]"
                      : "border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] text-[color:var(--glass-ink-soft)] hover:border-[color:var(--glass-accent-deep)]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "relative flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:size-8",
                      isActive
                        ? "bg-[color:var(--glass-accent-deep)] text-white"
                        : "bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-ink-soft)]",
                    )}
                  >
                    {index + 1}
                  </span>
                  {/* Le libellé reste visible sur mobile (un simple numéro ne
                      dit pas ce que contient l'étape) mais borné à 10 rem pour
                      que plusieurs pastilles tiennent dans le champ visible. */}
                  <span className="min-w-0 max-w-40 truncate sm:max-w-none sm:flex-1">{step.label}</span>
                  {step.hasError ? (
                    // Pastille ronde rouge remplacée par une icône : un point de
                    // couleur ne signifiait rien sans la percevoir.
                    <AlertCircle className="size-4 shrink-0 text-destructive sm:size-5" aria-hidden />
                  ) : step.complete ? (
                    <CheckCircle2 className="size-4 shrink-0 text-[color:var(--success)] sm:size-5" aria-hidden />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
