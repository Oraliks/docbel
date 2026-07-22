"use client";

/**
 * Calculateur "Tarif social énergie" — UI refondue 2026-05.
 *
 * Pattern UI aligné sur Brut/Net + Pécule + Allocations familiales :
 * layout 2 colonnes (form / résultat sticky), badges officiels, export PDF,
 * mention "Mis à jour le …".
 *
 * Pourquoi ce composant : depuis la fin de l'extension BIM (01.07.2023),
 * beaucoup de ménages belges ne savent plus s'ils sont éligibles au tarif
 * social fédéral. Cet outil vérifie l'éligibilité automatique selon les
 * 5 catégories officielles SPF Économie 2026 et estime l'économie annuelle
 * sur la facture énergie (élec + gaz) au regard des tarifs CREG trimestriels.
 *
 * La logique pure vit dans `lib/calculators/tarif-social.ts` ; ici on
 * assemble les inputs (statuts d'éligibilité, conso, profil de chauffage,
 * taille du ménage) et la carte de résultat.
 */

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Download,
  Flame,
  Info,
  RotateCcw,
  Zap,
} from "lucide-react";
import { CountryFlag } from "@/components/docbel/country-flag";
import {
  calcTarifSocial,
  PLAFONDS_2026,
  Q_REFERENCE,
  TARIFS_2026,
  type TarifSocialResult,
} from "@/lib/calculators/tarif-social";
import {
  CalcBadge,
  CalcCard,
  CalcError,
  CalcField,
  CalcGrid,
  CalcSubmitButton,
  ResultRow,
  YesNoToggle,
  fmtEUR,
  fmtNumber,
  parseNum,
} from "./_shared";

type Oui = "oui" | "non";

/**
 * Date de mise à jour du calculateur — pilote l'affichage public et
 * l'alerte annuelle dans /admin/calculateurs.
 */
const LAST_UPDATED = "2026-05-25";

interface StatusToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  accent: string;
  warningWhenChecked?: string;
}

/**
 * Checkbox stylée "carte" — chaque statut d'éligibilité occupe une ligne
 * avec une description courte. Préférable à 5+ toggles Oui/Non qui
 * prendraient trop de place verticalement.
 */
