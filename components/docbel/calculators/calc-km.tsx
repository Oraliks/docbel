"use client";

/**
 * Calculateur "Frais kilométriques domicile-travail" — UI refondue 2026-05.
 *
 * Pattern UI aligné sur Pension + Tarif social + Pécule + Allocs Fam : layout
 * 2 colonnes (form / résultat sticky), badges officiels, export PDF, mention
 * "Mis à jour le …".
 *
 * Pourquoi ce composant : un salarié belge sur deux ignore qu'il peut opter
 * pour les frais réels et économiser plusieurs centaines d'euros d'impôt
 * s'il a un long trajet ou un abonnement SNCB / STIB / TEC / De Lijn coûteux.
 * Ici on compare instantanément la déduction km nette au forfait légal de
 * 6 070 €/an (CIR 92 art. 51, revenus 2026 / EI 2027), on intègre le plafond
 * voiture 100 km AS, le plafond vélo 3 700 €/an, la règle de non-cumul tarif
 * fonctionnaires + indemnité employeur (art. 66 CIR 92), et l'information
 * pédagogique sur les km évités par télétravail.
 *
 * La logique pure vit dans `lib/calculators/frais-km.ts` ; ici on assemble
 * les inputs et la carte de résultat.
 */

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  BadgeCheck,
  Bike,
  Bus,
  Car,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Lightbulb,
  RotateCcw,
} from "lucide-react";
import { CountryFlag } from "@/components/docbel/country-flag";
import {
  calcFraisKm,
  FORFAIT_LEGAL_FRAIS_PRO_2026,
  PLAFOND_ANNUEL_VELO_2026,
  TAUX_KM_2026,
  type FraisKmResult,
  type TransportMode,
} from "@/lib/calculators/frais-km";
import {
  CalcBadge,
  CalcCard,
  CalcError,
  CalcField,
  CalcGrid,
  CalcSelect,
  CalcSubmitButton,
  ResultRow,
  fmtEUR,
  fmtNumber,
  parseNum,
} from "./_shared";

/**
 * Date de mise à jour du calculateur — pilote l'affichage public et
 * l'alerte annuelle dans /admin/calculateurs.
 */
const LAST_UPDATED = "2026-05-25";

/** Maps value de transport → clé i18n du badge court (résolu dans le panneau). */
const TRANSPORT_BADGE_KEYS: Record<TransportMode, string> = {
  voiture: "kmBadgeVoiture",
  velo: "kmBadgeVelo",
  transports_publics: "kmBadgeTP",
  moto: "kmBadgeMoto",
  covoiturage: "kmBadgeCovoiturage",
};

/* ------------------------------------------------------------------ */
/*  Composant principal                                               */
/* ------------------------------------------------------------------ */

