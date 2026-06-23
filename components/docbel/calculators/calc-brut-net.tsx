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
import { useTranslations } from "next-intl";
import { Download, Info } from "lucide-react";
import { CountryFlag } from "@/components/docbel/country-flag";
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

/**
 * Les libellés d'UI (statut / région / motorisation / enfants) sont
 * externalisés en clés i18n. On ne garde ici que l'ordre des valeurs et la
 * clé de traduction associée ; les `label` affichés sont résolus DANS les
 * composants via `t(...)` (cf. helpers `statutLabel` / `regionLabel` / etc.).
 */
const STATUT_KEYS: Record<StatutFiscal, string> = {
  isole: "bnStatutIsole",
  cohabitant: "bnStatutCohabitant",
  marie_un_revenu: "bnStatutMarieUn",
  marie_deux_revenus: "bnStatutMarieDeux",
};
const STATUT_ORDER: StatutFiscal[] = [
  "isole",
  "cohabitant",
  "marie_un_revenu",
  "marie_deux_revenus",
];

const REGION_KEYS: Record<Region, string> = {
  wallonie: "bnRegionWallonie",
  bruxelles: "bnRegionBruxelles",
  flandre: "bnRegionFlandre",
};
const REGION_ORDER: Region[] = ["wallonie", "bruxelles", "flandre"];

const MOTOR_KEYS: Record<MotorisationVehicule, string> = {
  essence: "bnMotorEssence",
  diesel: "bnMotorDiesel",
  hybride: "bnMotorHybride",
  electrique: "bnMotorElectrique",
};
const MOTOR_ORDER: MotorisationVehicule[] = [
  "essence",
  "diesel",
  "hybride",
  "electrique",
];

/* ------------------------------------------------------------------ */
/*  Composant principal                                               */
/* ------------------------------------------------------------------ */

