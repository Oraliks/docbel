"use client";

/**
 * Calculateur "Pécule de vacances" — UI refondue 2026-05.
 *
 * Pattern UI : aligné sur Brut/Net + Préavis (layout 2 colonnes form /
 * résultat sticky, badges, export PDF, mention « Mis à jour »).
 * Logique pure dans `lib/calculators/pecule.ts` (chiffres 2026 vérifiés
 * sur SPF Finances, ONVA et ONEM).
 *
 *  - Distinction nette pécule simple / double avec leurs barèmes propres.
 *  - Barème SPF officiel 11 tranches (au lieu d'un taux moyen).
 *  - Mention vacances-jeunes ONEM si « 1re année après études ».
 *  - Détail pédagogique de la retenue ONVA (ONSS + solidarité + précompte).
 */

import React, { useState } from "react";
import {
  Briefcase,
  HardHat,
  Download,
  Info,
  RotateCcw,
  ExternalLink,
  Sun,
} from "lucide-react";
import {
  calcPecule,
  type PeculeResult,
  TAUX_DOUBLE_PECULE_EMPLOYE,
  ONSS_SPECIALE_DOUBLE_PECULE,
  ONVA_COEF_MAJORATION,
  ONVA_TAUX_TOTAL,
  ONVA_COTISATION_SOLIDARITE,
  ONVA_PRECOMPTE_BAS,
  ONVA_PRECOMPTE_HAUT,
  ONVA_SEUIL_PRECOMPTE,
} from "@/lib/calculators/pecule";
import {
  CalcGrid,
  CalcField,
  CalcSubmitButton,
  CalcError,
  CalcBadge,
  CalcCard,
  YesNoToggle,
  ResultRow,
  fmtEUR,
  fmtPct,
  parseNum,
} from "./_shared";

type Statut = "employe" | "ouvrier";

/**
 * Date de mise à jour du calculateur — pilote l'affichage public et l'alerte
 * annuelle dans /admin/calculateurs.
 */
const LAST_UPDATED = "2026-05-25";

/* ------------------------------------------------------------------ */
/*  Toggle segmenté plein largeur (Statut)                            */
/* ------------------------------------------------------------------ */

function SegmentedToggle<T extends string>({
  label,
  value,
  onChange,
  options,
  accent,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  accent: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[color:var(--glass-ink)]">
        {label}
      </span>
      <div
        className="grid gap-1 rounded-xl border-[1.5px] p-1"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
          borderColor: "var(--glass-border)",
          background: "var(--glass-surface)",
        }}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[12.5px] font-semibold transition"
              style={{
                background: active ? accent : "transparent",
                color: active ? "white" : "var(--glass-ink-soft)",
              }}
            >
              {o.icon}
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Composant principal                                               */
/* ------------------------------------------------------------------ */

