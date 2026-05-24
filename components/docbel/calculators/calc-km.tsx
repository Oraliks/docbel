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

const TRANSPORT_OPTIONS: { value: TransportMode; label: string }[] = [
  { value: "voiture", label: "Voiture personnelle" },
  { value: "velo", label: "Vélo (y compris électrique)" },
  {
    value: "transports_publics",
    label: "Transports publics (SNCB / STIB / TEC / De Lijn)",
  },
  { value: "moto", label: "Moto" },
  { value: "covoiturage", label: "Covoiturage (passager)" },
];

const TRANSPORT_BADGE: Record<TransportMode, string> = {
  voiture: "Voiture",
  velo: "Vélo",
  transports_publics: "Transports publics",
  moto: "Moto",
  covoiturage: "Covoiturage",
};

/* ------------------------------------------------------------------ */
/*  Composant principal                                               */
/* ------------------------------------------------------------------ */

export function CalcKm({ accent }: { accent: string }) {
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
      setError("Indiquez une distance domicile-travail valide.");
      return;
    }
    if (!Number.isFinite(jours)) {
      setError("Indiquez un nombre de jours par semaine valide.");
      return;
    }
    if (!Number.isFinite(semaines)) {
      setError("Indiquez un nombre de semaines par an valide.");
      return;
    }
    if (isTP && !Number.isFinite(abo)) {
      setError("Indiquez le coût annuel de votre abonnement.");
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
      doc.text(`Généré le ${dateStr} à ${timeStr}`, pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        `Frais kilométriques domicile-travail — ${result.modeLabel}`,
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

      const inputs: [string, string][] = [
        ["Mode de transport", result.modeLabel],
        ["Distance aller simple", `${fmtNumber(parseNum(kmAllerSimple))} km`],
        ["Jours sur place / semaine", `${parseNum(joursParSemaine)} j`],
        ["Semaines / an", `${parseNum(semainesParAn)} sem`],
      ];
      if (isTP) {
        inputs.push([
          "Coût annuel abonnement",
          fmtEUR(parseNum(coutAbonnement)),
        ]);
      }
      if (parseNum(joursTelework) > 0) {
        inputs.push([
          "Jours de télétravail / semaine",
          `${parseNum(joursTelework)} j (info)`,
        ]);
      }
      if (parseNum(indemniteEmployeur) > 0) {
        inputs.push([
          "Indemnité employeur reçue",
          `${fmtEUR(parseNum(indemniteEmployeur))} / an`,
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
      doc.text("DÉDUCTION FISCALE ANNUELLE ESTIMÉE", margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtEUR(result.deductionKmNette), margin + 4, y + 18);

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Forfait légal CIR 92 art. 51 : ${fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)} / an — ${result.recommandationFraisReels ? "frais réels avantageux" : "forfait légal probablement préférable"}`,
        margin + 4,
        y + 26,
      );
      y += boxH + 8;

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
          "Kilomètres annuels (aller-retour)",
          `${fmtNumber(result.kmTotalAnnuel)} km`,
        ],
        [
          "Taux appliqué",
          typeof result.tauxApplique === "number"
            ? `${result.tauxApplique.toFixed(4).replace(".", ",")} €/km`
            : result.tauxApplique,
        ],
      ];
      if (result.abonnementInclus > 0) {
        details.push([
          "Abonnement déduit (100 %)",
          fmtEUR(result.abonnementInclus),
        ]);
      }
      if (result.plafondAtteint) {
        details.push([
          isVoiture ? "Plafond 100 km aller simple" : "Plafond vélo annuel",
          isVoiture
            ? "Atteint — excédent à 0,15 €/km"
            : `Atteint — capé à ${fmtEUR(PLAFOND_ANNUEL_VELO_2026)}/an`,
        ]);
      }
      if (result.indemniteEmployeurAnnuelle > 0) {
        details.push(["Déduction brute", fmtEUR(result.deductionKmBrute)]);
        details.push([
          "Indemnité employeur (à soustraire)",
          `- ${fmtEUR(result.indemniteEmployeurAnnuelle)}`,
        ]);
      }
      details.push(["Déduction nette", fmtEUR(result.deductionKmNette)]);
      if (
        typeof result.kmTeleworkEvites === "number" &&
        result.kmTeleworkEvites > 0
      ) {
        details.push([
          "Km évités par télétravail (info)",
          `${fmtNumber(result.kmTeleworkEvites)} km / an`,
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
          ? "Frais réels probablement avantageux"
          : "Forfait légal probablement plus avantageux",
        margin + 4,
        y + 7,
      );
      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(60, 60, 60);
      const recoTxt = doc.splitTextToSize(
        result.recommandationFraisReels
          ? `Votre déduction kilométrique nette (${fmtEUR(result.deductionKmNette)}) couvre déjà une part importante du forfait légal (${fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}). Ajoutez vos autres frais réels — si le total dépasse le forfait, optez pour les frais réels dans la déclaration (cases 1254/2254).`
          : `Votre déduction kilométrique nette (${fmtEUR(result.deductionKmNette)}) reste inférieure au forfait légal automatique (${fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}). L'option pour les frais réels n'est intéressante que si la somme totale (km + autres frais pro) dépasse ce forfait.`,
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
        `Estimation indicative — barèmes 2026 (revenus 2026 / EI 2027). Voiture : tarif fonctionnaires Q2 2026 ${(TAUX_KM_2026.voiture).toString().replace(".", ",")} €/km (circulaire BOSA n° 764) ou forfait CIR 92 art. 66 ${(0.15).toString().replace(".", ",")} €/km si l'employeur verse une indemnité km. Vélo ${(TAUX_KM_2026.velo).toString().replace(".", ",")} €/km plafonné à ${fmtEUR(PLAFOND_ANNUEL_VELO_2026)}/an. Forfait légal CIR 92 art. 51 : ${fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}/an. Sources : SPF Finances, SPF Mobilité, Moniteur belge.`,
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
                  Frais kilométriques domicile-travail
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  Déduction fiscale 2026 — voiture, vélo, transports publics
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
            <CalcBadge accent={accent}>Revenus 2026</CalcBadge>
            <CalcBadge accent={accent}>EI 2027</CalcBadge>
          </div>

          {/* --- Section 1 : trajet ----------------------------- */}
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
              1. Votre trajet
            </span>

            <CalcField
              id="km-aller-simple"
              label="Distance domicile-travail (aller simple)"
              value={kmAllerSimple}
              onChange={setKmAllerSimple}
              placeholder="ex : 25"
              min={1}
              max={499}
              suffix="km"
              hint={
                isVoiture
                  ? "Voiture / covoiturage : tarif préférentiel jusqu'à 100 km aller simple ; au-delà = 0,15 €/km."
                  : "Trajet aller simple — multiplié × 2 pour le retour."
              }
            />

            <CalcGrid cols={2}>
              <CalcField
                id="km-jours"
                label="Jours sur place / semaine"
                value={joursParSemaine}
                onChange={setJoursParSemaine}
                placeholder="ex : 5"
                min={1}
                max={7}
                suffix="j"
                hint="Jours physiquement présents au travail (hors télétravail)."
              />
              <CalcField
                id="km-semaines"
                label="Semaines / an"
                value={semainesParAn}
                onChange={setSemainesParAn}
                placeholder="44"
                min={1}
                max={52}
                step={1}
                suffix="sem"
                hint="52 − vacances − maladie. Défaut 44."
              />
            </CalcGrid>
          </div>

          {/* --- Section 2 : mode de transport ---------------------- */}
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
              2. Mode de transport
            </span>

            <CalcSelect<TransportMode>
              id="km-transport"
              label="Mode principal"
              value={transport}
              onChange={setTransport}
              options={TRANSPORT_OPTIONS}
              hint="En cas de combinaison (ex: voiture + train), choisissez le mode majoritaire."
            />

            {isTP ? (
              <CalcField
                id="km-abonnement"
                label="Coût annuel de l'abonnement"
                value={coutAbonnement}
                onChange={setCoutAbonnement}
                placeholder="ex : 750"
                min={0}
                suffix="€"
                hint="100 % du coût est déductible (SNCB, STIB, TEC, De Lijn — opérateurs publics)."
              />
            ) : null}

            {!isTP ? (
              <CalcField
                id="km-indemnite-employeur"
                label="Indemnité km annuelle reçue de l'employeur"
                value={indemniteEmployeur}
                onChange={setIndemniteEmployeur}
                placeholder="ex : 0"
                min={0}
                suffix="€"
                hint={
                  isVoiture
                    ? "Si > 0 → bascule automatique vers le forfait 0,15 €/km (CIR 92 art. 66, cumul interdit) + soustraction du montant reçu."
                    : "Soustraite de la déduction brute (règle de non-cumul)."
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
              3. Avancé (télétravail)
              {advancedOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
            {advancedOpen ? (
              <CalcField
                id="km-telework"
                label="Jours de télétravail / semaine"
                value={joursTelework}
                onChange={setJoursTelework}
                placeholder="ex : 2"
                min={0}
                max={5}
                suffix="j"
                hint="Pédagogique : ne réduit pas la déduction (les jours sur place sont déjà comptés ci-dessus). Affiche les km évités à titre informatif."
              />
            ) : null}
          </div>

          {error ? <CalcError>{error}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={handleCalc}>
              Calculer ma déduction
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
              Pour optimiser votre déclaration, simulez sur{" "}
              <strong>Tax-on-web (MyMinfin)</strong> ou consultez votre
              comptable. Les frais réels exigent des justificatifs.
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
        Calculateur mis à jour le <strong>{lastUpdatedFr}</strong> · Revenus
        2026 / EI 2027 · Sources officielles :{" "}
        <a
          href="https://fin.belgium.be/fr/particuliers/declaration-impot/revenus/indemnites-frais-deplacement-domicile-lieu-travail"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted"
        >
          SPF Finances
        </a>
        ,{" "}
        <a
          href="https://mobilit.belgium.be/fr/mobilite-durable/velos/avantages-fiscaux-et-primes-velo"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted"
        >
          SPF Mobilité
        </a>
        ,{" "}
        <a
          href="https://bosa.belgium.be/fr/themes/travailler-dans-la-fonction-publique/remuneration-et-avantages/allocations-et-indemnites-13"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted"
        >
          BOSA (circulaire indemnité km)
        </a>
        ,{" "}
        <a
          href="https://www.ejustice.just.fgov.be"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted"
        >
          Moniteur belge (CIR 92)
        </a>
        .
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
  const isVoiture = transport === "voiture";
  const isVelo = transport === "velo";
  const isTP = transport === "transports_publics";
  const voitureForfaitForcé =
    isVoiture &&
    result.indemniteEmployeurAnnuelle > 0 &&
    typeof result.tauxApplique === "number" &&
    result.tauxApplique === 0.15;

  const veloPlafondAtteint = isVelo && result.plafondAtteint;
  const recoColor = result.recommandationFraisReels ? "#22a06b" : "#a87b1a";

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
          title="Estimation indicative — barèmes revenus 2026 / EI 2027"
          aria-label="Estimation indicative — barèmes revenus 2026 / EI 2027"
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
        {TRANSPORT_BADGE[transport]}
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
          / an de déduction fiscale estimée
        </div>
        <div className="mt-1 text-[12.5px] text-[color:var(--glass-ink-soft)]">
          {isTP ? (
            <>
              Abonnement déduit à 100 % —{" "}
              <strong>{fmtNumber(result.kmTotalAnnuel)} km</strong> parcourus à
              titre indicatif
            </>
          ) : (
            <>
              <strong>{fmtNumber(result.kmTotalAnnuel)} km/an</strong> au taux
              de{" "}
              <strong>
                {typeof result.tauxApplique === "number"
                  ? `${result.tauxApplique.toFixed(4).replace(".", ",")} €/km`
                  : result.tauxApplique}
              </strong>
            </>
          )}
        </div>
      </div>

      {/* Comparaison forfait légal */}
      <div
        className="rounded-xl border-[1.5px] p-3 text-[11.5px] leading-[1.55]"
        style={{
          borderColor: `${recoColor}55`,
          background: `${recoColor}10`,
          color: recoColor,
        }}
      >
        <div className="mb-1 flex items-center gap-1.5 font-bold">
          {result.recommandationFraisReels ? (
            <>
              <BadgeCheck className="size-3.5" />
              Frais réels probablement avantageux
            </>
          ) : (
            <>
              <AlertCircle className="size-3.5" />
              Forfait légal probablement plus avantageux
            </>
          )}
        </div>
        <p className="text-[11.5px] leading-[1.55]">
          {result.recommandationFraisReels ? (
            <>
              Votre déduction km nette ({fmtEUR(result.deductionKmNette)})
              couvre déjà une part importante du forfait légal (
              {fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}/an). Ajoutez vos autres
              frais réels — si le total dépasse, optez pour les frais réels
              (cases 1254/2254).
            </>
          ) : (
            <>
              Votre déduction km nette ({fmtEUR(result.deductionKmNette)})
              reste inférieure au forfait légal automatique (
              {fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}/an). L&apos;option
              frais réels n&apos;est intéressante que si la somme totale dépasse
              ce forfait.
            </>
          )}
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
          Détail du calcul
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-[color:var(--glass-surface)] p-3.5 text-[12.5px]">
          <ResultRow
            label="Mode de transport"
            value={result.modeLabel}
          />
          <ResultRow
            label="Km annuels (aller-retour × jours × sem)"
            value={`${fmtNumber(result.kmTotalAnnuel)} km`}
          />
          {result.abonnementInclus > 0 ? (
            <ResultRow
              label="Abonnement déduit (100 %)"
              value={fmtEUR(result.abonnementInclus)}
            />
          ) : (
            <ResultRow
              label="Taux appliqué"
              value={
                typeof result.tauxApplique === "number"
                  ? `${result.tauxApplique.toFixed(4).replace(".", ",")} €/km`
                  : result.tauxApplique
              }
            />
          )}
          {result.plafondAtteint && isVoiture ? (
            <ResultRow
              label="Plafond 100 km aller simple"
              value="Atteint — excédent à 0,15 €/km"
              emphasis
            />
          ) : null}
          {veloPlafondAtteint ? (
            <ResultRow
              label="Plafond vélo annuel"
              value={`Atteint — capé à ${fmtEUR(PLAFOND_ANNUEL_VELO_2026)}/an`}
              emphasis
            />
          ) : null}
          {result.indemniteEmployeurAnnuelle > 0 ? (
            <>
              <ResultRow
                label="Déduction brute"
                value={fmtEUR(result.deductionKmBrute)}
              />
              <ResultRow
                label="Indemnité employeur"
                value={fmtEUR(result.indemniteEmployeurAnnuelle)}
                direction="minus"
              />
              <ResultRow
                label="Déduction nette"
                value={fmtEUR(result.deductionKmNette)}
                direction="plus"
                emphasis
              />
            </>
          ) : (
            <ResultRow
              label="Déduction annuelle"
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
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            color: "#1E40AF",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold">
            <Lightbulb className="size-3.5" />
            Km évités par le télétravail (info)
          </div>
          <p className="text-[#1E3A8A]">
            <strong>{fmtNumber(result.kmTeleworkEvites)} km/an</strong>{" "}
            économisés grâce à vos jours en télétravail. N&apos;entre pas dans
            la déduction (jours sans déplacement), mais réduit votre empreinte
            carbone et vos coûts réels (carburant, usure du véhicule).
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
          <Info className="size-3.5" /> À savoir
        </div>
        <ul className="list-inside list-disc space-y-1">
          <li>
            L&apos;option <strong>frais réels</strong> n&apos;est intéressante
            que si le total des frais professionnels dépasse le forfait légal
            de <strong>{fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026, 0)}/an</strong>{" "}
            (CIR 92 art. 51).
          </li>
          {isVoiture ? (
            <li>
              {voitureForfaitForcé ? (
                <>
                  Taux voiture appliqué :{" "}
                  <strong>0,15 €/km</strong> (forfait CIR 92 art. 66) — votre
                  employeur verse une indemnité km, le cumul avec le tarif
                  fonctionnaires (0,4327 €/km Q2 2026) n&apos;est pas
                  autorisé.
                </>
              ) : (
                <>
                  Taux voiture appliqué :{" "}
                  <strong>0,4327 €/km</strong> (tarif fonctionnaires Q2 2026,
                  circulaire BOSA n° 764) — aucune indemnité km de
                  l&apos;employeur. Si vous percevez une indemnité, le taux
                  bascule automatiquement à 0,15 €/km.
                </>
              )}
            </li>
          ) : null}
          {isVelo ? (
            <li>
              Vélo : <strong>0,37 €/km</strong> plafonné à{" "}
              <strong>{fmtEUR(PLAFOND_ANNUEL_VELO_2026)}/an</strong> (revenus
              2026 / EI 2027) — exonération uniquement si vos frais
              professionnels sont calculés au forfait.
            </li>
          ) : null}
          {isTP ? (
            <li>
              Transports publics : <strong>100 % du coût</strong> de
              l&apos;abonnement SNCB / STIB / TEC / De Lijn déductible
              (opérateurs publics).
            </li>
          ) : null}
          <li>
            <strong>Déclaration Tax-on-web</strong> : indemnité reçue à coder
            en case <strong>1254/2254</strong>, exonération en{" "}
            <strong>1255/2255</strong>. Frais réels à détailler dans la
            partie 2 de la déclaration.
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

function KmResultPlaceholder({ accent }: { accent: string }) {
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
        Renseignez votre trajet, votre mode de transport, puis cliquez sur{" "}
        <em>« Calculer ma déduction »</em>.
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-[color:var(--glass-ink-faint)]">
        <Car className="size-3.5" />
        <span>Voiture</span>
        <span>·</span>
        <Bike className="size-3.5" />
        <span>Vélo</span>
        <span>·</span>
        <Bus className="size-3.5" />
        <span>Transports publics</span>
      </div>
      <div className="mt-1 text-[10.5px] text-[color:var(--glass-ink-faint)]">
        Voiture {TAUX_KM_2026.voiture.toString().replace(".", ",")} €/km · Vélo{" "}
        {TAUX_KM_2026.velo.toString().replace(".", ",")} €/km · TP 100 %
        abonnement
      </div>
    </div>
  );
}
