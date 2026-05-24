"use client";

/**
 * Calculateur Brut → Net (et Net → Brut) — salarié belge.
 *
 * Refonte UX 2026-05 : layout 2 colonnes (form / résultat sticky), badges
 * "BE / ATN 2026 / Données 2026", export PDF du détail, mention "Mis à jour".
 *
 * S'appuie sur la logique pure de `@/lib/calculators/brut-net` et les UI
 * primitives partagées de `./_shared`. La logique de calcul n'est pas
 * touchée ; seul le squelette d'affichage est revu.
 */

import React, { useState } from "react";
import { Download, Info } from "lucide-react";
import {
  calcBrutNet,
  calcNetToBrut,
  type BrutNetResult,
  type StatutFiscal,
  type Region,
  type MotorisationVehicule,
} from "@/lib/calculators/brut-net";
import {
  CalcGrid,
  CalcField,
  CalcSelect,
  CalcRadio,
  CalcSubmitButton,
  CalcError,
  CalcBadge,
  CalcCard,
  YesNoToggle,
  ResultRow,
  fmtEUR,
  parseNum,
} from "./_shared";

type Mode = "brut-net" | "net-brut";

/**
 * Date de mise à jour du calculateur — à remplacer par un fetch CMS plus
 * tard ; pour l'instant elle vit ici, à côté du composant qu'elle décrit.
 */
const LAST_UPDATED = "2026-05-24";

const STATUTS: { value: StatutFiscal; label: string }[] = [
  { value: "isole", label: "Isolé(e)" },
  { value: "cohabitant", label: "Cohabitant légal" },
  { value: "marie_un_revenu", label: "Marié — un revenu" },
  { value: "marie_deux_revenus", label: "Marié — deux revenus" },
];

const REGIONS: { value: Region; label: string }[] = [
  { value: "wallonie", label: "Wallonie" },
  { value: "bruxelles", label: "Bruxelles" },
  { value: "flandre", label: "Flandre" },
];

const MOTORISATIONS: { value: MotorisationVehicule; label: string }[] = [
  { value: "essence", label: "Essence" },
  { value: "diesel", label: "Diesel" },
  { value: "hybride", label: "Hybride" },
  { value: "electrique", label: "Électrique" },
];

const ENFANTS_OPTIONS = Array.from({ length: 7 }, (_, i) => ({
  value: String(i) as `${number}`,
  label: i === 0 ? "Aucun" : i === 6 ? "6 ou plus" : String(i),
}));

const STATUT_LABEL: Record<StatutFiscal, string> = {
  isole: "Isolé(e)",
  cohabitant: "Cohabitant légal",
  marie_un_revenu: "Marié — un revenu",
  marie_deux_revenus: "Marié — deux revenus",
};

const REGION_LABEL: Record<Region, string> = {
  wallonie: "Wallonie",
  bruxelles: "Bruxelles",
  flandre: "Flandre",
};

const MOTOR_LABEL: Record<MotorisationVehicule, string> = {
  essence: "Essence",
  diesel: "Diesel",
  hybride: "Hybride",
  electrique: "Électrique",
};

/* ------------------------------------------------------------------ */
/*  Composant principal                                               */
/* ------------------------------------------------------------------ */