export function CalcPecule({ accent }: { accent: string }) {
  const [statut, setStatut] = useState<Statut>("employe");
  const [brutMensuel, setBrutMensuel] = useState("");
  const [moisPrestes, setMoisPrestes] = useState("12");
  const [tempsPartiel, setTempsPartiel] = useState<"oui" | "non">("non");
  const [tauxOccupation, setTauxOccupation] = useState("80");
  const [jeune, setJeune] = useState<"oui" | "non">("non");

  const [result, setResult] = useState<PeculeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const reset = () => {
    setStatut("employe");
    setBrutMensuel("");
    setMoisPrestes("12");
    setTempsPartiel("non");
    setTauxOccupation("80");
    setJeune("non");
    setResult(null);
    setError(null);
  };

  const onCalc = () => {
    setError(null);
    setResult(null);

    const brut = parseNum(brutMensuel);
    const mois = parseNum(moisPrestes);
    const taux = parseNum(tauxOccupation);

    if (!Number.isFinite(brut)) {
      setError("Indiquez un brut mensuel valide.");
      return;
    }

    const out = calcPecule({
      statut,
      brutMensuel: brut,
      moisPrestes: Number.isFinite(mois) ? mois : 12,
      tempsPartiel: tempsPartiel === "oui",
      tauxOccupation: Number.isFinite(taux) ? taux : 100,
      jeuneTravailleur: jeune === "oui",
    });

    if ("error" in out) {
      setError(out.error);
      return;
    }
    setResult(out);
  };

  /* --------------------------------------------------------------- */
  /*  Export PDF (jspdf dynamique)                                   */
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

      // Header : titre + bande accent BE
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
        `Estimation Pécule de vacances 2026 — régime ${
          result.statut === "employe" ? "employé" : "ouvrier ONVA"
        }`,
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

      const rows: [string, string][] = [
        ["Statut", statut === "employe" ? "Employé(e) privé" : "Ouvrier (ONVA)"],
        ["Brut mensuel", fmtEUR(parseNum(brutMensuel) || 0)],
        ["Mois prestés en 2025", moisPrestes || "12"],
        [
          "Temps de travail",
          tempsPartiel === "oui"
            ? `Temps partiel (${tauxOccupation || "—"} %)`
            : "Temps plein",
        ],
      ];
      if (statut === "employe") {
        rows.push([
          "1re année après études (< 25 ans)",
          jeune === "oui" ? "Oui" : "Non",
        ]);
      }

      const colKey = margin + 2;
      const colVal = pageWidth / 2 + 5;
      rows.forEach(([k, v]) => {
        doc.setTextColor(90, 90, 90);
        doc.text(k, colKey, y);
        doc.setTextColor(0, 0, 0);
        doc.setFont("", "bold");
        doc.text(v, colVal, y);
        doc.setFont("", "normal");
        y += lineGap;
      });
      y += 4;

      // Encadré PÉCULE TOTAL
      const boxH = 28;
      doc.setFillColor(248, 244, 252);
      doc.setDrawColor(159, 124, 255);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, "FD");

      doc.setFontSize(10);
      doc.setFont("", "bold");
      doc.setTextColor(90, 42, 140);
      doc.text("PÉCULE TOTAL BRUT", margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtEUR(result.totalBrut), margin + 4, y + 17);

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `≈ ${fmtEUR(result.totalNetEstime)} net estimé · versé ${
          result.statut === "ouvrier"
            ? "par l'ONVA en mai/juin"
            : "par l'employeur en juin"
        }`,
        margin + 4,
        y + 24,
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

      const detail: [string, string][] = [
        ["Pécule simple brut", fmtEUR(result.peculeSimpleBrut)],
        ["Pécule simple net (estimé)", fmtEUR(result.peculeSimpleNetEstime)],
        ["Double pécule brut", fmtEUR(result.doublePeculeBrut)],
        ["Double pécule net (estimé)", fmtEUR(result.doublePeculeNetEstime)],
        ["Total brut", fmtEUR(result.totalBrut)],
        ["Total net estimé", fmtEUR(result.totalNetEstime)],
      ];

      if (result.statut === "employe") {
        detail.push([
          "Précompte spécial double pécule",
          fmtPct(result.tauxPrecompteAppliquePourcent, 2),
        ]);
      } else {
        detail.push([
          "Retenue ONVA totale",
          `${fmtPct(result.tauxPrecompteAppliquePourcent, 2)} (ONSS 13,07 + solidarité 1 % + précompte)`,
        ]);
        detail.push([
          "Coefficient de majoration ONVA",
          ONVA_COEF_MAJORATION.toLocaleString("fr-BE"),
        ]);
        detail.push([
          "Taux ONVA global",
          fmtPct(ONVA_TAUX_TOTAL * 100, 2),
        ]);
      }

      detail.forEach(([k, v], idx) => {
        const isTotal = k === "Total brut" || k === "Total net estimé";
        if (isTotal) {
          doc.setDrawColor(220, 220, 220);
          doc.line(margin, y - 1, pageWidth - margin, y - 1);
          y += 2;
          doc.setFont("", "bold");
          doc.setTextColor(90, 42, 140);
        } else {
          doc.setFont("", "normal");
          doc.setTextColor(80, 80, 80);
        }
        doc.text(k, colKey, y);
        if (isTotal) {
          doc.setTextColor(90, 42, 140);
        } else {
          doc.setTextColor(0, 0, 0);
        }
        const wrapped = doc.splitTextToSize(v, pageWidth - colVal - margin + 5);
        doc.text(wrapped, pageWidth - margin, y, { align: "right" });
        y += lineGap * Math.max(1, wrapped.length);
      });
      y += 4;

      if (result.peculeJeunesEligible) {
        if (y > pageHeight - 50) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(191, 219, 254);
        const infoH = 22;
        doc.roundedRect(margin, y, pageWidth - margin * 2, infoH, 2, 2, "FD");
        doc.setFontSize(9.5);
        doc.setFont("", "bold");
        doc.setTextColor(30, 64, 175);
        doc.text("Vacances-jeunes ONEM", margin + 4, y + 6);
        doc.setFont("", "normal");
        doc.setTextColor(30, 58, 138);
        const infoText = doc.splitTextToSize(
          "En tant que jeune travailleur en 1re année après études (< 25 ans), l'ONEM peut compléter votre pécule (jusqu'à 4 semaines à 65 % du salaire plafonné). Demande à introduire via le formulaire C103, à transmettre à l'ONEM avant fin février 2026.",
          pageWidth - margin * 2 - 8,
        );
        doc.text(infoText, margin + 4, y + 12);
        y += infoH + 6;
      }

      // Footer
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setFont("", "italic");
      doc.setTextColor(120, 120, 120);
      const footer = doc.splitTextToSize(
        "Estimation indicative — chiffres 2026 conformes au barème SPF Finances « pécule de vacances et allocations exceptionnelles » (Annexe III AR/CIR 92, points 53-55), aux taux ONVA officiels (15,38 % du brut majoré 1,08) et à l'ONSS (13,07 %). Régularisation finale via la fiche de paie (employé) ou le décompte ONVA officiel (ouvrier).",
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

      doc.save(`docbel-pecule-${now.toISOString().split("T")[0]}.pdf`);
    } finally {
      setExportingPDF(false);
    }
  };

  const brutHint =
    statut === "employe"
      ? "Votre brut courant 2026 (avant retenues)."
      : "Brut mensuel moyen 2025 (année de référence ONVA).";

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
          {/* En-tête : icône + titre + badges + bouton Reset */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                }}
              >
                <Sun className="size-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-[color:var(--glass-ink)]">
                  Pécule de vacances
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  Calculez votre pécule simple et double — Belgique 2026
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
              <span aria-hidden="true">🇧🇪</span>
              Belgique
            </CalcBadge>
            <CalcBadge accent={accent}>ONVA 2026</CalcBadge>
            <CalcBadge accent={accent}>Données 2026</CalcBadge>
          </div>

          {/* Toggle Statut (employé / ouvrier) */}
          <SegmentedToggle<Statut>
            label="Statut"
            value={statut}
            onChange={(v) => {
              setStatut(v);
              if (v === "ouvrier") setJeune("non");
            }}
            options={[
              {
                value: "employe",
                label: "Employé(e)",
                icon: <Briefcase className="size-3.5" />,
              },
              {
                value: "ouvrier",
                label: "Ouvrier",
                icon: <HardHat className="size-3.5" />,
              },
            ]}
            accent={accent}
          />

          {/* Brut + mois prestés (2 cols) */}
          <CalcGrid cols={2}>
            <CalcField
              id="pecule-brut"
              label="Salaire mensuel brut"
              hint={brutHint}
              value={brutMensuel}
              onChange={setBrutMensuel}
              placeholder="ex : 3000"
              suffix="€"
              min={100}
              max={50000}
            />
            <CalcField
              id="pecule-mois"
              label="Mois prestés en 2025"
              hint="De 0 à 12. Maladie, congé maternité et chômage temporaire comptent comme prestés."
              value={moisPrestes}
              onChange={setMoisPrestes}
              placeholder="12"
              min={0}
              max={12}
              step={1}
            />
          </CalcGrid>

          {/* Temps partiel + (taux si oui) */}
          <CalcGrid cols={2}>
            <YesNoToggle
              label="Temps partiel ?"
              hint="Mi-temps, 4/5e, etc."
              value={tempsPartiel}
              onChange={setTempsPartiel}
              accent={accent}
            />
            {tempsPartiel === "oui" ? (
              <CalcField
                id="pecule-taux"
                label="Taux d'occupation"
                hint="Ex : 80 pour un 4/5e, 50 pour un mi-temps."
                value={tauxOccupation}
                onChange={setTauxOccupation}
                placeholder="80"
                suffix="%"
                min={1}
                max={100}
                step={1}
              />
            ) : (
              <div /> /* placeholder grille */
            )}
          </CalcGrid>

          {/* Pécule jeunes (uniquement pour employés) */}
          {statut === "employe" ? (
            <YesNoToggle
              label="Première année après vos études ?"
              hint="Si oui et < 25 ans : vacances-jeunes ONEM possibles (info dans le résultat)."
              value={jeune}
              onChange={setJeune}
              accent={accent}
            />
          ) : null}

          {error ? <CalcError>{error}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={onCalc}>
              Calculer le pécule
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
                Simulation indicative.
              </strong>{" "}
              Le pécule réel dépend de votre fiche de paie (employé) ou du
              décompte ONVA officiel (ouvrier).
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
              <PeculeResultPanel
                result={result}
                accent={accent}
                onExportPDF={handleExportPDF}
                exporting={exportingPDF}
              />
            ) : (
              <PeculeResultPlaceholder accent={accent} />
            )}
          </CalcCard>
        </div>
      </div>

      {/* Footer : Mise à jour + sources */}
      <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
        Calculateur mis à jour le <strong>{lastUpdatedFr}</strong> · Données
        2026 · Sources officielles : ONVA, SPF Finances et ONSS.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panneau résultat (rempli)                                         */