function StatusToggle({
  id,
  label,
  description,
  checked,
  onChange,
  accent,
}: StatusToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3 transition"
      style={{
        background: checked ? `${accent}10` : "var(--glass-surface)",
        borderColor: checked ? accent : "var(--glass-border)",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer"
        style={{ accentColor: accent }}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-[color:var(--glass-ink)]">
          {label}
        </span>
        {description ? (
          <span className="text-[11.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
            {description}
          </span>
        ) : null}
      </div>
    </label>
  );
}

export function CalcTarifSocial({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  // Statuts d'éligibilité officiels 2026
  const [bim, setBim] = useState(false);
  const [ris, setRis] = useState(false);
  const [grapa, setGrapa] = useState(false);
  const [handicap, setHandicap] = useState(false);
  const [aideEquivalente, setAideEquivalente] = useState(false);
  const [logementSocial, setLogementSocial] = useState(false);

  // Consommation et profil
  const [consoElec, setConsoElec] = useState("3500");
  const [consoGaz, setConsoGaz] = useState("17000");
  const [tailleMenage, setTailleMenage] = useState("2");
  const [chauffageElec, setChauffageElec] = useState<Oui>("non");
  const [chauffageGaz, setChauffageGaz] = useState<Oui>("oui");

  const [result, setResult] = useState<TarifSocialResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const reset = () => {
    setBim(false);
    setRis(false);
    setGrapa(false);
    setHandicap(false);
    setAideEquivalente(false);
    setLogementSocial(false);
    setConsoElec("3500");
    setConsoGaz("17000");
    setTailleMenage("2");
    setChauffageElec("non");
    setChauffageGaz("oui");
    setResult(null);
    setError(null);
  };

  const onCalc = () => {
    setError(null);
    setResult(null);

    const elec = parseNum(consoElec);
    const gaz = parseNum(consoGaz);
    const taille = parseNum(tailleMenage);

    const out = calcTarifSocial({
      bim,
      ris,
      grapa,
      handicap,
      aideEquivalente,
      logementSocial,
      consoElecKwh: isNaN(elec) ? 0 : elec,
      consoGazKwh: isNaN(gaz) ? 0 : gaz,
      chauffageElec: chauffageElec === "oui",
      chauffageGaz: chauffageGaz === "oui",
      tailleMenage: isNaN(taille) ? 2 : Math.round(taille),
    });

    if ("error" in out) {
      setError(out.error);
      return;
    }
    setResult(out);
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
      doc.text(t("tsPdfGenereLe", { date: dateStr, time: timeStr }), pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(t("tsPdfDocTitle", { q: Q_REFERENCE }), margin, y);
      y += 10;

      // Section Inputs
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("tsPdfParametres"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const statutsCoches: string[] = [];
      if (bim) statutsCoches.push(t("tsPdfStatutBim"));
      if (ris) statutsCoches.push(t("tsPdfStatutRis"));
      if (grapa) statutsCoches.push(t("tsPdfStatutGrapa"));
      if (handicap) statutsCoches.push(t("tsPdfStatutHandicap"));
      if (aideEquivalente) statutsCoches.push(t("tsPdfStatutAide"));
      if (logementSocial) statutsCoches.push(t("tsPdfStatutLogement"));

      const inputs: [string, string][] = [
        [
          t("tsPdfStatutsCoches"),
          statutsCoches.length > 0 ? statutsCoches.join(", ") : t("tsPdfAucun"),
        ],
        [t("tsPdfMenage"), String(parseNum(tailleMenage) || 2)],
        [t("tsPdfConsoElec"), t("tsPdfKwh", { x: fmtNumber(parseNum(consoElec) || 0) })],
        [t("tsPdfConsoGaz"), t("tsPdfKwh", { x: fmtNumber(parseNum(consoGaz) || 0) })],
        [t("tsPdfChauffageElec"), chauffageElec === "oui" ? t("tsPdfOui") : t("tsPdfNon")],
        [t("tsPdfChauffageGaz"), chauffageGaz === "oui" ? t("tsPdfOui") : t("tsPdfNon")],
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

      // Encadré ÉLIGIBILITÉ + GAIN
      const boxH = 32;
      doc.setFillColor(result.eligible ? 240 : 250, result.eligible ? 252 : 244, result.eligible ? 244 : 244);
      doc.setDrawColor(result.eligible ? 34 : 200, result.eligible ? 160 : 100, result.eligible ? 107 : 60);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, "FD");

      doc.setFontSize(10);
      doc.setFont("", "bold");
      doc.setTextColor(result.eligible ? 22 : 130, result.eligible ? 130 : 50, result.eligible ? 90 : 30);
      doc.text(
        result.eligible
          ? t("tsPdfEligibleTitle")
          : t("tsPdfNotEligibleTitle"),
        margin + 4,
        y + 7,
      );

      if (result.eligible) {
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text(
          t("tsPdfEconomieAn", { x: fmtEUR(result.gainAnnuel) }),
          margin + 4,
          y + 18,
        );
        doc.setFontSize(9);
        doc.setFont("", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(
          t("tsPdfSoitMois", { x: fmtEUR(result.gainMensuel), q: Q_REFERENCE }),
          margin + 4,
          y + 26,
        );
      } else {
        doc.setFontSize(11);
        doc.setFont("", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(
          t("tsPdfNotEligibleHint"),
          margin + 4,
          y + 18,
        );
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(
          t("tsPdfGainTheorique", { x: fmtEUR(result.gainAnnuel) }),
          margin + 4,
          y + 26,
        );
      }
      y += boxH + 8;

      // Motifs
      if (result.motifsEligibilite.length > 0) {
        doc.setFontSize(11);
        doc.setFont("", "bold");
        doc.setTextColor(200, 16, 46);
        doc.text(t("tsPdfMotifs"), margin, y);
        y += 6;
        doc.setFontSize(9.5);
        doc.setFont("", "normal");
        doc.setTextColor(0, 0, 0);
        result.motifsEligibilite.forEach((m) => {
          doc.text(`• ${m}`, colKey, y);
          y += lineGap;
        });
        y += 4;
      }

      // Détail par énergie
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("tsPdfDetail"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const details: [string, string][] = [
        [t("tsPdfEconomieElec"), fmtEUR(result.gainElec)],
        [t("tsPdfEconomieGaz"), fmtEUR(result.gainGaz)],
        [t("tsPdfPlafondElec"), t("tsPdfKwh", { x: fmtNumber(result.plafondElec) })],
        [t("tsPdfPlafondGaz"), t("tsPdfKwh", { x: fmtNumber(result.plafondGaz) })],
      ];
      if (result.consoExcedentElec > 0) {
        details.push([
          t("tsPdfExcedentElec"),
          t("tsPdfKwh", { x: fmtNumber(result.consoExcedentElec) }),
        ]);
      }
      if (result.consoExcedentGaz > 0) {
        details.push([
          t("tsPdfExcedentGaz"),
          t("tsPdfKwh", { x: fmtNumber(result.consoExcedentGaz) }),
        ]);
      }
      details.push([
        t("tsPdfCoutStandard"),
        fmtEUR(result.coutStandardTotal),
      ]);
      details.push([
        t("tsPdfCoutSocial"),
        fmtEUR(result.coutSocialTotal),
      ]);

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

      // Footer
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setFont("", "italic");
      doc.setTextColor(120, 120, 120);
      const footer = doc.splitTextToSize(
        t("tsPdfFooter", { q: Q_REFERENCE }),
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

      doc.save(`docbel-tarif-social-energie-${now.toISOString().split("T")[0]}.pdf`);
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
                <Zap className="size-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-[color:var(--glass-ink)]">
                  {t("tsTitle")}
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  {t("tsSubtitle", { q: Q_REFERENCE })}
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
              title={t("tsResetForm")}
            >
              <RotateCcw className="size-3.5" />
              {t("tsReset")}
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <CalcBadge>
              <CountryFlag code="be" size={14} country={t("badgeBelgiqueCountry")} />
              {t("badgeBelgiqueCountry")}
            </CalcBadge>
            <CalcBadge accent={accent}>{Q_REFERENCE}</CalcBadge>
            <CalcBadge accent={accent}>{t("badgeDonnees2026")}</CalcBadge>
          </div>

          {/* --- Section 1 : éligibilité ----------------------------- */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
                {t("tsSection1Title")}
              </span>
            </div>
            <p className="text-[11.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
              {t("tsSection1Help")}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <StatusToggle
                id="ts-ris"
                label={t("tsStatusRisLabel")}
                description={t("tsStatusRisDesc")}
                checked={ris}
                onChange={setRis}
                accent={accent}
              />
              <StatusToggle
                id="ts-grapa"
                label={t("tsStatusGrapaLabel")}
                description={t("tsStatusGrapaDesc")}
                checked={grapa}
                onChange={setGrapa}
                accent={accent}
              />
              <StatusToggle
                id="ts-handicap"
                label={t("tsStatusHandicapLabel")}
                description={t("tsStatusHandicapDesc")}
                checked={handicap}
                onChange={setHandicap}
                accent={accent}
              />
              <StatusToggle
                id="ts-aide"
                label={t("tsStatusAideLabel")}
                description={t("tsStatusAideDesc")}
                checked={aideEquivalente}
                onChange={setAideEquivalente}
                accent={accent}
              />
              <StatusToggle
                id="ts-logement"
                label={t("tsStatusLogementLabel")}
                description={t("tsStatusLogementDesc")}
                checked={logementSocial}
                onChange={setLogementSocial}
                accent={accent}
              />
              <StatusToggle
                id="ts-bim"
                label={t("tsStatusBimLabel")}
                description={t("tsStatusBimDesc")}
                checked={bim}
                onChange={setBim}
                accent={accent}
              />
            </div>
          </div>

          {/* --- Section 2 : estimation du gain ---------------------- */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
              {t("tsSection2Title")}
            </span>

            <CalcGrid cols={2}>
              <CalcField
                id="ts-taille-menage"
                label={t("tsFieldMenageLabel")}
                hint={t("tsFieldMenageHint")}
                value={tailleMenage}
                onChange={setTailleMenage}
                placeholder="2"
                min={1}
                max={15}
                step={1}
              />
              <CalcField
                id="ts-conso-elec"
                label={t("tsFieldElecLabel")}
                hint={t("tsFieldElecHint")}
                value={consoElec}
                onChange={setConsoElec}
                placeholder="3500"
                min={0}
                max={99999}
                suffix="kWh"
              />
              <CalcField
                id="ts-conso-gaz"
                label={t("tsFieldGazLabel")}
                hint={t("tsFieldGazHint")}
                value={consoGaz}
                onChange={setConsoGaz}
                placeholder="17000"
                min={0}
                max={99999}
                suffix="kWh"
              />
              <YesNoToggle
                label={t("tsFieldChauffageElecLabel")}
                hint={t("tsFieldChauffageElecHint", {
                  x: PLAFONDS_2026.ELEC_CHAUFFAGE,
                  y: PLAFONDS_2026.ELEC_BASE,
                })}
                value={chauffageElec}
                onChange={setChauffageElec}
                accent={accent}
              />
              <YesNoToggle
                label={t("tsFieldChauffageGazLabel")}
                hint={t("tsFieldChauffageGazHint", {
                  x: PLAFONDS_2026.GAZ_CHAUFFAGE,
                  y: PLAFONDS_2026.GAZ_NON_CHAUFFAGE,
                })}
                value={chauffageGaz}
                onChange={setChauffageGaz}
                accent={accent}
              />
            </CalcGrid>
          </div>

          {error ? <CalcError>{error}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={onCalc}>
              {t("tsSubmit")}
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
              {t("tsResetForm")}
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
              {t.rich("tsDisclaimerAuto", {
                strong: (c) => (
                  <strong className="text-[color:var(--glass-ink)]">{c}</strong>
                ),
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
              <TarifSocialResultPanel
                result={result}
                accent={accent}
                onExportPDF={handleExportPDF}
                exporting={exportingPDF}
              />
            ) : (
              <TarifSocialResultPlaceholder accent={accent} />
            )}
          </CalcCard>
        </div>
      </div>

      {/* Footer : Mise à jour + sources */}
      <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
        {t.rich("tsFooter", {
          date: lastUpdatedFr,
          q: Q_REFERENCE,
          strong: (c) => <strong>{c}</strong>,
        })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panneau résultat (rempli)                                         */
/* ------------------------------------------------------------------ */

function TarifSocialResultPanel({
  result,
  accent,
  onExportPDF,
  exporting,
}: {
  result: TarifSocialResult;
  accent: string;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  const t = useTranslations("public.outils");
  const eligibilityTone = result.eligible ? "success" : "warning";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: accent }}
        >
          {t("tsResultEyebrow")}
        </span>
        <span
          className="inline-flex items-center"
          title={t("tsResultInfoTitle", { q: Q_REFERENCE })}
          aria-label={t("tsResultInfoTitle", { q: Q_REFERENCE })}
        >
          <Info
            className="size-4"
            style={{ color: "var(--glass-ink-faint)" }}
          />
        </span>
      </div>

      {/* Badge éligibilité */}
      <div
        className="inline-flex w-fit items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.04em]"
        style={{
          borderColor: `var(--glass-${eligibilityTone}-border)`,
          background: `var(--glass-${eligibilityTone}-surface)`,
          color: `var(--glass-${eligibilityTone}-ink)`,
        }}
      >
        {result.eligible ? (
          <>
            <CheckCircle2 className="size-3.5" />
            {t("tsBadgeEligible")}
          </>
        ) : (
          <>
            <Info className="size-3.5" />
            {t("tsBadgeNotEligible")}
          </>
        )}
      </div>

      {/* Headline : gain annuel */}
      <div>
        <div
          className="font-extrabold tracking-[-0.5px] text-[color:var(--glass-ink)]"
          style={{ fontSize: 36, lineHeight: 1.05 }}
        >
          {fmtEUR(result.gainAnnuel)}
        </div>
        <div
          className="mt-1 text-[13px] font-semibold"
          style={{ color: "var(--glass-ink-soft)" }}
        >
          {result.eligible ? t("tsGainEligibleLabel") : t("tsGainTheoriqueLabel")}
        </div>
        <div className="mt-1 text-[12px] text-[color:var(--glass-ink-faint)]">
          {t.rich("tsGainMonthly", {
            x: fmtEUR(result.gainMensuel),
            strong: (c) => <strong>{c}</strong>,
          })}
        </div>
      </div>

      {/* Motifs d'éligibilité */}
      {result.eligible && result.motifsEligibilite.length > 0 ? (
        <div
          className="rounded-xl p-3"
          style={{
            background: "var(--glass-surface)",
            border: "1px solid var(--glass-success-border)",
          }}
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-success)]">
            <CheckCircle2 className="size-3" />
            {t("tsMotifsTitle", { count: result.motifsEligibilite.length })}
          </div>
          <ul className="space-y-1 text-[11.5px] leading-[1.5] text-[color:var(--glass-ink)]">
            {result.motifsEligibilite.map((m) => (
              <li key={m} className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-[color:var(--glass-success)]" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Notes pédagogiques (ex: BIM) */}
      {result.notes.length > 0 ? (
        <div
          className="rounded-xl p-3 text-[11.5px] leading-[1.55]"
          style={{
            background: "var(--glass-warning-surface)",
            border: "1px solid var(--glass-warning-border)",
            color: "var(--glass-warning-ink)",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold">
            <Info className="size-3.5" /> {t("tsNotesTitle")}
          </div>
          <ul className="space-y-1">
            {result.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Détail par énergie */}
      <div
        className="border-t pt-3"
        style={{ borderTopColor: "var(--glass-ink-line)" }}
      >
        <div
          className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.06em]"
          style={{ color: "var(--glass-ink-faint)" }}
        >
          {t("tsDetailTitle")}
        </div>
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-[color:var(--glass-surface)] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink)]">
                <Zap className="size-3.5" style={{ color: "var(--chart-1)" }} />
                {t("tsDetailElec")}
              </span>
              <span className="text-[14px] font-extrabold text-[color:var(--glass-ink)]">
                {fmtEUR(result.gainElec)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              <ResultRow
                label={t("tsDetailPlafond")}
                value={t("tsDetailKwh", { x: fmtNumber(result.plafondElec) })}
              />
              {result.consoExcedentElec > 0 ? (
                <ResultRow
                  label={t("tsDetailExcedent")}
                  value={t("tsDetailKwh", { x: fmtNumber(result.consoExcedentElec) })}
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-xl bg-[color:var(--glass-surface)] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink)]">
                <Flame className="size-3.5" style={{ color: "var(--chart-5)" }} />
                {t("tsDetailGaz")}
              </span>
              <span className="text-[14px] font-extrabold text-[color:var(--glass-ink)]">
                {fmtEUR(result.gainGaz)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              <ResultRow
                label={t("tsDetailPlafond")}
                value={t("tsDetailKwh", { x: fmtNumber(result.plafondGaz) })}
              />
              {result.consoExcedentGaz > 0 ? (
                <ResultRow
                  label={t("tsDetailExcedent")}
                  value={t("tsDetailKwh", { x: fmtNumber(result.consoExcedentGaz) })}
                />
              ) : null}
            </div>
          </div>

          {/* Comparaison standard vs social */}
          <div className="rounded-xl bg-[color:var(--glass-surface)] p-3">
            <div className="flex flex-col gap-1">
              <ResultRow
                label={t("tsDetailCoutStandard")}
                value={fmtEUR(result.coutStandardTotal)}
              />
              <ResultRow
                label={t("tsDetailCoutSocial")}
                value={fmtEUR(result.coutSocialTotal)}
              />
              <ResultRow
                label={t("tsDetailEconomieTotale")}
                value={fmtEUR(result.gainAnnuel)}
                direction="plus"
                emphasis
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bloc "À savoir" / "Si pas éligible" */}
      {result.eligible ? (
        <div
          className="rounded-xl p-3 text-[11.5px] leading-[1.6]"
          style={{
            background: `${accent}10`,
            border: `1px solid ${accent}25`,
            color: "var(--glass-ink-soft)",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold text-[color:var(--glass-ink)]">
            <Info className="size-3.5" /> {t("tsEligibleBlockTitle")}
          </div>
          <ul className="list-inside list-disc space-y-1">
            <li>{t.rich("tsEligibleBlockItem1", { strong: (c) => <strong>{c}</strong> })}</li>
            <li>{t.rich("tsEligibleBlockItem2", { strong: (c) => <strong>{c}</strong> })}</li>
            <li>{t("tsEligibleBlockItem3")}</li>
          </ul>
        </div>
      ) : (
        <div
          className="rounded-xl p-3 text-[11.5px] leading-[1.6]"
          style={{
            background: "var(--glass-info-surface)",
            border: "1px solid var(--glass-info-border)",
            color: "var(--glass-info-ink)",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold">
            <Info className="size-3.5" /> {t("tsNotEligibleBlockTitle")}
          </div>
          <ul className="list-inside list-disc space-y-1 text-[color:var(--glass-info-ink)]">
            <li>{t.rich("tsNotEligibleBlockItem1", { strong: (c) => <strong>{c}</strong> })}</li>
            <li>{t.rich("tsNotEligibleBlockItem2", { strong: (c) => <strong>{c}</strong> })}</li>
            <li>{t("tsNotEligibleBlockItem3")}</li>
          </ul>
        </div>
      )}

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
        {exporting ? t("tsPdfExporting") : t("tsPdfDownload")}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder : avant le premier calcul                             */
/* ------------------------------------------------------------------ */

function TarifSocialResultPlaceholder({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        {t("tsResultEyebrow")}
      </span>
      <div
        className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink-soft)]"
        style={{ maxWidth: 260 }}
      >
        {t.rich("tsPlaceholderInstruction", { em: (c) => <em>{c}</em> })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-[color:var(--glass-ink-faint)]">
        <Zap className="size-3.5" />
        <span>{t("tsPlaceholderElec")}</span>
        <span>·</span>
        <Flame className="size-3.5" />
        <span>{t("tsPlaceholderGaz")}</span>
      </div>
      <div className="mt-1 text-[10.5px] text-[color:var(--glass-ink-faint)]">
        {t("tsPlaceholderTarifs", {
          q: Q_REFERENCE,
          x: fmtEUR(TARIFS_2026.ELEC_SOCIAL, 5),
          y: fmtEUR(TARIFS_2026.GAZ_SOCIAL, 5),
        })}
      </div>
    </div>
  );
}
