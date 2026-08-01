"use client";

import { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DownloadIcon,
  SendIcon,
  CheckCircle2Icon,
  Loader2Icon,
  InfoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PdfField } from "./pdf-field";
import { buildValidator, countRequirements, findFirstInvalidStep, isFieldVisible } from "@/lib/pdf-forms/validation";
import { Locale, FieldValue, FormPayload, PdfFormField, PdfFormTrigger, loc } from "@/lib/pdf-forms/types";
import type { PrefillMap } from "@/lib/pdf-forms/canonical/extract";
import { todayISO } from "@/lib/pdf-forms/system-values";
import { resolveSignerName } from "@/lib/pdf-forms/signature";
import { isAutoField, isCreationDateField, isSignatureField } from "@/lib/pdf-forms/auto-fields";
import { buildInitialValues, withSuggestedBic, sanitizeStoredPayload } from "@/lib/pdf-forms/initial-values";
import { FIELD_DERIVATIONS, applyFieldDerivations } from "@/lib/pdf-forms/field-derivations";
import { resolveOnSelectSet } from "@/lib/pdf-forms/field-side-effects";
import { findListMatchErrors } from "@/lib/pdf-forms/list-match";
import { activeTriggers } from "@/lib/pdf-forms/triggers";
import { bicFromForeignIban } from "@/lib/pdf-forms/bic-lookup";
import type { PublicForm, PublicField } from "@/lib/pdf-forms/public-serializer";
import { buildSteps, buildMacroSteps, type OptionalSection, type MacroStep } from "@/lib/pdf-forms/build-steps";
import { resolveStepIndexById } from "@/lib/pdf-forms/resume-step";
import { sectionLabel } from "@/lib/pdf-forms/section-labels";
import {
  getFormPresentation,
  stepGroupTitle,
  // stepTitleReplacesFieldLabel n'est plus consommé ici : la question s'affiche
  // toujours dans le corps (cf. hideLabelForId figé à undefined).
  stepGroupDescription,
  stepAnchorField,
  stepAnchorLabel,
} from "@/lib/pdf-forms/form-presentation";
import { FormStepper } from "./form-stepper";
import { FormShell } from "./form-shell";
import { ContextHelpPanel } from "./context-help-panel";
import { DemarcheRail, type DemarcheRailData } from "@/components/docbel/demarche-rail";
import type { TipEntry } from "@/lib/form-context-tips";
import { MotifSituationPicker } from "./motif-situation-picker";
import { CompactAccordionSection } from "./compact-accordion-section";
import { AutoSaveNotice } from "./auto-save-notice";
import { ResetFormButton } from "./reset-form-button";
import { PaymentMethodPanel } from "./payment-method-panel";
import { OptionCard } from "@/components/ui/option-card";

const LOCALE_NAMES: Record<Locale, string> = { fr: "FR", nl: "NL", de: "DE" };

// Types de champ qui occupent toute la largeur dans la grille 2 colonnes.
const FULL_WIDTH_TYPES = new Set(["textarea", "signature", "fullname", "checkbox", "radio", "array"]);

/// Ancre de la case de consentement — sert au scroll d'erreur du submit.
const CONSENT_FIELD_ID = "runner-consent";

/// Ancre de l'en-tête d'étape : cible du focus et du défilement quand on
/// change d'étape (le contenu principal change entièrement — WCAG 2.4.3).
const STEP_ANCHOR_ID = "runner-step-anchor";

/// Vrai si l'usager a demandé à réduire les animations. On lit LES DEUX
/// signaux exigés par DESIGN_RULES : la préférence système et le réglage
/// maison de la barre d'accessibilité.
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true ||
    document.documentElement.dataset.docbelMotion === "reduced"
  );
}

/// Amène un champ dans le champ visible. Centralisé pour que le respect des
/// préférences de mouvement ne dépende pas de la vigilance de chaque appelant :
/// les cinq défilements du runner étaient tous codés en dur en `smooth`.
function scrollToField(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center",
  });
}

/// Sauvegarde du brouillon : délai d'inactivité avant écriture, et délai
/// MAXIMUM au-delà duquel on écrit même si la saisie continue.
const DRAFT_DEBOUNCE_MS = 1500;
const DRAFT_MAX_WAIT_MS = 10_000;