/* ------------------------------------------------------------------ */

function PeculeResultPanel({
  result,
  accent,
  onExportPDF,
  exporting,
}: {
  result: PeculeResult;
  accent: string;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  const regimeLabel =
    result.statut === "employe" ? "Régime employé" : "Régime ONVA (ouvrier)";
  const versementLabel =
    result.statut === "employe"
      ? "versé par l'employeur en juin"
      : "versé par l'ONVA en mai/juin";

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
          title="Estimation indicative — barèmes SPF Finances et ONVA 2026"
          aria-label="Estimation indicative — barèmes SPF Finances et ONVA 2026"
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
          {fmtEUR(result.totalBrut)}
        </div>
        <div
          className="mt-1 text-[13px] font-semibold"
          style={{ color: "var(--glass-ink-soft)" }}
        >
          ≈ {fmtEUR(result.totalNetEstime)} net estimé
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <CalcBadge accent={accent}>{regimeLabel}</CalcBadge>
          <span className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
            {versementLabel}
          </span>
        </div>
      </div>

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
        <div className="flex flex-col gap-1.5">
          <ResultRow
            label="Pécule simple brut"
            value={fmtEUR(result.peculeSimpleBrut)}
          />
          <ResultRow
            label="Pécule simple net estimé"
            value={fmtEUR(result.peculeSimpleNetEstime)}
            direction="plus"
          />
          <ResultRow
            label="Double pécule brut"
            value={fmtEUR(result.doublePeculeBrut)}
          />
          <ResultRow
            label="Double pécule net estimé"
            value={fmtEUR(result.doublePeculeNetEstime)}
            direction="plus"
            emphasis
          />
          <ResultRow label="Total brut" value={fmtEUR(result.totalBrut)} />
          <ResultRow
            label="Total net estimé"
            value={fmtEUR(result.totalNetEstime)}
            emphasis
          />
        </div>
      </div>

      {/* Bloc vacances-jeunes ONEM si applicable */}
      {result.peculeJeunesEligible ? (
        <div
          className="rounded-xl p-3 text-[11.5px] leading-[1.55]"
          style={{
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            color: "#1E40AF",
          }}
        >
          <div className="mb-1 flex items-center gap-1.5 font-bold">
            <Info className="size-3.5" /> Vacances-jeunes ONEM possible
          </div>
          <p className="text-[#1E3A8A]">
            En tant que jeune travailleur (&lt; 25 ans) en 1re année après
            études, l'ONEM peut compléter votre pécule (jusqu'à 4 semaines
            à 65 % du salaire plafonné) si 2025 n'a pas suffi à constituer
            un pécule complet. Demande via le formulaire <strong>C103</strong>,
            à transmettre à l'ONEM avant fin février 2026.
          </p>
          <a
            href="https://www.onem.be/citoyens/conges/avez-vous-droit-aux-vacances-jeunes-"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold underline"
          >
            En savoir plus sur onem.be
            <ExternalLink className="size-3" />
          </a>
        </div>
      ) : null}

      {/* Bloc « À savoir » */}
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
          {result.statut === "employe" ? (
            <>
              <li>
                Le <strong>pécule simple</strong> est intégré à votre salaire
                de juin (employé) — pas un complément distinct.
              </li>
              <li>
                Le <strong>double pécule</strong> (
                {fmtPct(TAUX_DOUBLE_PECULE_EMPLOYE * 100, 0)} du brut) subit
                un précompte spécial dégressif selon votre tranche fiscale —
                ici{" "}
                <strong>
                  {fmtPct(result.tauxPrecompteAppliquePourcent, 2)}
                </strong>{" "}
                appliqué (barème SPF Finances 11 tranches).
              </li>
              <li>
                Les <strong>jours assimilés</strong> (maladie, chômage
                temporaire, congé maternité) comptent comme prestés.
              </li>
            </>
          ) : (
            <>
              <li>
                L'<strong>ONVA</strong> verse en mai/juin{" "}
                <strong>{fmtPct(ONVA_TAUX_TOTAL * 100, 2)}</strong> du brut
                annuel majoré ({ONVA_COEF_MAJORATION.toLocaleString("fr-BE")}{" "}
                ×).
              </li>
              <li>
                Retenue totale :{" "}
                <strong>
                  {fmtPct(result.tauxPrecompteAppliquePourcent, 2)}
                </strong>{" "}
                = ONSS{" "}
                {fmtPct(ONSS_SPECIALE_DOUBLE_PECULE * 100, 2)} + solidarité{" "}
                {fmtPct(ONVA_COTISATION_SOLIDARITE * 100, 0)} + précompte{" "}
                {fmtPct(ONVA_PRECOMPTE_BAS * 100, 2)} si pécule ≤{" "}
                {fmtEUR(ONVA_SEUIL_PRECOMPTE, 0)} sinon{" "}
                {fmtPct(ONVA_PRECOMPTE_HAUT * 100, 2)}.
              </li>
              <li>
                Les <strong>jours assimilés</strong> (maladie, congé
                maternité) comptent comme prestés.
              </li>
            </>
          )}
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

function PeculeResultPlaceholder({ accent }: { accent: string }) {
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
        Indiquez votre statut, votre brut mensuel et les mois prestés en 2025,
        puis cliquez sur <em>« Calculer le pécule »</em>.
      </div>
      <Info
        className="mt-1 size-5"
        style={{ color: "var(--glass-ink-faint)" }}
      />
    </div>
  );
}
