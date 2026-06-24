"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, TrendingUpIcon } from "lucide-react";
import { Sparkle } from "@phosphor-icons/react";
import {
  ANCIENNETE_OPTIONS,
  BAREME_2026,
  CATEGORIE_LABELS,
  CATEGORIE_LABEL_KEYS,
  estimerAllocation,
  type AncienneteValue,
  type CategorieFamiliale,
  type SimulationInput,
  type SimulationResult,
} from "@/lib/simulateur-chomage";

/**
 * Simulateur « Mon estimation » du hero — version FONCTIONNELLE de l'ancienne
 * StatusCard mock. Même gabarit visuel (carte SOMBRE violette incrustée sur la
 * nappe du bloc hero : ring blanc 15 %, dégradé color-mix profond, ombre
 * portée marquée, badge clair, pilule sombre), mais le montant vient du moteur
 * pur `lib/simulateur-chomage` (lui-même adossé à lib/calculators/chomage —
 * mêmes chiffres que le calculateur complet de /outils).
 *
 * Deux états : formulaire (catégorie / brut / ancienneté) ⇄ résultat
 * (count-up €/jour). L'estimation N'EST PAS persistée : elle vit uniquement le
 * temps de la session (état React). Un rechargement de page repart donc du
 * formulaire vide — comportement voulu pour ne pas réafficher un ancien calcul.
 * Toutes les animations sont neutralisées par prefers-reduced-motion
 * (motion-reduce:* + matchMedia pour le count-up).
 */