export function CalcBrutNet({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");

  // Clés dynamiques → cast vers le type de clé attendu par t() (typage strict).
  const tk = (key: string) => t(key as Parameters<typeof t>[0]);
  const statutOptions = STATUT_ORDER.map((value) => ({
    value,
    label: tk(STATUT_KEYS[value]),
  }));
  const regionOptions = REGION_ORDER.map((value) => ({
    value,
    label: tk(REGION_KEYS[value]),
  }));
  const motorOptions = MOTOR_ORDER.map((value) => ({
    value,
    label: tk(MOTOR_KEYS[value]),
  }));
  const enfantsOptions = Array.from({ length: 7 }, (_, i) => ({
    value: String(i) as `${number}`,
    label:
      i === 0 ? t("bnEnfantsAucun") : i === 6 ? t("bnEnfants6Plus") : String(i),
  }));

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
      setError(t("bnErrMontant"));
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
      doc.text(t("bnPdfGeneratedAt", { date: dateStr, time: timeStr }), pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre principal
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        mode === "brut-net"
          ? t("bnPdfTitleBrutNet")
          : t("bnPdfTitleNetBrut"),
        margin,
        y,
      );
      y += 10;

      // Section Inputs
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("bnPdfParams"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const labelInput =
        mode === "brut-net" ? t("bnPdfInputBrut") : t("bnPdfInputNet");
      const rows: [string, string][] = [
        [labelInput, fmtEUR(parseNum(montant))],
        [t("bnStatutFiscal"), tk(STATUT_KEYS[statut])],
        [
          t("bnEnfantsCharge"),
          parseInt(enfants, 10) >= 6 ? t("bnEnfants6Plus") : enfants,
        ],
        [t("bnRegion"), tk(REGION_KEYS[region])],
        [
          t("bnChequesRepas"),
          chequesRepas === "oui" ? t("bnPdfChequesOui") : t("bnPdfNon"),
        ],
      ];
      if (hasVehicule === "oui") {
        rows.push(
          [
            t("bnPdfVoitureValeur"),
            fmtEUR(parseNum(valeurCatalogue) || 0),
          ],
          [t("bnPdfVoitureAge"), t("bnPdfAnsValue", { age: ageVehicule })],
          [t("bnPdfVoitureMotor"), tk(MOTOR_KEYS[motorisation])],
        );
      } else {
        rows.push([t("bnVoitureSociete"), t("bnPdfNon")]);
      }
      const teleNum = parseNum(telework);
      if (Number.isFinite(teleNum) && teleNum > 0) {
        rows.push([t("bnIndemniteTelework"), fmtEUR(teleNum)]);
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
        mode === "brut-net" ? t("bnPdfNetEstime") : t("bnPdfBrutRequis"),
        margin + 4,
        y + 7,
      );

      doc.setFontSize(20);
      doc.setTextColor(0, 0, 0);
      doc.text(
        `${fmtEUR(mode === "brut-net" ? result.net : result.brut)} ${mode === "brut-net" ? t("bnUnitNet") : t("bnUnitBrut")}`,
        margin + 4,
        y + 16,
      );

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        t("bnPdfTauxNetBrut", {
          taux: (result.tauxNetBrut * 100).toFixed(1),
        }),
        margin + 4,
        y + 22,
      );
      y += boxH + 8;

      // Section détail
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("bnDetailCalcul"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const detail: [string, string][] = [
        [t("bnSalaireBrut"), fmtEUR(result.brut)],
        [
          result.bonus > 0
            ? t("bnPdfOnssWorkbonus", { bonus: fmtEUR(result.bonus) })
            : t("bnOnss"),
          `− ${fmtEUR(result.onssRetenue)}`,
        ],
      ];
      if (result.atn > 0) {
        detail.push([t("bnAtnVoiture"), `+ ${fmtEUR(result.atn)}`]);
      }
      detail.push(
        [t("bnSalaireImposable"), fmtEUR(result.imposable)],
        [t("bnPrecompte"), `− ${fmtEUR(result.precompte)}`],
      );
      if (result.cotisationSpeciale > 0) {
        detail.push([
          t("bnCotisationSpeciale"),
          `− ${fmtEUR(result.cotisationSpeciale)}`,
        ]);
      }
      if (result.chequesRepas > 0) {
        detail.push([t("bnChequesRepasDetail"), `+ ${fmtEUR(result.chequesRepas)}`]);
      }
      if (result.indemniteTelework > 0) {
        detail.push([
          t("bnIndemniteTelework"),
          `+ ${fmtEUR(result.indemniteTelework)}`,
        ]);
      }
      detail.push([t("bnPdfNetEnPoche"), fmtEUR(result.net)]);

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
        t("bnPdfDisclaimer"),
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
  const modeLabel =
    mode === "brut-net" ? t("bnModeBrutNet") : t("bnModeNetBrut");
  const inputLabel =
    mode === "brut-net" ? t("bnInputLabelBrut") : t("bnInputLabelNet");
  const inputHint =
    mode === "brut-net" ? t("bnInputHintBrut") : t("bnInputHintNet");

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
            <CountryFlag code="be" size={14} country="Belgique" />
            Belgique
          </CalcBadge>
          <CalcBadge accent={accent}>ATN 2026</CalcBadge>
          <CalcBadge accent={accent}>Données 2026</CalcBadge>
        </div>
        <p className="text-[13px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          {t.rich("bnIntro", {
            strong: (chunks) => <strong>{chunks}</strong>,
            em: (chunks) => <em>{chunks}</em>,
          })}
        </p>
      </div>

      {/* Layout 2 colonnes : form (gauche) | résultat sticky (droite) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
        {/* ---------- Colonne gauche : formulaire ---------- */}
        <CalcCard className="flex flex-col gap-4">
          <CalcRadio<Mode>
            label={t("bnModeCalcul")}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setResult(null);
              setError(null);
            }}
            options={[
              { value: "brut-net", label: t("bnModeOptBrutNet") },
              { value: "net-brut", label: t("bnModeOptNetBrut") },
            ]}
            accent={accent}
          />

          <CalcField
            id="brut-net-montant"
            label={inputLabel}
            hint={inputHint}
            value={montant}
            onChange={setMontant}
            placeholder={
              mode === "brut-net"
                ? t("bnPlaceholderBrut")
                : t("bnPlaceholderNet")
            }
            suffix="€"
            min={100}
          />

          <CalcGrid cols={2}>
            <CalcSelect<StatutFiscal>
              id="brut-net-statut"
              label={t("bnStatutFiscal")}
              value={statut}
              onChange={setStatut}
              options={statutOptions}
            />
            <CalcSelect
              id="brut-net-enfants"
              label={t("bnEnfantsCharge")}
              value={enfants}
              onChange={setEnfants}
              options={enfantsOptions}
            />
          </CalcGrid>

          <CalcGrid cols={2}>
            <CalcSelect<Region>
              id="brut-net-region"
              label={t("bnRegion")}
              value={region}
              onChange={setRegion}
              options={regionOptions}
              hint={t("bnRegionHint")}
            />
            <YesNoToggle
              label={t("bnChequesRepas")}
              hint={t("bnChequesRepasHint")}
              value={chequesRepas}
              onChange={setChequesRepas}
              accent={accent}
            />
          </CalcGrid>

          <CalcGrid cols={2}>
            <YesNoToggle
              label={t("bnVoitureSociete")}
              hint={t("bnVoitureSocieteHint")}
              value={hasVehicule}
              onChange={setHasVehicule}
              accent={accent}
            />
            <CalcField
              id="brut-net-telework"
              label={t("bnIndemniteTelework")}
              hint={t("bnIndemniteTeleworkHint")}
              value={telework}
              onChange={setTelework}
              placeholder={t("bnPlaceholderTelework")}
              suffix="€"
              min={0}
              max={200}
            />
          </CalcGrid>

          {hasVehicule === "oui" ? (
            <CalcGrid cols={3}>
              <CalcField
                id="brut-net-valeur-catalogue"
                label={t("bnValeurCatalogue")}
                hint={t("bnValeurCatalogueHint")}
                value={valeurCatalogue}
                onChange={setValeurCatalogue}
                placeholder={t("bnPlaceholderValeur")}
                suffix="€"
                min={0}
              />
              <CalcField
                id="brut-net-age-vehicule"
                label={t("bnAgeVehicule")}
                hint={t("bnAgeVehiculeHint")}
                value={ageVehicule}
                onChange={setAgeVehicule}
                placeholder="0"
                suffix={t("bnSuffixAns")}
                min={0}
                max={30}
              />
              <CalcSelect<MotorisationVehicule>
                id="brut-net-motorisation"
                label={t("bnMotorisation")}
                value={motorisation}
                onChange={setMotorisation}
                options={motorOptions}
              />
            </CalcGrid>
          ) : null}

          {error ? <CalcError>{error}</CalcError> : null}

          <CalcSubmitButton accent={accent} onClick={handleCalc}>
            {t("bnCalcButton", { mode: modeLabel })}
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
        {t.rich("bnFooterUpdated", {
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
  const t = useTranslations("public.outils");
  const headlineValue = mode === "brut-net" ? result.net : result.brut;
  const headlineUnit =
    mode === "brut-net" ? t("bnUnitNet") : t("bnUnitBrut");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: accent }}
        >
          {t("bnResultEyebrow")}
        </span>
        <span
          className="inline-flex items-center"
          title={t("bnResultInfoTitle")}
          aria-label={t("bnResultInfoTitle")}
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
          {t("bnTauxLabel")}{" "}
          <strong style={{ color: "var(--glass-ink)" }}>
            {(result.tauxNetBrut * 100).toFixed(1)} %
          </strong>
          {mode === "net-brut" ? (
            <> {t("bnTauxPourNet", { net: fmtEUR(result.net) })}</>
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
          {t("bnDetailCalcul")}
        </div>
        <div className="flex flex-col gap-1.5">
          <ResultRow label={t("bnSalaireBrut")} value={fmtEUR(result.brut)} />
          <ResultRow
            label={
              result.bonus > 0
                ? t("bnOnssWorkbonus", { bonus: fmtEUR(result.bonus) })
                : t("bnOnss")
            }
            value={fmtEUR(result.onssRetenue)}
            direction="minus"
          />
          {result.atn > 0 ? (
            <ResultRow
              label={t("bnAtnVoiture")}
              value={fmtEUR(result.atn)}
              direction="plus"
            />
          ) : null}
          <ResultRow
            label={t("bnSalaireImposable")}
            value={fmtEUR(result.imposable)}
          />
          <ResultRow
            label={t("bnPrecompte")}
            value={fmtEUR(result.precompte)}
            direction="minus"
          />
          {result.cotisationSpeciale > 0 ? (
            <ResultRow
              label={t("bnCotisationSpeciale")}
              value={fmtEUR(result.cotisationSpeciale)}
              direction="minus"
            />
          ) : null}
          {result.chequesRepas > 0 ? (
            <ResultRow
              label={t("bnChequesRepasDetail")}
              value={fmtEUR(result.chequesRepas)}
              direction="plus"
            />
          ) : null}
          {result.indemniteTelework > 0 ? (
            <ResultRow
              label={t("bnIndemniteTelework")}
              value={fmtEUR(result.indemniteTelework)}
              direction="plus"
            />
          ) : null}
          <ResultRow
            label={t("bnNetEnPoche")}
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
        {t.rich("bnPanelDisclaimer", {
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
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
        {exporting ? t("bnExporting") : t("bnExportButton")}
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
  const t = useTranslations("public.outils");
  const modeLabel =
    mode === "brut-net" ? t("bnModeBrutNet") : t("bnModeNetBrut");
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        {t("bnResultEyebrow")}
      </span>
      <div
        className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink-soft)]"
        style={{ maxWidth: 240 }}
      >
        {t.rich("bnPlaceholderText", {
          mode: modeLabel,
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