export function CalcBrutNet({ accent }: { accent: string }) {
  const [mode, setMode] = useState<Mode>("brut-net");
  const [montant, setMontant] = useState("");
  const [statut, setStatut] = useState<StatutFiscal>("isole");
  const [enfants, setEnfants] = useState("0");
  const [region, setRegion] = useState<Region>("wallonie");
  const [chequesRepas, setChequesRepas] = useState<"oui" | "non">("non");

  // Voiture de société (ATN)
  const [hasVehicule, setHasVehicule] = useState<"oui" | "non">("non");
  const [valeurCatalogue, setValeurCatalogue] = useState("");
  const [ageVehicule, setAgeVehicule] = useState("0");
  const [motorisation, setMotorisation] =
    useState<MotorisationVehicule>("essence");

  // Indemnité télétravail
  const [telework, setTelework] = useState("");

  const [result, setResult] = useState<BrutNetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const handleCalc = () => {
    setError(null);
    setResult(null);

    const valeur = parseNum(montant);
    if (!Number.isFinite(valeur)) {
      setError("Indiquez un montant valide.");
      return;
    }

    const voitureSociete =
      hasVehicule === "oui"
        ? {
            hasVehicule: true,
            valeurCatalogueHT: parseNum(valeurCatalogue) || 0,
            ageVehicule: parseInt(ageVehicule, 10) || 0,
            motorisation,
          }
        : undefined;

    const teleworkNum = parseNum(telework);
    const indemniteTelework = Number.isFinite(teleworkNum) ? teleworkNum : 0;

    const params = {
      statut,
      enfants: parseInt(enfants, 10) || 0,
      region,
      chequesRepas: chequesRepas === "oui",
      voitureSociete,
      indemniteTelework,
    };

    const res =
      mode === "brut-net"
        ? calcBrutNet({ ...params, brut: valeur })
        : calcNetToBrut(valeur, params);

    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
  };

  /* --------------------------------------------------------------- */
  /*  Export PDF (jspdf en import dynamique pour ne pas gonfler le   */
  /*  bundle initial)                                                */
  /* --------------------------------------------------------------- */
  const handleExportPDF = async () => {
    if (!result) return;
    setExportingPDF(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const lineGap = 6;
      let y = 20;

      // En-tête : titre + bande accent
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

      // Titre principal
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        mode === "brut-net"
          ? "Estimation Brut → Net (salarié belge, 2026)"
          : "Estimation Net → Brut (salarié belge, 2026)",
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

      const labelInput =
        mode === "brut-net" ? "Salaire brut mensuel" : "Net souhaité (mensuel)";
      const rows: [string, string][] = [
        [labelInput, fmtEUR(parseNum(montant))],
        ["Statut fiscal", STATUT_LABEL[statut]],
        [
          "Enfants à charge",
          parseInt(enfants, 10) >= 6 ? "6 ou plus" : enfants,
        ],
        ["Région", REGION_LABEL[region]],
        ["Chèques-repas", chequesRepas === "oui" ? "Oui (8,91 €/j)" : "Non"],
      ];
      if (hasVehicule === "oui") {
        rows.push(
          [
            "Voiture société — valeur catalogue HT",
            fmtEUR(parseNum(valeurCatalogue) || 0),
          ],
          ["Voiture société — âge", `${ageVehicule} ans`],
          ["Voiture société — motorisation", MOTOR_LABEL[motorisation]],
        );
      } else {
        rows.push(["Voiture société", "Non"]);
      }
      const teleNum = parseNum(telework);
      if (Number.isFinite(teleNum) && teleNum > 0) {
        rows.push(["Indemnité télétravail", fmtEUR(teleNum)]);
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

      // Section résultat (encadré)
      const boxH = 24;
      doc.setFillColor(248, 244, 252);
      doc.setDrawColor(159, 124, 255);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, "FD");

      doc.setFontSize(10);
      doc.setFont("", "bold");
      doc.setTextColor(90, 42, 140);
      doc.text(
        mode === "brut-net" ? "NET ESTIMÉ" : "BRUT REQUIS",
        margin + 4,
        y + 7,
      );

      doc.setFontSize(20);
      doc.setTextColor(0, 0, 0);
      doc.text(
        `${fmtEUR(mode === "brut-net" ? result.net : result.brut)} ${mode === "brut-net" ? "/ mois net" : "/ mois brut"}`,
        margin + 4,
        y + 16,
      );

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Taux net / brut : ${(result.tauxNetBrut * 100).toFixed(1)} %`,
        margin + 4,
        y + 22,
      );
      y += boxH + 8;

      // Section détail
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text("Détail du calcul", margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const detail: [string, string][] = [
        ["Salaire brut", fmtEUR(result.brut)],
        [
          result.bonus > 0
            ? `Cotisations ONSS retenue (workbonus −${fmtEUR(result.bonus)})`
            : "Cotisations ONSS (13,07 %)",
          `− ${fmtEUR(result.onssRetenue)}`,
        ],
      ];
      if (result.atn > 0) {
        detail.push(["ATN voiture société (imposable)", `+ ${fmtEUR(result.atn)}`]);
      }
      detail.push(
        ["= Salaire imposable", fmtEUR(result.imposable)],
        ["Précompte professionnel", `− ${fmtEUR(result.precompte)}`],
      );
      if (result.cotisationSpeciale > 0) {
        detail.push([
          "Cotisation spéciale sécu",
          `− ${fmtEUR(result.cotisationSpeciale)}`,
        ]);
      }
      if (result.chequesRepas > 0) {
        detail.push(["Chèques-repas (≈ 21 j)", `+ ${fmtEUR(result.chequesRepas)}`]);
      }
      if (result.indemniteTelework > 0) {
        detail.push([
          "Indemnité télétravail",
          `+ ${fmtEUR(result.indemniteTelework)}`,
        ]);
      }
      detail.push(["NET EN POCHE", fmtEUR(result.net)]);

      detail.forEach(([k, v], idx) => {
        const isLast = idx === detail.length - 1;
        if (isLast) {
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
        if (isLast) {
          doc.setTextColor(90, 42, 140);
        } else {
          doc.setTextColor(0, 0, 0);
        }
        doc.text(v, pageWidth - margin, y, { align: "right" });
        y += lineGap;
      });
      y += 4;

      // Footer
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setFont("", "italic");
      doc.setTextColor(120, 120, 120);
      const footer = doc.splitTextToSize(
        "Estimation indicative — chiffres 2026 conformes au barème SPF Finances (Annexe III AR/CIR 92) et aux taux ONSS officiels. Le précompte exact dépend de votre situation fiscale précise (double pécule, ATN multiples, cotisations spéciales). Régularisation finale via Tax-on-web.",
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

      doc.save(`docbel-brut-net-${now.toISOString().split("T")[0]}.pdf`);
    } finally {
      setExportingPDF(false);
    }
  };

  /* --------------------------------------------------------------- */
  /*  Labels dynamiques selon le mode                                */
  /* --------------------------------------------------------------- */
  const modeLabel = mode === "brut-net" ? "brut → net" : "net → brut";
  const inputLabel =
    mode === "brut-net"
      ? "Salaire mensuel brut"
      : "Salaire mensuel net souhaité";
  const inputHint =
    mode === "brut-net"
      ? "Montant indiqué sur votre fiche de paie avant retenues."
      : "Le calcul cherche le brut qui donne ce net (méthode dichotomique).";

  const lastUpdatedFr = new Date(LAST_UPDATED).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête badges + intro */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalcBadge>
            <span aria-hidden="true">🇧🇪</span>
            Belgique
          </CalcBadge>
          <CalcBadge accent={accent}>ATN 2026</CalcBadge>
          <CalcBadge accent={accent}>Données 2026</CalcBadge>
        </div>
        <p className="text-[13px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          Estimation rapide du <strong>passage brut → net mensuel</strong> pour
          un salarié belge. Inversement possible avec le mode{" "}
          <em>Net → Brut</em>. Inclut voiture de société (ATN) et indemnité
          télétravail — chiffres 2026, voir disclaimer.
        </p>
      </div>

      {/* Layout 2 colonnes : form (gauche) | résultat sticky (droite) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
        {/* ---------- Colonne gauche : formulaire ---------- */}
        <CalcCard className="flex flex-col gap-4">
          <CalcRadio<Mode>
            label="Mode de calcul"
            value={mode}
            onChange={(v) => {
              setMode(v);
              setResult(null);
              setError(null);
            }}
            options={[
              { value: "brut-net", label: "Brut → Net" },
              { value: "net-brut", label: "Net → Brut" },
            ]}
            accent={accent}
          />

          <CalcField
            id="brut-net-montant"
            label={inputLabel}
            hint={inputHint}
            value={montant}
            onChange={setMontant}
            placeholder={mode === "brut-net" ? "ex : 3000" : "ex : 2150"}
            suffix="€"
            min={100}
          />

          <CalcGrid cols={2}>
            <CalcSelect<StatutFiscal>
              id="brut-net-statut"
              label="Statut fiscal"
              value={statut}
              onChange={setStatut}
              options={STATUTS}
            />
            <CalcSelect
              id="brut-net-enfants"
              label="Enfants à charge"
              value={enfants}
              onChange={setEnfants}
              options={ENFANTS_OPTIONS}
            />
          </CalcGrid>

          <CalcGrid cols={2}>
            <CalcSelect<Region>
              id="brut-net-region"
              label="Région"
              value={region}
              onChange={setRegion}
              options={REGIONS}
              hint="Impact marginal sur le précompte mensuel."
            />
            <YesNoToggle
              label="Chèques-repas"
              hint="≈ 21 jours / mois × 8,91 €"
              value={chequesRepas}
              onChange={setChequesRepas}
              accent={accent}
            />
          </CalcGrid>

          <CalcGrid cols={2}>
            <YesNoToggle
              label="Voiture société"
              hint="Avantage en nature imposable (ATN)."
              value={hasVehicule}
              onChange={setHasVehicule}
              accent={accent}
            />
            <CalcField
              id="brut-net-telework"
              label="Indemnité télétravail"
              hint="Plafond 2026 : 154,74 €/mois."
              value={telework}
              onChange={setTelework}
              placeholder="ex : 154"
              suffix="€"
              min={0}
              max={200}
            />
          </CalcGrid>

          {hasVehicule === "oui" ? (
            <CalcGrid cols={3}>
              <CalcField
                id="brut-net-valeur-catalogue"
                label="Valeur catalogue HT"
                hint="Prix neuf hors TVA."
                value={valeurCatalogue}
                onChange={setValeurCatalogue}
                placeholder="ex : 35000"
                suffix="€"
                min={0}
              />
              <CalcField
                id="brut-net-age-vehicule"
                label="Âge du véhicule"
                hint="En années (0 = neuf)."
                value={ageVehicule}
                onChange={setAgeVehicule}
                placeholder="0"
                suffix="ans"
                min={0}
                max={30}
              />
              <CalcSelect<MotorisationVehicule>
                id="brut-net-motorisation"
                label="Motorisation"
                value={motorisation}
                onChange={setMotorisation}
                options={MOTORISATIONS}
              />
            </CalcGrid>
          ) : null}

          {error ? <CalcError>{error}</CalcError> : null}

          <CalcSubmitButton accent={accent} onClick={handleCalc}>
            Calculer {modeLabel}
          </CalcSubmitButton>
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
              <ResultPanel
                result={result}
                mode={mode}
                accent={accent}
                onExportPDF={handleExportPDF}
                exporting={exportingPDF}
              />
            ) : (
              <ResultPlaceholder accent={accent} mode={mode} />
            )}
          </CalcCard>
        </div>
      </div>

      {/* Mention "Mis à jour" */}
      <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
        Calculateur mis à jour le <strong>{lastUpdatedFr}</strong> · Données
        2026 · Conforme à l&apos;Annexe III AR/CIR 92 · Sources : SPF Finances
        et ONSS.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panneau résultat (rempli)                                         */
/* ------------------------------------------------------------------ */

function ResultPanel({
  result,
  mode,
  accent,
  onExportPDF,
  exporting,
}: {
  result: BrutNetResult;
  mode: Mode;
  accent: string;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  const headlineValue = mode === "brut-net" ? result.net : result.brut;
  const headlineUnit = mode === "brut-net" ? "/ mois net" : "/ mois brut";

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
          title="Estimation indicative basée sur les barèmes 2026"
          aria-label="Estimation indicative basée sur les barèmes 2026"
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
          {fmtEUR(headlineValue)}
        </div>
        <div
          className="mt-1 text-[13px] font-semibold"
          style={{ color: "var(--glass-ink-soft)" }}
        >
          {headlineUnit}
        </div>
        <div className="mt-2 text-[12.5px] text-[color:var(--glass-ink-soft)]">
          Taux net / brut :{" "}
          <strong style={{ color: "var(--glass-ink)" }}>
            {(result.tauxNetBrut * 100).toFixed(1)} %
          </strong>
          {mode === "net-brut" ? (
            <> — pour un net de {fmtEUR(result.net)}</>
          ) : null}
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
          <ResultRow label="Salaire brut" value={fmtEUR(result.brut)} />
          <ResultRow
            label={
              result.bonus > 0
                ? `ONSS retenue (workbonus −${fmtEUR(result.bonus)})`
                : "Cotisations ONSS (13,07 %)"
            }
            value={fmtEUR(result.onssRetenue)}
            direction="minus"
          />
          {result.atn > 0 ? (
            <ResultRow
              label="ATN voiture société (imposable)"
              value={fmtEUR(result.atn)}
              direction="plus"
            />
          ) : null}
          <ResultRow
            label="= Salaire imposable"
            value={fmtEUR(result.imposable)}
          />
          <ResultRow
            label="Précompte professionnel"
            value={fmtEUR(result.precompte)}
            direction="minus"
          />
          {result.cotisationSpeciale > 0 ? (
            <ResultRow
              label="Cotisation spéciale sécu"
              value={fmtEUR(result.cotisationSpeciale)}
              direction="minus"
            />
          ) : null}
          {result.chequesRepas > 0 ? (
            <ResultRow
              label="Chèques-repas (≈ 21 j)"
              value={fmtEUR(result.chequesRepas)}
              direction="plus"
            />
          ) : null}
          {result.indemniteTelework > 0 ? (
            <ResultRow
              label="Indemnité télétravail"
              value={fmtEUR(result.indemniteTelework)}
              direction="plus"
            />
          ) : null}
          <ResultRow
            label="Net en poche"
            value={fmtEUR(result.net)}
            emphasis
          />
        </div>
      </div>

      <div
        className="rounded-xl p-3 text-[11.5px] leading-[1.55]"
        style={{
          background: `${accent}10`,
          border: `1px solid ${accent}25`,
          color: "var(--glass-ink-soft)",
        }}
      >
        <strong>Estimation indicative</strong> — chiffres 2026 simplifiés.
        L'ATN voiture utilise les coefficients CO2 moyens et la décote d'âge
        officielle (AR 14/01/2014). Le précompte exact dépend de votre
        situation fiscale précise.
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

function ResultPlaceholder({
  accent,
  mode,
}: {
  accent: string;
  mode: Mode;
}) {
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
        style={{ maxWidth: 240 }}
      >
        Saisissez un montant et cliquez sur{" "}
        <em>« Calculer {mode === "brut-net" ? "brut → net" : "net → brut"} »</em>{" "}
        pour voir le détail.
      </div>
      <Info
        className="mt-1 size-5"
        style={{ color: "var(--glass-ink-faint)" }}
      />
    </div>
  );
}