/// Case de consentement RGPD — même bloc dans les deux rendus du runner.
///
/// En erreur (tentative d'envoi sans avoir coché) : ligne en rouge, case en
/// `aria-invalid`, ET message explicite sous la case. Le rouge seul ne suffit
/// pas — DESIGN_RULES l'interdit (« la couleur ne porte jamais seule le
/// sens ») et un toast qui disparaît laisse l'usager sans indice.
function ConsentCheckbox({
  checked,
  onChange,
  invalid,
  label,
  errorMessage,
  compact = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  invalid: boolean;
  label: string;
  errorMessage: string;
  compact?: boolean;
}) {
  const errorId = `${CONSENT_FIELD_ID}-error`;
  return (
    <div className="flex flex-col gap-1.5">
    <label
      id={CONSENT_FIELD_ID}
      className={[
        "flex items-start",
        compact ? "gap-2.5 text-sm" : "gap-3 text-base leading-relaxed",
        invalid ? "text-destructive" : "text-muted-foreground",
      ].join(" ")}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        className="mt-0.5"
      />
      <span>{label}</span>
    </label>
      {invalid && (
        <p id={errorId} role="alert" className="pl-7 text-sm font-medium text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

/// Legende de l'asterisque.
///
/// `pdf-field.tsx` marque les champs requis d'un « * » rouge, et rien nulle
/// part n'expliquait ce qu'il signifie. Un symbole non explicite laisse
/// deviner — et la couleur seule ne porte jamais le sens (DESIGN_RULES).
/// Placee AVANT les champs : une legende lue apres coup n'aide plus.
function RequiredLegend({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground">{label}</p>;
}

/// Récapitulatif PERSISTANT des champs refusés à l'envoi.
///
/// Le toast dit combien, puis disparaît — et n'en nomme que trois. Quand les
/// champs manquants sont répartis sur plusieurs étapes, l'usager n'a alors plus
/// aucun moyen de savoir ce qu'il reste à corriger : le runner l'emmène sur le
/// premier, et les suivants sont hors écran, dans des étapes déjà quittées.
///
/// Cette liste reste affichée jusqu'à la tentative suivante, et chaque entrée
/// est un bouton qui ramène à son champ — c'est ce qui la rend utile plutôt que
/// décorative. `role="alert"` la fait annoncer par les lecteurs d'écran
/// (WCAG 3.3.1 : identifier l'erreur, pas seulement la signaler).
function InvalidFieldsSummary({
  fields,
  title,
  onJump,
}: {
  fields: Array<{ id: string; label: string }>;
  title: string;
  onJump: (id: string) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3"
    >
      <p className="text-sm font-semibold text-destructive">{title}</p>
      <ul className="flex flex-col gap-1">
        {fields.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onJump(f.id)}
              className="text-left text-sm text-destructive underline underline-offset-2 hover:no-underline"
            >
              {f.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/// `withSuggestedBic` et l'état de départ du runner vivent désormais dans
/// `lib/pdf-forms/initial-values.ts` : ils sont purs, et la page dossier a
/// besoin de la MÊME fonction pour savoir quels champs hérités elle peut
/// masquer sans risquer une case blanche (cf. `dossier-inheritance.ts`).
function defaultValues(form: PublicForm, bundlePrefill?: PrefillMap): FormPayload {
  return buildInitialValues(form.fields, bundlePrefill);
}

type Step =
  | { kind: "fields"; id: string; title: string; subtitle: string; fields: PublicField[] }
  | { kind: "optional-group"; id: string; title: string; subtitle: string; sections: OptionalSection[] }
  | { kind: "summary"; id: string; title: string; subtitle: string };

interface PdfFormRunnerProps {
  form: PublicForm;
  bundlePrefill?: PrefillMap;
  bundleRunId?: string;
  /// Slug du dossier (bundle) ouvrant — présent uniquement quand le
  /// formulaire est rempli DANS un dossier. Sert à rediriger vers le
  /// parcours après une validation (delivery="save"), cf. submit().
  bundleSlug?: string;
  onValuesChange?: (values: FormPayload) => void;
  onLocaleChange?: (locale: Locale) => void;
  /// Infos importantes contextuelles servies par le serveur (DB sur défauts,
  /// cf. `getFormContextTips`). Absent = le panneau retombe sur les défauts purs.
  contextTips?: TipEntry[];
  /// Reprise fine (Lot 3) : identifiant STABLE de l'étape à rouvrir au montage
  /// (résolu serveur via `pickInitialStepId`). Absent = étape 0.
  initialStepId?: string;
  /// Réponses EN COURS restaurées (brouillon serveur du dossier). Fusionnées à
  /// la PLUS HAUTE précédence dans l'état initial — préserve TOUS les types
  /// (cases à cocher, listes) que `bundlePrefill`/`PrefillMap` ne portent pas.
  draftValues?: FormPayload;
  /// Utilisateur connecté ? Sert au message d'auto-save honnête : les réponses
  /// ne sont réellement persistées que dans un dossier (brouillon serveur) OU
  /// pour un utilisateur connecté.
  isAuthenticated?: boolean;
  /// Rail de démarche (contexte dossier uniquement) — construit côté serveur ;
  /// prend l'emplacement du ContextHelpPanel et en embarque le contenu.
  /// Absent = mode autonome, ContextHelpPanel historique inchangé.
  rail?: DemarcheRailData;
}

export function PdfFormRunner({ form, bundlePrefill, bundleRunId, bundleSlug, onValuesChange, onLocaleChange, contextTips, initialStepId, draftValues, isAuthenticated = false, rail }: PdfFormRunnerProps) {
  const t = useTranslations("public.dossier");
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>(form.defaultLocale);
  // Valeurs initiales : défauts (+ prefill profil/inter-documents), PUIS le
  // brouillon en cours restauré par-dessus (plus haute précédence — la dernière
  // frappe de l'utilisateur prime). Le merge dans le state préserve tous les
  // types (booléens, listes), contrairement à la voie `bundlePrefill` — mais
  // `draftValues` reste un payload ENREGISTRÉ, jamais revalidé depuis : il peut
  // dater d'un schéma où ce même champ avait un AUTRE type (ex. Q5 du C1A,
  // passée d'`array` à `textarea` sans changer d'id, commit `1f36623`).
  // `sanitizeStoredPayload` ignore alors la valeur au lieu de la rendre telle
  // quelle (un tableau affiché dans un textarea devient littéralement
  // "[object Object]" — `.toString()` implicite de React).
  const [values, setValues] = useState<FormPayload>(() => ({
    ...defaultValues(form, bundlePrefill),
    ...sanitizeStoredPayload(form.fields, draftValues),
  }));
  // Triggers actifs en direct (avant même soumission) sur les valeurs
  // courantes, pour prévenir l'utilisateur qu'un compagnon sera ajouté au
  // dossier — purement informatif, ne bloque rien (cf. runnerLiveTriggerNotice).
  const liveTriggers = useMemo(
    () => (form.triggers.length > 0 ? activeTriggers(form.triggers, values) : []),
    [form.triggers, values],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  // Erreur « consentement non coché » (Oraliks 2026-07-26) : le toast seul
  // n'était pas rattaché visuellement à la case — la ligne passe en rouge et
  // la case en `aria-invalid`, comme n'importe quel champ requis. Levée au
  // submit, retombe dès que la case est cochée.
  const [consentError, setConsentError] = useState(false);
  /// Champs refuses a la derniere tentative d'envoi, pour le recapitulatif
  /// persistant (le toast ne survit pas et n'en nomme que trois).
  const [invalidFields, setInvalidFields] = useState<Array<{ id: string; label: string }>>([]);
  const updateConsent = useCallback((next: boolean) => {
    setConsent(next);
    if (next) setConsentError(false);
  }, []);
  const [delivery, setDelivery] = useState<"download" | "doccle">(form.allowDownload ? "download" : "doccle");
  const [doccleRef, setDoccleRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { mode: "download" | "doccle" }>(null);
  // Écran de continuation in-line (§11.3) : après une validation DANS un dossier
  // (delivery="save"), au lieu de renvoyer sur la liste des documents on affiche
  // une carte proposant de continuer avec le prochain document requis
  // (`missing[0]`). Renseigné DANS le handler async `submit()` (jamais dans un
  // useEffect — règle ESLint anti-setState-in-effect).
  const [continuation, setContinuation] = useState<
    null | { missing: { slug: string; title: string }[]; allRequiredDone: boolean }
  >(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sauvegarde en attente : les valeurs vivent dans `valuesRef` (toujours à
  // jour), on ne mémorise ici que le contexte de la dernière frappe.
  const pendingSave = useRef<{ stepId: string | null; field: string } | null>(null);
  const lastSaveStartedAt = useRef(0);
  const valuesRef = useRef<FormPayload>(values);
  const mounted = useRef(true);
  // Champs déjà modifiés par l'utilisateur — le brouillon serveur, qui arrive
  // de façon asynchrone au montage, ne doit JAMAIS les réécrire (cf. l'effet
  // de chargement plus bas).
  const touchedFields = useRef(new Set<string>());
  // Mémorise les BIC proposés afin de les effacer seulement quand l'IBAN est
  // remplacé par un compte non couvert (le BIC redevient alors saisissable).
  const autoFilledBic = useRef(new Map<string, string>());
  // Champ actuellement focalisé (§10.4, Lot 4d) : pilote l'aide « À propos de
  // ce champ » en tête du panneau de gauche. Mis à jour PAR ÉVÉNEMENT (focus /
  // clic d'un champ) — jamais dans un useEffect (règle anti-setState-in-effect).
  const [activeFieldId, setActiveFieldId] = useState<string | undefined>(undefined);
  const handleFocusField = useCallback((id: string) => setActiveFieldId(id), []);

  // Rues `requireListMatch` VÉRIFIÉES (choisies dans la liste) — état local,
  // jamais sérialisé. Init : une rue déjà non vide au montage (brouillon
  // restauré / prefill) est considérée vérifiée, pour ne pas bloquer un
  // retour d'utilisateur sur une valeur saisie lors d'une session précédente.
  const [verifiedStreets, setVerifiedStreets] = useState<Set<string>>(() => {
    const init = new Set<string>();
    // Même base que l'état initial des valeurs ci-dessus (défauts + brouillon
    // ASSAINI) : sans le même filtre, une valeur de mauvaise forme pourrait
    // être lue ici avant de l'être là-bas et désynchroniser les deux départs.
    const v0 = { ...defaultValues(form, bundlePrefill), ...sanitizeStoredPayload(form.fields, draftValues) };
    for (const f of form.fields) {
      if (!f.requireListMatch) continue;
      const val = v0[f.id];
      if (typeof val === "string" && val.trim() !== "") init.add(f.id);
    }
    return init;
  });
  const handleStreetVerified = useCallback((fieldId: string, verified: boolean) => {
    setVerifiedStreets((prev) => {
      if (verified === prev.has(fieldId)) return prev;
      const next = new Set(prev);
      if (verified) next.add(fieldId);
      else next.delete(fieldId);
      return next;
    });
  }, []);

  // Miroir des valeurs pour les traitements HORS rendu (minuteur de sauvegarde,
  // flush au démontage) : ils ne peuvent pas lire le state par fermeture sans
  // se figer sur une version périmée.
  useEffect(() => { valuesRef.current = values; }, [values]);

  useEffect(() => { onValuesChange?.(values); }, [values, onValuesChange]);
  useEffect(() => { onLocaleChange?.(locale); }, [locale, onLocaleChange]);

  /// Reset complet (Phase 5 du plan bindings-canonical-ux) : purge le
  /// brouillon serveur (best-effort — silencieux si non connecté / réseau
  /// KO), rejoue defaultValues (systemDate/prefill remis en place), remet
  /// les erreurs à zéro, le consentement à false et retour step 0. Ne
  /// touche PAS la locale ni le mode delivery (choix produit conservés).
  async function resetForm() {
    // `bundleRunId` (si présent) route la suppression vers le brouillon serveur
    // du dossier (draftPayloads[form]) ; sinon le corps `{}` cible le
    // PdfFormDraft autonome (connecté). Best-effort, silencieux si KO.
    // `discardDraft` annule au passage la sauvegarde en attente : sans ça, un
    // minuteur déjà armé réécrivait le brouillon juste après l'avoir effacé.
    discardDraft();
    setValues(defaultValues(form, bundlePrefill));
    autoFilledBic.current.clear();
    touchedFields.current.clear();
    setErrors({});
    setConsent(false);
    setConsentError(false);
    // Sans ça, « dernier enregistrement à 14:32 » restait affiché alors que le
    // brouillon venait d'être supprimé.
    setLastSavedAt(null);
    setActive(0);
    toast.success(t("runnerResetDone"));
  }

  // Retour du flux itsme (?prefill=ok|error|unavailable).
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("prefill");
    if (!status) return;
    if (status === "ok") toast.success(t("runnerItsmeOk"));
    else if (status === "unavailable") toast.info(t("runnerItsmeUnavailable"));
    else toast.error(t("runnerItsmeError"));
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charge un éventuel brouillon (best-effort, utilisateur connecté).
  useEffect(() => {
    // Brouillon autonome (PdfFormDraft, connectés) : UNIQUEMENT hors dossier.
    // En contexte dossier, la vérité est BundleRun.draftPayloads, déjà
    // restaurée côté serveur (draftValues) — ne jamais fusionner par-dessus.
    if (bundleRunId) return;
    const ctrl = new AbortController();
    fetch(`/api/pdf/${form.slug}/draft`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.draft && typeof d.draft === "object") {
          setValues((prev) => {
            // Le brouillon ne réécrit PAS un champ que l'utilisateur vient de
            // remplir (Oraliks 2026-07-26). Sur réseau lent, la réponse arrive
            // plusieurs centaines de ms après le montage : le merge naïf
            // `{ ...prev, ...draft }` remplaçait la saisie en cours par la
            // valeur d'un brouillon vieux de plusieurs jours, sous les doigts
            // de l'usager et sans explication.
            //
            // `sanitizeStoredPayload` D'ABORD : ce brouillon peut avoir été
            // enregistré sous un schéma antérieur, où ce champ avait un AUTRE
            // type (même id, cf. commit 1f36623) — sans ce filtre, la valeur
            // de mauvaise forme se serait affichée telle quelle à l'écran.
            const cleaned = sanitizeStoredPayload(form.fields, d.draft as FormPayload);
            const restored = Object.fromEntries(
              Object.entries(cleaned).filter(
                ([id]) => !touchedFields.current.has(id),
              ),
            ) as FormPayload;
            const merged: FormPayload = { ...prev, ...restored };
            // Filet de sécurité (Oraliks 2026-07-07) : les brouillons pré-mes-
            // fixes peuvent contenir des valeurs vides sur des champs auto
            // (`system.today` / signature) exclus du rendu utilisateur — ce
            // qui bloquait le submit avec « Date de signature » sans que
            // l'utilisateur puisse corriger. On force le refill de ces champs
            // ici, avant que le state React ne se propage aux composants.
            for (const f of form.fields) {
              if (isCreationDateField(f)) {
                const cur = merged[f.id];
                if (typeof cur !== "string" || cur.trim() === "") merged[f.id] = todayISO();
              }
            }
            return withSuggestedBic(merged, form.fields);
          });
          toast.info(t("runnerDraftRestored"));
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.slug]);

  // ----- Construction des étapes -----
  // Étapes "core" (séquentielles) + un bloc "optionnel" replié (sections
  // stepPriority=optional) + l'étape résumé, dans cet ordre. Logique pure
  // extraite dans build-steps.ts (testée indépendamment).
  const dataFields = useMemo(
    () => form.fields.filter((f) => !isAutoField(f)),
    [form.fields]
  );
  // Dérivations "virtuelles" (ex. hors-EEE ← nationalité) pour le calcul de
  // VISIBILITÉ uniquement — jamais écrites dans `values` (cf. field-
  // derivations.ts). Sans ça, un `visibleIf` référençant un champ
  // `derivedFrom` encore à sa valeur par défaut ne s'affiche jamais tant que
  // l'étape n'a pas été validée une première fois (même symptôme que le piège
  // historique autoAnswered documenté dans c1-fields-improvements.ts).
  const derivedValues = useMemo(() => applyFieldDerivations(values, form.fields), [values, form.fields]);
  const { coreSteps, optionalSections } = useMemo(
    () =>
      buildSteps(dataFields, derivedValues, locale, {
        fallbackTitle: t("runnerStepInfoTitle"),
        fallbackSubtitle: t("runnerStepInfoSubtitle"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataFields, derivedValues, locale]
  );

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = [...coreSteps];
    if (optionalSections.length > 0) {
      out.push({
        kind: "optional-group",
        id: "optional-group",
        title: t("runnerOptionalGroupTitle"),
        subtitle: t("runnerOptionalGroupSubtitle"),
        sections: optionalSections,
      });
    }
    out.push({ kind: "summary", id: "summary", title: t("runnerStepSummaryTitle"), subtitle: t("runnerStepSummarySubtitle") });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreSteps, optionalSections, locale]);

  // Mode « macro-étapes » (ex. C1 → 5 étapes) : non-null si des champs portent
  // `stepGroup`. Supersède `steps` (pas de résumé, envoi sur la dernière
  // étape). Null pour les autres formulaires → rendu classique inchangé.
  // L'ordre canonique des macro-étapes est propre au formulaire : celui du PDF
  // ne correspond pas au parcours voulu (l'identité est en tête sur le papier,
  // pas à l'écran). Un formulaire non enregistré retombe sur l'ordre de
  // première apparition de ses groupes.
  const macroSteps = useMemo(
    () => buildMacroSteps(form.fields, derivedValues, getFormPresentation(form.slug).stepGroupOrder ?? []),
    [form.fields, derivedValues, form.slug]
  );

  // Nom du signataire résolu depuis les champs saisis (pour la signature
  // numérique). "" si aucun nom exploitable.
  const signerName = useMemo(() => resolveSignerName(form.fields, values), [form.fields, values]);

  // Liste ORDONNÉE des identifiants d'étape STABLES (macro OU classique) — sert
  // la reprise fine (Lot 3) : on persiste/résout un id, jamais un index (la
  // liste change via visibleIf).
  const stepIds = macroSteps ? macroSteps.map((s) => s.id) : steps.map((s) => s.id);

  // L'étape courante est mémorisée par son ID STABLE, jamais par son index
  // (2026-07-26). Avec un index, une réponse qui faisait DISPARAÎTRE une étape
  // laissait `active` sur une valeur périmée — seulement masquée par un clamp
  // d'affichage. Une réponse ultérieure qui réintroduisait l'étape faisait
  // alors BONDIR l'affichage d'un cran, sans aucune action de l'usager.
  //
  // Étape initiale : one-shot synchrone (pas d'effet → React-Compiler-safe).
  // On mémorise l'id ET la position au moment de la navigation. L'id fait foi ;
  // la position ne sert que de repli si l'étape disparaît, pour rester à la
  // MÊME HAUTEUR dans la liste plutôt que de renvoyer l'usager au début.
  const [activeStep, setActiveStep] = useState<{ id: string | undefined; index: number }>(() => {
    const index = resolveStepIndexById(stepIds, initialStepId);
    return { id: stepIds[index], index };
  });
  const stepCount = macroSteps ? macroSteps.length : steps.length;
  const foundIndex = activeStep.id ? stepIds.indexOf(activeStep.id) : -1;
  const activeIndex =
    foundIndex >= 0 ? foundIndex : Math.max(0, Math.min(activeStep.index, stepCount - 1));

  // Changement d'étape : on remonte en tête de l'étape ET on y place le focus.
  // Sans ça, après un « Continuer » en bas d'une longue étape, l'usager
  // restait EN BAS de la nouvelle — au niveau du pied de page — et croyait
  // n'avoir pas avancé ; et rien n'annonçait à un lecteur d'écran que tout le
  // contenu principal venait de changer (WCAG 2.4.3).
  //
  // Le déclencheur est un COMPTEUR DE NAVIGATION, pas `activeIndex`. Celui-ci
  // est DÉRIVÉ de la liste d'étapes (cf. `foundIndex` ci-dessus), et cette
  // liste se recalcule à chaque réponse : cocher une case qui révèle ou masque
  // une étape située AVANT l'étape courante décale l'index sans que l'usager
  // ait navigué. Adossé à `activeIndex`, l'effet prenait ce glissement pour un
  // changement d'étape et renvoyait la page en haut à chaque clic — « on
  // dirait que j'appuie sur un # » (retour Oraliks, 2026-07-30). Seuls les
  // gestes de navigation passent par `setActive`, donc par ce compteur.
  const [navigationTick, setNavigationTick] = useState(0);
  useEffect(() => {
    if (navigationTick === 0) return; // montage : ne pas voler le focus
    const anchor = document.getElementById(STEP_ANCHOR_ID);
    if (!anchor) return;
    anchor.focus({ preventScroll: true });
    anchor.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }, [navigationTick]);

  // `setActive` garde une signature par INDEX (une dizaine d'appelants) mais
  // enregistre l'id. Lit `stepIds` dans une ref pour rester stable : plusieurs
  // `useCallback` la capturent, et une identité changeante y figerait une liste
  // d'étapes périmée.
  const stepIdsRef = useRef(stepIds);
  useEffect(() => {
    stepIdsRef.current = stepIds;
  });
  const setActive = useCallback((index: number) => {
    const ids = stepIdsRef.current;
    if (ids.length === 0) return;
    const clamped = Math.max(0, Math.min(index, ids.length - 1));
    setActiveStep({ id: ids[clamped], index: clamped });
    // Geste de navigation DÉLIBÉRÉ : c'est le seul chemin qui autorise le
    // défilement vers l'en-tête (cf. `navigationTick`).
    setNavigationTick((n) => n + 1);
  }, []);

  // Id STABLE de l'étape courante — persisté avec le brouillon (autosave).
  const activeStepId = stepIds[activeIndex];

  // PLANCHER DE DÉFILEMENT — la page ne RÉTRÉCIT JAMAIS sous les pieds de
  // l'usager tant qu'il reste sur la même étape.
  //
  // Quatrième signalement du même symptôme (Oraliks : C1, C1A, C1C, puis le
  // 2026-07-31) : répondre à une question renvoie la vue en haut, « comme si
  // c'était un # ». Ce n'est ni une ancre ni un bouton non typé. Répondre
  // RACCOURCIT le document — un `visibleIf` masque un champ — et dès qu'il
  // devient plus court que `scrollTop + hauteur d'écran`, le navigateur écrête
  // la position de défilement : la vue saute.
  //
  // Deux garde-fous existaient déjà et ne suffisent pas :
  //   • `min-h-[60svh]` sur le formulaire empêche l'étape d'être MINUSCULE,
  //     pas de rétrécir : une étape de 120 svh qui retombe à 60 fait toujours
  //     sauter la page ;
  //   • il ne couvre que le formulaire, alors que la liste d'étapes et le
  //     résumé d'erreurs, qui apparaissent et disparaissent aussi, sont
  //     DEHORS.
  //
  // D'où une CALE en fin de page, dont la hauteur compense exactement ce que le
  // document vient de perdre. Elle suit la plus grande hauteur atteinte sur
  // l'étape courante et se relâche au changement d'étape — sinon une étape
  // courte hériterait de la hauteur de la précédente. Invisible : elle n'ajoute
  // de l'espace qu'en bas, jamais un trou au milieu du formulaire.
  //
  // Effet de MISE EN PAGE, et écriture directe du style : un état React
  // repeindrait après le saut, donc trop tard.
  //
  // La cale est posée en fin de `document.body`, pas dans le JSX : le runner a
  // quatre points de retour (confirmation, reprise, mode macro, mode
  // classique), et c'est le DOCUMENT qui défile, pas un conteneur du runner.
  const cale = useRef<HTMLDivElement | null>(null);
  const plancherPage = useRef(0);

  useLayoutEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.dataset.docbelScrollFloor = "";
    el.style.height = "0px";
    document.body.appendChild(el);
    cale.current = el;
    return () => {
      el.remove();
      cale.current = null;
    };
  }, []);

  // Relâche le plancher au changement d'étape. Déclaré AVANT la mesure, donc
  // exécuté avant elle dans le même commit (les effets de mise en page se
  // déclenchent dans l'ordre de déclaration).
  useLayoutEffect(() => {
    plancherPage.current = 0;
    if (cale.current) cale.current.style.height = "0px";
  }, [activeStepId]);

  // À chaque rendu, et seulement à la hausse.
  useLayoutEffect(() => {
    const el = cale.current;
    if (!el) return;
    const caleActuelle = el.offsetHeight;
    // Hauteur du document SANS la cale : c'est elle qu'il faut comparer d'un
    // rendu à l'autre, sinon la cale se mesurerait elle-même.
    const naturelle = document.documentElement.scrollHeight - caleActuelle;
    if (naturelle > plancherPage.current) plancherPage.current = naturelle;
    const manque = Math.max(0, plancherPage.current - naturelle);
    if (manque !== caleActuelle) el.style.height = `${manque}px`;
  });
  // Les réponses sont réellement persistées côté serveur si on est dans un
  // dossier (brouillon serveur, même anonyme) OU connecté (PdfFormDraft).
  // Sinon (autonome anonyme) : rien n'est enregistré → message honnête.
  const serverSaved = !!bundleRunId || isAuthenticated;

  // Map champ → index d'étape (pour sauter sur la 1ʳᵉ erreur) — macro-aware.
  const fieldStepIndex = useMemo(() => {
    const m: Record<string, number> = {};
    if (macroSteps) {
      macroSteps.forEach((ms, i) => {
        ms.sections.forEach((sec) => sec.fields.forEach((f) => (m[f.id] = i)));
        ms.advanced.forEach((f) => (m[f.id] = i));
      });
    } else {
      steps.forEach((s, i) => {
        if (s.kind === "fields") s.fields.forEach((f) => (m[f.id] = i));
        if (s.kind === "optional-group") s.sections.forEach((sec) => sec.fields.forEach((f) => (m[f.id] = i)));
      });
    }
    return m;
  }, [steps, macroSteps]);

  /// Supprime le brouillon du BON périmètre après une soumission réussie.
  ///
  /// Le `bundleRunId` est indispensable (Oraliks 2026-07-26) : sans lui, la
  /// route retombait sur le brouillon AUTONOME. Pour un citoyen anonyme en
  /// dossier elle répondait 401 et `draftPayloads` n'était jamais purgé — le
  /// brouillon périmé se restaurait par-dessus les réponses validées. Pour un
  /// connecté, elle supprimait son brouillon autonome d'un tout autre parcours.
  /// On annule aussi la sauvegarde en attente : sans ça, le minuteur en cours
  /// pouvait recréer le brouillon juste après l'avoir effacé.
  const discardDraft = useCallback(() => {
    pendingSave.current = null;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    fetch(`/api/pdf/${form.slug}/draft`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleRunId }),
    }).catch(() => {});
  }, [form.slug, bundleRunId]);

  /// Envoie MAINTENANT le brouillon en attente, s'il y en a un. Lit les valeurs
  /// dans `valuesRef` (jamais dans un updater `setValues` — un updater React
  /// doit rester pur ; l'ancien code y déclenchait le `fetch`, ce qui produisait
  /// deux PUT par sauvegarde en StrictMode).
  const flushDraft = useCallback(() => {
    const pending = pendingSave.current;
    if (!pending) return;
    pendingSave.current = null;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    lastSaveStartedAt.current = Date.now();
    fetch(`/api/pdf/${form.slug}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // `bundleRunId` route vers le brouillon serveur du dossier (anonyme
      // possible) ; `stepId`/`field` alimentent la reprise fine (Lot 3).
      body: JSON.stringify({
        payload: valuesRef.current,
        stepId: pending.stepId,
        field: pending.field,
        bundleRunId,
      }),
      // `keepalive` : la requête survit à la fermeture de l'onglet, ce qui rend
      // le flush sur `visibilitychange` réellement utile sur mobile.
      keepalive: true,
    })
      // N'affiche « enregistré » QUE si le serveur a réellement persisté
      // (corrige le faux « enregistré » sur un 401 anonyme autonome).
      .then((res) => {
        if (res.ok && mounted.current) setLastSavedAt(new Date());
      })
      .catch(() => {});
  }, [form.slug, bundleRunId]);

  // Filets de la sauvegarde auto : on n'attend jamais indéfiniment.
  //   • onglet masqué / fermé → on écrit tout de suite ;
  //   • démontage (navigation vers un autre document) → idem, et on annule le
  //     minuteur en cours pour ne pas écrire après coup.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      flushDraft();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [flushDraft]);

  useEffect(() => () => { mounted.current = false; }, []);

  const setValue = useCallback(
    (id: string, value: FieldValue) => {
      const field = form.fields.find((candidate) => candidate.id === id);
      touchedFields.current.add(id);
      const bicField = field?.canonicalKey === "banque.iban"
        ? form.fields.find((candidate) => candidate.canonicalKey === "banque.bic")
        : undefined;
      if (field?.canonicalKey === "banque.bic") autoFilledBic.current.delete(id);

      setValues((prev) => {
        const next = { ...prev, [id]: value };
        // Effet de bord déclaratif `onSelectSet` (ex. C1 : « c'est une
        // colocation » ⇒ statutFamilial=isolé + habiteEnColocation=oui). Ne
        // s'applique QUE sur saisie utilisateur (ce callback) — jamais au
        // restore de brouillon (setValues direct) — donc pas de boucle.
        const sets = field ? resolveOnSelectSet(field, value) : null;
        if (sets) for (const s of sets) next[s.fieldId] = s.value;

        if (bicField && typeof value === "string") {
          const currentBic = typeof prev[bicField.id] === "string" ? prev[bicField.id] : "";
          const previouslyAutoFilled = autoFilledBic.current.get(bicField.id);
          const suggestedBic = bicFromForeignIban(value);
          // Quand la table locale reconnaît la banque, le BIC devient la
          // valeur de référence du formulaire et le champ est verrouillé.
          if (suggestedBic) {
            next[bicField.id] = suggestedBic;
            autoFilledBic.current.set(bicField.id, suggestedBic);
          } else if (currentBic === previouslyAutoFilled) {
            next[bicField.id] = "";
            autoFilledBic.current.delete(bicField.id);
          }
        }
        return next;
      });
      setErrors((prev) => {
        if (!prev[id] && (!bicField || !prev[bicField.id])) return prev;
        return { ...prev, [id]: "", ...(bicField ? { [bicField.id]: "" } : {}) };
      });
      pendingSave.current = { stepId: activeStepId ?? null, field: id };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Plafond de report (Oraliks 2026-07-26). Le debounce était « trailing »
      // pur : chaque frappe repoussait la sauvegarde de 1,5 s, donc quelqu'un
      // qui tape lentement mais SANS PAUSE de 1,5 s — clavier virtuel, public
      // en difficulté — ne déclenchait jamais d'enregistrement. Au-delà de
      // DRAFT_MAX_WAIT_MS depuis la dernière écriture, on écrit sans attendre.
      if (Date.now() - lastSaveStartedAt.current >= DRAFT_MAX_WAIT_MS) {
        flushDraft();
        return;
      }
      saveTimer.current = setTimeout(flushDraft, DRAFT_DEBOUNCE_MS);
    },
    [form.fields, activeStepId, flushDraft]
  );

  // Bloque l'avancée vers une étape ULTÉRIEURE tant que les champs REQUIS
  // d'une des étapes SURVOLÉES (celle qu'on quitte, ET toute étape qu'on
  // saute en cliquant plus loin dans le stepper) ne sont pas valides — un
  // clic direct sur une étape 2+ crans plus loin ne validait auparavant QUE
  // l'étape courante, laissant les étapes intermédiaires (ex. Identité)
  // passer sans jamais être vérifiées (bug remonté par Oraliks, 2026-07-07).
  // Reculer (étape déjà vue) reste toujours libre : cf. les appels à
  // `setActive` directement pour "Précédent" et pour un clic en arrière sur
  // le stepper.
  const attemptAdvance = useCallback(
    (stepsFieldsList: PublicField[][], startIndex: number, nextIndex: number) => {
      // Applique les dérivations AVANT la validation d'étape : les champs
      // `derivedFrom` (date de naissance ← NISS, pays ← code postal) sont
      // calculés à la volée à l'affichage mais leur valeur n'est pas écrite
      // dans le state React. Sans cette étape, Zod voit le champ vide et
      // bloque l'avancée (Oraliks 2026-07-07 : « il me bloque sur des champs
      // auto date de naissance et pays de résidence »).
      const derivedValues = applyFieldDerivations(values, form.fields);
      const invalid = findFirstInvalidStep(stepsFieldsList as unknown as PdfFormField[][], derivedValues, locale);
      if (invalid) {
        setErrors((prev) => ({ ...prev, ...invalid.errors }));
        setActive(startIndex + invalid.index);
        const firstInvalidFieldId = stepsFieldsList[invalid.index].find((f) => invalid.errors[f.id])?.id;
        if (firstInvalidFieldId) {
          setTimeout(() => scrollToField(firstInvalidFieldId), 60);
        }
        return;
      }
      // Forçage `requireListMatch` (rue non choisie dans la liste, sans
      // échappatoire) : contrôle asynchrone-par-nature, hors Zod — on bloque
      // sur la 1ʳᵉ étape survolée qui contient une rue non vérifiée.
      const listErrors = findListMatchErrors(
        stepsFieldsList.flat() as unknown as PdfFormField[],
        derivedValues,
        verifiedStreets,
        locale
      );
      const firstListId = Object.keys(listErrors)[0];
      if (firstListId) {
        setErrors((prev) => ({ ...prev, ...listErrors }));
        const stepIdx = stepsFieldsList.findIndex((sf) => sf.some((f) => f.id === firstListId));
        if (stepIdx >= 0) setActive(startIndex + stepIdx);
        setTimeout(() => scrollToField(firstListId), 60);
        return;
      }
      setActive(nextIndex);
    },
    [values, locale, verifiedStreets, form.fields, setActive]
  );

  /// Ramene a un champ refuse : bascule sur son etape si besoin, puis defile.
  /// Meme geste que celui applique au premier champ invalide apres un envoi —
  /// sans quoi la liste ne serait qu'un constat.
  const jumpToInvalidField = useCallback(
    (id: string) => {
      const stepIdx = fieldStepIndex[id];
      if (stepIdx !== undefined) setActive(stepIdx);
      setTimeout(() => scrollToField(id), 60);
    },
    [fieldStepIndex, setActive]
  );

  async function submit() {
    // Repart d'une ardoise propre : un recapitulatif perime est pire qu'aucun.
    setInvalidFields([]);
    if (!consent) {
      setConsentError(true);
      toast.error(t("runnerConsentRequired"));
      scrollToField(CONSENT_FIELD_ID);
      return;
    }
    // Signature numérique automatique : on auto-confirme tous les champs
    // signature du formulaire si un nom de signataire est résolu depuis la
    // saisie. Le serveur produira le bloc « Signé numériquement par X » au
    // bon endroit dans le PDF.
    //
    // applyFieldDerivations : synchronise les champs `derivedFrom` (ex. date
    // de naissance ← NISS) sur leur valeur ACTUELLEMENT affichée (verrouillée
    // à l'écran), au cas où `values` garderait une saisie manuelle antérieure.
    //
    // NOTE Phase 7 (2026-07-08) : les 6 transforms client historiques
    // (`applyMotifTransferOverride`, `applyIbanCountryRouting`,
    // `applyRemarqueSituationFamiliale`, `applyTitulaireCompteNomDerivation`,
    // `applyIbanSplitDerivation`, `applyDateHeaderP2Derivation`) ont été
    // retirés — leur comportement est désormais assuré par les règles
    // déclaratives du moteur de bindings serveur (`lib/pdf-forms/bindings/`)
    // évaluées dans `/api/pdf/[slug]/generate/route.ts` avant `fillForm`.
    const signedValues: FormPayload = applyFieldDerivations({ ...values }, form.fields);
    if (signerName) {
      for (const f of form.fields) {
        if (isSignatureField(f)) signedValues[f.id] = "confirmed";
        // Filet de sécurité : les champs `system.today` (date de génération,
        // date de signature) sont normalement pré-remplis au mount via
        // defaultValues(). Mais un bundlePrefill contenant une chaîne vide
        // pour ce champ écrase le todayISO au mount et laisse la valeur "" —
        // Zod bloque alors sur un champ auto-field EXCLU du rendu, que
        // l'utilisateur ne peut donc pas corriger (bug remonté par Oraliks
        // 2026-07-07 : "Date de signature" apparaissait dans le toast alors
        // que la date est censée être générée automatiquement). On refill
        // ici en dernier recours, juste avant la validation.
        if (isCreationDateField(f)) {
          const cur = signedValues[f.id];
          if (typeof cur !== "string" || cur.trim() === "") signedValues[f.id] = todayISO();
        }
      }
    } else {
      // Pas de nom exploitable : on annule pour ne pas générer un document
      // signé "anonyme".
      toast.error(t("runnerNameRequiredToSign"));
      return;
    }
    // Validation avec la version signée (sinon les champs signature requis
    // seraient signalés comme manquants).
    // On ne valide (et on n'envoie) QUE les champs réellement visibles.
    //
    // Sans ce filtre, la validation portait aussi sur les champs masqués par
    // `visibleIf` dont la valeur restait dans `values` : un IBAN étranger mal
    // formé saisi puis masqué en changeant de mode de paiement bloquait
    // l'envoi sur un champ que l'utilisateur ne pouvait NI atteindre (il
    // n'appartient à aucune étape visible → `fieldStepIndex` undefined) NI
    // faire défiler (aucun noeud DOM) — impasse totale, et le serveur rejouait
    // la même validation. Purger les valeurs invisibles évite en prime
    // d'imprimer sur le PDF officiel une réponse à une question non posée.
    const visibleFields = form.fields.filter((f) => isFieldVisible(f.visibleIf, signedValues));
    const visibleIds = new Set(visibleFields.map((f) => f.id));
    for (const f of form.fields) {
      if (!visibleIds.has(f.id)) delete signedValues[f.id];
    }
    const validator = buildValidator(visibleFields as unknown as PdfFormField[], locale);
    const res0 = validator.safeParse(signedValues);
    if (!res0.success) {
      const next: Record<string, string> = {};
      const invalidIds: string[] = [];
      for (const issue of res0.error.issues) {
        const id = String(issue.path[0] ?? "");
        if (id && !next[id]) {
          next[id] = issue.message;
          invalidIds.push(id);
        }
      }
      setErrors(next);
      setInvalidFields(
        invalidIds.map((id) => {
          const f = form.fields.find((x) => x.id === id);
          return { id, label: f ? loc(f.label, locale) : id };
        })
      );
      // Log console explicite : quand l'utilisateur ne voit pas où corriger
      // (champ dans une étape déjà validée, ou champ orphelin sans stepGroup),
      // on lui donne au moins la liste dans la devtools.
      console.warn("[pdf-form-runner] validation failed on:", invalidIds.map((id) => {
        const f = form.fields.find((x) => x.id === id);
        return { id, label: f ? loc(f.label, locale) : id, step: fieldStepIndex[id] };
      }));
      const firstId = invalidIds[0];
      if (firstId) {
        const stepIdx = fieldStepIndex[firstId];
        if (stepIdx !== undefined) setActive(stepIdx);
        setTimeout(() => scrollToField(firstId), 60);
      }
      // Toast enrichi : liste des libellés des 3 premiers champs invalides
      // (au-delà, on garde le message générique — évite un toast géant).
      const labels = invalidIds.slice(0, 3).map((id) => {
        const f = form.fields.find((x) => x.id === id);
        return f ? loc(f.label, locale) : id;
      });
      const suffix = invalidIds.length > 3 ? ` (+${invalidIds.length - 3})` : "";
      const detail = labels.length > 0 ? ` — ${labels.join(", ")}${suffix}` : "";
      toast.error(`${t("runnerSomeFieldsInvalid")}${detail}`);
      return;
    }
    // Forçage `requireListMatch` au submit (dernier filet) : une rue tapée
    // hors liste, sans échappatoire, bloque la génération même si Zod passe.
    const listErrors = findListMatchErrors(
      form.fields as unknown as PdfFormField[],
      signedValues,
      verifiedStreets,
      locale
    );
    const firstListId = Object.keys(listErrors)[0];
    if (firstListId) {
      setErrors(listErrors);
      setInvalidFields(
        Object.keys(listErrors).map((id) => {
          const f = form.fields.find((x) => x.id === id);
          return { id, label: f ? loc(f.label, locale) : id };
        })
      );
      const stepIdx = fieldStepIndex[firstListId];
      if (stepIdx !== undefined) setActive(stepIdx);
      setTimeout(() => scrollToField(firstListId), 60);
      toast.error(listErrors[firstListId]);
      return;
    }
    setErrors({});
    // Dans un dossier (bundleRunId présent) : "Valider" — sauvegarde le
    // payload, aucun PDF généré. Le téléchargement se fait plus tard, groupé,
    // depuis l'écran "Mes documents" du parcours (cf. bundle-roadmap.tsx),
    // une fois tous les documents requis (dont ceux déclenchés) complétés.
    const effectiveDelivery: "download" | "doccle" | "save" = bundleRunId ? "save" : delivery;
    // Tester `effectiveDelivery`, PAS `delivery` : dans un dossier la livraison
    // vaut toujours "save" et le champ destinataire Doccle n'est même pas rendu.
    // Un formulaire `allowDownload: false` démarre pourtant sur delivery="doccle"
    // → l'envoi échouait sur « destinataire requis » en désignant un champ
    // invisible. Seconde impasse, du même genre que celle des champs masqués.
    if (effectiveDelivery === "doccle" && !doccleRef.trim()) {
      toast.error(t("runnerDoccleRecipientRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pdf/${form.slug}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: signedValues,
          locale,
          delivery: effectiveDelivery,
          consent: true,
          doccleRecipient: delivery === "doccle" ? { reference: doccleRef.trim() } : undefined,
          bundleRunId,
        }),
      });

      if (effectiveDelivery === "save") {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || t("runnerGenerationFailed"));
          return;
        }
        discardDraft();
        const newlyTriggered: Array<{ slug: string; title: string }> = data.newlyTriggered || [];
        if (newlyTriggered.length > 0) {
          // Un choix vient de matérialiser un document compagnon : on le
          // signale (le « prochain document » précis est ensuite porté par la
          // carte de continuation ci-dessous).
          toast.info(
            t("runnerNewlyTriggered", {
              titles: newlyTriggered.map((d) => d.title).join(", "),
            }),
          );
        }
        // Écran de continuation in-line (§11.3) : en mode dossier (bundleSlug +
        // bundleRunId présents — toujours le cas pour delivery="save"), on
        // remplace la redirection par une carte proposant le prochain document.
        // Filet défensif : sans contexte dossier (ne devrait pas arriver ici),
        // on retombe sur l'ancien comportement (toast + redirection éventuelle).
        if (bundleSlug && bundleRunId) {
          const missing: Array<{ slug: string; title: string }> = Array.isArray(data.missing)
            ? data.missing
            : [];
          const allRequiredDone = data.allRequiredDone === true;
          // Dossier complet : plus rien à remplir → on va DIRECTEMENT au
          // dossier (Oraliks 2026-07-26). L'écran « Votre dossier est complet »
          // n'hébergeait qu'un bouton « Voir mon dossier » : un clic de trop.
          // La carte de continuation ne sert donc plus qu'au cas « il reste
          // des documents ».
          if (allRequiredDone || missing.length === 0) {
            router.push(`/d/${bundleSlug}?bundleRun=${encodeURIComponent(bundleRunId)}`);
            return;
          }
          setContinuation({ missing, allRequiredDone });
        } else {
          toast.success(t("runnerSavedSuccess"));
          if (bundleSlug)
            router.push(
              bundleRunId
                ? `/d/${bundleSlug}?bundleRun=${encodeURIComponent(bundleRunId)}`
                : `/d/${bundleSlug}`,
            );
        }
        return;
      }

      // Hors dossier (bundleRunId absent) : la réponse au download/doccle
      // n'a pas de connaissance serveur du contexte dossier (pas de
      // BundleRun) — on annonce donc les triggers ACTIFS sur le payload
      // soumis, calculés côté client (`activeTriggers`, existant), à titre
      // purement informatif et non bloquant (le fichier est déjà généré).
      const standaloneTriggerNotice = () => {
        if (bundleRunId || !form.triggers || form.triggers.length === 0) return;
        const active = activeTriggers(form.triggers, signedValues);
        if (active.length === 0) return;
        const titles = active.map((tr) => tr.reason?.fr || tr.requiresFormSlug).join(", ");
        toast.info(t("runnerStandaloneTriggerNotice", { titles }));
      };

      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/pdf")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        // Nom serveur (renderFilename : slug + date, cf. Content-Disposition
        // envoyé par generate/route.ts) — repli sur l'ancien nom si l'en-tête
        // est absent ou mal formé.
        const cd = res.headers.get("content-disposition") || "";
        a.download = cd.match(/filename="([^"]+)"/)?.[1] || `${form.slug}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        discardDraft();
        setDone({ mode: "download" });
        standaloneTriggerNotice();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.delivery === "doccle") {
        discardDraft();
        setDone({ mode: "doccle" });
        standaloneTriggerNotice();
        return;
      }
      if (res.status === 409 && data.error === "dossier_incomplete") {
        const titles = (data.missing || []).map((m: { title: string }) => m.title).join(", ");
        toast.error(t("runnerDossierIncomplete", { titles }));
        return;
      }
      // Anti-doublon : ce document est identique à une demande existante — on
      // informe et on redirige vers celle-ci (« aucune différence »).
      if (res.status === 409 && data.code === "duplicate_document") {
        toast.info(t("demandeDuplicate"));
        if (typeof data.bundleSlug === "string" && typeof data.existingRunId === "string") {
          const target = `/d/${encodeURIComponent(data.bundleSlug)}?bundleRun=${encodeURIComponent(data.existingRunId)}&demarrer=1`;
          setTimeout(() => router.push(target), 900);
        }
        return;
      }
      if (res.status === 422 && Array.isArray(data.issues)) {
        const next: Record<string, string> = {};
        for (const i of data.issues) if (i.field) next[i.field] = i.message;
        setErrors(next);
        toast.error(t("runnerServerValidationFailed"));
        return;
      }
      toast.error(data.error || t("runnerGenerationFailed"));
    } catch {
      toast.error(t("runnerNetworkError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="rounded-2xl border-0 bg-card shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2Icon className="size-10 text-primary" />
          <p className="text-sm text-muted-foreground">
            {done.mode === "download"
              ? t("runnerDoneDownload")
              : t("runnerDoneDoccle")}
          </p>
          <Button variant="outline" size="sm" onClick={() => { setDone(null); setActive(0); }}>
            {t("runnerGenerateAnother")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Écran de continuation in-line (§11.3). Décision produit : PAS de bouton de
  // téléchargement ici — l'architecture verrouille le download par document
  // (garde 409) tant que le dossier n'est pas complet ; le téléchargement/mail
  // reste sur la feuille de route de fin de dossier (BundleRoadmap).
  if (continuation && continuation.missing.length > 0) {
    const next = continuation.missing[0];
    const goNext = () => {
      if (!next || !bundleRunId || !bundleSlug) return;
      // Route en mode dossier : le catch-all /document conserve bundleRun &
      // bundleSlug, et shared-values pré-remplit le formulaire suivant.
      router.push(
        `/document/${next.slug}?bundleRun=${encodeURIComponent(bundleRunId)}&bundleSlug=${encodeURIComponent(bundleSlug)}`,
      );
    };
    const goDossier = () => {
      if (!bundleSlug) return;
      router.push(
        bundleRunId
          ? `/d/${bundleSlug}?bundleRun=${encodeURIComponent(bundleRunId)}`
          : `/d/${bundleSlug}`,
      );
    };
    return (
      <Card className="rounded-2xl border-0 bg-card shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2Icon className="size-10 text-primary" />
          <h2 className="glass-display text-[20px] font-semibold text-[color:var(--glass-ink)]">
            {t("runnerContinuationReadyTitle", { title: form.title })}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("runnerContinuationSavedNote")}
          </p>
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4 text-left">
            <p className="text-sm font-medium text-[color:var(--glass-ink)]">
              {t("runnerContinuationRemainingCount", { count: continuation.missing.length })}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:var(--glass-ink)]">
              {continuation.missing.slice(0, 3).map((item) => (
                <li key={item.slug}>{item.title}</li>
              ))}
              {continuation.missing.length > 3 ? (
                <li className="text-[color:var(--glass-ink-soft)]">+{continuation.missing.length - 3}</li>
              ) : null}
            </ul>
            <p className="mt-2 text-[12px] text-[color:var(--glass-ink-soft)]">
              {t("runnerContinuationPrefillNote")}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button className="rounded-full px-6" onClick={goNext}>
              {t("runnerContinuationCta", { title: next.title })}
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={goDossier}>
              {t("runnerContinuationBack")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mode macro (C1) : rendu 5 étapes sans résumé, envoi sur la dernière.
  if (macroSteps) {
    return (
      <MacroRunnerBody
        invalidFields={invalidFields}
        jumpToInvalidField={jumpToInvalidField}
        form={form}
        macroSteps={macroSteps}
        activeIndex={activeIndex}
        setActive={setActive}
        attemptAdvance={attemptAdvance}
        locale={locale}
        setLocale={setLocale}
        values={values}
        errors={errors}
        setValue={setValue}
        signerName={signerName}
        consent={consent}
        setConsent={updateConsent}
        consentError={consentError}
        delivery={delivery}
        setDelivery={setDelivery}
        doccleRef={doccleRef}
        setDoccleRef={setDoccleRef}
        submitting={submitting}
        submit={submit}
        resetForm={resetForm}
        lastSavedAt={lastSavedAt}
        serverSaved={serverSaved}
        liveTriggers={liveTriggers}
        bundleRunId={bundleRunId}
        onStreetVerifiedChange={handleStreetVerified}
        verifiedStreets={verifiedStreets}
        onFocusField={handleFocusField}
        activeFieldId={activeFieldId}
        contextTips={contextTips}
        rail={rail}
        t={t}
      />
    );
  }

  const current = steps[activeIndex];
  const stepHasError = (s: Step) =>
    (s.kind === "fields" && s.fields.some((f) => errors[f.id])) ||
    (s.kind === "optional-group" && s.sections.some((sec) => sec.fields.some((f) => errors[f.id])));
  const stepFieldsOf = (s: Step): PublicField[] =>
    s.kind === "fields" ? s.fields : s.kind === "optional-group" ? s.sections.flatMap((sec) => sec.fields) : [];
  // Navigation via le stepper : reculer reste toujours libre, avancer est
  // gaté sur la validité de TOUTES les étapes survolées (cf. attemptAdvance).
  const handleStepSelect = (targetIndex: number) => {
    if (targetIndex <= activeIndex) { setActive(targetIndex); return; }
    attemptAdvance(steps.slice(activeIndex, targetIndex).map(stepFieldsOf), activeIndex, targetIndex);
  };

  const activeSectionKey = current.kind === "fields" ? current.id : undefined;
  // Motifs cochés (champs booléens à true) → déclencheurs du panneau d'infos.
  const checkedFieldIds = Object.keys(values).filter((k) => values[k] === true);

  return (
    <div className="flex flex-col gap-3">
      {/* Barre langue + itsme (au-dessus de la carte) */}
      {(form.locales.length > 1 || form.allowItsme) && (
        <div className="flex flex-wrap items-center gap-2">
          {form.locales.length > 1 &&
            form.locales.map((l) => (
              <Button key={l} size="sm" variant={l === locale ? "default" : "outline"} className="h-7 px-2.5" onClick={() => setLocale(l)}>
                {LOCALE_NAMES[l]}
              </Button>
            ))}
          {form.allowItsme && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => { window.location.href = `/api/pdf/${form.slug}/prefill/start`; }}
            >
              {t("runnerItsmePrefillCta")}
            </Button>
          )}
        </div>
      )}

      <FormShell
        helpFirstOnMobile={Boolean(rail)}
        helpPanel={(() => {
          const help = (
            <ContextHelpPanel
              formSlug={form.slug}
              sectionKeys={activeSectionKey ? [activeSectionKey] : []}
              checkedFieldIds={checkedFieldIds}
              entries={contextTips}
              activeFieldId={activeFieldId}
              fields={form.fields}
              locale={locale}
              embedded={Boolean(rail)}
            />
          );
          return rail ? (
            <DemarcheRail
              bundleName={rail.bundleName}
              bundleSlug={rail.bundleSlug}
              runId={rail.runId}
              model={rail.model}
              activeDocSlug={form.slug}
              helpSlot={help}
            />
          ) : (
            help
          );
        })()}
      >
        <Card className="overflow-hidden rounded-3xl border-0 bg-card shadow-sm">
          {/* Ancre du changement d'étape : cible du focus et du défilement.
              `tabIndex={-1}` la rend focalisable par programme sans l'ajouter
              à l'ordre de tabulation. En y plaçant le focus, le lecteur
              d'écran annonce l'en-tête (« Étape 3 sur 5 — Famille »), ce qui
              signale le changement de contenu sans région live redondante. */}
          <div
            id={STEP_ANCHOR_ID}
            tabIndex={-1}
            className="border-b border-[color:var(--glass-ink-line)] px-3 outline-none"
          >
            <FormStepper
              steps={steps.map((s) => {
                const meta = computeStepMeta(stepFieldsOf(s), values, locale, (c) => t("runnerStepRemaining", { count: c }), verifiedStreets);
                return { id: s.id, label: s.title, hasError: stepHasError(s), ...meta };
              })}
              activeIndex={activeIndex}
              onSelect={handleStepSelect}
            />
          </div>

          <CardContent className="p-4 sm:p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (current.kind === "summary") submit();
              }}
              className="flex flex-col gap-4"
            >
              <RequiredLegend label={t("runnerRequiredLegend")} />
              {/* En-tête d'étape */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h2
                    className="glass-display text-[18px] font-semibold leading-tight text-[color:var(--glass-ink)] sm:text-[20px]"
                    style={{ fontVariationSettings: "'WONK' 0, 'SOFT' 0", fontFeatureSettings: "'swsh' 0, 'salt' 0" }}
                  >
                    {current.title}
                  </h2>
                  {current.kind === "summary" && (
                    <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
                      {t("runnerSummaryStepHelp")}
                    </p>
                  )}
                </div>
                {current.kind === "fields" && current.fields.length > 0 && (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                    <InfoIcon className="size-3" />
                    {current.fields.every((f) => f.required) ? t("runnerAllFieldsRequired") : t("runnerStarFieldsRequired")}
                  </span>
                )}
              </div>

              {/* Contenu de l'étape */}
              {current.kind === "summary" ? (
                <ConfirmationCard hasSignature={form.fields.some(isSignatureField)} signerName={signerName} />
              ) : current.kind === "optional-group" ? (
                <CompactAccordionSection
                  sections={current.sections}
                  renderFields={(fields) => (
                    <FieldsCluster
                      fields={fields}
                      values={values}
                      errors={errors}
                      locale={locale}
                      setValue={setValue}
                      formId={form.id}
                      formSlug={form.slug}
                      onStreetVerifiedChange={handleStreetVerified}
                      onFocusField={handleFocusField}
                    />
                  )}
                />
              ) : (
                <FieldsCluster
                  fields={current.fields}
                  values={values}
                  errors={errors}
                  locale={locale}
                  setValue={setValue}
                  formId={form.id}
                  formSlug={form.slug}
                  onStreetVerifiedChange={handleStreetVerified}
                  onFocusField={handleFocusField}
                />
              )}

              {/* Pied d'étape */}
              {current.kind === "summary" ? (
                <div className="flex flex-col gap-4">
                  {!bundleRunId && form.allowDownload && form.allowDoccle && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{t("runnerDeliveryModeLabel")}</span>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" variant={delivery === "download" ? "default" : "outline"} onClick={() => setDelivery("download")}>
                          <DownloadIcon className="size-4" /> {t("runnerDeliveryDownload")}
                        </Button>
                        <Button type="button" size="sm" variant={delivery === "doccle" ? "default" : "outline"} onClick={() => setDelivery("doccle")}>
                          <SendIcon className="size-4" /> {t("runnerDeliveryDoccle")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {!bundleRunId && delivery === "doccle" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="doccle-ref">{t("runnerDoccleRecipientLabel")}</Label>
                      <Input id="doccle-ref" value={doccleRef} placeholder={t("runnerDoccleRecipientPlaceholder")} onChange={(e) => setDoccleRef(e.target.value)} />
                    </div>
                  )}
                  <Separator />
                  {form.fields.some(isSignatureField) && (
                    <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("runnerDigitalSignatureLabel")}
                      </div>
                      {signerName ? (
                        <>
                          <div className="mt-1 font-serif text-lg italic">{signerName}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {t("runnerDigitalSignatureAutoNote")}
                          </div>
                        </>
                      ) : (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          {t("runnerDigitalSignatureNameRequired")}
                        </div>
                      )}
                    </div>
                  )}
                  <InvalidFieldsSummary
                    fields={invalidFields}
                    title={t("runnerSomeFieldsInvalid")}
                    onJump={jumpToInvalidField}
                  />
                  <ConsentCheckbox
                    compact
                    checked={consent}
                    onChange={updateConsent}
                    invalid={consentError}
                    label={t("runnerConsentText")}
                    errorMessage={t("runnerConsentRequired")}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} serverSaved={serverSaved} />
                    <ResetFormButton onConfirm={resetForm} disabled={submitting} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--glass-border)] pt-4">
                    <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
                      {activeIndex > 0 && (
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => setActive(activeIndex - 1)}>
                          <ChevronLeftIcon className="size-4" /> {t("previous")}
                        </Button>
                      )}
                      <Button type="submit" disabled={submitting} className="rounded-full px-6">
                        {submitting ? <Loader2Icon className="size-4 animate-spin" /> : bundleRunId ? <CheckCircle2Icon className="size-4" /> : delivery === "doccle" ? <SendIcon className="size-4" /> : <DownloadIcon className="size-4" />}
                        {submitting
                          ? t("runnerGenerating")
                          : bundleRunId
                          ? t("runnerSubmitValidate")
                          : delivery === "doccle"
                          ? t("runnerSubmitSignAndSend")
                          : t("runnerSubmitSignAndGenerate")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 border-t border-[color:var(--glass-border)] pt-4">
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="flex items-center gap-2">
                      {activeIndex > 0 && (
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => setActive(activeIndex - 1)}>
                          <ChevronLeftIcon className="size-4" /> {t("previous")}
                        </Button>
                      )}
                      <Button type="button" className="rounded-full px-6" onClick={() => attemptAdvance([stepFieldsOf(current)], activeIndex, activeIndex + 1)}>
                        {t("continue")} <ChevronRightIcon className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} serverSaved={serverSaved} />
                    <ResetFormButton onConfirm={resetForm} disabled={submitting} />
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </FormShell>
    </div>
  );
}

/// Une LIGNE du tableau jour × créneau : la case "jour" (champ SANS `col`,
/// cf. `scheduleGrid` dans types.ts) et les cases de créneau par identifiant
/// de colonne. `dayField` est optionnel dans le TYPE mais toujours présent en
/// pratique dans ce schéma (Q4/Q18/Q22 posent tous une case "jour" par ligne) ;
/// le repli `rowKey` brut ci-dessous (ScheduleGridTable) couvre le cas où un
/// futur document omettrait cette case, sans jamais planter le rendu.
interface ScheduleGridRow {
  key: string;
  dayField?: PublicField;
  cells: Map<string, PublicField>;
}

/// Reconstruit la structure ligne × colonne à partir de champs qui portent
/// TOUS `scheduleGrid` (filtré par l'appelant, cf. `FieldsCluster`). Ordre des
/// LIGNES = ordre de PREMIÈRE apparition parmi les champs — déjà l'ordre du
/// document (cf. PDF_FORMS_RULES, "une rubrique = un bloc d'order contigu").
/// Ordre des COLONNES = idem, sur les valeurs de `col` rencontrées ; une
/// grille sans AUCUNE colonne (Q22 : sept jours sans créneau) retombe sur un
/// tableau à une seule colonne "jour" — même composant, pas de branche à part.
function buildScheduleGrid(fields: readonly PublicField[]) {
  const rows = new Map<string, ScheduleGridRow>();
  const rowOrder: string[] = [];
  const colOrder: string[] = [];
  const colSample = new Map<string, PublicField>();
  for (const f of fields) {
    const sg = f.scheduleGrid;
    if (!sg) continue;
    let row = rows.get(sg.row);
    if (!row) {
      row = { key: sg.row, cells: new Map() };
      rows.set(sg.row, row);
      rowOrder.push(sg.row);
    }
    if (sg.col === undefined) {
      row.dayField = f;
    } else {
      row.cells.set(sg.col, f);
      if (!colSample.has(sg.col)) {
        colSample.set(sg.col, f);
        colOrder.push(sg.col);
      }
    }
  }
  return { rowOrder, rows, colOrder, colSample };
}

/// Grille jour × créneau en vrai tableau (Q4/Q18 du C1A : lundi..dimanche ×
/// avant 7 h / entre 7 h et 18 h / après 18 h ; Q22 : sept jours SANS créneau
/// — même composant, `colOrder` vide, cf. `buildScheduleGrid`).
///
/// Sémantique `<table>` + `<th scope>` plutôt qu'une grille CSS + ARIA
/// manuel : la case "jour" partage le `<th scope="row">` de sa ligne avec le
/// nom du jour (association native par imbrication dans un `<label>`,
/// `Checkbox` est un élément labelable — bouton), chaque case de créneau
/// porte un `aria-label` complet ("Lundi — Avant 7 h", jamais la case nue).
/// Les en-têtes de colonne reprennent le libellé du PREMIER champ qui porte
/// ce `col` — jamais une chaîne inventée (cf. PDF_FORMS_RULES). Défile
/// horizontalement DANS son propre conteneur sur mobile (`overflow-x-auto` +
/// largeur minimale) plutôt que de tasser les libellés des jours en
/// abréviations : plus sûr pour un formulaire officiel (aucun risque de
/// confondre deux jours abrégés), au prix d'un défilement sur très petit
/// écran — choix documenté dans le rapport de ce lot.
function ScheduleGridTable({
  fields,
  values,
  setValue,
  locale,
  onFocusField,
}: {
  fields: readonly PublicField[];
  values: FormPayload;
  setValue: (id: string, value: FieldValue) => void;
  locale: Locale;
  onFocusField?: (id: string) => void;
}) {
  const { rowOrder, rows, colOrder, colSample } = useMemo(() => buildScheduleGrid(fields), [fields]);
  if (rowOrder.length === 0) return null;

  const gridCheckbox = (field: PublicField, ariaLabel: string) => (
    <Checkbox
      id={field.id}
      checked={values[field.id] === true}
      onCheckedChange={(c) => setValue(field.id, c === true)}
      onFocus={() => onFocusField?.(field.id)}
      onClick={() => onFocusField?.(field.id)}
      aria-label={ariaLabel}
    />
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-[color:var(--glass-ink-line)]">
      <table className="w-full min-w-[26rem] border-collapse text-sm">
        {colOrder.length > 0 && (
          <thead>
            <tr>
              <th scope="col" className="border-b border-[color:var(--glass-ink-line)] p-2" />
              {colOrder.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="border-b border-l border-[color:var(--glass-ink-line)] p-2 text-center text-xs font-medium text-[color:var(--glass-ink-soft)]"
                >
                  {loc(colSample.get(col)?.label, locale)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rowOrder.map((rowKey) => {
            const row = rows.get(rowKey);
            const dayField = row?.dayField;
            const dayLabel = dayField ? loc(dayField.label, locale) : rowKey;
            return (
              <tr key={rowKey} className="border-b border-[color:var(--glass-ink-line)] last:border-b-0">
                <th scope="row" className="p-2 text-left font-normal">
                  {dayField ? (
                    <label className="flex items-center gap-2.5">
                      {gridCheckbox(dayField, dayLabel)}
                      <span className="text-[color:var(--glass-ink)]">{dayLabel}</span>
                    </label>
                  ) : (
                    <span className="text-[color:var(--glass-ink)]">{dayLabel}</span>
                  )}
                </th>
                {colOrder.map((col) => {
                  const cellField = row?.cells.get(col);
                  return (
                    <td key={col} className="border-l border-[color:var(--glass-ink-line)] p-2 text-center">
                      {cellField ? gridCheckbox(cellField, `${dayLabel} — ${loc(cellField.label, locale)}`) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/// Regroupe les champs `renderAs: "chip"` en grille de OptionCard (au lieu
/// d'appeler PdfField pour ceux-là) ; le reste des champs suit le rendu
/// PdfField habituel. Single-select si le champ est "radio", multi-select
/// (indépendant) si "checkbox" — chaque champ garde sa propre valeur, ce
/// composant ne fait qu'aiguiller le rendu.
function FieldsCluster({
  fields: allFields,
  values,
  errors,
  locale,
  setValue,
  formId,
  formSlug,
  onStreetVerifiedChange,
  onFocusField,
  hideLabelForId,
}: {
  fields: PublicField[];
  values: FormPayload;
  errors: Record<string, string>;
  locale: Locale;
  setValue: (id: string, value: FieldValue) => void;
  formId: string;
  formSlug: string;
  onStreetVerifiedChange?: (fieldId: string, verified: boolean) => void;
  onFocusField?: (id: string) => void;
  /// Champ dont le libellé est DÉJÀ affiché comme titre de l'étape : on ne le
  /// répète pas à l'écran (cf. `stepTitleReplacesFieldLabel`). Absent = tous
  /// les champs portent leur libellé, comportement de tous les autres écrans.
  hideLabelForId?: string;
}) {
  // Grille jour × créneau (cf. `scheduleGrid`, types.ts) : détection PAR LA
  // DONNÉE, comme les autres familles de rendu ci-dessous — un champ qui
  // porte cette propriété (posée dans le seed, ex. les grilles horaires du
  // C1A) sort du flux normal AVANT toute autre classification, et se rend en
  // `<table>` (ScheduleGridTable) plutôt qu'en ligne PdfField. Aucun test sur
  // `formSlug` : un futur document compose le même rendu en posant la
  // propriété sur ses propres champs.
  const scheduleGridFields = allFields.filter((f) => f.scheduleGrid);
  const fields = scheduleGridFields.length > 0 ? allFields.filter((f) => !f.scheduleGrid) : allFields;

  // Trois familles de rendu : cartes de choix (chips), lignes binaires
  // compactes (oui/non + cases, empilées dans un conteneur à séparateurs),
  // et le reste en grille classique.
  const isRowField = (f: PublicField) =>
    f.renderAs !== "chip" &&
    (f.type === "checkbox" || (f.type === "radio" && (f.options || []).length === 2));

  // Échappatoires `requireListMatch` (ex. « ma rue n'est pas dans la liste ») :
  // le help du champ liste promet la case « juste en dessous ». On la rattache
  // donc INLINE sous son champ parent (dans la grille), au lieu de la reléguer
  // dans le bloc des cases oui/non où elle serait visuellement détachée de la
  // rue (Oraliks 2026-07-11 : « tu dis coche si la rue n'est pas dans la liste
  // mais y a pas de coche »).
  const escapeByParent = new Map<string, PublicField>();
  const escapeFieldIds = new Set<string>();
  for (const f of fields) {
    const escId = f.requireListMatch?.escapeFieldId;
    if (!escId) continue;
    const escField = fields.find((x) => x.id === escId);
    if (escField) {
      escapeByParent.set(f.id, escField);
      escapeFieldIds.add(escId);
    }
  }

  const chipFields = fields.filter((f) => f.renderAs === "chip");
  const rowFields = fields.filter((f) => isRowField(f) && !escapeFieldIds.has(f.id));
  const otherFields = fields.filter(
    (f) => f.renderAs !== "chip" && !isRowField(f) && !escapeFieldIds.has(f.id),
  );

  // Champs de suivi : un champ (ex. date « À partir du ») dont la visibilité
  // dépend d'une question Oui/Non (rowField) de CE cluster doit s'afficher
  // INLINE, juste sous la ligne qui l'a déclenché — pas relégué en bas dans le
  // bloc `otherFields`. On rattache donc chaque suivi à sa ligne parente et on
  // le retire du bloc autonome. (Seuls les champs déjà VISIBLES arrivent ici —
  // cf. buildMacroSteps qui filtre sur `visibleIf` — donc un suivi n'est présent
  // que quand sa condition est remplie.)
  const rowFieldIds = new Set(rowFields.map((f) => f.id));
  const followUpsByParent = new Map<string, PublicField[]>();
  for (const f of otherFields) {
    const parentId = f.visibleIf?.fieldId;
    if (parentId && rowFieldIds.has(parentId)) {
      const list = followUpsByParent.get(parentId) ?? [];
      list.push(f);
      followUpsByParent.set(parentId, list);
    }
  }
  const attachedIds = new Set(
    [...followUpsByParent.values()].flat().map((f) => f.id),
  );
  const standaloneOtherFields = otherFields.filter((f) => !attachedIds.has(f.id));
  // Champ dérivé (ex. date de naissance ← NISS) : recalculé À CHAQUE RENDU
  // depuis le champ source, jamais stocké dans `values` (cf. PdfField.derivedValue).
  const deriveValueFor = (f: PublicField): string | null =>
    f.derivedFrom ? FIELD_DERIVATIONS[f.derivedFrom.via](values[f.derivedFrom.fieldId] ?? "") : null;
  // Code postal courant du champ source — désigné par `f.streetAutocomplete`
  // (priorise les suggestions de rue) OU `f.communeFrom` (résout la commune).
  // Les deux réutilisent la même prop `relatedPostalCode` de PdfField.
  const relatedPostalCodeFor = (f: PublicField): string | undefined => {
    const postalFieldId = f.streetAutocomplete?.postalFieldId ?? f.communeFrom?.postalFieldId;
    const raw = postalFieldId ? values[postalFieldId] : undefined;
    return typeof raw === "string" ? raw : undefined;
  };

  // Erreur(s) partagée(s) des champs chip : une contrainte de GROUPE
  // ("au moins un parmi N") s'attache à un seul champ (l'ancre), mais
  // concerne visuellement TOUT le groupe — on l'affiche donc comme message
  // sous la grille plutôt que de rougir une carte en particulier. Dédupliqué
  // (plusieurs champs pourraient en théorie partager le même message).
  const chipGroupErrors = [...new Set(chipFields.map((f) => errors[f.id]).filter(Boolean))];

  return (
    <div className="flex flex-col gap-4">
      {chipFields.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {chipFields.map((f) => {
              if (f.type === "radio") {
                return (f.options || []).map((o) => (
                  <OptionCard
                    key={`${f.id}-${o.value}`}
                    label={loc(o.label, locale)}
                    selected={values[f.id] === o.value}
                    onToggle={() => setValue(f.id, o.value)}
                    invalid={f.required === true && !!errors[f.id]}
                  />
                ));
              }
              // checkbox : une seule carte, toggle indépendant. `labelShort`
              // pilote la version mobile (< 640px), cf. Phase 4 du plan
              // bindings-canonical-ux.
              return (
                <OptionCard
                  key={f.id}
                  label={loc(f.label, locale)}
                  labelShort={f.labelShort ? loc(f.labelShort, locale) : undefined}
                  selected={values[f.id] === true}
                  onToggle={() => setValue(f.id, values[f.id] !== true)}
                  invalid={f.required === true && !!errors[f.id]}
                  indicator="check"
                />
              );
            })}
          </div>
          {chipGroupErrors.map((msg) => (
            <p key={msg} role="alert" className="text-sm font-normal text-destructive">
              {msg}
            </p>
          ))}
        </div>
      )}
      {scheduleGridFields.length > 0 && (
        <ScheduleGridTable
          fields={scheduleGridFields}
          values={values}
          setValue={setValue}
          locale={locale}
          onFocusField={onFocusField}
        />
      )}
      {rowFields.length > 0 && (
        <div className="divide-y divide-[color:var(--glass-border)] rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)]">
          {rowFields.map((f) => {
            const followUps = followUpsByParent.get(f.id) ?? [];
            return (
              <div key={f.id}>
                <PdfField
                  field={f}
                  value={values[f.id] ?? ""}
                  error={errors[f.id]}
                  locale={locale}
                  onChange={(v) => setValue(f.id, v)}
                  formId={formId}
                  formSlug={formSlug}
                  rowLayout
                  derivedValue={deriveValueFor(f)}
                  onFocusField={onFocusField}
                  hideLabel={f.id === hideLabelForId}
                />
                {/* Suivi(s) déclenché(s) par ce Oui/Non : rendus juste sous la
                    ligne, en léger retrait, dans le même cadre. */}
                {followUps.length > 0 && (
                  <div className="flex flex-col gap-3 px-4 pb-3.5 pt-0.5 sm:pl-8">
                    {followUps.map((sub) => (
                      <PdfField
                        key={sub.id}
                        field={sub}
                        value={values[sub.id] ?? ""}
                        error={errors[sub.id]}
                        locale={locale}
                        onChange={(v) => setValue(sub.id, v)}
                        formId={formId}
                        formSlug={formSlug}
                        derivedValue={deriveValueFor(sub)}
                        relatedPostalCode={relatedPostalCodeFor(sub)}
                        parentValues={values}
                        onFocusField={onFocusField}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {standaloneOtherFields.length > 0 && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
          {standaloneOtherFields.map((f) => {
            const escapeField = escapeByParent.get(f.id);
            // Grille à DEUX colonnes seulement (`sm:grid-cols-2`, jamais 3) :
            // un `xl:col-span-3` ici visait une 3e colonne qui n'existe à
            // aucun palier, laissant le champ "pleine largeur" se redimen-
            // sionner sur une piste implicite au lieu de vraiment occuper
            // toute la largeur. `sm:col-span-2` suffit à couvrir les deux
            // colonnes existantes, à n'importe quelle largeur d'écran.
            const spansFullWidth = FULL_WIDTH_TYPES.has(f.type) || f.wide;
            return (
              <div key={f.id} className={spansFullWidth ? "sm:col-span-2" : ""}>
                <PdfField
                  field={f}
                  value={values[f.id] ?? ""}
                  error={errors[f.id]}
                  locale={locale}
                  onChange={(v) => setValue(f.id, v)}
                  formId={formId}
                  formSlug={formSlug}
                  derivedValue={deriveValueFor(f)}
                  relatedPostalCode={relatedPostalCodeFor(f)}
                  onSelectStreetSuggestion={(postalCode) => {
                    if (f.streetAutocomplete) setValue(f.streetAutocomplete.postalFieldId, postalCode);
                  }}
                  onStreetVerifiedChange={(v) => onStreetVerifiedChange?.(f.id, v)}
                  parentValues={values}
                  onFocusField={onFocusField}
                  hideLabel={f.id === hideLabelForId}
                />
                {/* Case échappatoire (« ma rue n'est pas dans la liste »)
                    rendue juste sous l'input auquel elle se rapporte. */}
                {escapeField && (
                  <div className="mt-2 pl-1">
                    <PdfField
                      field={escapeField}
                      value={values[escapeField.id] ?? false}
                      error={errors[escapeField.id]}
                      locale={locale}
                      onChange={(v) => setValue(escapeField.id, v)}
                      formId={formId}
                      formSlug={formSlug}
                      onFocusField={onFocusField}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/// Métadonnées de complétion d'une étape pour le stepper : `complete` (toutes
/// les exigences satisfaites) + `subLabel` (« N champs restants »). Une étape
/// sans rien d'obligatoire ne renvoie rien (ni coche, ni compteur).
///
/// Le décompte est délégué à `countRequirements`, qui applique les MÊMES
/// règles que le validateur du bouton « Continuer » (visibilité, groupes
/// « au moins un parmi N », champs auto). Le filtre maison `f.required`
/// utilisé auparavant ignorait `visibleIf` et `requiredGroup` : la coche verte
/// apparaissait sur l'étape Motif dès la date remplie, sans motif coché.
function computeStepMeta(
  fields: PublicField[],
  values: FormPayload,
  locale: Locale,
  remainingLabel: (count: number) => string,
  verifiedStreets: ReadonlySet<string>
): { complete?: boolean; subLabel?: string } {
  const { total, missing } = countRequirements(
    fields as unknown as PdfFormField[],
    values,
    locale,
  );
  // `requireListMatch` (une rue tapée hors liste, sans échappatoire) bloque
  // « Continuer » mais échappe à `countRequirements` : le champ est rempli ET
  // de format valide, il n'a rien de « manquant ». L'étape s'affichait donc
  // cochée verte, « 0 champ restant », pendant que le bouton refusait
  // d'avancer avec « Choisis ta rue dans la liste ». Il vit hors de
  // `validation.ts` (qui ne peut pas l'importer sans cycle) et dépend d'un
  // état runtime — d'où ce complément ici, au plus près du stepper.
  const listErrors = Object.keys(
    findListMatchErrors(fields as unknown as PdfFormField[], values, verifiedStreets, locale)
  ).length;

  const blocking = missing + listErrors;
  if (total + listErrors === 0) return {};
  return {
    complete: blocking === 0,
    subLabel: blocking > 0 ? remainingLabel(blocking) : undefined,
  };
}

/// Étape finale allégée : plus de liste détaillée des valeurs (ancien
/// SummaryStep, conservé plus bas pour le mode legacy). Le mode de
/// livraison/signature/consentement restent dans le pied d'étape appelant.
function ConfirmationCard({ hasSignature, signerName }: { hasSignature: boolean; signerName: string }) {
  const t = useTranslations("public.dossier");
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-5 text-sm text-[color:var(--glass-ink)]">
      <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-[color:var(--glass-accent-deep,#5B46E5)]" />
      <div className="min-w-0">
        {t("runnerConfirmationReady")}
        {hasSignature && !signerName && (
          <span className="mt-1 block text-amber-700 dark:text-amber-300">
            {t("runnerConfirmationNameForSignature")}
          </span>
        )}
      </div>
    </div>
  );
}

interface MacroRunnerBodyProps {
  /// Recapitulatif persistant des champs refuses au dernier envoi, et le
  /// geste qui y ramene. Remontes depuis le parent : c'est lui qui valide.
  invalidFields: Array<{ id: string; label: string }>;
  jumpToInvalidField: (id: string) => void;
  form: PublicForm;
  macroSteps: MacroStep[];
  activeIndex: number;
  setActive: (i: number) => void;
  attemptAdvance: (stepsFieldsList: PublicField[][], startIndex: number, nextIndex: number) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  values: FormPayload;
  errors: Record<string, string>;
  setValue: (id: string, value: FieldValue) => void;
  signerName: string;
  consent: boolean;
  setConsent: (c: boolean) => void;
  consentError: boolean;
  delivery: "download" | "doccle";
  setDelivery: (d: "download" | "doccle") => void;
  doccleRef: string;
  setDoccleRef: (v: string) => void;
  submitting: boolean;
  submit: () => void;
  resetForm: () => void | Promise<void>;
  lastSavedAt: Date | null;
  serverSaved: boolean;
  liveTriggers: PdfFormTrigger[];
  bundleRunId?: string;
  /// Rues déjà validées via la liste — sert au décompte du stepper
  /// (`requireListMatch` bloque « Continuer » sans rien rendre « manquant »).
  verifiedStreets: ReadonlySet<string>;
  onStreetVerifiedChange?: (fieldId: string, verified: boolean) => void;
  onFocusField?: (id: string) => void;
  activeFieldId?: string;
  contextTips?: TipEntry[];
  rail?: DemarcheRailData;
  t: ReturnType<typeof useTranslations>;
}

/// Rendu « macro-étapes » (C1 → 5 étapes) : pas d'étape résumé, l'action
/// d'envoi (consentement + livraison + signature + génération) vit dans le
/// pied de la DERNIÈRE étape. Réutilise FieldsCluster / FormStepper /
/// ContextHelpPanel (la progression unique vit dans FormStepper). Une
/// macro-étape à plusieurs sections
/// affiche un sous-titre par section ; le long-tail non curé (`advanced`)
/// va dans un accordéon replié.
function MacroRunnerBody({
  form, macroSteps, activeIndex, setActive, attemptAdvance, locale, setLocale, values, errors,
  setValue, signerName, consent, setConsent, consentError, delivery, setDelivery, doccleRef,
  setDoccleRef, submitting, submit, resetForm, lastSavedAt, serverSaved, liveTriggers, bundleRunId, onStreetVerifiedChange, verifiedStreets, onFocusField, activeFieldId, contextTips, rail, t,
  invalidFields, jumpToInvalidField,
}: MacroRunnerBodyProps) {
  const current = macroSteps[activeIndex];
  const isLast = activeIndex === macroSteps.length - 1;
  const multiSection = current.sections.length > 1;
  // Présentation propre au formulaire (ordre, titres, chrome) — plus aucun
  // `form.slug === "..."` dans le rendu : un second formulaire à macro-étapes
  // s'enregistre dans `form-presentation.ts` au lieu de venir modifier ce
  // composant.
  const presentation = getFormPresentation(form.slug);
  const detectedBic = useMemo(() => {
    const ibanField = form.fields.find((field) => field.canonicalKey === "banque.iban");
    const ibanValue = ibanField ? values[ibanField.id] : undefined;
    if (typeof ibanValue !== "string") {
      return null;
    }
    return bicFromForeignIban(ibanValue);
  }, [form.fields, values]);
  const stepFieldsOf = (ms: MacroStep): PublicField[] => [...ms.sections.flatMap((sec) => sec.fields), ...ms.advanced];
  // Une étape qui EST une question se titre avec cette question : son champ
  // ancre porte l'identifiant du groupe (cf. `stepAnchorField`). Le repli
  // (clé i18n, puis libellé de section) reste celui de tout autre formulaire.
  // `stepAnchorLabel` préfère `labelShort` s'il existe : les questions
  // recopiées mot pour mot du PDF sont parfois interminables une fois
  // affichées seules en titre de bandeau compact.
  const titleFor = (ms: MacroStep) => {
    const anchor = stepAnchorField(ms.id, stepFieldsOf(ms));
    return stepGroupTitle(presentation, ms.id, locale, t, stepAnchorLabel(anchor, locale));
  };
  const descFor = (id: string) => stepGroupDescription(presentation, id, t);
  // La question vit dans le CORPS, sur son propre champ (décision Oraliks
  // 2026-07-30) : on ne masque plus jamais le libellé du champ ancre. L'en-tête
  // se réduit alors à la barre de progression pour ces étapes (cf. `titleFor`
  // appliqué conditionnellement dans `stepperItems`).
  const hideLabelForId: string | undefined = undefined;
  const stepHasError = (ms: MacroStep) =>
    ms.sections.some((sec) => sec.fields.some((f) => errors[f.id])) ||
    ms.advanced.some((f) => errors[f.id]);
  // Reculer reste libre ; avancer est gaté sur la validité de TOUTES les
  // étapes survolées (cf. attemptAdvance).
  const handleStepSelect = (targetIndex: number) => {
    if (targetIndex <= activeIndex) { setActive(targetIndex); return; }
    attemptAdvance(macroSteps.slice(activeIndex, targetIndex).map(stepFieldsOf), activeIndex, targetIndex);
  };

  // Les métadonnées d'étape sont mémoïsées plutôt que recalculées DANS le
  // rendu : le `.map` en appelait une par étape à chaque frappe, et chacune
  // rejoue les contrôles de format (checksums NISS/IBAN compris) sur tous les
  // champs de son étape. Ne dépend que des valeurs et de la langue.
  const stepperItems = useMemo(
    () =>
      macroSteps.map((s) => {
        const stepFields = [...s.sections.flatMap((sec) => sec.fields), ...s.advanced];
        const meta = computeStepMeta(
          stepFields,
          values,
          locale,
          (c) => t("runnerStepRemaining", { count: c }),
          verifiedStreets,
        );
        // Une étape qui EST une question (elle a un champ ancre homonyme du
        // groupe, cf. C1A) ne met PAS son libellé dans l'en-tête : il s'affiche
        // dans le corps sur le champ lui-même, avec son aide en ⓘ. L'en-tête
        // n'y garde que le compteur et la barre. Les étapes-GROUPES (C1 :
        // « Identité »…) n'ont pas de champ ancre → elles gardent leur titre.
        const anchor = stepAnchorField(s.id, stepFields);
        return {
          id: s.id,
          label: anchor ? undefined : titleFor(s),
          description: anchor ? undefined : descFor(s.id),
          hasError: stepHasError(s),
          ...meta,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [macroSteps, values, locale, verifiedStreets, errors, t]
  );

  const cluster = (fields: PublicField[]) => (
    <FieldsCluster
      fields={fields}
      values={values}
      errors={errors}
      locale={locale}
      setValue={setValue}
      formId={form.id}
      formSlug={form.slug}
      onStreetVerifiedChange={onStreetVerifiedChange}
      onFocusField={onFocusField}
      hideLabelForId={hideLabelForId}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {(form.locales.length > 1 || form.allowItsme) && (
        <div className="flex flex-wrap items-center gap-2">
          {form.locales.length > 1 &&
            form.locales.map((l) => (
              <Button key={l} variant={l === locale ? "default" : "outline"} className="min-h-11 px-4" onClick={() => setLocale(l)}>
                {LOCALE_NAMES[l]}
              </Button>
            ))}
          {form.allowItsme && (
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => { window.location.href = `/api/pdf/${form.slug}/prefill/start`; }}>
              {t("runnerItsmePrefillCta")}
            </Button>
          )}
        </div>
      )}

      <FormShell
        helpFirstOnMobile={Boolean(rail)}
        helpPanel={(() => {
          const help = (
            <ContextHelpPanel
              formSlug={form.slug}
              sectionKeys={current.sections.map((s) => s.key).filter((k): k is string => !!k)}
              checkedFieldIds={Object.keys(values).filter((k) => values[k] === true)}
              entries={contextTips}
              activeFieldId={activeFieldId}
              fields={form.fields}
              locale={locale}
              embedded={Boolean(rail)}
            />
          );
          return rail ? (
            <DemarcheRail
              bundleName={rail.bundleName}
              bundleSlug={rail.bundleSlug}
              runId={rail.runId}
              model={rail.model}
              activeDocSlug={form.slug}
              helpSlot={help}
            />
          ) : (
            help
          );
        })()}
      >
        <Card className="overflow-hidden rounded-3xl border-0 bg-card shadow-sm">
          {/* Ancre du changement d'étape : cible du focus et du défilement.
              `tabIndex={-1}` la rend focalisable par programme sans l'ajouter
              à l'ordre de tabulation. En y plaçant le focus, le lecteur
              d'écran annonce l'en-tête (« Étape 3 sur 5 — Famille »), ce qui
              signale le changement de contenu sans région live redondante. */}
          <div
            id={STEP_ANCHOR_ID}
            tabIndex={-1}
            className="border-b border-[color:var(--glass-ink-line)] px-3 outline-none"
          >
            <FormStepper
              steps={stepperItems}
              activeIndex={activeIndex}
              onSelect={handleStepSelect}
              showNavigation={!presentation.hideStepList}
            />
          </div>

          <CardContent className="p-4 sm:p-5" data-docbel-readable>
            <form
              onSubmit={(e) => { e.preventDefault(); if (isLast) submit(); }}
              // Hauteur PLANCHER : répondre à une question masque souvent un
              // champ (`visibleIf`), ce qui raccourcit le document. Quand la
              // page devient plus courte que `scrollTop + hauteur d'écran`, le
              // navigateur écrête la position de défilement et la vue remonte
              // d'un coup — le « comme si c'était un # » signalé sur le C1, le
              // C1A puis le C1C. Avec « une question = une étape » le cas est
              // permanent : les étapes sont courtes, donc la page est à peine
              // plus haute que l'écran et le moindre repli la fait sauter.
              // Le plancher absorbe ces variations sans figer les étapes
              // longues, qui dépassent naturellement.
              className="flex min-h-[60svh] flex-col gap-3.5"
            >
              <RequiredLegend label={t("runnerRequiredLegend")} />
              {current.sections.map((sec, i) => {
                // Étape "Motif" à contrainte de groupe (ex. les 5 situations
                // du C1 changement-situation) : rendu dédié tableau + panneau
                // Détails (cf. mockup Oraliks, 2026-07-07), au lieu de la
                // grille de chips générique. Détection par la donnée — pas un
                // id de dossier en dur, ce rendu s'applique à tout formulaire
                // du même moule.
                //
                // Le marqueur est la PAIRE `requiredGroup` + `renderAs: "chip"`
                // (2026-07-31). Sur le seul `requiredGroup`, la détection
                // confisquait toute section « au moins une réponse parmi N » au
                // profit d'un rendu conçu pour les motifs du C1 : les cinq
                // annexes du C1B, qui sont une liste de cases à cocher, seraient
                // devenues un tableau de situations. `requiredGroup` redevient
                // ce que son nom dit — une contrainte de VALIDATION — et le
                // choix du rendu se lit dans `renderAs`, dont c'est le rôle.
                // Les cinq champs du C1 portent bien les deux marqueurs (cf.
                // `c1-fields-improvements.test.ts`) : rendu inchangé pour lui.
                if (sec.fields.some((f) => f.requiredGroup && f.renderAs === "chip")) {
                  return (
                    <MotifSituationPicker
                      key={sec.key ?? `sec-${i}`}
                      fields={sec.fields}
                      values={values}
                      errors={errors}
                      locale={locale}
                      setValue={setValue}
                      formId={form.id}
                      formSlug={form.slug}
                    />
                  );
                }
                // Détection PAR LA DONNÉE, comme le picker de motifs juste
                // au-dessus : toute section « mode de paiement » mérite ce
                // rendu, quel que soit le formulaire qui la porte.
                if (sec.key === "mode-paiement") {
                  return (
                    <PaymentMethodPanel
                      key={sec.key}
                      title={sectionLabel(sec.key, locale)}
                      fields={sec.fields}
                      renderField={(field) => (
                        <PdfField
                          field={field}
                          // La valeur affichée vient TOUJOURS du state — jamais
                          // de `detectedBic`, sinon l'écran peut montrer un BIC
                          // pendant que le PDF en reçoit un autre. `setValue` et
                          // `withSuggestedBic` maintiennent le state aligné sur
                          // l'IBAN ; `detectedBic` ne sert plus qu'au verrou.
                          value={values[field.id] ?? ""}
                          autoLocked={field.canonicalKey === "banque.bic" && !!detectedBic}
                          error={errors[field.id]}
                          locale={locale}
                          onChange={(value) => setValue(field.id, value)}
                          formId={form.id}
                          formSlug={form.slug}
                          rowLayout
                          segmentedVariant="pills"
                          onFocusField={onFocusField}
                        />
                      )}
                    />
                  );
                }
                return (
                  <div
                    key={sec.key ?? `sec-${i}`}
                    className={
                      multiSection
                        ? "flex flex-col gap-3 rounded-2xl border border-[color:var(--glass-ink-line)] bg-[color:var(--glass-surface)] p-3.5 sm:p-4"
                        : "flex flex-col gap-3"
                    }
                  >
                    {multiSection && sec.key && (
                      // Gras FONCÉ (`--glass-ink`, pas `--glass-ink-soft`) : un
                      // titre de carte est un repère de structure, pas une
                      // note secondaire — l'atténuer le confondait avec le
                      // reste des libellés de champs.
                      <h3 className="text-base font-bold text-[color:var(--glass-ink)]">
                        {sectionLabel(sec.key, locale)}
                      </h3>
                    )}
                    {cluster(sec.fields)}
                  </div>
                );
              })}

              {current.advanced.length > 0 && (
                <CompactAccordionSection
                  sections={[{ key: "advanced", title: t("runnerAdvancedSectionTitle"), fields: current.advanced, defaultOpen: false }]}
                  renderFields={cluster}
                />
              )}

              {isLast ? (
                <>
                  <div className="flex flex-col gap-4 border-t border-[color:var(--glass-ink-line)] pt-4">
                  {!bundleRunId && form.allowDownload && form.allowDoccle && (
                    <div className="flex flex-col gap-2">
                      <span className="text-base font-bold text-muted-foreground">{t("runnerDeliveryModeLabel")}</span>
                      <div className="flex gap-1.5">
                        <Button className="min-h-11" type="button" variant={delivery === "download" ? "default" : "outline"} onClick={() => setDelivery("download")}>
                          <DownloadIcon className="size-4" /> {t("runnerDeliveryDownload")}
                        </Button>
                        <Button className="min-h-11" type="button" variant={delivery === "doccle" ? "default" : "outline"} onClick={() => setDelivery("doccle")}>
                          <SendIcon className="size-4" /> {t("runnerDeliveryDoccle")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {!bundleRunId && delivery === "doccle" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="doccle-ref-macro">{t("runnerDoccleRecipientLabel")}</Label>
                      <Input id="doccle-ref-macro" value={doccleRef} placeholder={t("runnerDoccleRecipientPlaceholder")} onChange={(e) => setDoccleRef(e.target.value)} />
                    </div>
                  )}
                  {form.fields.some(isSignatureField) && (
                    <div className="rounded-2xl border border-dashed bg-muted/30 p-4 text-base">
                      <div className="font-bold text-muted-foreground">{t("runnerDigitalSignatureLabel")}</div>
                      {signerName ? (
                        <>
                          <div className="mt-1 font-serif text-lg italic">{signerName}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{t("runnerDigitalSignatureAutoNote")}</div>
                        </>
                      ) : (
                        <div className="mt-1 text-sm text-amber-700 dark:text-amber-300">{t("runnerDigitalSignatureNameRequired")}</div>
                      )}
                    </div>
                  )}
                  <InvalidFieldsSummary
                    fields={invalidFields}
                    title={t("runnerSomeFieldsInvalid")}
                    onJump={jumpToInvalidField}
                  />
                  <ConsentCheckbox
                    checked={consent}
                    onChange={setConsent}
                    invalid={consentError}
                    label={t("runnerConsentText")}
                    errorMessage={t("runnerConsentRequired")}
                  />
                  {liveTriggers.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                      {t("runnerLiveTriggerNotice", {
                        titles: liveTriggers.map((tr) => tr.reason?.fr || tr.requiresFormSlug).join(", "),
                      })}
                    </p>
                  )}
                  {/* Pied de rangée : mention d'auto-save à gauche, paire de
                      boutons à droite, "Recommencer" juste SOUS cette paire —
                      discret, aligné à droite. Jamais sur la même ligne que la
                      mention, qui l'éloignerait du geste auquel il se rapporte. */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} serverSaved={serverSaved} />
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        {/* Garde `activeIndex > 0` (2026-07-26) : sur un
                            formulaire à UNE SEULE macro-étape, la dernière étape
                            est aussi la première — sans elle, « Précédent »
                            appelait setActive(-1) et le rendu plantait sur
                            `macroSteps[-1]`. Pas atteignable sur le C1 (5 étapes),
                            mais c'est le piège du prochain formulaire. */}
                        {activeIndex > 0 && (
                          <Button type="button" variant="outline" className="min-h-12 rounded-full" onClick={() => setActive(activeIndex - 1)}>
                            <ChevronLeftIcon className="size-4" /> {t("previous")}
                          </Button>
                        )}
                        <Button type="submit" disabled={submitting} className="min-h-12 rounded-full px-6">
                          {submitting ? <Loader2Icon className="size-4 animate-spin" /> : bundleRunId ? <CheckCircle2Icon className="size-4" /> : delivery === "doccle" ? <SendIcon className="size-4" /> : <DownloadIcon className="size-4" />}
                          {submitting ? t("runnerGenerating") : bundleRunId ? t("runnerSubmitValidate") : delivery === "doccle" ? t("runnerSubmitSignAndSend") : t("runnerSubmitSignAndGenerate")}
                        </Button>
                      </div>
                      <ResetFormButton onConfirm={resetForm} disabled={submitting} />
                    </div>
                  </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-3 border-t border-[color:var(--glass-ink-line)] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <AutoSaveNotice lastSavedAt={lastSavedAt} isPartOfBundle={!!bundleRunId} serverSaved={serverSaved} />
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        {activeIndex > 0 && (
                          <Button type="button" variant="outline" className="min-h-12 rounded-full" onClick={() => setActive(activeIndex - 1)}>
                            <ChevronLeftIcon className="size-4" /> {t("previous")}
                          </Button>
                        )}
                        <Button type="button" className="min-h-12 rounded-full px-6" onClick={() => attemptAdvance([stepFieldsOf(current)], activeIndex, activeIndex + 1)}>
                          {t("continue")} <ChevronRightIcon className="size-4" />
                        </Button>
                      </div>
                      <ResetFormButton onConfirm={resetForm} disabled={submitting} />
                    </div>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </FormShell>
    </div>
  );
}
