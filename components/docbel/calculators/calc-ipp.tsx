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

const STATUTS: { value: StatutIPP; label: string }[] = [
  { value: "isole", label: "Isolé(e)" },
  { value: "marie_un_revenu", label: "Marié — un seul revenu" },
  { value: "marie_deux_revenus", label: "Marié — deux revenus" },
];

const formatTrancheBorne = (n: number) =>
  n === Infinity
    ? "∞"
    : n.toLocaleString("fr-BE", { maximumFractionDigits: 0 });

export function CalcIPP({ accent }: { accent: string }) {
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
      setError("Indiquez un revenu annuel valide.");
      return;
    }
    if (!Number.isInteger(enfantsNum) || enfantsNum < 0) {
      setError("Le nombre d'enfants doit être un entier positif.");
      return;
    }
    if (!Number.isInteger(autresNum) || autresNum < 0) {
      setError(
        "Le nombre d'autres personnes à charge doit être un entier positif.",
      );
      return;
    }
    if (!Number.isFinite(additionnelNum)) {
      setError("Indiquez un additionnel communal valide.");
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
      doc.text(`Généré le ${dateStr} à ${timeStr}`, pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        `Impôt des Personnes Physiques — EI 2026`,
        margin,
        y,
      );
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

      const statutLabel =
        STATUTS.find((s) => s.value === statut)?.label ?? statut;

      const inputs: [string, string][] = [
        ["Revenu imposable annuel", fmtEUR(parseNum(revenu))],
        ["Statut familial", statutLabel],
        ["Enfants à charge", String(parseInt(enfants, 10) || 0)],
        ["Autres personnes à charge", String(parseInt(autres, 10) || 0)],
        ["Additionnel communal", `${parseNum(additionnel)} %`],
      ];
      if (parentIsole && parseInt(enfants, 10) > 0 && statut === "isole") {
        inputs.push(["Parent isolé (allocataire seul)", "Oui"]);
      }
      if (parseNum(epargnePension) > 0) {
        inputs.push(["Épargne pension", fmtEUR(parseNum(epargnePension))]);
      }
      if (parseNum(titresServices) > 0) {
        inputs.push(["Titres-services", fmtEUR(parseNum(titresServices))]);
      }
      if (parseNum(dons) > 0) {
        inputs.push(["Dons", fmtEUR(parseNum(dons))]);
      }
      if (parseNum(pretHypo) > 0) {
        inputs.push(["Prêt hypothécaire", fmtEUR(parseNum(pretHypo))]);
      }
      if (parseNum(gardeEnfants) > 0) {
        inputs.push(["Frais garde enfants", fmtEUR(parseNum(gardeEnfants))]);
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
      doc.text("IMPÔT TOTAL ESTIMÉ", margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtEUR(result.impotTotal), margin + 4, y + 18);

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Taux moyen ${result.tauxMoyen.toFixed(1)} % · Taux marginal ${result.tauxMarginal.toFixed(0)} % · Revenu net ${fmtEUR(result.revenuNetApresImpot)}/an`,
        margin + 4,
        y + 26,
      );
      y += boxH + 8;

      // Détail
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text("Décomposition du calcul", margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const details: [string, string][] = [
        ["Quotité exemptée appliquée", fmtEUR(result.quotiteExemptee)],
        ["− Réduction liée à la quotité", `− ${fmtEUR(result.reductionQuotite)}`],
        ["Impôt fédéral brut (post-quotité)", fmtEUR(result.impotBrutFederal)],
      ];
      if (result.allegementQuotientConjugal > 0) {
        details.push([
          "− Quotient conjugal (estimation)",
          `− ${fmtEUR(result.allegementQuotientConjugal)}`,
        ]);
      }
      if (result.reductionsTotales > 0) {
        details.push([
          "− Réductions d'impôt totales",
          `− ${fmtEUR(result.reductionsTotales)}`,
        ]);
      }
      details.push([
        "Impôt après crédits",
        fmtEUR(result.impotBrutApresCredits),
      ]);
      details.push([
        "+ Additionnel communal",
        `+ ${fmtEUR(result.additionnelCommunalEur)}`,
      ]);
      if (result.cotisationSpecialeSecu > 0) {
        details.push([
          "+ Cotisation spéciale sécu",
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
      doc.text("Détail par tranche", margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      result.tranches.forEach((t, i) => {
        if (t.impotTranche <= 0.01) return;
        const min = TRANCHES_IPP_2026[i].min;
        const max =
          t.borne === Infinity
            ? "∞"
            : t.borne.toLocaleString("fr-BE", { maximumFractionDigits: 0 });
        doc.setTextColor(80, 80, 80);
        doc.text(
          `${min.toLocaleString("fr-BE")} → ${max} € (${(t.taux * 100).toFixed(0)} %)`,
          colKey,
          y,
        );
        doc.setFont("", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(fmtEUR(t.impotTranche), pageWidth - margin, y, {
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
        "Estimation pédagogique — barème fédéral IPP exercice d'imposition 2026 (revenus 2025), quotité exemptée 10 910 € (art. 131 CIR 92), suppléments enfants 1 980 / 5 110 / 11 440 / 18 510 / +7 070 € (art. 132), quotient conjugal plafonné à 13 460 € (art. 134), cotisation spéciale sécu (loi 30/03/1994). Pour le calcul officiel et personnalisé : Tax-on-web (SPF Finances).",
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
                  Impôt des Personnes Physiques
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  Simulateur IPP fédéral — exercice 2026 (revenus 2025)
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
            <CalcBadge accent={accent}>Exercice 2026</CalcBadge>
            <CalcBadge accent={accent}>Revenus 2025</CalcBadge>
          </div>

          {/* --- Section 1 : Revenus ------------------------------- */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
              1. Revenus
            </span>

            <CalcField
              id="ipp-revenu"
              label="Revenu annuel imposable net (€/an)"
              hint="Revenu après ONSS et frais pro forfaitaires. Pour un salarié : approximativement salaire annuel brut × 0,73."
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
              label="Statut familial"
              hint="Le quotient conjugal s'applique automatiquement si « marié — un seul revenu » (Art. 134 CIR 92)."
              value={statut}
              onChange={setStatut}
              options={STATUTS}
            />
          </div>

          {/* --- Section 2 : Personnes à charge --------------------- */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
              2. Personnes à charge
            </span>

            <CalcGrid cols={2}>
              <CalcField
                id="ipp-enfants"
                label="Enfants à charge"
                hint="Suppléments cumulés Art. 132 CIR 92 : 1 980 € / 5 110 € / 11 440 € / 18 510 €."
                value={enfants}
                onChange={setEnfants}
                placeholder="0"
                min={0}
                max={10}
                step={1}
              />
              <CalcField
                id="ipp-autres"
                label="Autres personnes à charge"
                hint="Parent âgé, grand-parent, frère/sœur 66+ en dépendance. 1 980 €/personne (cas générique)."
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
                    Parent isolé (allocataire seul) avec enfant(s) à charge
                  </span>
                  <span className="text-[11.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                    Supplément de quotité de 1 980 € (SPF Finances EI 2026).
                  </span>
                </div>
              </label>
            ) : null}

            <CalcField
              id="ipp-additionnel"
              label="Additionnel communal (%)"
              hint="Moyenne belge ≈ 7,5 %. Bruxelles-Ville 7 %, Anvers 7 %, Liège 8 %, Charleroi 8,5 %. Variable par commune."
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
                  ? "Masquer les réductions d'impôt"
                  : "3. Ajouter des réductions d'impôt (optionnel)"}
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
                  Indiquez les montants <strong>annuels</strong> effectivement
                  versés ou dépensés. Le simulateur applique le taux standard
                  pour chaque poste (épargne pension 30 %, titres-services ≈
                  15 %, dons 45 %, prêt hypothécaire ≈ 30 %, garde 45 %).
                </p>

                <CalcField
                  id="ipp-epargne-pension"
                  label="Épargne pension (€/an)"
                  hint={`Plafond panier de base ${fmtEUR(
                    EPARGNE_PENSION_PLAFOND,
                  )} à 30 % (réduction max = ${fmtEUR(
                    EPARGNE_PENSION_PLAFOND * 0.3,
                  )}).`}
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
                  label="Titres-services achetés (€/an)"
                  hint={`Plafond ${fmtEUR(
                    TITRES_SERVICES_PLAFOND,
                  )}. Taux réel : Wallonie 10 %, Bruxelles 15 %, Flandre 20 % (moyenne 15 %).`}
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
                  label="Dons à associations agréées (€/an)"
                  hint="Réduction 45 % à partir de 40 €/an par bénéficiaire (art. 145³³ CIR 92)."
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
                  label="Prêt hypothécaire — capital + intérêts (€/an)"
                  hint="Chèque habitation régional moyen ≈ 30 %. Varie selon région et date d'emprunt."
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
                  label="Frais de garde d'enfants (€/an)"
                  hint="Enfants < 14 ans (< 21 ans si handicap). Réduction 45 %, plafond 16,40 €/jour/enfant."
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
              Calculer mon impôt
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
                Estimation pédagogique.
              </strong>{" "}
              Pour le calcul officiel et personnalisé (revenus mobiliers et
              immobiliers, pensions alimentaires, bonus à l&apos;emploi,
              particularismes régionaux), rendez-vous sur{" "}
              <strong>Tax-on-web</strong>.
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
        Calculateur mis à jour le <strong>{lastUpdatedFr}</strong> · Exercice
        d&apos;imposition <strong>2026</strong> (revenus 2025) · Sources
        officielles :{" "}
        <a
          href="https://fin.belgium.be/fr/particuliers/declaration_impot/taux-imposition-revenus/taux-imposition"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline-offset-2 hover:underline"
        >
          SPF Finances
        </a>
        ,{" "}
        <a
          href="https://finances.belgium.be/fr/E-services/tax-on-web"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline-offset-2 hover:underline"
        >
          Tax-on-web
        </a>
        ,{" "}
        <a
          href="https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=1992041252&table_name=loi"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline-offset-2 hover:underline"
        >
          Moniteur belge — CIR 92
        </a>
        ,{" "}
        <a
          href="https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_contributions/other_specialcontributions/specialsocialsecuritycontribution.html"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline-offset-2 hover:underline"
        >
          ONSS
        </a>
        .
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
  const tranchesUtilisees = result.tranches.filter((t) => t.impotTranche > 0.01);

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
          title="Estimation indicative — barème fédéral IPP exercice 2026 (revenus 2025), SPF Finances."
          aria-label="Estimation indicative — barème fédéral IPP exercice 2026 (revenus 2025), SPF Finances."
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
          / an d&apos;impôt total estimé
        </div>
        <div className="mt-1 text-[12px] text-[color:var(--glass-ink-faint)]">
          ≈ <strong>{fmtEUR(result.impotTotal / 12)}</strong> / mois (moyenne)
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
            Taux moyen
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
            Taux marginal
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
          Revenu net après impôt
        </div>
        <div
          className="mt-1 font-extrabold"
          style={{ fontSize: 22, lineHeight: 1, color: accent }}
        >
          {fmtEUR(result.revenuNetApresImpot)}
        </div>
        <div className="mt-1 text-[11.5px] text-[color:var(--glass-ink-soft)]">
          ≈ <strong>{fmtEUR(result.revenuNetApresImpot / 12)}</strong> / mois
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
          Décomposition
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5 text-[12.5px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Quotité exemptée appliquée
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {fmtEUR(result.quotiteExemptee)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              − Réduction liée à la quotité
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              − {fmtEUR(result.reductionQuotite)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              Impôt fédéral brut (post-quotité)
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {fmtEUR(result.impotBrutFederal)}
            </span>
          </div>
          {result.allegementQuotientConjugal > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                − Quotient conjugal (Art. 134)
              </span>
              <span className="font-semibold text-[color:var(--glass-ink)]">
                − {fmtEUR(result.allegementQuotientConjugal)}
              </span>
            </div>
          ) : null}
          {result.reductionsTotales > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                − Réductions d&apos;impôt
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
              Impôt après crédits
            </span>
            <span className="font-bold text-[color:var(--glass-ink)]">
              {fmtEUR(result.impotBrutApresCredits)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[color:var(--glass-ink-soft)]">
              + Additionnel communal
            </span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              + {fmtEUR(result.additionnelCommunalEur)}
            </span>
          </div>
          {result.cotisationSpecialeSecu > 0 ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[color:var(--glass-ink-soft)]">
                + Cotisation spéciale sécu
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
            Tranches appliquées
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-[color:var(--glass-surface)] p-3 text-[11.5px]">
            {result.tranches.map((t, i) => {
              if (t.impotTranche <= 0.01) return null;
              const min = TRANCHES_IPP_2026[i].min;
              return (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-[color:var(--glass-ink-soft)]">
                    {fmtNumber(min)} → {formatTrancheBorne(t.borne)} € ·{" "}
                    <strong>{(t.taux * 100).toFixed(0)} %</strong>
                  </span>
                  <span className="font-semibold text-[color:var(--glass-ink)]">
                    {fmtEUR(t.impotTranche)}
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
          <Info className="size-3.5" /> À savoir
        </div>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Le calcul officiel se fait sur <strong>Tax-on-web</strong>{" "}
            (SPF Finances) — connexion itsme/eID.
          </li>
          <li>
            L&apos;<strong>additionnel communal</strong> varie de 0 à 9 %
            selon la commune (moyenne belge ≈ 7,5 %).
          </li>
          <li>
            La quotité exemptée de base est de{" "}
            <strong>{fmtEUR(QUOTITE_BASE_2026)}</strong> + suppléments par
            personne à charge (Art. 131 et 132 CIR 92).
          </li>
          {result.allegementQuotientConjugal > 0 ? (
            <li>
              Le <strong>quotient conjugal</strong> appliqué ici est une
              estimation : plafond de transfert{" "}
              {fmtEUR(QUOTIENT_CONJUGAL_PLAFOND)} (Art. 134 CIR 92).
            </li>
          ) : null}
        </ul>
      </div>

      {/* Avertissement haut revenu / tranche 50 % */}
      {result.tauxMarginal >= 50 ? (
        <div
          className="rounded-xl p-3 text-[11.5px] leading-[1.55]"
          style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1.5px solid rgba(245, 158, 11, 0.30)",
            color: "rgb(120, 53, 15)",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold text-[color:rgb(180,83,9)]">
            <AlertCircle className="size-3.5" />
            Vous êtes dans la tranche marginale à 50 %
          </div>
          <p className="text-[11.5px] leading-[1.55]">
            Au-delà de {fmtEUR(49840)}, chaque euro supplémentaire est imposé
            à 50 %. Les revenus mobiliers, l&apos;épargne pension et les dons
            ouvrent des réductions intéressantes — explorez les optimisations
            fiscales légales sur Tax-on-web.
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
        {exporting ? "Génération du PDF…" : "Exporter PDF"}
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
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
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
        Indiquez votre revenu annuel imposable et votre situation familiale,
        puis cliquez sur <em>« Calculer mon impôt »</em>.
      </div>
      <div className="mt-1 text-[11px] text-[color:var(--glass-ink-faint)]">
        Quotité exemptée {fmtEUR(QUOTITE_BASE_2026)} · 4 tranches fédérales ·
        EI 2026
      </div>
      <Info
        className="mt-1 size-5"
        style={{ color: "var(--glass-ink-faint)" }}
      />
    </div>
  );
}
