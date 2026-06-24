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
import { useTranslations } from "next-intl";
import {
  Briefcase,
  HardHat,
  Download,
  Info,
  RotateCcw,
  ExternalLink,
  Sun,
} from "lucide-react";
import { CountryFlag } from "@/components/docbel/country-flag";
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
  const t = useTranslations("public.outils");
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
      setError(t("pecErrorBrut"));
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
      doc.text(t("pecPdfGenerated", { date: dateStr, time: timeStr }), pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(
        t("pecPdfTitle", {
          regime:
            result.statut === "employe"
              ? t("pecPdfRegimeEmploye")
              : t("pecPdfRegimeOuvrier"),
        }),
        margin,
        y,
      );
      y += 10;

      // Section Inputs
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("pecPdfParams"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const rows: [string, string][] = [
        [
          t("pecPdfRowStatut"),
          statut === "employe"
            ? t("pecPdfStatutEmploye")
            : t("pecPdfStatutOuvrier"),
        ],
        [t("pecPdfRowBrut"), fmtEUR(parseNum(brutMensuel) || 0)],
        [t("pecPdfRowMois"), moisPrestes || "12"],
        [
          t("pecPdfRowTemps"),
          tempsPartiel === "oui"
            ? t("pecPdfTempsPartiel", { taux: tauxOccupation || "—" })
            : t("pecPdfTempsPlein"),
        ],
      ];
      if (statut === "employe") {
        rows.push([
          t("pecPdfRowJeune"),
          jeune === "oui" ? t("pecPdfOui") : t("pecPdfNon"),
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
      doc.text(t("pecPdfTotalLabel"), margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(fmtEUR(result.totalBrut), margin + 4, y + 17);

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        t("pecPdfTotalSub", {
          net: fmtEUR(result.totalNetEstime),
          versement:
            result.statut === "ouvrier"
              ? t("pecPdfVersementOnva")
              : t("pecPdfVersementEmploye"),
        }),
        margin + 4,
        y + 24,
      );
      y += boxH + 8;

      // Détail
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("pecDetailTitle"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const detail: [string, string, boolean?][] = [
        [t("pecRowSimpleBrut"), fmtEUR(result.peculeSimpleBrut)],
        [t("pecPdfRowSimpleNet"), fmtEUR(result.peculeSimpleNetEstime)],
        [t("pecRowDoubleBrut"), fmtEUR(result.doublePeculeBrut)],
        [t("pecPdfRowDoubleNet"), fmtEUR(result.doublePeculeNetEstime)],
        [t("pecRowTotalBrut"), fmtEUR(result.totalBrut), true],
        [t("pecRowTotalNet"), fmtEUR(result.totalNetEstime), true],
      ];

      if (result.statut === "employe") {
        detail.push([
          t("pecPdfRowPrecompte"),
          fmtPct(result.tauxPrecompteAppliquePourcent, 2),
        ]);
      } else {
        detail.push([
          t("pecPdfRowRetenueOnva"),
          t("pecPdfRetenueOnvaValue", {
            taux: fmtPct(result.tauxPrecompteAppliquePourcent, 2),
          }),
        ]);
        detail.push([
          t("pecPdfRowCoefOnva"),
          ONVA_COEF_MAJORATION.toLocaleString("fr-BE"),
        ]);
        detail.push([
          t("pecPdfRowTauxOnva"),
          fmtPct(ONVA_TAUX_TOTAL * 100, 2),
        ]);
      }

      detail.forEach(([k, v, isTotalFlag]) => {
        const isTotal = Boolean(isTotalFlag);
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
        doc.text(t("pecPdfJeunesTitle"), margin + 4, y + 6);
        doc.setFont("", "normal");
        doc.setTextColor(30, 58, 138);
        const infoText = doc.splitTextToSize(
          t("pecPdfJeunesText"),
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
        t("pecPdfFooter"),
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
      ? t("pecBrutHintEmploye")
      : t("pecBrutHintOuvrier");

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
                  {t("pecTitle")}
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  {t("pecSubtitle")}
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
              title={t("pecResetFormTitle")}
            >
              <RotateCcw className="size-3.5" />
              {t("pecReset")}
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <CalcBadge>
              <CountryFlag code="be" size={14} country={t("badgeBelgiqueCountry")} />
              {t("badgeBelgiqueCountry")}
            </CalcBadge>
            <CalcBadge accent={accent}>{t("badgeOnva2026")}</CalcBadge>
            <CalcBadge accent={accent}>{t("badgeDonnees2026")}</CalcBadge>
          </div>

          {/* Toggle Statut (employé / ouvrier) */}
          <SegmentedToggle<Statut>
            label={t("pecStatut")}
            value={statut}
            onChange={(v) => {
              setStatut(v);
              if (v === "ouvrier") setJeune("non");
            }}
            options={[
              {
                value: "employe",
                label: t("pecStatutEmploye"),
                icon: <Briefcase className="size-3.5" />,
              },
              {
                value: "ouvrier",
                label: t("pecStatutOuvrier"),
                icon: <HardHat className="size-3.5" />,
              },
            ]}
            accent={accent}
          />

          {/* Brut + mois prestés (2 cols) */}
          <CalcGrid cols={2}>
            <CalcField
              id="pecule-brut"
              label={t("pecBrutLabel")}
              hint={brutHint}
              value={brutMensuel}
              onChange={setBrutMensuel}
              placeholder={t("pecBrutPlaceholder")}
              suffix="€"
              min={100}
              max={50000}
            />
            <CalcField
              id="pecule-mois"
              label={t("pecMoisLabel")}
              hint={t("pecMoisHint")}
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
              label={t("pecTempsPartielLabel")}
              hint={t("pecTempsPartielHint")}
              value={tempsPartiel}
              onChange={setTempsPartiel}
              accent={accent}
            />
            {tempsPartiel === "oui" ? (
              <CalcField
                id="pecule-taux"
                label={t("pecTauxLabel")}
                hint={t("pecTauxHint")}
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
              label={t("pecJeuneLabel")}
              hint={t("pecJeuneHint")}
              value={jeune}
              onChange={setJeune}
              accent={accent}
            />
          ) : null}

          {error ? <CalcError>{error}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={onCalc}>
              {t("pecCalcButton")}
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
              {t("pecResetForm")}
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
              {t.rich("pecDisclaimer", {
                strong: (chunks) => (
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
        {t.rich("pecFooter", {
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
  const t = useTranslations("public.outils");
  const regimeLabel =
    result.statut === "employe"
      ? t("pecRegimeEmploye")
      : t("pecRegimeOnva");
  const versementLabel =
    result.statut === "employe"
      ? t("pecVersementEmploye")
      : t("pecVersementOnva");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: accent }}
        >
          {t("pecResultEyebrow")}
        </span>
        <span
          className="inline-flex items-center"
          title={t("pecResultInfoTitle")}
          aria-label={t("pecResultInfoTitle")}
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
          {t("pecNetEstime", { net: fmtEUR(result.totalNetEstime) })}
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
          {t("pecDetailTitle")}
        </div>
        <div className="flex flex-col gap-1.5">
          <ResultRow
            label={t("pecRowSimpleBrut")}
            value={fmtEUR(result.peculeSimpleBrut)}
          />
          <ResultRow
            label={t("pecRowSimpleNet")}
            value={fmtEUR(result.peculeSimpleNetEstime)}
            direction="plus"
          />
          <ResultRow
            label={t("pecRowDoubleBrut")}
            value={fmtEUR(result.doublePeculeBrut)}
          />
          <ResultRow
            label={t("pecRowDoubleNet")}
            value={fmtEUR(result.doublePeculeNetEstime)}
            direction="plus"
            emphasis
          />
          <ResultRow label={t("pecRowTotalBrut")} value={fmtEUR(result.totalBrut)} />
          <ResultRow
            label={t("pecRowTotalNet")}
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
            <Info className="size-3.5" /> {t("pecJeunesTitle")}
          </div>
          <p className="text-[#1E3A8A]">
            {t.rich("pecJeunesText", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <a
            href="https://www.onem.be/citoyens/conges/avez-vous-droit-aux-vacances-jeunes-"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold underline"
          >
            {t("pecJeunesLink")}
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
          <Info className="size-3.5" /> {t("pecKnowTitle")}
        </div>
        <ul className="list-inside list-disc space-y-1">
          {result.statut === "employe" ? (
            <>
              <li>
                {t.rich("pecKnowEmployeSimple", {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </li>
              <li>
                {t.rich("pecKnowEmployeDouble", {
                  tauxDouble: fmtPct(TAUX_DOUBLE_PECULE_EMPLOYE * 100, 0),
                  taux: fmtPct(result.tauxPrecompteAppliquePourcent, 2),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </li>
              <li>
                {t.rich("pecKnowEmployeAssimiles", {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </li>
            </>
          ) : (
            <>
              <li>
                {t.rich("pecKnowOuvrierOnva", {
                  taux: fmtPct(ONVA_TAUX_TOTAL * 100, 2),
                  coef: ONVA_COEF_MAJORATION.toLocaleString("fr-BE"),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </li>
              <li>
                {t.rich("pecKnowOuvrierRetenue", {
                  total: fmtPct(result.tauxPrecompteAppliquePourcent, 2),
                  onss: fmtPct(ONSS_SPECIALE_DOUBLE_PECULE * 100, 2),
                  solidarite: fmtPct(ONVA_COTISATION_SOLIDARITE * 100, 0),
                  precompteBas: fmtPct(ONVA_PRECOMPTE_BAS * 100, 2),
                  seuil: fmtEUR(ONVA_SEUIL_PRECOMPTE, 0),
                  precompteHaut: fmtPct(ONVA_PRECOMPTE_HAUT * 100, 2),
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </li>
              <li>
                {t.rich("pecKnowOuvrierAssimiles", {
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
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
        {exporting ? t("pecPdfGenerating") : t("pecPdfDownload")}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder : avant le premier calcul                             */
/* ------------------------------------------------------------------ */

function PeculeResultPlaceholder({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        {t("pecResultEyebrow")}
      </span>
      <div
        className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink-soft)]"
        style={{ maxWidth: 260 }}
      >
        {t.rich("pecPlaceholder", {
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
