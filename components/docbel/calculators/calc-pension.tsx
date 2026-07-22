"use client";

/**
 * Calculateur "Pension légale estimée (salarié)" — UI refondue 2026-05.
 *
 * Pattern UI aligné sur Brut/Net + Pécule + Allocs Fam : layout 2 colonnes
 * (form / résultat sticky), badges officiels, export PDF, mention
 * "Mis à jour le …".
 *
 * Pourquoi ce composant : la pension légale belge fait peur. La plupart
 * des outils publics donnent un chiffre opaque sans expliquer pourquoi
 * un départ anticipé est ou non possible. Ici on applique fidèlement la
 * formule SFP (taux × carrière / 45), on intègre les périodes assimilées,
 * on applique le plancher minimum garanti et les plafonds — et on
 * explique clairement le résultat ou le refus d'anticipation.
 *
 * La logique pure vit dans `lib/calculators/pension.ts` ; ici on
 * assemble les inputs et la carte de résultat.
 */

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, BadgeCheck, Download, Info, RotateCcw } from "lucide-react";
import { CountryFlag } from "@/components/docbel/country-flag";
import {
  calcPension,
  PLAFOND_SALARIAL_2026,
  type PensionResult,
} from "@/lib/calculators/pension";
import {
  CalcBadge,
  CalcCard,
  CalcError,
  CalcField,
  CalcGrid,
  CalcSubmitButton,
  YesNoToggle,
  fmtEUR,
  fmtNumber,
  parseNum,
} from "./_shared";

type Statut = "isole" | "menage";
type MenageYesNo = "oui" | "non";

/**
 * Date de mise à jour du calculateur — pilote l'affichage public et
 * l'alerte annuelle dans /admin/calculateurs.
 */
const LAST_UPDATED = "2026-05-25";