const FMT_JOUR = new Intl.NumberFormat("fr-BE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const FMT_MOIS = new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 0 });

/* Styles partagés — champs lisibles sur la carte sombre. Le `background` est
   en inline-style : la règle globale `.glass-root input/select` (fond verre
   clair) a une spécificité supérieure aux utilitaires Tailwind. */
const LABEL_CLS =
  "text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/75";
const FIELD_CLS =
  "w-full rounded-[12px] border-0 px-3.5 py-2.5 text-[13.5px] font-semibold text-white outline-none ring-1 ring-white/20 transition placeholder:text-white/40 focus:ring-2 focus:ring-[color:var(--glass-accent-c)] motion-reduce:transition-none";
const FIELD_STYLE = {
  background: "rgba(255,255,255,0.12)",
  colorScheme: "dark",
} as const;
/* Fond du menu déroulant natif. La carte est sombre et le trigger reçoit déjà
   un fond verre clair via la règle globale `.glass-root select` — mais le popup
   d'options est dessiné par l'OS : les <option> ont un fond transparent qui
   retombe sur du blanc, d'où le texte blanc illisible (blanc sur blanc) vu en
   maquette. On force un fond sombre opaque + texte clair sur chaque <option>
   (Chrome/Firefox Windows/Linux) ; sur macOS le menu natif suit le
   `color-scheme: dark` du select. */
const OPTION_STYLE = { background: "#1b1142", color: "#ffffff" } as const;
const PILL_CLS =
  "inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-[rgba(13,7,34,0.5)] px-5 py-3.5 text-[13.5px] font-bold text-white transition hover:bg-[rgba(13,7,34,0.72)] motion-reduce:transition-none";

export function SimulatorCard() {
  const t = useTranslations("public.home");
  const tc = useTranslations("public.dossierContent");
  const resolve = (key: string | undefined, fallback: string): string => {
    if (!key) return fallback;
    try {
      const v = tc(key as Parameters<typeof tc>[0]);
      return v && v !== key ? v : fallback;
    } catch {
      return fallback;
    }
  };
  const uid = useId();
  const catId = `${uid}-categorie`;
  const brutId = `${uid}-brut`;
  const ancId = `${uid}-anciennete`;
  const errId = `${uid}-erreur`;

  // Champs du formulaire (préremplis à la restauration / au « Recalculer »).
  const [categorie, setCategorie] = useState<CategorieFamiliale>("isole");
  const [brutStr, setBrutStr] = useState("");
  const [anciennete, setAnciennete] = useState<AncienneteValue>("0-3");

  // Dernier résultat affiché + libellé « Mise à jour » figé au moment du
  // calcul / de la restauration (jamais Date.now() au render — règle
  // react-hooks/purity ; un libellé statique suffit ici).
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Count-up du montant journalier : rAF + easing, ou valeur directe si
  // l'utilisateur préfère moins d'animations.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!result) return;
    const target = result.parJour;
    let raf = 0;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      raf = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(raf);
    }
    const DUREE_MS = 750;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DUREE_MS);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setShown(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const brut = Number.parseFloat(brutStr.replace(",", "."));
    if (!Number.isFinite(brut) || brut <= BAREME_2026.brutMensuelMinimum) {
      setFormError(
        t("simErrInvalidBrut", { min: BAREME_2026.brutMensuelMinimum }),
      );
      return;
    }
    const option =
      ANCIENNETE_OPTIONS.find((o) => o.value === anciennete) ??
      ANCIENNETE_OPTIONS[0];
    const input: SimulationInput = {
      categorie,
      brutMensuel: brut,
      moisDeChomage: option.moisRepresentatif,
    };
    let res: SimulationResult;
    try {
      res = estimerAllocation(input);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("simErrGeneric"),
      );
      return;
    }
    setFormError(null);
    setResult(res);
    setEditing(false);
  }

  return (
    <aside
      className="relative z-10 flex flex-col gap-4 overflow-hidden rounded-[20px] p-5 text-white ring-1 ring-white/15 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(168deg, color-mix(in oklab, var(--glass-status-from) 70%, #181040) 0%, color-mix(in oklab, var(--glass-status-to) 82%, #0F0A2C) 100%)",
        boxShadow:
          "0 24px 48px -14px rgba(34,18,84,0.55), 0 6px 18px rgba(34,18,84,0.25)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/75">
          {t("simEstimateLabel")}
        </span>
        {/* Badge clair : taux appliqué quand on a un résultat, étincelle sinon. */}
        <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[color:var(--glass-accent-deep)]">
          {result && !editing ? (
            <>
              <TrendingUpIcon className="size-3" strokeWidth={2.4} />
              {result.tauxPct} %
            </>
          ) : (
            <Sparkle weight="fill" className="size-3.5" aria-hidden />
          )}
        </span>
      </div>

      {/* `!result || editing` (plutôt qu'un booléen dérivé) : TypeScript
          narrowe ainsi `result` en non-null dans la branche résultat. */}
      {!result || editing ? (
        /* ── État formulaire ── */
        <form
          key="form"
          onSubmit={handleSubmit}
          noValidate
          aria-label={t("simFormLabel")}
          className="flex flex-1 animate-[fadeInUp_0.45s_ease] flex-col gap-3 motion-reduce:animate-none"
        >
          <h2 className="glass-display text-[19px] font-semibold leading-snug">
            {t("simFormTitle")}
          </h2>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={catId} className={LABEL_CLS}>
              {t("simFieldSituation")}
            </label>
            <select
              id={catId}
              value={categorie}
              onChange={(e) =>
                setCategorie(e.target.value as CategorieFamiliale)
              }
              className={FIELD_CLS}
              style={FIELD_STYLE}
            >
              {Object.entries(CATEGORIE_LABELS).map(([value, label]) => (
                <option key={value} value={value} style={OPTION_STYLE}>
                  {resolve(CATEGORIE_LABEL_KEYS[value as CategorieFamiliale], label)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={brutId} className={LABEL_CLS}>
              {t("simFieldBrut")}
            </label>
            <input
              id={brutId}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder={t("simBrutPlaceholder")}
              value={brutStr}
              onChange={(e) => setBrutStr(e.target.value)}
              aria-invalid={formError ? true : undefined}
              aria-describedby={formError ? errId : undefined}
              className={FIELD_CLS}
              style={FIELD_STYLE}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={ancId} className={LABEL_CLS}>
              {t("simFieldSince")}
            </label>
            <select
              id={ancId}
              value={anciennete}
              onChange={(e) =>
                setAnciennete(e.target.value as AncienneteValue)
              }
              className={FIELD_CLS}
              style={FIELD_STYLE}
            >
              {ANCIENNETE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} style={OPTION_STYLE}>
                  {resolve(o.labelKey, o.label)}
                </option>
              ))}
            </select>
          </div>

          {formError && (
            <p
              id={errId}
              role="alert"
              className="text-[12px] font-semibold leading-snug text-[#FFD6E8]"
            >
              {formError}
            </p>
          )}

          <button type="submit" className={`mt-auto ${PILL_CLS}`}>
            {t("simSubmit")}
            <ArrowRightIcon className="size-4" />
          </button>
        </form>
      ) : (
        /* ── État résultat ── */
        <div
          key="result"
          className="flex flex-1 animate-[fadeInUp_0.45s_ease] flex-col gap-4 motion-reduce:animate-none"
        >
          <div
            className="relative overflow-hidden rounded-[16px] p-5 ring-1 ring-white/20"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--glass-status-from) 0%, var(--glass-status-to) 100%)",
            }}
          >
            <span
              className="absolute -top-10 -right-10 size-40 rounded-full bg-[rgba(255,200,140,0.40)] dark:bg-[rgba(180,160,200,0.12)]"
              style={{ filter: "blur(28px)" }}
            />
            <div className="relative">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">
                {t("simResultTitle")}
              </div>
              <div className="glass-display mt-1 text-[40px] leading-none font-semibold">
                {FMT_JOUR.format(shown)} €
                <small className="ml-1.5 text-[14px] font-semibold opacity-70">
                  {t("simPerDay")}
                </small>
              </div>
              <div className="mt-1.5 text-[12px] opacity-80">
                {t("simResultMonthly", {
                  amount: FMT_MOIS.format(result.parMois),
                  rate: result.tauxPct,
                  capped: result.plafondApplique ? "yes" : "no",
                })}
              </div>
            </div>
          </div>

          {/* Méta réelles, détachées du bloc chiffré par un filet clair. */}
          <div className="flex flex-col gap-2 border-t border-white/15 pt-4 text-[12px]">
            <div className="flex justify-between gap-3">
              <span className="text-white/60">{t("simMetaUpdated")}</span>
              <span className="font-bold">{t("simMetaUpdatedNow")}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/60">{t("simMetaCategory")}</span>
              <span className="font-bold">{resolve(CATEGORIE_LABEL_KEYS[categorie], CATEGORIE_LABELS[categorie])}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/60">{t("simMetaPeriod")}</span>
              <span className="font-bold">{result.periodeLabel}</span>
            </div>
          </div>

          <p className="text-[11px] leading-snug text-white/65">
            {t("simDisclaimer")}{" "}
            <Link
              href="/outils"
              className="font-semibold text-white underline decoration-white/40 underline-offset-2 transition hover:decoration-white motion-reduce:transition-none"
            >
              {t("simRefineLink")}
              <ArrowRightIcon className="ml-0.5 inline size-3" aria-hidden />
            </Link>
          </p>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`mt-auto ${PILL_CLS}`}
          >
            {t("simRecalculate")}
            <ArrowRightIcon className="size-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
