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
      doc.text(`Généré le ${dateStr} à ${timeStr}`, pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(`Tarif social énergie — ${Q_REFERENCE}`, margin, y);
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

      const statutsCoches: string[] = [];
      if (bim) statutsCoches.push("BIM");
      if (ris) statutsCoches.push("RIS");
      if (grapa) statutsCoches.push("GRAPA");
      if (handicap) statutsCoches.push("Allocation handicap");
      if (aideEquivalente) statutsCoches.push("Aide CPAS équivalente");
      if (logementSocial) statutsCoches.push("Logement social");

      const inputs: [string, string][] = [
        [
          "Statuts cochés",
          statutsCoches.length > 0 ? statutsCoches.join(", ") : "Aucun",
        ],
        ["Personnes dans le ménage", String(parseNum(tailleMenage) || 2)],
        ["Conso annuelle électricité", `${fmtNumber(parseNum(consoElec) || 0)} kWh`],
        ["Conso annuelle gaz", `${fmtNumber(parseNum(consoGaz) || 0)} kWh`],
        ["Chauffage électrique", chauffageElec === "oui" ? "Oui" : "Non"],
        ["Chauffage au gaz", chauffageGaz === "oui" ? "Oui" : "Non"],
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
          ? "VOUS ÊTES ÉLIGIBLE AU TARIF SOCIAL"
          : "PAS D'ÉLIGIBILITÉ AUTOMATIQUE DÉTECTÉE",
        margin + 4,
        y + 7,
      );

      if (result.eligible) {
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text(
          `${fmtEUR(result.gainAnnuel)} / an d'économie`,
          margin + 4,
          y + 18,
        );
        doc.setFontSize(9);
        doc.setFont("", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Soit environ ${fmtEUR(result.gainMensuel)} / mois · Tarifs ${Q_REFERENCE}`,
          margin + 4,
          y + 26,
        );
      } else {
        doc.setFontSize(11);
        doc.setFont("", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(
          "Vérifiez les aides régionales et l'intervention CPAS.",
          margin + 4,
          y + 18,
        );
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Gain théorique : ${fmtEUR(result.gainAnnuel)}/an si vous aviez été éligible.`,
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
        doc.text("Motifs d'éligibilité", margin, y);
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
      doc.text("Détail du calcul", margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const details: [string, string][] = [
        ["Économie sur l'électricité", fmtEUR(result.gainElec)],
        ["Économie sur le gaz", fmtEUR(result.gainGaz)],
        ["Plafond élec applicable", `${fmtNumber(result.plafondElec)} kWh`],
        ["Plafond gaz applicable", `${fmtNumber(result.plafondGaz)} kWh`],
      ];
      if (result.consoExcedentElec > 0) {
        details.push([
          "Excédent élec (tarif standard)",
          `${fmtNumber(result.consoExcedentElec)} kWh`,
        ]);
      }
      if (result.consoExcedentGaz > 0) {
        details.push([
          "Excédent gaz (tarif standard)",
          `${fmtNumber(result.consoExcedentGaz)} kWh`,
        ]);
      }
      details.push([
        "Coût annuel au tarif standard",
        fmtEUR(result.coutStandardTotal),
      ]);
      details.push([
        "Coût annuel au tarif social",
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
        `Estimation indicative — tarifs CREG ${Q_REFERENCE} (note trimestrielle) et liste des bénéficiaires SPF Économie 2026. Le statut BIM seul n'ouvre plus le droit au tarif social automatique depuis le 1ᵉʳ juillet 2023. Pour confirmer votre éligibilité, contactez votre fournisseur ou consultez economie.fgov.be.`,
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
                  Tarif social énergie
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  Vérifiez votre éligibilité + estimez l&apos;économie annuelle
                  ({Q_REFERENCE})
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
            <CalcBadge accent={accent}>{Q_REFERENCE}</CalcBadge>
            <CalcBadge accent={accent}>Données 2026</CalcBadge>
          </div>

          {/* --- Section 1 : éligibilité ----------------------------- */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
                1. Vérifier votre éligibilité
              </span>
            </div>
            <p className="text-[11.5px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
              Cochez tous les statuts qui s&apos;appliquent à votre ménage. Un
              seul suffit pour l&apos;application automatique du tarif social.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <StatusToggle
                id="ts-ris"
                label="RIS — Revenu d'Intégration Sociale"
                description="Versé par le CPAS."
                checked={ris}
                onChange={setRis}
                accent={accent}
              />
              <StatusToggle
                id="ts-grapa"
                label="GRAPA"
                description="Garantie de Revenus Aux Personnes Âgées (SFP)."
                checked={grapa}
                onChange={setGrapa}
                accent={accent}
              />
              <StatusToggle
                id="ts-handicap"
                label="Allocation handicap (DG HAN)"
                description="DG Personnes Handicapées (SPF Sécurité Sociale)."
                checked={handicap}
                onChange={setHandicap}
                accent={accent}
              />
              <StatusToggle
                id="ts-aide"
                label="Aide sociale équivalente du CPAS"
                description="Équivalente au RIS pour les personnes non éligibles au RIS."
                checked={aideEquivalente}
                onChange={setAideEquivalente}
                accent={accent}
              />
              <StatusToggle
                id="ts-logement"
                label="Logement social agréé"
                description="Locataire d'une SLSP / SLRB / VMSW chauffé au gaz collectif."
                checked={logementSocial}
                onChange={setLogementSocial}
                accent={accent}
              />
              <StatusToggle
                id="ts-bim"
                label="BIM (à titre indicatif)"
                description="Le BIM seul n'ouvre PLUS le droit depuis le 01.07.2023."
                checked={bim}
                onChange={setBim}
                accent={accent}
              />
            </div>
          </div>

          {/* --- Section 2 : estimation du gain ---------------------- */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[color:var(--glass-ink-faint)]">
              2. Estimer le gain annuel
            </span>

            <CalcGrid cols={2}>
              <CalcField
                id="ts-taille-menage"
                label="Personnes dans le ménage"
                hint="Plafond élec : +200 kWh par personne supplémentaire."
                value={tailleMenage}
                onChange={setTailleMenage}
                placeholder="2"
                min={1}
                max={15}
                step={1}
              />
              <CalcField
                id="ts-conso-elec"
                label="Conso annuelle électricité"
                hint="Voir votre dernière facture annuelle. Moyenne BE ≈ 3 500 kWh."
                value={consoElec}
                onChange={setConsoElec}
                placeholder="3500"
                min={0}
                max={99999}
                suffix="kWh"
              />
              <CalcField
                id="ts-conso-gaz"
                label="Conso annuelle gaz"
                hint="0 si vous n'avez pas de gaz naturel. Moyenne BE ≈ 17 000 kWh."
                value={consoGaz}
                onChange={setConsoGaz}
                placeholder="17000"
                min={0}
                max={99999}
                suffix="kWh"
              />
              <YesNoToggle
                label="Chauffage électrique ?"
                hint={`Plafond élec : ${PLAFONDS_2026.ELEC_CHAUFFAGE} kWh si oui (sinon ${PLAFONDS_2026.ELEC_BASE} kWh).`}
                value={chauffageElec}
                onChange={setChauffageElec}
                accent={accent}
              />
              <YesNoToggle
                label="Chauffage au gaz ?"
                hint={`Plafond gaz : ${PLAFONDS_2026.GAZ_CHAUFFAGE} kWh si oui (sinon ${PLAFONDS_2026.GAZ_NON_CHAUFFAGE} kWh).`}
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
              Vérifier mon éligibilité
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
                Application automatique.
              </strong>{" "}
              Le SPF Économie vérifie votre éligibilité 4× par an et notifie
              automatiquement votre fournisseur — aucune démarche à effectuer.
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
        Calculateur mis à jour le <strong>{lastUpdatedFr}</strong> · Tarifs{" "}
        <strong>{Q_REFERENCE}</strong> · Sources officielles :{" "}
        <strong>CREG</strong>, <strong>SPF Économie</strong>,{" "}
        <strong>Moniteur belge</strong>.
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
  const eligibilityColor = result.eligible ? "#22a06b" : "#a87b1a";

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
          title={`Estimation indicative — barèmes CREG ${Q_REFERENCE}, plafonds AR 29/03/2012, liste SPF Économie 2026`}
          aria-label={`Estimation indicative — barèmes CREG ${Q_REFERENCE}, plafonds AR 29/03/2012, liste SPF Économie 2026`}
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
          borderColor: `${eligibilityColor}55`,
          background: `${eligibilityColor}15`,
          color: eligibilityColor,
        }}
      >
        {result.eligible ? (
          <>
            <CheckCircle2 className="size-3.5" />
            Vous êtes éligible
          </>
        ) : (
          <>
            <Info className="size-3.5" />
            Pas d&apos;éligibilité auto
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
          {result.eligible ? "/ an d'économie estimée" : "/ an de gain théorique"}
        </div>
        <div className="mt-1 text-[12px] text-[color:var(--glass-ink-faint)]">
          ≈ <strong>{fmtEUR(result.gainMensuel)}</strong> / mois
        </div>
      </div>

      {/* Motifs d'éligibilité */}
      {result.eligible && result.motifsEligibilite.length > 0 ? (
        <div
          className="rounded-xl p-3"
          style={{
            background: "var(--glass-surface)",
            border: "1px solid #BBF7D0",
          }}
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#22a06b]">
            <CheckCircle2 className="size-3" />
            Motif{result.motifsEligibilite.length > 1 ? "s" : ""}{" "}
            d&apos;éligibilité
          </div>
          <ul className="space-y-1 text-[11.5px] leading-[1.5] text-[color:var(--glass-ink)]">
            {result.motifsEligibilite.map((m) => (
              <li key={m} className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-[#22a06b]" />
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
            background: "#FEF3C7",
            border: "1px solid #FCD34D",
            color: "#92400E",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold">
            <Info className="size-3.5" /> À noter
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
          Détail du calcul
        </div>
        <div className="flex flex-col gap-2">
          <div className="rounded-xl bg-[color:var(--glass-surface)] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink)]">
                <Zap className="size-3.5" style={{ color: "#f59e0b" }} />
                Électricité
              </span>
              <span className="text-[14px] font-extrabold text-[color:var(--glass-ink)]">
                {fmtEUR(result.gainElec)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              <ResultRow
                label="plafond applicable"
                value={`${fmtNumber(result.plafondElec)} kWh`}
              />
              {result.consoExcedentElec > 0 ? (
                <ResultRow
                  label="excédent (tarif standard)"
                  value={`${fmtNumber(result.consoExcedentElec)} kWh`}
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-xl bg-[color:var(--glass-surface)] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink)]">
                <Flame className="size-3.5" style={{ color: "#ef4444" }} />
                Gaz naturel
              </span>
              <span className="text-[14px] font-extrabold text-[color:var(--glass-ink)]">
                {fmtEUR(result.gainGaz)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1">
              <ResultRow
                label="plafond applicable"
                value={`${fmtNumber(result.plafondGaz)} kWh`}
              />
              {result.consoExcedentGaz > 0 ? (
                <ResultRow
                  label="excédent (tarif standard)"
                  value={`${fmtNumber(result.consoExcedentGaz)} kWh`}
                />
              ) : null}
            </div>
          </div>

          {/* Comparaison standard vs social */}
          <div className="rounded-xl bg-[color:var(--glass-surface)] p-3">
            <div className="flex flex-col gap-1">
              <ResultRow
                label="coût au tarif standard"
                value={fmtEUR(result.coutStandardTotal)}
              />
              <ResultRow
                label="coût au tarif social"
                value={fmtEUR(result.coutSocialTotal)}
              />
              <ResultRow
                label="économie totale"
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
            <Info className="size-3.5" /> Application automatique
          </div>
          <ul className="list-inside list-disc space-y-1">
            <li>
              Le SPF Économie notifie votre fournisseur{" "}
              <strong>tous les 3 mois</strong>.
            </li>
            <li>
              Tarifs <strong>recalculés chaque trimestre</strong> par la CREG.
            </li>
            <li>
              Au-delà des plafonds, le tarif standard s&apos;applique sur
              l&apos;excédent uniquement.
            </li>
          </ul>
        </div>
      ) : (
        <div
          className="rounded-xl p-3 text-[11.5px] leading-[1.6]"
          style={{
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            color: "#1E40AF",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold">
            <Info className="size-3.5" /> Autres aides possibles
          </div>
          <ul className="list-inside list-disc space-y-1 text-[#1E3A8A]">
            <li>
              <strong>Prime énergie régionale</strong> (Wallonie / Bruxelles /
              Flandre).
            </li>
            <li>
              <strong>Fonds gaz et électricité</strong> auprès de votre CPAS.
            </li>
            <li>
              Allocation chauffage (mazout, gaz propane, pellets) selon
              conditions.
            </li>
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
        {exporting ? "Génération du PDF…" : "Télécharger le détail (PDF)"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder : avant le premier calcul                             */
/* ------------------------------------------------------------------ */

function TarifSocialResultPlaceholder({ accent }: { accent: string }) {
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
        Cochez vos statuts éligibles, indiquez votre consommation, puis
        cliquez sur <em>« Vérifier mon éligibilité »</em>.
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-[color:var(--glass-ink-faint)]">
        <Zap className="size-3.5" />
        <span>Électricité</span>
        <span>·</span>
        <Flame className="size-3.5" />
        <span>Gaz naturel</span>
      </div>
      <div className="mt-1 text-[10.5px] text-[color:var(--glass-ink-faint)]">
        Tarifs CREG {Q_REFERENCE} · {fmtEUR(TARIFS_2026.ELEC_SOCIAL, 5)}/kWh
        élec · {fmtEUR(TARIFS_2026.GAZ_SOCIAL, 5)}/kWh gaz
      </div>
    </div>
  );
}