export function CalcPension({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  const [dateNaissance, setDateNaissance] = useState("");
  const [anneesCarriere, setAnneesCarriere] = useState("42");
  const [periodesAssimilees, setPeriodesAssimilees] = useState("");
  const [salaireMoyen, setSalaireMoyen] = useState("45000");
  const [statutMenage, setStatutMenage] = useState<MenageYesNo>("non");
  const [ageDepart, setAgeDepart] = useState("65");

  const [result, setResult] = useState<PensionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const reset = () => {
    setDateNaissance("");
    setAnneesCarriere("42");
    setPeriodesAssimilees("");
    setSalaireMoyen("45000");
    setStatutMenage("non");
    setAgeDepart("65");
    setResult(null);
    setError(null);
  };

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const carriere = parseNum(anneesCarriere);
    const assimilees = periodesAssimilees ? parseNum(periodesAssimilees) : 0;
    const salaire = parseNum(salaireMoyen);
    const age = parseNum(ageDepart);
    const statut: Statut = statutMenage === "oui" ? "menage" : "isole";

    if (!dateNaissance) {
      setError(t("penErrDateNaissance"));
      return;
    }
    if (!Number.isFinite(carriere)) {
      setError(t("penErrCarriere"));
      return;
    }
    if (periodesAssimilees && !Number.isFinite(assimilees)) {
      setError(t("penErrAssimilees"));
      return;
    }
    if (!Number.isFinite(salaire)) {
      setError(t("penErrSalaire"));
      return;
    }
    if (!Number.isFinite(age)) {
      setError(t("penErrAge"));
      return;
    }

    const res = calcPension({
      dateNaissance,
      anneesCarriere: carriere,
      periodesAssimilees: assimilees,
      salaireMoyen: salaire,
      statut,
      ageDepart: age,
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
    // Libellé du statut traduit (remplace `result.statutLabel` qui est
    // produit en français dans `lib/calculators/pension.ts`).
    const statutLabel =
      statutMenage === "oui"
        ? t("penStatutMenageLabel")
        : t("penStatutIsoleLabel");
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
      doc.text(t("penPdfGeneratedOn", { date: dateStr, time: timeStr }), pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(t("penPdfTitle", { statut: statutLabel }), margin, y);
      y += 10;

      // Section Inputs
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("penPdfInputsSection"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const carriereTotale = result.carriereTotale;
      const inputs: [string, string][] = [
        [t("penPdfDateNaissance"), new Date(dateNaissance).toLocaleDateString("fr-BE")],
        [t("penPdfStatutCivil"), statutLabel],
        [t("penPdfCarriereEffective"), t("penPdfYears", { n: result.anneesCarriere })],
        [t("penPdfPeriodesAssimilees"), t("penPdfYears", { n: fmtNumber(result.periodesAssimilees, result.periodesAssimilees % 1 === 0 ? 0 : 1) })],
        [t("penPdfCarriereTotale"), t("penPdfYears", { n: fmtNumber(carriereTotale, carriereTotale % 1 === 0 ? 0 : 1) })],
        [t("penPdfSalaireAnnuelMoyen"), fmtEUR(parseNum(salaireMoyen))],
        [t("penPdfAgeDepart"), t("penPdfYears", { n: result.ageDepart })],
        [t("penPdfAgeLegal"), t("penPdfYears", { n: result.ageLegal })],
        [t("penPdfAgeEffectif"), t("penPdfYears", { n: result.ageEffectif })],
      ];

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

      // Encadré PENSION MENSUELLE
      const boxH = 30;
      doc.setFillColor(238, 233, 252);
      doc.setDrawColor(124, 91, 232);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, "FD");

      doc.setFontSize(10);
      doc.setFont("", "bold");
      doc.setTextColor(78, 48, 165);
      doc.text(t("penPdfMonthlyBoxLabel"), margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtEUR(result.pensionMensuelle), margin + 4, y + 17);

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        t("penPdfAnnualHint", { amount: fmtEUR(result.pensionAnnuelle) }),
        margin + 4,
        y + 25,
      );
      y += boxH + 8;

      // Statut éligibilité anticipée
      if (!result.eligibiliteAnticipee.possible && result.eligibiliteAnticipee.raison) {
        if (y > pageHeight - 50) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(254, 243, 199);
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.6);
        doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 2, 2, "FD");
        doc.setFontSize(10);
        doc.setFont("", "bold");
        doc.setTextColor(180, 83, 9);
        doc.text(t("penPdfAnticipeIneligible"), margin + 4, y + 7);
        doc.setFontSize(9);
        doc.setFont("", "normal");
        doc.setTextColor(60, 60, 60);
        const txt = doc.splitTextToSize(
          result.eligibiliteAnticipee.raison,
          pageWidth - margin * 2 - 8,
        );
        doc.text(txt, margin + 4, y + 14);
        y += 28;
      }

      // Détail
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("penDetailTitle"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const details: [string, string][] = [
        [
          t("penPdfCarrierePriseEnCompte"),
          `${t("penPdfCarriereSur45", { n: fmtNumber(Math.min(carriereTotale, 45), carriereTotale % 1 === 0 ? 0 : 1) })}${result.longueCarriere ? t("penPlafonneeSuffix") : ""}`,
        ],
        [
          t("penPdfSalairePrisEnCompte"),
          result.plafondAtteint
            ? t("penPlafonneAmount", { amount: fmtEUR(PLAFOND_SALARIAL_2026) })
            : fmtEUR(parseNum(salaireMoyen)),
        ],
        [t("penPdfTauxApplicable"), statutLabel],
      ];
      details.forEach(([k, v]) => {
        doc.setTextColor(80, 80, 80);
        doc.text(k, colKey, y);
        doc.setFont("", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(v, pageWidth - margin, y, { align: "right" });
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
        t("penPdfFooterDisclaimer"),
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

      doc.save(`docbel-pension-estimation-${now.toISOString().split("T")[0]}.pdf`);
    } finally {
      setExportingPDF(false);
    }
  };

  const lastUpdatedFr = new Date(LAST_UPDATED).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
                <BadgeCheck className="size-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-[color:var(--glass-ink)]">
                  {t("penTitle")}
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  {t("penSubtitle")}
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
              title={t("penResetFormTitle")}
            >
              <RotateCcw className="size-3.5" />
              {t("penReset")}
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <CalcBadge>
              <CountryFlag code="be" size={14} country={t("badgeBelgiqueCountry")} />
              {t("badgeBelgiqueCountry")}
            </CalcBadge>
            <CalcBadge accent={accent}>{t("badgeSalarie2026")}</CalcBadge>
            <CalcBadge accent={accent}>{t("badgeDonnees2026")}</CalcBadge>
          </div>

          {/* Date de naissance */}
          <CalcField
            id="pension-naissance"
            label={t("penFieldDateNaissance")}
            type="date"
            value={dateNaissance}
            onChange={setDateNaissance}
            hint={t("penHintDateNaissance")}
          />

          {/* Carrière + Assimilées */}
          <CalcGrid cols={2}>
            <CalcField
              id="pension-carriere"
              label={t("penFieldCarriere")}
              value={anneesCarriere}
              onChange={setAnneesCarriere}
              placeholder="ex : 42"
              min={0}
              max={50}
              suffix={t("penSuffixAns")}
              hint={t("penHintCarriere")}
            />
            <CalcField
              id="pension-assimilees"
              label={t("penFieldAssimilees")}
              value={periodesAssimilees}
              onChange={setPeriodesAssimilees}
              placeholder="0"
              min={0}
              max={15}
              suffix={t("penSuffixAns")}
              hint={t("penHintAssimilees")}
            />
          </CalcGrid>

          {/* Salaire + Âge */}
          <CalcGrid cols={2}>
            <CalcField
              id="pension-salaire"
              label={t("penFieldSalaire")}
              value={salaireMoyen}
              onChange={setSalaireMoyen}
              placeholder="ex : 45000"
              min={0}
              max={200000}
              step={1000}
              suffix="€"
              hint={t("penHintSalaire")}
            />
            <CalcField
              id="pension-age-depart"
              label={t("penFieldAgeDepart")}
              value={ageDepart}
              onChange={setAgeDepart}
              placeholder="ex : 65"
              min={60}
              max={70}
              suffix={t("penSuffixAns")}
              hint={t("penHintAgeDepart")}
            />
          </CalcGrid>

          {/* Statut */}
          <YesNoToggle
            label={t("penToggleLabel")}
            hint={t("penToggleHint")}
            value={statutMenage}
            onChange={setStatutMenage}
            accent={accent}
            yesLabel={t("penToggleYes")}
            noLabel={t("penToggleNo")}
          />

          {error ? <CalcError>{error}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={handleCalc}>
              {t("penSubmit")}
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
              {t("penResetForm")}
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
              {t.rich("penFormDisclaimer", {
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
              <PensionResultPanel
                result={result}
                salaireSaisi={parseNum(salaireMoyen)}
                isMenage={statutMenage === "oui"}
                accent={accent}
                onExportPDF={handleExportPDF}
                exporting={exportingPDF}
              />
            ) : (
              <PensionResultPlaceholder accent={accent} />
            )}
          </CalcCard>
        </div>
      </div>

      {/* Footer : Mise à jour + sources */}
      <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
        {t.rich("penFooter", {
          date: lastUpdatedFr,
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panneau résultat (rempli)                                         */
/* ------------------------------------------------------------------ */

function PensionResultPanel({
  result,
  salaireSaisi,
  isMenage,
  accent,
  onExportPDF,
  exporting,
}: {
  result: PensionResult;
  salaireSaisi: number;
  isMenage: boolean;
  accent: string;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  const t = useTranslations("public.outils");
  // Libellé du statut traduit (remplace `result.statutLabel` produit en
  // français dans `lib/calculators/pension.ts`).
  const statutLabel = isMenage
    ? t("penStatutMenageLabel")
    : t("penStatutIsoleLabel");
  const inelig =
    result.eligibiliteAnticipee.possible === false
      ? result.eligibiliteAnticipee
      : null;

  // Détection du type de calcul appliqué (sert juste à l'affichage du badge).
  // On considère plafond atteint si la mensuelle est très proche du plafond
  // applicable (3500 isolé / 4350 ménage).
  const plafondMensuel = isMenage ? 4350 : 3500;
  const plafondPensionAtteint =
    Math.abs(result.pensionMensuelle - plafondMensuel) < 0.5;

  // Minimum garanti : on déduit du fait que la formule de base donne un
  // résultat inférieur au plancher. On ne dispose pas du flag direct, on
  // reconstitue à partir des inputs visibles.
  const fractionCarriere = Math.min(result.carriereTotale, 45) / 45;
  const salairePris = result.plafondAtteint ? 69521 : salaireSaisi;
  const tauxApplicable = isMenage ? 0.75 : 0.6;
  const pensionFormuleAnnuelle =
    salairePris * tauxApplicable * fractionCarriere;
  const minimumAppliquerait =
    result.carriereTotale >= 30 &&
    !plafondPensionAtteint &&
    Math.abs(result.pensionAnnuelle - pensionFormuleAnnuelle) > 1;

  let typeCalculLabel = t("penTypeStandard");
  if (plafondPensionAtteint) typeCalculLabel = t("penTypePlafond");
  else if (minimumAppliquerait) typeCalculLabel = t("penTypeMinimum");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: accent }}
        >
          {t("penResultEyebrow")}
        </span>
        <span
          className="inline-flex items-center"
          title={t("penResultTooltip")}
          aria-label={t("penResultTooltip")}
        >
          <Info
            className="size-4"
            style={{ color: "var(--glass-ink-faint)" }}
          />
        </span>
      </div>

      <div>
        <div
          className="font-extrabold tracking-[-0.5px] text-[color:var(--glass-ink)]"
          style={{ fontSize: 36, lineHeight: 1.05 }}
        >
          {fmtEUR(result.pensionMensuelle)}
        </div>
        <div
          className="mt-1 text-[13px] font-semibold"
          style={{ color: "var(--glass-ink-soft)" }}
        >
          {t("penPerMonth")}
        </div>
        <div className="mt-1 text-[12.5px] text-[color:var(--glass-ink-soft)]">
          {t.rich("penPerYear", {
            amount: fmtEUR(result.pensionAnnuelle),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CalcBadge accent={accent}>{typeCalculLabel}</CalcBadge>
          {result.plafondAtteint ? (
            <CalcBadge accent={accent}>{t("penBadgeSalairePlafonne")}</CalcBadge>
          ) : null}
          {result.longueCarriere ? (
            <CalcBadge accent={accent}>{t("penBadgeLongueCarriere")}</CalcBadge>
          ) : null}
        </div>
      </div>

      {/* Bloc rouge/orange si départ anticipé refusé */}
      {inelig ? (
        <div
          className="rounded-xl p-3.5 text-[12px] leading-[1.55]"
          style={{
            background: "var(--glass-warning-surface)",
            border: "1.5px solid var(--glass-warning-border)",
            color: "var(--glass-warning-ink)",
          }}
        >
          <div className="mb-1.5 flex items-center gap-1.5 font-bold text-[color:var(--glass-warning-ink)]">
            <AlertCircle className="size-3.5" />
            {t("penIneligTitle", { age: result.ageDepart })}
          </div>
          <p className="text-[11.5px] leading-[1.6]">
            {inelig.raison ?? t("penIneligFallback")}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-[1.6]">
            {t.rich("penIneligInfo", {
              age: result.ageLegal,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
      ) : null}

      {/* Détail du calcul */}
      <div
        className="border-t pt-3"
        style={{ borderTopColor: "var(--glass-ink-line)" }}
      >
        <div
          className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.06em]"
          style={{ color: "var(--glass-ink-faint)" }}
        >
          {t("penDetailTitle")}
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5 text-[12.5px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              {t("penRowCarriereEffective")}
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {t("penValueYears", { n: result.anneesCarriere })}
            </span>
          </div>
          {result.periodesAssimilees > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                {t("penRowAssimilees")}
              </span>
              <span className="font-semibold text-[color:var(--glass-ink)]">
                {t("penValueYears", {
                  n: fmtNumber(
                    result.periodesAssimilees,
                    result.periodesAssimilees % 1 === 0 ? 0 : 1,
                  ),
                })}
              </span>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              {t("penRowCarriereTotale")}
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {t("penValueCarriereSur45", {
                n: fmtNumber(
                  Math.min(result.carriereTotale, 45),
                  result.carriereTotale % 1 === 0 ? 0 : 1,
                ),
              })}
              {result.longueCarriere ? t("penPlafonneeSuffix") : ""}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              {t("penRowSalairePris")}
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {result.plafondAtteint
                ? t("penPlafonneAmount", { amount: fmtEUR(69521) })
                : fmtEUR(salaireSaisi)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              {t("penRowTauxApplicable")}
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {statutLabel}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              {t("penRowAgeLegal")}
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {t("penValueYears", { n: result.ageLegal })}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              {t("penRowAgeEffectif")}
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {t("penValueYears", { n: result.ageEffectif })}
              {result.ageEffectif !== result.ageDepart ? t("penAgeLegalSuffix") : ""}
            </span>
          </div>
        </div>
      </div>

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
          <Info className="size-3.5" /> {t("penKnowTitle")}
        </div>
        <ul className="list-inside list-disc space-y-1">
          <li>
            {t.rich("penKnow1", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("penKnow2", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>
            {t.rich("penKnow3", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
        </ul>
      </div>

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
        {exporting ? t("penPdfGenerating") : t("penPdfDownload")}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder : avant le premier calcul                             */
/* ------------------------------------------------------------------ */

function PensionResultPlaceholder({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        {t("penResultEyebrow")}
      </span>
      <div
        className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink-soft)]"
        style={{ maxWidth: 260 }}
      >
        {t.rich("penPlaceholderBody", {
          em: (chunks) => <em>{chunks}</em>,
        })}
      </div>
      <Info
        className="mt-1 size-5"
        style={{ color: "var(--glass-ink-faint)" }}
      />
    </div>
  );
}
