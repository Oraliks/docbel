"use client";

/**
 * Calculateur "Impôt des Personnes Physiques (IPP)" — UI refondue 2026-05.
 *
 * Pattern UI aligné sur Pension / Tarif social : layout 2 colonnes
 * (form / résultat sticky), badges officiels, export PDF, mention
 * "Mis à jour le …".
 *
 * Pourquoi ce composant : l'IPP belge est progressif sur 4 tranches mais
 * les outils publics simples (calculatrices de magazines) oublient souvent
 * l'additionnel communal (qui peut atteindre 9 %), la cotisation spéciale
 * sécurité sociale (loi 30/03/1994) et les principales réductions d'impôt
 * (épargne pension 30 %, titres-services ≈ 15 %, dons 45 %). On modélise
 * les 4 tranches officielles SPF Finances pour l'exercice 2026 (revenus
 * 2025), la quotité exemptée 10 910 € (art. 131 CIR 92) avec suppléments
 * pour enfants à charge à jour (1 980 / 5 110 / 11 440 / 18 510 / +7 070)
 * et le quotient conjugal (art. 134, plafond 13 460 €).
 *
 * La logique pure vit dans `lib/calculators/ipp.ts` ; ici on assemble
 * les inputs et la carte de résultat.
 */

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { CountryFlag } from "@/components/docbel/country-flag";
import {
  calcIPP,
  TRANCHES_IPP_2026,
  QUOTITE_BASE_2026,
  EPARGNE_PENSION_PLAFOND,
  TITRES_SERVICES_PLAFOND,
  QUOTIENT_CONJUGAL_PLAFOND,
  type IPPResult,
  type StatutIPP,
} from "@/lib/calculators/ipp";
import {
  CalcBadge,
  CalcCard,
  CalcError,
  CalcField,
  CalcGrid,
  CalcSelect,
  CalcSubmitButton,
  fmtEUR,
  fmtNumber,
  parseNum,
} from "./_shared";

/**
 * Date de mise à jour du calculateur — pilote l'affichage public et
 * l'alerte annuelle dans /admin/calculateurs.
 */
const LAST_UPDATED = "2026-05-25";

const formatTrancheBorne = (n: number) =>
  n === Infinity
    ? "∞"
    : n.toLocaleString("fr-BE", { maximumFractionDigits: 0 });

