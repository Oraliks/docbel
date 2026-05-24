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
      setError("Indiquez votre date de naissance.");
      return;
    }
    if (!Number.isFinite(carriere)) {
      setError("Indiquez un nombre d'années de carrière valide.");
      return;
    }
    if (periodesAssimilees && !Number.isFinite(assimilees)) {
      setError(
        "Indiquez un nombre d'années assimilées valide (ou laissez vide).",
      );
      return;
    }
    if (!Number.isFinite(salaire)) {
      setError("Indiquez un salaire annuel moyen valide.");
      return;
    }
    if (!Number.isFinite(age)) {
      setError("Indiquez un âge de départ valide.");
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
      doc.text(`Généré le ${dateStr} à ${timeStr}`, pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(`Estimation Pension légale 2026 — ${result.statutLabel}`, margin, y);
      y += 10;

      // Section Inputs
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text("Paramètres saisis", margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const carriereTotale = result.carriereTotale;
      const inputs: [string, string][] = [
        ["Date de naissance", new Date(dateNaissance).toLocaleDateString("fr-BE")],
        ["Statut civil", result.statutLabel],
        ["Carrière effective", `${result.anneesCarriere} ans`],
        ["Périodes assimilées", `${fmtNumber(result.periodesAssimilees, result.periodesAssimilees % 1 === 0 ? 0 : 1)} ans`],
        ["Carrière totale", `${fmtNumber(carriereTotale, carriereTotale % 1 === 0 ? 0 : 1)} ans`],
        ["Salaire annuel moyen", fmtEUR(parseNum(salaireMoyen))],
        ["Âge de départ envisagé", `${result.ageDepart} ans`],
        ["Âge légal de pension", `${result.ageLegal} ans`],
        ["Âge effectif retenu", `${result.ageEffectif} ans`],
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
      doc.text("PENSION MENSUELLE BRUTE ESTIMÉE", margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtEUR(result.pensionMensuelle), margin + 4, y + 17);

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Soit environ ${fmtEUR(result.pensionAnnuelle)} / an (brut, avant impôt)`,
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
        doc.text("Départ anticipé non éligible", margin + 4, y + 7);
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
      doc.text("Détail du calcul", margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const details: [string, string][] = [
        [
          "Carrière prise en compte",
          `${fmtNumber(Math.min(carriereTotale, 45), carriereTotale % 1 === 0 ? 0 : 1)} / 45 ans${result.longueCarriere ? " (plafonnée)" : ""}`,
        ],
        [
          "Salaire pris en compte",
          result.plafondAtteint
            ? `${fmtEUR(PLAFOND_SALARIAL_2026)} (plafonné)`
            : fmtEUR(parseNum(salaireMoyen)),
        ],
        ["Taux applicable", result.statutLabel],
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
        "Estimation indicative — formule officielle SFP (taux × carrière / 45). Plafond salarial 2026 et minimum garanti post-indexation mars 2026. Conditions d'anticipation conformes à la loi du 10 août 2015. Pour le calcul officiel et personnalisé : mypension.be. Sources : SFP, mypension.be, Moniteur belge.",
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
                  Pension légale estimée
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  Salarié belge — formule officielle SFP 2026
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
              title="Réinitialiser le formulaire"
            >
              <RotateCcw className="size-3.5" />
              Réinitialiser
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <CalcBadge>
              <CountryFlag code="be" size={14} country="Belgique" />
              Belgique
            </CalcBadge>
            <CalcBadge accent={accent}>Salarié 2026</CalcBadge>
            <CalcBadge accent={accent}>Données 2026</CalcBadge>
          </div>

          {/* Date de naissance */}
          <CalcField
            id="pension-naissance"
            label="Date de naissance"
            type="date"
            value={dateNaissance}
            onChange={setDateNaissance}
            hint="Détermine automatiquement l'âge légal (65, 66 ou 67 ans selon la loi du 10/08/2015)."
          />

          {/* Carrière + Assimilées */}
          <CalcGrid cols={2}>
            <CalcField
              id="pension-carriere"
              label="Années de carrière effectives"
              value={anneesCarriere}
              onChange={setAnneesCarriere}
              placeholder="ex : 42"
              min={0}
              max={50}
              suffix="ans"
              hint="Années réellement travaillées — hors périodes assimilées."
            />
            <CalcField
              id="pension-assimilees"
              label="Périodes assimilées"
              value={periodesAssimilees}
              onChange={setPeriodesAssimilees}
              placeholder="0"
              min={0}
              max={15}
              suffix="ans"
              hint="Chômage, maladie, congé parental, service militaire, crédit-temps reconnu."
            />
          </CalcGrid>

          {/* Salaire + Âge */}
          <CalcGrid cols={2}>
            <CalcField
              id="pension-salaire"
              label="Salaire annuel brut moyen"
              value={salaireMoyen}
              onChange={setSalaireMoyen}
              placeholder="ex : 45000"
              min={0}
              max={200000}
              step={1000}
              suffix="€"
              hint="Moyenne sur l'ensemble de la carrière (pas le dernier salaire). Plafonné à 69 521 €/an en 2026."
            />
            <CalcField
              id="pension-age-depart"
              label="Âge de départ envisagé"
              value={ageDepart}
              onChange={setAgeDepart}
              placeholder="ex : 65"
              min={60}
              max={70}
              suffix="ans"
              hint="Entre 60 et 70 ans. Le départ anticipé exige une carrière minimum."
            />
          </CalcGrid>

          {/* Statut */}
          <YesNoToggle
            label="Taux ménage ?"
            hint="Taux ménage (75 %) si conjoint sans revenu propre suffisant. Sinon taux isolé (60 %)."
            value={statutMenage}
            onChange={setStatutMenage}
            accent={accent}
            yesLabel="Ménage (75 %)"
            noLabel="Isolé (60 %)"
          />

          {error ? <CalcError>{error}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={handleCalc}>
              Estimer ma pension
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
              Réinitialiser le formulaire
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
              <strong className="text-[color:var(--glass-ink)]">
                Estimation indicative.
              </strong>{" "}
              Pour le calcul officiel et personnalisé, basé sur votre compte de
              carrière complet, rendez-vous sur <strong>mypension.be</strong>.
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
        Calculateur mis à jour le <strong>{lastUpdatedFr}</strong> · Données
        2026 · Sources officielles : SFP (Service Fédéral des Pensions),
        mypension.be, Moniteur belge.
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
  accent,
  onExportPDF,
  exporting,
}: {
  result: PensionResult;
  salaireSaisi: number;
  accent: string;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  const inelig =
    result.eligibiliteAnticipee.possible === false
      ? result.eligibiliteAnticipee
      : null;

  // Détection du type de calcul appliqué (sert juste à l'affichage du badge).
  // On considère plafond atteint si la mensuelle est très proche du plafond
  // applicable (3500 isolé / 4350 ménage).
  const isMenage = result.statutLabel.startsWith("Ménage");
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

  let typeCalculLabel = "Calcul standard";
  if (plafondPensionAtteint) typeCalculLabel = "Plafond pension atteint";
  else if (minimumAppliquerait) typeCalculLabel = "Minimum garanti appliqué";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: accent }}
        >
          Résultat estimatif
        </span>
        <span
          className="inline-flex items-center"
          title="Estimation indicative — formule SFP officielle"
          aria-label="Estimation indicative — formule SFP officielle"
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
          / mois (brut, avant impôt)
        </div>
        <div className="mt-1 text-[12.5px] text-[color:var(--glass-ink-soft)]">
          ≈ <strong>{fmtEUR(result.pensionAnnuelle)}</strong> / an
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CalcBadge accent={accent}>{typeCalculLabel}</CalcBadge>
          {result.plafondAtteint ? (
            <CalcBadge accent={accent}>Salaire plafonné</CalcBadge>
          ) : null}
          {result.longueCarriere ? (
            <CalcBadge accent={accent}>Longue carrière</CalcBadge>
          ) : null}
        </div>
      </div>

      {/* Bloc rouge/orange si départ anticipé refusé */}
      {inelig ? (
        <div
          className="rounded-xl p-3.5 text-[12px] leading-[1.55]"
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1.5px solid rgba(245, 158, 11, 0.35)",
            color: "rgb(120, 53, 15)",
          }}
        >
          <div className="mb-1.5 flex items-center gap-1.5 font-bold text-[color:rgb(180,83,9)]">
            <AlertCircle className="size-3.5" />
            Départ anticipé à {result.ageDepart} ans impossible
          </div>
          <p className="text-[11.5px] leading-[1.6]">
            {inelig.raison ??
              `La pension anticipée n'est pas accessible avant 60 ans.`}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-[1.6]">
            Le calcul ci-dessus est fait à l'<strong>âge légal</strong> (
            {result.ageLegal} ans) à titre informatif.
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
          Détail du calcul
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5 text-[12.5px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Carrière effective
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {result.anneesCarriere} ans
            </span>
          </div>
          {result.periodesAssimilees > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                Périodes assimilées
              </span>
              <span className="font-semibold text-[color:var(--glass-ink)]">
                {fmtNumber(
                  result.periodesAssimilees,
                  result.periodesAssimilees % 1 === 0 ? 0 : 1,
                )}{" "}
                ans
              </span>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Carrière totale prise en compte
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {fmtNumber(
                Math.min(result.carriereTotale, 45),
                result.carriereTotale % 1 === 0 ? 0 : 1,
              )}{" "}
              / 45 ans
              {result.longueCarriere ? " (plafonnée)" : ""}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Salaire pris en compte
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {result.plafondAtteint
                ? `${fmtEUR(69521)} (plafonné)`
                : fmtEUR(salaireSaisi)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Taux applicable
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {result.statutLabel}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Âge légal de pension
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {result.ageLegal} ans
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Âge effectivement retenu
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {result.ageEffectif} ans
              {result.ageEffectif !== result.ageDepart ? " (âge légal)" : ""}
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
          <Info className="size-3.5" /> À savoir
        </div>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Votre <strong>compte de carrière officiel</strong> est consultable
            sur <strong>mypension.be</strong> (login itsme).
          </li>
          <li>
            Les <strong>périodes assimilées</strong> (chômage indemnisé,
            maladie de longue durée, congé parental, service militaire,
            crédit-temps reconnu) comptent dans la carrière.
          </li>
          <li>
            Le régime salarié <strong>ne prévoit pas de bonus</strong> pour les
            carrières longues (&gt; 45 ans) : la formule plafonne à 45/45.
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
        {exporting ? "Génération du PDF…" : "Télécharger le détail (PDF)"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder : avant le premier calcul                             */
/* ------------------------------------------------------------------ */

function PensionResultPlaceholder({ accent }: { accent: string }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        Résultat estimatif
      </span>
      <div
        className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink-soft)]"
        style={{ maxWidth: 260 }}
      >
        Renseignez votre date de naissance, votre carrière et votre salaire
        moyen, puis cliquez sur <em>« Estimer ma pension »</em>.
      </div>
      <Info
        className="mt-1 size-5"
        style={{ color: "var(--glass-ink-faint)" }}
      />
    </div>
  );
}