export function CalcKm({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");

  const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
    { value: "voiture", label: t("kmTransportVoiture") },
    { value: "velo", label: t("kmTransportVelo") },
    { value: "transports_publics", label: t("kmTransportTP") },
    { value: "moto", label: t("kmTransportMoto") },
    { value: "covoiturage", label: t("kmTransportCovoiturage") },
  ];

  const [transport, setTransport] = useState<TransportMode>("voiture");
  const [kmAllerSimple, setKmAllerSimple] = useState("25");
  const [joursParSemaine, setJoursParSemaine] = useState("5");
  const [semainesParAn, setSemainesParAn] = useState("44");
  const [coutAbonnement, setCoutAbonnement] = useState("");
  const [joursTelework, setJoursTelework] = useState("0");
  const [indemniteEmployeur, setIndemniteEmployeur] = useState("0");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [result, setResult] = useState<FraisKmResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const isTP = transport === "transports_publics";
  const isVoiture = transport === "voiture";

  const reset = () => {
    setTransport("voiture");
    setKmAllerSimple("25");
    setJoursParSemaine("5");
    setSemainesParAn("44");
    setCoutAbonnement("");
    setJoursTelework("0");
    setIndemniteEmployeur("0");
    setAdvancedOpen(false);
    setResult(null);
    setError(null);
  };

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const km = parseNum(kmAllerSimple);
    const jours = parseNum(joursParSemaine);
    const semaines = parseNum(semainesParAn);
    const abo = isTP ? parseNum(coutAbonnement) : 0;
    const telework = Number.isFinite(parseNum(joursTelework))
      ? parseNum(joursTelework)
      : 0;
    const indemnite = Number.isFinite(parseNum(indemniteEmployeur))
      ? parseNum(indemniteEmployeur)
      : 0;

    if (!Number.isFinite(km)) {
      setError(t("kmErrDistance"));
      return;
    }
    if (!Number.isFinite(jours)) {
      setError(t("kmErrJours"));
      return;
    }
    if (!Number.isFinite(semaines)) {
      setError(t("kmErrSemaines"));
      return;
    }
    if (isTP && !Number.isFinite(abo)) {
      setError(t("kmErrAbonnement"));
      return;
    }

    const res = calcFraisKm({
      kmAllerSimple: km,
      joursParSemaine: jours,
      semainesParAn: semaines,
      transport,
      coutAbonnement: abo,
      joursTelework: telework,
      indemniteEmployeurAnnuelle: indemnite,
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
      doc.text(t("kmPdfGeneratedAt", { date: dateStr, time: timeStr }), pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        t("kmPdfTitle", { modeLabel: result.modeLabel }),
        margin,
        y,
      );
      y += 10;

      // Section Inputs
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("kmPdfInputsTitle"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const inputs: [string, string][] = [
        [t("kmPdfRowMode"), result.modeLabel],
        [t("kmPdfRowDistance"), t("kmPdfDistanceValue", { n: fmtNumber(parseNum(kmAllerSimple)) })],
        [t("kmPdfRowJours"), t("kmPdfJoursValue", { n: parseNum(joursParSemaine) })],
        [t("kmPdfRowSemaines"), t("kmPdfSemainesValue", { n: parseNum(semainesParAn) })],
      ];
      if (isTP) {
        inputs.push([
          t("kmPdfRowAbonnement"),
          fmtEUR(parseNum(coutAbonnement)),
        ]);
      }
      if (parseNum(joursTelework) > 0) {
        inputs.push([
          t("kmPdfRowTelework"),
          t("kmPdfTeleworkValue", { n: parseNum(joursTelework) }),
        ]);
      }
      if (parseNum(indemniteEmployeur) > 0) {
        inputs.push([
          t("kmPdfRowIndemnite"),
          t("kmPdfIndemniteValue", { montant: fmtEUR(parseNum(indemniteEmployeur)) }),
        ]);
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

      // Encadré DÉDUCTION NETTE
      const boxH = 32;
      doc.setFillColor(232, 244, 253);
      doc.setDrawColor(15, 118, 191);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, "FD");

      doc.setFontSize(10);
      doc.setFont("", "bold");
      doc.setTextColor(12, 74, 110);
      doc.text(t("kmPdfDeductionLabel"), margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtEUR(result.deductionKmNette), margin + 4, y + 18);

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        t("kmPdfForfaitLine", {
          forfait: fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0),
          reco: result.recommandationFraisReels
            ? t("kmPdfForfaitRecoFraisReels")
            : t("kmPdfForfaitRecoForfait"),
        }),
        margin + 4,
        y + 26,
      );
      y += boxH + 8;

      // Détail
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("kmPdfDetailTitle"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const details: [string, string][] = [
        [
          t("kmPdfRowKmAnnuels"),
          t("kmPdfKmValue", { n: fmtNumber(result.kmTotalAnnuel) }),
        ],
        [
          t("kmPdfRowTaux"),
          typeof result.tauxApplique === "number"
            ? `${result.tauxApplique.toFixed(4).replace(".", ",")} €/km`
            : result.tauxApplique,
        ],
      ];
      if (result.abonnementInclus > 0) {
        details.push([
          t("kmPdfRowAbonnementDeduit"),
          fmtEUR(result.abonnementInclus),
        ]);
      }
      if (result.plafondAtteint) {
        details.push([
          isVoiture ? t("kmPdfRowPlafondVoiture") : t("kmPdfRowPlafondVelo"),
          isVoiture
            ? t("kmPdfPlafondVoitureValue")
            : t("kmPdfPlafondVeloValue", { plafond: fmtEUR(PLAFOND_ANNUEL_VELO_2026) }),
        ]);
      }
      if (result.indemniteEmployeurAnnuelle > 0) {
        details.push([t("kmPdfRowDeductionBrute"), fmtEUR(result.deductionKmBrute)]);
        details.push([
          t("kmPdfRowIndemniteSoustraire"),
          `- ${fmtEUR(result.indemniteEmployeurAnnuelle)}`,
        ]);
      }
      details.push([t("kmPdfRowDeductionNette"), fmtEUR(result.deductionKmNette)]);
      if (
        typeof result.kmTeleworkEvites === "number" &&
        result.kmTeleworkEvites > 0
      ) {
        details.push([
          t("kmPdfRowKmTelework"),
          t("kmPdfKmTeleworkValue", { n: fmtNumber(result.kmTeleworkEvites) }),
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

      // Bloc Recommandation
      if (y > pageHeight - 35) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(result.recommandationFraisReels ? 240 : 254, result.recommandationFraisReels ? 252 : 243, result.recommandationFraisReels ? 244 : 199);
      doc.setDrawColor(result.recommandationFraisReels ? 34 : 245, result.recommandationFraisReels ? 160 : 158, result.recommandationFraisReels ? 107 : 11);
      doc.setLineWidth(0.6);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, "FD");
      doc.setFontSize(10);
      doc.setFont("", "bold");
      doc.setTextColor(result.recommandationFraisReels ? 22 : 180, result.recommandationFraisReels ? 130 : 83, result.recommandationFraisReels ? 90 : 9);
      doc.text(
        result.recommandationFraisReels
          ? t("kmPdfRecoFraisReelsTitle")
          : t("kmPdfRecoForfaitTitle"),
        margin + 4,
        y + 7,
      );
      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(60, 60, 60);
      const recoTxt = doc.splitTextToSize(
        result.recommandationFraisReels
          ? t("kmPdfRecoFraisReelsBody", {
              montant: fmtEUR(result.deductionKmNette),
              forfait: fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0),
            })
          : t("kmPdfRecoForfaitBody", {
              montant: fmtEUR(result.deductionKmNette),
              forfait: fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0),
            }),
        pageWidth - margin * 2 - 8,
      );
      doc.text(recoTxt, margin + 4, y + 14);
      y += 28;

      // Footer
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setFont("", "italic");
      doc.setTextColor(120, 120, 120);
      const footer = doc.splitTextToSize(
        t("kmPdfFooter", {
          tauxVoiture: TAUX_KM_2026.voiture.toString().replace(".", ","),
          tauxForfait: (0.15).toString().replace(".", ","),
          tauxVelo: TAUX_KM_2026.velo.toString().replace(".", ","),
          plafondVelo: fmtEUR(PLAFOND_ANNUEL_VELO_2026),
          forfait: fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0),
        }),
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

      doc.save(
        `docbel-frais-kilometriques-${now.toISOString().split("T")[0]}.pdf`,
      );
    } finally {
      setExportingPDF(false);
    }
  };

  const lastUpdatedFr = new Date(LAST_UPDATED).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const TransportIcon = isVoiture
    ? Car
    : transport === "velo"
      ? Bike
      : transport === "transports_publics"
        ? Bus
        : Car;

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
                <Car className="size-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-[color:var(--glass-ink)]">
                  {t("kmTitle")}
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  {t("kmSubtitle")}
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
              title={t("kmResetForm")}
            >
              <RotateCcw className="size-3.5" />
              {t("kmReset")}
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <CalcBadge>
              <CountryFlag code="be" size={14} country={t("badgeBelgiqueCountry")} />
              {t("badgeBelgiqueCountry")}
            </CalcBadge>
            <CalcBadge accent={accent}>{t("badgeRevenus2026")}</CalcBadge>
            <CalcBadge accent={accent}>{t("badgeEi2027")}</CalcBadge>
          </div>

          {/* --- Section 1 : trajet ----------------------------- */}
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
              {t("kmSection1")}
            </span>

            <CalcField
              id="km-aller-simple"
              label={t("kmFieldDistance")}
              value={kmAllerSimple}
              onChange={setKmAllerSimple}
              placeholder="ex : 25"
              min={1}
              max={499}
              suffix={t("kmSuffixKm")}
              hint={
                isVoiture
                  ? t("kmHintDistanceVoiture")
                  : t("kmHintDistanceAutre")
              }
            />

            <CalcGrid cols={2}>
              <CalcField
                id="km-jours"
                label={t("kmFieldJours")}
                value={joursParSemaine}
                onChange={setJoursParSemaine}
                placeholder="ex : 5"
                min={1}
                max={7}
                suffix={t("kmSuffixJours")}
                hint={t("kmHintJours")}
              />
              <CalcField
                id="km-semaines"
                label={t("kmFieldSemaines")}
                value={semainesParAn}
                onChange={setSemainesParAn}
                placeholder="44"
                min={1}
                max={52}
                step={1}
                suffix={t("kmSuffixSem")}
                hint={t("kmHintSemaines")}
              />
            </CalcGrid>
          </div>

          {/* --- Section 2 : mode de transport ---------------------- */}
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
              {t("kmSection2")}
            </span>

            <CalcSelect<TransportMode>
              id="km-transport"
              label={t("kmFieldMode")}
              value={transport}
              onChange={setTransport}
              options={TRANSPORT_OPTIONS}
              hint={t("kmHintMode")}
            />

            {isTP ? (
              <CalcField
                id="km-abonnement"
                label={t("kmFieldAbonnement")}
                value={coutAbonnement}
                onChange={setCoutAbonnement}
                placeholder="ex : 750"
                min={0}
                suffix="€"
                hint={t("kmHintAbonnement")}
              />
            ) : null}

            {!isTP ? (
              <CalcField
                id="km-indemnite-employeur"
                label={t("kmFieldIndemnite")}
                value={indemniteEmployeur}
                onChange={setIndemniteEmployeur}
                placeholder="ex : 0"
                min={0}
                suffix="€"
                hint={
                  isVoiture
                    ? t("kmHintIndemniteVoiture")
                    : t("kmHintIndemniteAutre")
                }
              />
            ) : null}
          </div>

          {/* --- Section 3 : avancé (collapsable) -------------------- */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="inline-flex w-fit items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)] transition hover:text-[color:var(--glass-ink)]"
            >
              {t("kmSection3")}
              {advancedOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
            {advancedOpen ? (
              <CalcField
                id="km-telework"
                label={t("kmFieldTelework")}
                value={joursTelework}
                onChange={setJoursTelework}
                placeholder="ex : 2"
                min={0}
                max={5}
                suffix={t("kmSuffixJours")}
                hint={t("kmHintTelework")}
              />
            ) : null}
          </div>

          {error ? <CalcError>{error}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={handleCalc}>
              {t("kmSubmit")}
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
              {t("kmResetForm")}
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
              {t.rich("kmDisclaimer", {
                b: (chunks) => (
                  <strong className="text-[color:var(--glass-ink)]">
                    {chunks}
                  </strong>
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
              <KmResultPanel
                result={result}
                accent={accent}
                transport={transport}
                onExportPDF={handleExportPDF}
                exporting={exportingPDF}
                TransportIcon={TransportIcon}
              />
            ) : (
              <KmResultPlaceholder accent={accent} />
            )}
          </CalcCard>
        </div>
      </div>

      {/* Footer : Mise à jour + sources */}
      <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
        {t.rich("kmFooter", {
          date: lastUpdatedFr,
          b: (chunks) => <strong>{chunks}</strong>,
          spf: () => (
            <a
              href="https://fin.belgium.be/fr/particuliers/declaration-impot/revenus/indemnites-frais-deplacement-domicile-lieu-travail"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {t("kmFooterSpf")}
            </a>
          ),
          mob: () => (
            <a
              href="https://mobilit.belgium.be/fr/mobilite-durable/velos/avantages-fiscaux-et-primes-velo"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {t("kmFooterMob")}
            </a>
          ),
          bosa: () => (
            <a
              href="https://bosa.belgium.be/fr/themes/travailler-dans-la-fonction-publique/remuneration-et-avantages/allocations-et-indemnites-13"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {t("kmFooterBosa")}
            </a>
          ),
          mb: () => (
            <a
              href="https://www.ejustice.just.fgov.be"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted"
            >
              {t("kmFooterMb")}
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

function KmResultPanel({
  result,
  accent,
  transport,
  onExportPDF,
  exporting,
  TransportIcon,
}: {
  result: FraisKmResult;
  accent: string;
  transport: TransportMode;
  onExportPDF: () => void;
  exporting: boolean;
  TransportIcon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  const t = useTranslations("public.outils");
  const tk = (key: string) => t(key as Parameters<typeof t>[0]);
  const isVoiture = transport === "voiture";
  const isVelo = transport === "velo";
  const isTP = transport === "transports_publics";
  const voitureForfaitForcé =
    isVoiture &&
    result.indemniteEmployeurAnnuelle > 0 &&
    typeof result.tauxApplique === "number" &&
    result.tauxApplique === 0.15;

  const veloPlafondAtteint = isVelo && result.plafondAtteint;
  const recoTone = result.recommandationFraisReels ? "success" : "warning";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: accent }}
        >
          {t("kmResultEyebrow")}
        </span>
        <span
          className="inline-flex items-center"
          title={t("kmResultAria")}
          aria-label={t("kmResultAria")}
        >
          <Info
            className="size-4"
            style={{ color: "var(--glass-ink-faint)" }}
          />
        </span>
      </div>

      {/* Badge mode */}
      <div
        className="inline-flex w-fit items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.04em]"
        style={{
          borderColor: `${accent}55`,
          background: `${accent}15`,
          color: accent,
        }}
      >
        <TransportIcon className="size-3.5" />
        {tk(TRANSPORT_BADGE_KEYS[transport])}
      </div>

      {/* Headline : déduction nette */}
      <div>
        <div
          className="font-extrabold tracking-[-0.5px] text-[color:var(--glass-ink)]"
          style={{ fontSize: 36, lineHeight: 1.05 }}
        >
          {fmtEUR(result.deductionKmNette)}
        </div>
        <div
          className="mt-1 text-[13px] font-semibold"
          style={{ color: "var(--glass-ink-soft)" }}
        >
          {t("kmHeadlineSuffix")}
        </div>
        <div className="mt-1 text-[12.5px] text-[color:var(--glass-ink-soft)]">
          {isTP
            ? t.rich("kmHeadlineTP", {
                n: fmtNumber(result.kmTotalAnnuel),
                strong: (chunks) => <strong>{chunks}</strong>,
              })
            : t.rich("kmHeadlineAutre", {
                n: fmtNumber(result.kmTotalAnnuel),
                taux:
                  typeof result.tauxApplique === "number"
                    ? `${result.tauxApplique.toFixed(4).replace(".", ",")} €/km`
                    : result.tauxApplique,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
        </div>
      </div>

      {/* Comparaison forfait légal */}
      <div
        className="rounded-xl border-[1.5px] p-3 text-[11.5px] leading-[1.55]"
        style={{
          borderColor: `var(--glass-${recoTone}-border)`,
          background: `var(--glass-${recoTone}-surface)`,
          color: `var(--glass-${recoTone}-ink)`,
        }}
      >
        <div className="mb-1 flex items-center gap-1.5 font-bold">
          {result.recommandationFraisReels ? (
            <>
              <BadgeCheck className="size-3.5" />
              {t("kmRecoFraisReelsTitle")}
            </>
          ) : (
            <>
              <AlertCircle className="size-3.5" />
              {t("kmRecoForfaitTitle")}
            </>
          )}
        </div>
        <p className="text-[11.5px] leading-[1.55]">
          {result.recommandationFraisReels
            ? t("kmRecoFraisReelsBody", {
                montant: fmtEUR(result.deductionKmNette),
                forfait: fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0),
              })
            : t("kmRecoForfaitBody", {
                montant: fmtEUR(result.deductionKmNette),
                forfait: fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0),
              })}
        </p>
      </div>

      {/* Détail du calcul */}
      <div
        className="border-t pt-3"
        style={{ borderTopColor: "var(--glass-ink-line)" }}
      >
        <div
          className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.06em]"
          style={{ color: "var(--glass-ink-faint)" }}
        >
          {t("kmDetailTitle")}
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5 text-[12.5px]">
          <ResultRow
            label={t("kmRowMode")}
            value={result.modeLabel}
          />
          <ResultRow
            label={t("kmRowKmAnnuels")}
            value={t("kmRowKmValue", { n: fmtNumber(result.kmTotalAnnuel) })}
          />
          {result.abonnementInclus > 0 ? (
            <ResultRow
              label={t("kmRowAbonnement")}
              value={fmtEUR(result.abonnementInclus)}
            />
          ) : (
            <ResultRow
              label={t("kmRowTaux")}
              value={
                typeof result.tauxApplique === "number"
                  ? `${result.tauxApplique.toFixed(4).replace(".", ",")} €/km`
                  : result.tauxApplique
              }
            />
          )}
          {result.plafondAtteint && isVoiture ? (
            <ResultRow
              label={t("kmRowPlafondVoiture")}
              value={t("kmRowPlafondVoitureValue")}
              emphasis
            />
          ) : null}
          {veloPlafondAtteint ? (
            <ResultRow
              label={t("kmRowPlafondVelo")}
              value={t("kmRowPlafondVeloValue", { plafond: fmtEUR(PLAFOND_ANNUEL_VELO_2026) })}
              emphasis
            />
          ) : null}
          {result.indemniteEmployeurAnnuelle > 0 ? (
            <>
              <ResultRow
                label={t("kmRowDeductionBrute")}
                value={fmtEUR(result.deductionKmBrute)}
              />
              <ResultRow
                label={t("kmRowIndemnite")}
                value={fmtEUR(result.indemniteEmployeurAnnuelle)}
                direction="minus"
              />
              <ResultRow
                label={t("kmRowDeductionNette")}
                value={fmtEUR(result.deductionKmNette)}
                direction="plus"
                emphasis
              />
            </>
          ) : (
            <ResultRow
              label={t("kmRowDeductionAnnuelle")}
              value={fmtEUR(result.deductionKmNette)}
              emphasis
            />
          )}
        </div>
      </div>

      {/* Km évités télétravail (info pédago) */}
      {typeof result.kmTeleworkEvites === "number" &&
      result.kmTeleworkEvites > 0 ? (
        <div
          className="rounded-xl p-3 text-[11.5px] leading-[1.55]"
          style={{
            background: "var(--glass-info-surface)",
            border: "1px solid var(--glass-info-border)",
            color: "var(--glass-info-ink)",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold">
            <Lightbulb className="size-3.5" />
            {t("kmTeleworkTitle")}
          </div>
          <p className="text-[color:var(--glass-info-ink)]">
            {t.rich("kmTeleworkBody", {
              n: fmtNumber(result.kmTeleworkEvites),
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
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
          <Info className="size-3.5" /> {t("kmToKnow")}
        </div>
        <ul className="list-inside list-disc space-y-1">
          <li>
            {t.rich("kmToKnowForfait", {
              forfait: fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0),
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          {isVoiture ? (
            <li>
              {voitureForfaitForcé
                ? t.rich("kmToKnowVoitureForce", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })
                : t.rich("kmToKnowVoiture", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
            </li>
          ) : null}
          {isVelo ? (
            <li>
              {t.rich("kmToKnowVelo", {
                plafond: fmtEUR(PLAFOND_ANNUEL_VELO_2026),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          ) : null}
          {isTP ? (
            <li>
              {t.rich("kmToKnowTP", {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </li>
          ) : null}
          <li>
            {t.rich("kmToKnowTaxOnWeb", {
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
        {exporting ? t("kmGeneratingPdf") : t("kmDownloadPdf")}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder : avant le premier calcul                             */
/* ------------------------------------------------------------------ */

function KmResultPlaceholder({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        {t("kmResultEyebrow")}
      </span>
      <div
        className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink-soft)]"
        style={{ maxWidth: 260 }}
      >
        {t.rich("kmPlaceholderText", {
          em: (chunks) => <em>{chunks}</em>,
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-[color:var(--glass-ink-faint)]">
        <Car className="size-3.5" />
        <span>{t("kmPlaceholderVoiture")}</span>
        <span>·</span>
        <Bike className="size-3.5" />
        <span>{t("kmPlaceholderVelo")}</span>
        <span>·</span>
        <Bus className="size-3.5" />
        <span>{t("kmPlaceholderTP")}</span>
      </div>
      <div className="mt-1 text-[10.5px] text-[color:var(--glass-ink-faint)]">
        {t("kmPlaceholderRates", {
          voiture: TAUX_KM_2026.voiture.toString().replace(".", ","),
          velo: TAUX_KM_2026.velo.toString().replace(".", ","),
        })}
      </div>
    </div>
  );
}