export function CalcIPP({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");

  const STATUTS: { value: StatutIPP; label: string }[] = [
    { value: "isole", label: t("ippStatutIsole") },
    { value: "marie_un_revenu", label: t("ippStatutMarieUnRevenu") },
    { value: "marie_deux_revenus", label: t("ippStatutMarieDeuxRevenus") },
  ];

  const [revenu, setRevenu] = useState("35000");
  const [statut, setStatut] = useState<StatutIPP>("isole");
  const [enfants, setEnfants] = useState("0");
  const [autres, setAutres] = useState("0");
  const [additionnel, setAdditionnel] = useState("7.5");
  const [parentIsole, setParentIsole] = useState(false);

  /* -- Réductions (masquées par défaut) -- */
  const [showReductions, setShowReductions] = useState(false);
  const [epargnePension, setEpargnePension] = useState("0");
  const [titresServices, setTitresServices] = useState("0");
  const [dons, setDons] = useState("0");
  const [pretHypo, setPretHypo] = useState("0");
  const [gardeEnfants, setGardeEnfants] = useState("0");

  const [result, setResult] = useState<IPPResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const reset = () => {
    setRevenu("35000");
    setStatut("isole");
    setEnfants("0");
    setAutres("0");
    setAdditionnel("7.5");
    setParentIsole(false);
    setShowReductions(false);
    setEpargnePension("0");
    setTitresServices("0");
    setDons("0");
    setPretHypo("0");
    setGardeEnfants("0");
    setResult(null);
    setError(null);
  };

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const revenuNum = parseNum(revenu);
    const enfantsNum = parseInt(enfants, 10);
    const autresNum = parseInt(autres, 10);
    const additionnelNum = parseNum(additionnel);

    if (!Number.isFinite(revenuNum)) {
      setError(t("ippErrRevenu"));
      return;
    }
    if (!Number.isInteger(enfantsNum) || enfantsNum < 0) {
      setError(t("ippErrEnfants"));
      return;
    }
    if (!Number.isInteger(autresNum) || autresNum < 0) {
      setError(t("ippErrAutres"));
      return;
    }
    if (!Number.isFinite(additionnelNum)) {
      setError(t("ippErrAdditionnel"));
      return;
    }

    // Parse réductions (vide / NaN → 0)
    const safeNum = (s: string) => {
      const n = parseNum(s);
      return Number.isFinite(n) ? n : 0;
    };

    const res = calcIPP({
      revenuAnnuelImposable: revenuNum,
      statut,
      enfants: enfantsNum,
      autresPersonnesACharge: autresNum,
      additionnelCommunal: additionnelNum,
      parentIsole: parentIsole && enfantsNum > 0 && statut === "isole",
      epargnePension: safeNum(epargnePension),
      titresServices: safeNum(titresServices),
      dons: safeNum(dons),
      pretHypothecaire: safeNum(pretHypo),
      gardeEnfants: safeNum(gardeEnfants),
    });

    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
  };

  /* --------------------------------------------------------------- */
  /*  Export PDF (jspdf en import dynamique)                         */
  /* --------------------------------------------------------------- */
  const handleExportPDF = async () => {
    if (!result) return;
    setExportingPDF(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const lineGap = 6;
      let y = 20;

      // Header
      doc.setFontSize(18);
      doc.setFont("", "bold");
      doc.setTextColor(0, 51, 102);
      doc.text("DOCBEL", margin, y);
      y += 7;
      doc.setDrawColor(200, 16, 46);
      doc.setLineWidth(0.6);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(110, 110, 110);
      doc.text("https://www.docbel.be", margin, y);
      const now = new Date();
      const dateStr = now.toLocaleDateString("fr-BE");
      const timeStr = now.toLocaleTimeString("fr-BE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      doc.text(t("ippPdfGenere", { date: dateStr, time: timeStr }), pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        t("ippPdfTitre"),
        margin,
        y,
      );
      y += 10;

      // Section Inputs
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("ippPdfParametres"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const statutLabel =
        STATUTS.find((s) => s.value === statut)?.label ?? statut;

      const inputs: [string, string][] = [
        [t("ippPdfInRevenu"), fmtEUR(parseNum(revenu))],
        [t("ippPdfInStatut"), statutLabel],
        [t("ippPdfInEnfants"), String(parseInt(enfants, 10) || 0)],
        [t("ippPdfInAutres"), String(parseInt(autres, 10) || 0)],
        [t("ippPdfInAdditionnel"), t("ippPdfInAdditionnelVal", { pct: parseNum(additionnel) })],
      ];
      if (parentIsole && parseInt(enfants, 10) > 0 && statut === "isole") {
        inputs.push([t("ippPdfInParentIsole"), t("ippPdfOui")]);
      }
      if (parseNum(epargnePension) > 0) {
        inputs.push([t("ippPdfInEpargnePension"), fmtEUR(parseNum(epargnePension))]);
      }
      if (parseNum(titresServices) > 0) {
        inputs.push([t("ippPdfInTitresServices"), fmtEUR(parseNum(titresServices))]);
      }
      if (parseNum(dons) > 0) {
        inputs.push([t("ippPdfInDons"), fmtEUR(parseNum(dons))]);
      }
      if (parseNum(pretHypo) > 0) {
        inputs.push([t("ippPdfInPretHypo"), fmtEUR(parseNum(pretHypo))]);
      }
      if (parseNum(gardeEnfants) > 0) {
        inputs.push([t("ippPdfInGardeEnfants"), fmtEUR(parseNum(gardeEnfants))]);
      }

      const colKey = margin + 2;
      const colVal = pageWidth / 2 + 5;
      inputs.forEach(([k, v]) => {
        doc.setTextColor(90, 90, 90);
        doc.text(k, colKey, y);
        doc.setTextColor(0, 0, 0);
        doc.setFont("", "bold");
        doc.text(v, colVal, y);
        doc.setFont("", "normal");
        y += lineGap;
      });
      y += 4;

      // Encadré IMPÔT TOTAL
      const boxH = 32;
      doc.setFillColor(232, 246, 240);
      doc.setDrawColor(34, 160, 107);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, "FD");

      doc.setFontSize(10);
      doc.setFont("", "bold");
      doc.setTextColor(22, 130, 90);
      doc.text(t("ippPdfImpotTotalLabel"), margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtEUR(result.impotTotal), margin + 4, y + 18);

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        t("ippPdfTauxResume", {
          tauxMoyen: result.tauxMoyen.toFixed(1),
          tauxMarginal: result.tauxMarginal.toFixed(0),
          revenuNet: fmtEUR(result.revenuNetApresImpot),
        }),
        margin + 4,
        y + 26,
      );
      y += boxH + 8;

      // Détail
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("ippPdfDecomposition"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const details: [string, string][] = [
        [t("ippPdfDecQuotite"), fmtEUR(result.quotiteExemptee)],
        [t("ippPdfDecReductionQuotite"), `− ${fmtEUR(result.reductionQuotite)}`],
        [t("ippPdfDecImpotBrut"), fmtEUR(result.impotBrutFederal)],
      ];
      if (result.allegementQuotientConjugal > 0) {
        details.push([
          t("ippPdfDecQuotientConjugal"),
          `− ${fmtEUR(result.allegementQuotientConjugal)}`,
        ]);
      }
      if (result.reductionsTotales > 0) {
        details.push([
          t("ippPdfDecReductions"),
          `− ${fmtEUR(result.reductionsTotales)}`,
        ]);
      }
      details.push([
        t("ippPdfDecImpotApresCredits"),
        fmtEUR(result.impotBrutApresCredits),
      ]);
      details.push([
        t("ippPdfDecAdditionnel"),
        `+ ${fmtEUR(result.additionnelCommunalEur)}`,
      ]);
      if (result.cotisationSpecialeSecu > 0) {
        details.push([
          t("ippPdfDecCotisation"),
          `+ ${fmtEUR(result.cotisationSpecialeSecu)}`,
        ]);
      }

      details.forEach(([k, v]) => {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = 20;
        }
        doc.setTextColor(90, 90, 90);
        doc.text(k, colKey, y);
        doc.setFont("", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(v, pageWidth - margin, y, { align: "right" });
        doc.setFont("", "normal");
        y += lineGap;
      });
      y += 4;

      // Tableau des tranches
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("ippPdfDetailTranche"), margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      result.tranches.forEach((tr, i) => {
        if (tr.impotTranche <= 0.01) return;
        const min = TRANCHES_IPP_2026[i].min;
        const max =
          tr.borne === Infinity
            ? "∞"
            : tr.borne.toLocaleString("fr-BE", { maximumFractionDigits: 0 });
        doc.setTextColor(80, 80, 80);
        doc.text(
          t("ippPdfTrancheLigne", {
            min: min.toLocaleString("fr-BE"),
            max,
            taux: (tr.taux * 100).toFixed(0),
          }),
          colKey,
          y,
        );
        doc.setFont("", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(fmtEUR(tr.impotTranche), pageWidth - margin, y, {
          align: "right",
        });
        doc.setFont("", "normal");
        y += lineGap;
      });
      y += 4;

      // Footer
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setFont("", "italic");
      doc.setTextColor(120, 120, 120);
      const footer = doc.splitTextToSize(
        t("ippPdfFooterDisclaimer"),
        pageWidth - margin * 2,
      );
      doc.text(footer, margin, y);
      y += footer.length * 4 + 4;

      doc.setFont("", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(
        "Docbel © 2026 | https://www.docbel.be",
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" },
      );

      doc.save(`docbel-ipp-estimation-${now.toISOString().split("T")[0]}.pdf`);
    } finally {
      setExportingPDF(false);
    }
  };

  const lastUpdatedFr = new Date(LAST_UPDATED).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const enfantsNum = parseInt(enfants, 10);
  const canShowParentIsole =
    statut === "isole" && Number.isInteger(enfantsNum) && enfantsNum > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Layout 2 colonnes : form (gauche) | résultat sticky (droite) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
        {/* ---------- Colonne gauche : formulaire ---------- */}
        <CalcCard className="flex flex-col gap-4">
          {/* En-tête : icône + titre + sous-titre + bouton Reset */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                }}
              >
                <Receipt className="size-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-[color:var(--glass-ink)]">
                  {t("ippTitle")}
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  {t("ippSubtitle")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border-[1.5px] px-2.5 text-[11.5px] font-semibold transition"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-surface)",
                color: "var(--glass-ink-soft)",
              }}
              title={t("ippResetForm")}
            >
              <RotateCcw className="size-3.5" />
              {t("ippReset")}
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <CalcBadge>
              <CountryFlag code="be" size={14} country={t("badgeBelgiqueCountry")} />
              {t("badgeBelgiqueCountry")}
            </CalcBadge>
            <CalcBadge accent={accent}>{t("badgeExercice2026")}</CalcBadge>
            <CalcBadge accent={accent}>{t("badgeRevenus2025")}</CalcBadge>
          </div>

          {/* --- Section 1 : Revenus ------------------------------- */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
              {t("ippSection1")}
            </span>

            <CalcField
              id="ipp-revenu"
              label={t("ippRevenuLabel")}
              hint={t("ippRevenuHint")}
              value={revenu}
              onChange={setRevenu}
              placeholder="ex : 35 000"
              suffix="€"
              min={0}
              max={1000000}
              step={500}
            />

            <CalcSelect<StatutIPP>
              id="ipp-statut"
              label={t("ippStatutLabel")}
              hint={t("ippStatutHint")}
              value={statut}
              onChange={setStatut}
              options={STATUTS}
            />
          </div>

          {/* --- Section 2 : Personnes à charge --------------------- */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
              {t("ippSection2")}
            </span>

            <CalcGrid cols={2}>
              <CalcField
                id="ipp-enfants"
                label={t("ippEnfantsLabel")}
                hint={t("ippEnfantsHint")}
                value={enfants}
                onChange={setEnfants}
                placeholder="0"
                min={0}
                max={10}
                step={1}
              />
              <CalcField
                id="ipp-autres"
                label={t("ippAutresLabel")}
                hint={t("ippAutresHint")}
                value={autres}
                onChange={setAutres}
                placeholder="0"
                min={0}
                max={5}
                step={1}
              />
            </CalcGrid>

            {/* Toggle parent isolé — seulement si pertinent */}
            {canShowParentIsole ? (
              <label
                htmlFor="ipp-parent-isole"
                className="flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3 transition"
                style={{
                  background: parentIsole
                    ? `${accent}10`
                    : "var(--glass-surface)",
                  borderColor: parentIsole
                    ? accent
                    : "var(--glass-border)",
                }}
              >
                <input
                  id="ipp-parent-isole"
                  type="checkbox"
                  checked={parentIsole}
                  onChange={(e) => setParentIsole(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer"
                  style={{ accentColor: accent }}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-[color:var(--glass-ink)]">
                    {t("ippParentIsoleLabel")}
                  </span>
                  <span className="text-[11.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                    {t("ippParentIsoleDesc")}
                  </span>
                </div>
              </label>
            ) : null}

            <CalcField
              id="ipp-additionnel"
              label={t("ippAdditionnelLabel")}
              hint={t("ippAdditionnelHint")}
              value={additionnel}
              onChange={setAdditionnel}
              placeholder="7.5"
              suffix="%"
              min={0}
              max={15}
              step={0.1}
            />
          </div>

          {/* --- Section 3 : Réductions (collapsable) --------------- */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowReductions((v) => !v)}
              className="flex items-center justify-between gap-2 rounded-xl border-[1.5px] border-dashed border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
            >
              <span>
                {showReductions
                  ? t("ippReductionsHide")
                  : t("ippReductionsShow")}
              </span>
              {showReductions ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>

            {showReductions ? (
              <div className="flex flex-col gap-3 rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-3.5">
                <p className="text-[11.5px] leading-[1.6] text-[color:var(--glass-ink-faint)]">
                  {t.rich("ippReductionsIntro", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>

                <CalcField
                  id="ipp-epargne-pension"
                  label={t("ippEpargnePensionLabel")}
                  hint={t("ippEpargnePensionHint", {
                    plafond: fmtEUR(EPARGNE_PENSION_PLAFOND),
                    max: fmtEUR(EPARGNE_PENSION_PLAFOND * 0.3),
                  })}
                  value={epargnePension}
                  onChange={setEpargnePension}
                  placeholder="0"
                  suffix="€"
                  min={0}
                  max={5000}
                  step={10}
                />

                <CalcField
                  id="ipp-titres-services"
                  label={t("ippTitresServicesLabel")}
                  hint={t("ippTitresServicesHint", {
                    plafond: fmtEUR(TITRES_SERVICES_PLAFOND),
                  })}
                  value={titresServices}
                  onChange={setTitresServices}
                  placeholder="0"
                  suffix="€"
                  min={0}
                  max={5000}
                  step={10}
                />

                <CalcField
                  id="ipp-dons"
                  label={t("ippDonsLabel")}
                  hint={t("ippDonsHint")}
                  value={dons}
                  onChange={setDons}
                  placeholder="0"
                  suffix="€"
                  min={0}
                  max={100000}
                  step={10}
                />

                <CalcField
                  id="ipp-pret-hypo"
                  label={t("ippPretHypoLabel")}
                  hint={t("ippPretHypoHint")}
                  value={pretHypo}
                  onChange={setPretHypo}
                  placeholder="0"
                  suffix="€"
                  min={0}
                  max={50000}
                  step={50}
                />

                <CalcField
                  id="ipp-garde-enfants"
                  label={t("ippGardeEnfantsLabel")}
                  hint={t("ippGardeEnfantsHint")}
                  value={gardeEnfants}
                  onChange={setGardeEnfants}
                  placeholder="0"
                  suffix="€"
                  min={0}
                  max={50000}
                  step={10}
                />
              </div>
            ) : null}
          </div>

          {error ? <CalcError>{error}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={handleCalc}>
              {t("ippCalcButton")}
            </CalcSubmitButton>
            <button
              type="button"
              onClick={reset}
              className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] text-[13px] font-semibold transition"
              style={{
                borderColor: "var(--glass-border)",
                background: "var(--glass-surface)",
                color: "var(--glass-ink-soft)",
              }}
            >
              <RotateCcw className="size-4" />
              {t("ippResetForm")}
            </button>
          </CalcGrid>

          {/* Info disclaimer bas form */}
          <div
            className="flex items-start gap-2 rounded-xl border-[1.5px] p-3 text-[11.5px] leading-[1.55]"
            style={{
              borderColor: "var(--glass-border)",
              background: "var(--glass-surface)",
              color: "var(--glass-ink-soft)",
            }}
          >
            <Info className="mt-0.5 size-4 shrink-0 text-[color:var(--glass-ink-faint)]" />
            <div>
              {t.rich("ippDisclaimer", {
                strong: (chunks) => (
                  <strong className="text-[color:var(--glass-ink)]">
                    {chunks}
                  </strong>
                ),
                b: (chunks) => <strong>{chunks}</strong>,
              })}
            </div>
          </div>
        </CalcCard>

        {/* ---------- Colonne droite : résultat sticky ---------- */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <CalcCard
            style={{
              background: `${accent}10`,
              borderColor: `${accent}30`,
            }}
          >
            {result ? (
              <IPPResultPanel
                result={result}
                revenu={parseNum(revenu)}
                accent={accent}
                onExportPDF={handleExportPDF}
                exporting={exportingPDF}
              />
            ) : (
              <IPPResultPlaceholder accent={accent} />
            )}
          </CalcCard>
        </div>
      </div>

      {/* Footer : Mise à jour + sources */}
      <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
        {t.rich("ippFooter", {
          date: lastUpdatedFr,
          strong: (chunks) => <strong>{chunks}</strong>,
          spf: (chunks) => (
            <a
              href="https://fin.belgium.be/fr/particuliers/declaration_impot/taux-imposition-revenus/taux-imposition"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline-offset-2 hover:underline"
            >
              {chunks}
            </a>
          ),
          tow: (chunks) => (
            <a
              href="https://finances.belgium.be/fr/E-services/tax-on-web"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline-offset-2 hover:underline"
            >
              {chunks}
            </a>
          ),
          cir: (chunks) => (
            <a
              href="https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=1992041252&table_name=loi"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline-offset-2 hover:underline"
            >
              {chunks}
            </a>
          ),
          onss: (chunks) => (
            <a
              href="https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_contributions/other_specialcontributions/specialsocialsecuritycontribution.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline-offset-2 hover:underline"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panneau résultat (rempli)                                         */
/* ------------------------------------------------------------------ */

function IPPResultPanel({
  result,
  revenu,
  accent,
  onExportPDF,
  exporting,
}: {
  result: IPPResult;
  revenu: number;
  accent: string;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  const t = useTranslations("public.outils");
  const tranchesUtilisees = result.tranches.filter(
    (tr) => tr.impotTranche > 0.01,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: accent }}
        >
          {t("ippResultEyebrow")}
        </span>
        <span
          className="inline-flex items-center"
          title={t("ippResultInfoTooltip")}
          aria-label={t("ippResultInfoTooltip")}
        >
          <Info
            className="size-4"
            style={{ color: "var(--glass-ink-faint)" }}
          />
        </span>
      </div>

      {/* Headline : impôt total */}
      <div>
        <div
          className="font-extrabold tracking-[-0.5px] text-[color:var(--glass-ink)]"
          style={{ fontSize: 36, lineHeight: 1.05 }}
        >
          {fmtEUR(result.impotTotal)}
        </div>
        <div
          className="mt-1 text-[13px] font-semibold"
          style={{ color: "var(--glass-ink-soft)" }}
        >
          {t("ippPerYear")}
        </div>
        <div className="mt-1 text-[12px] text-[color:var(--glass-ink-faint)]">
          {t.rich("ippPerMonthAvg", {
            value: fmtEUR(result.impotTotal / 12),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </div>
      </div>

      {/* Taux : moyen + marginal en grand */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-xl p-3"
          style={{
            background: "var(--glass-surface)",
            border: "1.5px solid var(--glass-border)",
          }}
        >
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-faint)]">
            {t("ippTauxMoyen")}
          </div>
          <div
            className="mt-1 font-extrabold text-[color:var(--glass-ink)]"
            style={{ fontSize: 24, lineHeight: 1 }}
          >
            {result.tauxMoyen.toFixed(1)} %
          </div>
        </div>
        <div
          className="rounded-xl p-3"
          style={{
            background: "var(--glass-surface)",
            border: "1.5px solid var(--glass-border)",
          }}
        >
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-faint)]">
            {t("ippTauxMarginal")}
          </div>
          <div
            className="mt-1 font-extrabold text-[color:var(--glass-ink)]"
            style={{ fontSize: 24, lineHeight: 1 }}
          >
            {result.tauxMarginal.toFixed(0)} %
          </div>
        </div>
      </div>

      {/* Revenu net */}
      <div
        className="rounded-xl p-3"
        style={{
          background: `${accent}15`,
          border: `1.5px solid ${accent}40`,
        }}
      >
        <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-faint)]">
          {t("ippRevenuNet")}
        </div>
        <div
          className="mt-1 font-extrabold"
          style={{ fontSize: 22, lineHeight: 1, color: accent }}
        >
          {fmtEUR(result.revenuNetApresImpot)}
        </div>
        <div className="mt-1 text-[11.5px] text-[color:var(--glass-ink-soft)]">
          {t.rich("ippPerMonth", {
            value: fmtEUR(result.revenuNetApresImpot / 12),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </div>
      </div>

      {/* Décomposition */}
      <div
        className="border-t pt-3"
        style={{ borderTopColor: "var(--glass-ink-line)" }}
      >
        <div
          className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.06em]"
          style={{ color: "var(--glass-ink-faint)" }}
        >
          {t("ippDecomposition")}
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5 text-[12.5px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              {t("ippDecQuotite")}
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {fmtEUR(result.quotiteExemptee)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              {t("ippDecReductionQuotite")}
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              − {fmtEUR(result.reductionQuotite)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              {t("ippDecImpotBrut")}
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {fmtEUR(result.impotBrutFederal)}
            </span>
          </div>
          {result.allegementQuotientConjugal > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                {t("ippDecQuotientConjugal")}
              </span>
              <span className="font-semibold text-[color:var(--glass-ink)]">
                − {fmtEUR(result.allegementQuotientConjugal)}
              </span>
            </div>
          ) : null}
          {result.reductionsTotales > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                {t("ippDecReductions")}
              </span>
              <span className="font-semibold text-[color:var(--glass-ink)]">
                − {fmtEUR(result.reductionsTotales)}
              </span>
            </div>
          ) : null}
          <div
            className="flex items-baseline justify-between gap-3 border-t pt-1.5"
            style={{ borderTopColor: "var(--glass-ink-line)" }}
          >
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {t("ippDecImpotApresCredits")}
            </span>
            <span className="font-bold text-[color:var(--glass-ink)]">
              {fmtEUR(result.impotBrutApresCredits)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              {t("ippDecAdditionnel")}
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              + {fmtEUR(result.additionnelCommunalEur)}
            </span>
          </div>
          {result.cotisationSpecialeSecu > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                {t("ippDecCotisation")}
              </span>
              <span className="font-semibold text-[color:var(--glass-ink)]">
                + {fmtEUR(result.cotisationSpecialeSecu)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tableau des tranches appliquées */}
      {tranchesUtilisees.length > 0 ? (
        <div
          className="border-t pt-3"
          style={{ borderTopColor: "var(--glass-ink-line)" }}
        >
          <div
            className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.06em]"
            style={{ color: "var(--glass-ink-faint)" }}
          >
            {t("ippTranchesAppliquees")}
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-[color:var(--glass-surface)] p-3 text-[11.5px]">
            {result.tranches.map((tr, i) => {
              if (tr.impotTranche <= 0.01) return null;
              const min = TRANCHES_IPP_2026[i].min;
              return (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-[color:var(--glass-ink-soft)]">
                    {t.rich("ippTrancheLigne", {
                      min: fmtNumber(min),
                      max: formatTrancheBorne(tr.borne),
                      taux: (tr.taux * 100).toFixed(0),
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </span>
                  <span className="font-semibold text-[color:var(--glass-ink)]">
                    {fmtEUR(tr.impotTranche)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Bloc "À savoir" */}
      <div
        className="rounded-xl p-3 text-[11.5px] leading-[1.6]"
        style={{
          background: `${accent}10`,
          border: `1px solid ${accent}25`,
          color: "var(--glass-ink-soft)",
        }}
      >
        <div className="mb-1 flex items-center gap-1.5 font-bold text-[color:var(--glass-ink)]">
          <Info className="size-3.5" /> {t("ippASavoir")}
        </div>
        <ul className="list-inside list-disc space-y-1">
          <li>
            {t.rich("ippASavoirTaxOnWeb", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("ippASavoirAdditionnel", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("ippASavoirQuotite", {
              value: fmtEUR(QUOTITE_BASE_2026),
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          {result.allegementQuotientConjugal > 0 ? (
            <li>
              {t.rich("ippASavoirQuotientConjugal", {
                value: fmtEUR(QUOTIENT_CONJUGAL_PLAFOND),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          ) : null}
        </ul>
      </div>

      {/* Avertissement haut revenu / tranche 50 % */}
      {result.tauxMarginal >= 50 ? (
        <div
          className="rounded-xl p-3 text-[11.5px] leading-[1.55]"
          style={{
            background: "var(--glass-warning-surface)",
            border: "1.5px solid var(--glass-warning-border)",
            color: "var(--glass-warning-ink)",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold text-[color:var(--glass-warning-ink)]">
            <AlertCircle className="size-3.5" />
            {t("ippMarginal50Title")}
          </div>
          <p className="text-[11.5px] leading-[1.55]">
            {t("ippMarginal50Body", { seuil: fmtEUR(49840) })}
          </p>
        </div>
      ) : null}

      {/* Bouton PDF */}
      <button
        type="button"
        onClick={onExportPDF}
        disabled={exporting}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          borderColor: `${accent}50`,
          background: "var(--glass-surface)",
          color: accent,
        }}
      >
        <Download className="size-4" />
        {exporting ? t("ippPdfGenerating") : t("ippExportPdf")}
      </button>

      {/* Silence "unused" — revenu sert au PDF via le state parent */}
      {revenu > 0 ? null : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder : avant le premier calcul                             */
/* ------------------------------------------------------------------ */

function IPPResultPlaceholder({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        {t("ippResultEyebrow")}
      </span>
      <div
        className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink-soft)]"
        style={{ maxWidth: 260 }}
      >
        {t.rich("ippPlaceholderPrompt", {
          em: (chunks) => <em>{chunks}</em>,
        })}
      </div>
      <div className="mt-1 text-[11px] text-[color:var(--glass-ink-faint)]">
        {t("ippPlaceholderQuotite", { value: fmtEUR(QUOTITE_BASE_2026) })}
      </div>
      <Info
        className="mt-1 size-5"
        style={{ color: "var(--glass-ink-faint)" }}
      />
    </div>
  );
}
