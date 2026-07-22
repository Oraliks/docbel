"use client";

/**
 * Calculateur "Délai de préavis" — UI refondue 2026-05.
 *
 * Refonte UX : layout 2 colonnes (form / résultat sticky), badges régime
 * détecté auto, export PDF du détail, mention "Mis à jour". S'appuie sur
 * les primitives partagées de `./_shared` (CalcCard, CalcBadge, ResultRow,
 * etc.) et garde la logique métier 100 % inchangée — c'est la même que
 * dans l'ancien `CalcPreavis` de `tool-views.tsx`.
 *
 * La logique repose sur :
 *  - `lib/date-utils` pour parser / calculer l'ancienneté
 *  - `lib/notice-periods-spf` pour les barèmes officiels SPF (pré/post 2014)
 *  - `lib/data-client` pour la liste des commissions paritaires (autocomplete)
 */

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Calendar,
  Clock,
  Download,
  Info,
  Search,
  User,
  Building2,
  Gift,
  Check,
  RotateCcw,
} from "lucide-react";
import { NOTICE_PERIODS_EMPLOYE_AVANT_2014 } from "@/lib/docbel-data";
import {
  NOTICE_PERIODS_POST_2014,
  NOTICE_PERIODS_DEMISSION_POST_2014,
  NOTICE_PERIODS_OUVRIER_PRE_2014_CCT75,
  getNoticeDaysFromTable,
  getNoticeWeeksFromTable,
} from "@/lib/notice-periods-spf";
import {
  parseDate,
  formatDate,
  calculateSeniority,
  addDaysToDate,
  isBeforeThreshold,
} from "@/lib/date-utils";
import {
  getCommissionsParitaires,
  searchCommissions,
  type CommissionParitaire,
} from "@/lib/data-client";
import {
  CalcBadge,
  CalcCard,
  CalcError,
  CalcGrid,
  CalcSubmitButton,
} from "./_shared";

const LAST_UPDATED = "2026-04-26";

type Statut = "ouvrier" | "employe";
type QuiRompt = "employeur" | "travailleur";
type EmploiType = "fullTime" | "partTime";

interface PreavisResult {
  regime: "avant2014" | "après2014";
  delaiJours: number;
  delaiSemaines: number;
  dateFinPreavis: string;
  details: string;
  icl?: { jours: number; raison: string };
}

/* ------------------------------------------------------------------ */
/*  Toggle segmenté full-width (3 cols Statut / Rupture / Emploi)     */
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

export function CalcPreavis({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  const [statut, setStatut] = useState<Statut>("ouvrier");
  const [quiRompt, setQuiRompt] = useState<QuiRompt>("employeur");
  const [emploiType, setEmploiType] = useState<EmploiType>("fullTime");
  const [dateEntree, setDateEntree] = useState("");
  const [dateDimission, setDateDimission] = useState("");
  const [commissionSearch, setCommissionSearch] = useState("");
  const [selectedCommission, setSelectedCommission] =
    useState<CommissionParitaire | null>(null);
  const [showCommissionDropdown, setShowCommissionDropdown] = useState(false);
  const [salaire, setSalaire] = useState("");
  const [result, setResult] = useState<PreavisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [allCommissions, setAllCommissions] = useState<CommissionParitaire[]>(
    [],
  );
  const [exportingPDF, setExportingPDF] = useState(false);

  // Load commissions on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const commissions = await getCommissionsParitaires();
        setAllCommissions(commissions);
      } catch (err) {
        console.error("Error loading commissions:", err);
      }
    };
    loadData();
  }, []);

  // Régime applicable détecté automatiquement selon la date d'entrée.
  // Affiché sous forme de badge en tête de carte form une fois la date
  // saisie ; le panneau résultat affiche aussi la version "Avant/Après
  // 2014" pour confirmer ce qui a été appliqué.
  const detectedRegime: "avant2014" | "après2014" | null = (() => {
    if (!dateEntree) return null;
    const dt = parseDate(dateEntree);
    if (!dt) return null;
    return isBeforeThreshold(dt) ? "avant2014" : "après2014";
  })();

  const filteredCommissions = searchCommissions(
    allCommissions,
    commissionSearch,
  ).slice(0, 8);

  const reset = () => {
    setStatut("ouvrier");
    setQuiRompt("employeur");
    setEmploiType("fullTime");
    setDateEntree("");
    setDateDimission("");
    setCommissionSearch("");
    setSelectedCommission(null);
    setSalaire("");
    setResult(null);
    setErrorMsg("");
  };

  /* --------------------------------------------------------------- */
  /*  Calcul — logique inchangée par rapport à l'ancien composant    */
  /* --------------------------------------------------------------- */
  const calc = () => {
    setErrorMsg("");
    setResult(null);

    if (!dateEntree) {
      setErrorMsg(t("pvErrDateEntree"));
      return;
    }
    if (!dateDimission) {
      setErrorMsg(t("pvErrDateLicenciement"));
      return;
    }
    if (!selectedCommission) {
      setErrorMsg(t("pvErrCommission"));
      return;
    }

    const dtEntree = parseDate(dateEntree);
    const dtDimission = parseDate(dateDimission);

    if (!dtEntree || !dtDimission || dtDimission <= dtEntree) {
      setErrorMsg(t("pvErrDateOrder"));
      return;
    }

    const threshold = new Date(2014, 0, 1);
    const isAvant2014 = isBeforeThreshold(dtEntree);
    const contractSpans2014 =
      dtEntree < threshold && dtDimission >= threshold;

    let calcResult: PreavisResult;

    if (contractSpans2014) {
      const lastDayOf2013 = new Date(2013, 11, 31);
      const seniorityBefore2014 = calculateSeniority(dtEntree, lastDayOf2013);
      const seniorityAfter2014 = calculateSeniority(threshold, dtDimission);

      let joursBefore2014 = 0;
      let joursAfter2014 = 0;
      let detailsBefore = "";
      let detailsAfter = "";
      let iclInfo: { jours: number; raison: string } | undefined;

      if (statut === "ouvrier") {
        joursBefore2014 =
          getNoticeDaysFromTable(
            seniorityBefore2014,
            NOTICE_PERIODS_OUVRIER_PRE_2014_CCT75,
          ) || 112;
        detailsBefore = t("pvDetailOuvrierBefore", { jours: joursBefore2014 });
      } else {
        if (!salaire) {
          setErrorMsg(t("pvErrSalaireEmploye"));
          return;
        }
        const sal = parseFloat(salaire);
        if (isNaN(sal) || sal <= 0) {
          setErrorMsg(t("pvErrSalaireInvalide"));
          return;
        }
        const tableBefore =
          quiRompt === "employeur"
            ? NOTICE_PERIODS_EMPLOYE_AVANT_2014.employeur
            : NOTICE_PERIODS_EMPLOYE_AVANT_2014.travailleur;
        let moisBefore = 0;
        if (sal <= 32254) {
          moisBefore =
            tableBefore.salaireMax32254.moisMin +
            seniorityBefore2014 * tableBefore.salaireMax32254.moisPerAn;
        } else if (sal <= 64508) {
          moisBefore =
            tableBefore.salaire32254a64508.moisMin +
            seniorityBefore2014 * tableBefore.salaire32254a64508.moisPerAn;
        } else {
          moisBefore =
            tableBefore.salaireMax64508.moisMin +
            seniorityBefore2014 * tableBefore.salaireMax64508.moisPerAn;
        }
        joursBefore2014 = Math.ceil(moisBefore * 30.44);
        detailsBefore = t("pvDetailEmployeBefore", {
          mois: moisBefore.toFixed(2),
          sal,
        });
      }

      const tableAfter =
        quiRompt === "employeur"
          ? NOTICE_PERIODS_POST_2014
          : NOTICE_PERIODS_DEMISSION_POST_2014;
      const semaines =
        getNoticeWeeksFromTable(seniorityAfter2014, tableAfter) || 13;
      joursAfter2014 = semaines * 7;
      detailsAfter = t("pvDetailAfter", {
        semaines,
        rupture: quiRompt === "employeur" ? "licenciement" : "demission",
      });

      const totalJours = joursBefore2014 + joursAfter2014;

      if (joursBefore2014 > joursAfter2014) {
        const iclDayDiff = joursBefore2014 - joursAfter2014;
        iclInfo = {
          jours: iclDayDiff,
          raison: t("pvIclReason", { jours: iclDayDiff }),
        };
      }

      calcResult = {
        regime: "avant2014",
        delaiJours: totalJours,
        delaiSemaines: Math.ceil(totalJours / 7),
        dateFinPreavis: formatDate(addDaysToDate(dtDimission, totalJours)),
        details: `${detailsBefore} + ${detailsAfter}`,
        icl: iclInfo,
      };
    } else if (isAvant2014) {
      const seniority = calculateSeniority(dtEntree, dtDimission);
      if (statut === "ouvrier") {
        const jours =
          getNoticeDaysFromTable(
            seniority,
            NOTICE_PERIODS_OUVRIER_PRE_2014_CCT75,
          ) || 112;
        calcResult = {
          regime: "avant2014",
          delaiJours: jours,
          delaiSemaines: Math.ceil(jours / 7),
          dateFinPreavis: formatDate(addDaysToDate(dtDimission, jours)),
          details: t("pvDetailOuvrierPre2014", { jours }),
        };
      } else {
        if (!salaire) {
          setErrorMsg(t("pvErrSalaireEmployePre2014"));
          return;
        }
        const sal = parseFloat(salaire);
        if (isNaN(sal) || sal <= 0) {
          setErrorMsg(t("pvErrSalaireInvalide"));
          return;
        }
        const table =
          quiRompt === "employeur"
            ? NOTICE_PERIODS_EMPLOYE_AVANT_2014.employeur
            : NOTICE_PERIODS_EMPLOYE_AVANT_2014.travailleur;
        let moisPreavis = 0;
        if (sal <= 32254) {
          moisPreavis =
            table.salaireMax32254.moisMin +
            seniority * table.salaireMax32254.moisPerAn;
        } else if (sal <= 64508) {
          moisPreavis =
            table.salaire32254a64508.moisMin +
            seniority * table.salaire32254a64508.moisPerAn;
        } else {
          moisPreavis =
            table.salaireMax64508.moisMin +
            seniority * table.salaireMax64508.moisPerAn;
        }
        const jours = Math.ceil(moisPreavis * 30.44);
        calcResult = {
          regime: "avant2014",
          delaiJours: jours,
          delaiSemaines: Math.ceil(jours / 7),
          dateFinPreavis: formatDate(addDaysToDate(dtDimission, jours)),
          details: t("pvDetailEmployePre2014", {
            mois: moisPreavis.toFixed(2),
            sal,
          }),
        };
      }
    } else {
      const seniority = calculateSeniority(dtEntree, dtDimission);
      const tableAfter =
        quiRompt === "employeur"
          ? NOTICE_PERIODS_POST_2014
          : NOTICE_PERIODS_DEMISSION_POST_2014;
      const semaines = getNoticeWeeksFromTable(seniority, tableAfter) || 13;
      const jours = semaines * 7;
      calcResult = {
        regime: "après2014",
        delaiJours: jours,
        delaiSemaines: semaines,
        dateFinPreavis: formatDate(addDaysToDate(dtDimission, jours)),
        details: t("pvDetailUnifie", {
          semaines,
          rupture: quiRompt === "employeur" ? "licenciement" : "demission",
        }),
      };
    }

    setResult(calcResult);
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
      doc.text(t("pvPdfGeneratedAt", { date: dateStr, time: timeStr }), pageWidth - margin, y, {
        align: "right",
      });
      y += 10;

      // Titre
      doc.setFontSize(15);
      doc.setFont("", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(t("pvPdfTitle"), margin, y);
      y += 10;

      // Section Inputs
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("pvPdfParams"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const rows: [string, string][] = [
        [t("pvLabelStatut"), statut === "ouvrier" ? t("pvOptOuvrier") : t("pvOptEmploye")],
        [
          t("pvLabelRupture"),
          quiRompt === "employeur" ? t("pvOptEmployeur") : t("pvOptTravailleur"),
        ],
        [
          t("pvLabelEmploiType"),
          emploiType === "fullTime" ? t("pvOptTempsPlein") : t("pvOptTempsPartiel"),
        ],
        [
          t("pvLabelCommission"),
          selectedCommission ? selectedCommission.label : "—",
        ],
        [t("pvLabelDateEntree"), dateEntree],
        [t("pvLabelDateLicenciement"), dateDimission],
      ];
      if (statut === "employe" && salaire) {
        rows.push([t("pvPdfSalaireBrut"), t("pvPdfSalaireValue", { sal: salaire })]);
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

      // Résultat
      const boxH = 28;
      doc.setFillColor(248, 244, 252);
      doc.setDrawColor(159, 124, 255);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, y, pageWidth - margin * 2, boxH, 2, 2, "FD");

      doc.setFontSize(10);
      doc.setFont("", "bold");
      doc.setTextColor(90, 42, 140);
      doc.text(t("pvPdfResultHeading"), margin + 4, y + 7);

      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(
        t("pvPdfWeeks", { n: result.delaiSemaines }),
        margin + 4,
        y + 17,
      );

      doc.setFontSize(9);
      doc.setFont("", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        t("pvPdfDaysRegime", {
          jours: result.delaiJours,
          regime: result.regime === "avant2014" ? "avant" : "apres",
        }),
        margin + 4,
        y + 24,
      );
      y += boxH + 8;

      // Détail
      doc.setFontSize(11);
      doc.setFont("", "bold");
      doc.setTextColor(200, 16, 46);
      doc.text(t("pvPdfDetailHeading"), margin, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setFont("", "normal");
      doc.setTextColor(0, 0, 0);

      const detail: [string, string][] = [
        [t("pvResFinLabel"), result.dateFinPreavis],
        [t("pvResStartLabel"), t("pvResStartValue")],
        [t("pvResRuleLabel"), result.details],
      ];
      if (result.icl) {
        detail.push([t("pvPdfIclLabel"), t("pvPdfIclValue", { jours: result.icl.jours })]);
      }
      detail.forEach(([k, v]) => {
        doc.setTextColor(80, 80, 80);
        doc.text(k, colKey, y);
        doc.setTextColor(0, 0, 0);
        const wrapped = doc.splitTextToSize(
          v,
          pageWidth - colVal - margin + 5,
        );
        doc.text(wrapped, colVal, y);
        y += lineGap * wrapped.length;
      });
      y += 4;

      // Disclaimer
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setFont("", "italic");
      doc.setTextColor(120, 120, 120);
      const footerText = doc.splitTextToSize(
        t("pvPdfDisclaimer"),
        pageWidth - margin * 2,
      );
      doc.text(footerText, margin, y);
      y += footerText.length * 4 + 4;

      doc.setFont("", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(
        "Docbel © 2026 | https://www.docbel.be",
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" },
      );

      doc.save(`docbel-preavis-${now.toISOString().split("T")[0]}.pdf`);
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
          {/* En-tête de carte : titre + badge régime détecté */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                }}
              >
                <Calendar className="size-5" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold text-[color:var(--glass-ink)]">
                  {t("pvTitle")}
                </h2>
                <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
                  {t("pvSubtitle")}
                </p>
              </div>
            </div>
            {detectedRegime ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.04em]"
                style={{
                  background: "var(--glass-success-surface)",
                  border: "1px solid var(--glass-success-border)",
                  color: "var(--glass-success-ink)",
                }}
              >
                <Check className="size-3.5" strokeWidth={3} />
                {t("pvBadgeRegimeDetected")}
              </span>
            ) : null}
          </div>

          {/* Row 1 : Statut / Rupture par / Type d'emploi */}
          <CalcGrid cols={3}>
            <SegmentedToggle<Statut>
              label={t("pvLabelStatut")}
              value={statut}
              onChange={(v) => {
                setStatut(v);
                setSalaire("");
              }}
              options={[
                {
                  value: "ouvrier",
                  label: t("pvOptOuvrier"),
                  icon: <User className="size-3.5" />,
                },
                {
                  value: "employe",
                  label: t("pvOptEmploye"),
                  icon: <User className="size-3.5" />,
                },
              ]}
              accent={accent}
            />
            <SegmentedToggle<QuiRompt>
              label={t("pvLabelRupture")}
              value={quiRompt}
              onChange={setQuiRompt}
              options={[
                {
                  value: "employeur",
                  label: t("pvOptEmployeur"),
                  icon: <Building2 className="size-3.5" />,
                },
                {
                  value: "travailleur",
                  label: t("pvOptTravailleur"),
                  icon: <User className="size-3.5" />,
                },
              ]}
              accent={accent}
            />
            <SegmentedToggle<EmploiType>
              label={t("pvLabelEmploiType")}
              value={emploiType}
              onChange={setEmploiType}
              options={[
                {
                  value: "fullTime",
                  label: t("pvOptTempsPlein"),
                  icon: <Calendar className="size-3.5" />,
                },
                {
                  value: "partTime",
                  label: t("pvOptTempsPartiel"),
                  icon: <Clock className="size-3.5" />,
                },
              ]}
              accent={accent}
            />
          </CalcGrid>

          {/* Commission paritaire (autocomplete) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-[color:var(--glass-ink)]">
              {t("pvLabelCommission")}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[color:var(--glass-ink-faint)]">
                <Search className="size-4" />
              </span>
              <input
                type="text"
                value={commissionSearch}
                onChange={(e) => {
                  setCommissionSearch(e.target.value);
                  setShowCommissionDropdown(true);
                  if (e.target.value === "") setSelectedCommission(null);
                }}
                onFocus={() => setShowCommissionDropdown(true)}
                onBlur={() =>
                  setTimeout(() => setShowCommissionDropdown(false), 150)
                }
                placeholder={t("pvCommissionPlaceholder")}
                className="h-11 w-full rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] pr-3.5 pl-10 text-[14px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:border-[color:var(--glass-accent-deep)] focus:outline-none"
              />
              {showCommissionDropdown && filteredCommissions.length > 0 ? (
                <div
                  className="absolute top-full right-0 left-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] shadow-lg"
                  style={{ background: "var(--glass-surface)" }}
                >
                  {filteredCommissions.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        setSelectedCommission(c);
                        setCommissionSearch(c.label);
                        setShowCommissionDropdown(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b border-[color:var(--glass-border)] px-3.5 py-2.5 text-left text-[13px] text-[color:var(--glass-ink)] transition hover:bg-[color:var(--glass-ink-line)]/30 last:border-b-0"
                    >
                      <span className="font-semibold">{c.numero}</span>
                      <span className="truncate text-[12px] text-[color:var(--glass-ink-soft)]">
                        {c.nom}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Dates : 2 cols */}
          <CalcGrid cols={2}>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="preavis-date-entree"
                className="flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--glass-ink)]"
              >
                {t("pvLabelDateEntree")}
                <span title={t("pvTooltipDateEntree")}>
                  <Info className="size-3.5 text-[color:var(--glass-ink-faint)]" />
                </span>
              </label>
              <input
                id="preavis-date-entree"
                type="text"
                inputMode="numeric"
                value={dateEntree}
                onChange={(e) => setDateEntree(e.target.value)}
                placeholder={t("pvDatePlaceholder")}
                className="h-11 rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 text-[14px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:border-[color:var(--glass-accent-deep)] focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="preavis-date-licenciement"
                className="flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--glass-ink)]"
              >
                {t("pvLabelDateLicenciement")}
                <span title={t("pvTooltipDateLicenciement")}>
                  <Info className="size-3.5 text-[color:var(--glass-ink-faint)]" />
                </span>
              </label>
              <input
                id="preavis-date-licenciement"
                type="text"
                inputMode="numeric"
                value={dateDimission}
                onChange={(e) => setDateDimission(e.target.value)}
                placeholder={t("pvDatePlaceholder")}
                className="h-11 rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 text-[14px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:border-[color:var(--glass-accent-deep)] focus:outline-none"
              />
            </div>
          </CalcGrid>

          {/* Salaire annuel (uniquement employé pré-2014 ou contrat spanning) */}
          {statut === "employe" &&
          dateEntree &&
          parseDate(dateEntree) &&
          isBeforeThreshold(parseDate(dateEntree)!) ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="preavis-salaire"
                className="text-[12px] font-semibold text-[color:var(--glass-ink)]"
              >
                {t("pvLabelSalaire")}{" "}
                <span className="text-[color:var(--glass-ink-faint)]">
                  {t("pvLabelSalaireSuffix")}
                </span>
              </label>
              <input
                id="preavis-salaire"
                type="number"
                value={salaire}
                onChange={(e) => setSalaire(e.target.value)}
                placeholder={t("pvSalairePlaceholder")}
                className="h-11 rounded-xl border-[1.5px] border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 text-[14px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:border-[color:var(--glass-accent-deep)] focus:outline-none"
              />
              <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
                {t("pvSalaireHint")}
              </p>
            </div>
          ) : null}

          {errorMsg ? <CalcError>{errorMsg}</CalcError> : null}

          {/* Boutons : Calculer + Réinitialiser */}
          <CalcGrid cols={2}>
            <CalcSubmitButton accent={accent} onClick={calc}>
              {t("pvSubmit")}
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
              {t("pvReset")}
            </button>
          </CalcGrid>

          {/* Info disclaimer en bas du form */}
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
              {t.rich("pvDisclaimer", {
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
              <PreavisResultPanel
                result={result}
                accent={accent}
                onExportPDF={handleExportPDF}
                exporting={exportingPDF}
              />
            ) : (
              <PreavisResultPlaceholder accent={accent} />
            )}
          </CalcCard>
        </div>
      </div>

      {/* Mention "Mis à jour" */}
      <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
        {t.rich("pvFooter", {
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

function PreavisResultPanel({
  result,
  accent,
  onExportPDF,
  exporting,
}: {
  result: PreavisResult;
  accent: string;
  onExportPDF: () => void;
  exporting: boolean;
}) {
  const t = useTranslations("public.outils");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.06em]"
          style={{ color: accent }}
        >
          {t("pvResultEyebrow")}
        </span>
        <span
          className="inline-flex items-center"
          title={t("pvResultInfoTooltip")}
          aria-label={t("pvResultInfoTooltip")}
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
          style={{ fontSize: 42, lineHeight: 1.05 }}
        >
          {result.delaiSemaines}{" "}
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {t("pvResWeeksUnit")}
          </span>
        </div>
        <div
          className="mt-1 text-[13px] font-semibold"
          style={{ color: "var(--glass-ink-soft)" }}
        >
          {t("pvResDays", { jours: result.delaiJours })}
        </div>
        <div className="mt-2">
          <CalcBadge accent="var(--chart-4)">
            {t("pvResRegimeBadge", {
              regime: result.regime === "avant2014" ? "avant" : "apres",
            })}
          </CalcBadge>
        </div>
      </div>

      <div
        className="border-t pt-3"
        style={{ borderTopColor: "var(--glass-ink-line)" }}
      >
        <div className="flex flex-col gap-3">
          <ResultDetailRow
            icon={<Calendar className="size-4" />}
            label={t("pvResFinLabel")}
            value={result.dateFinPreavis}
            accent={accent}
          />
          <ResultDetailRow
            icon={<Clock className="size-4" />}
            label={t("pvResStartLabel")}
            value={t("pvResStartValue")}
            accent={accent}
          />
          <ResultDetailRow
            icon={<Gift className="size-4" />}
            label={t("pvResRuleLabel")}
            value={result.details}
            accent={accent}
          />
        </div>
      </div>

      {result.icl ? (
        <div
          className="rounded-xl p-3 text-[11.5px] leading-[1.55]"
          style={{
            background: `${accent}18`,
            border: `1px solid ${accent}40`,
            color: "var(--glass-ink)",
          }}
        >
          {t.rich("pvIclWarning", {
            jours: result.icl.jours,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}{" "}
          {result.icl.raison}
        </div>
      ) : null}

      <div
        className="rounded-xl p-3 text-[11.5px] leading-[1.6]"
        style={{
          background: "var(--glass-info-surface)",
          border: "1px solid var(--glass-info-border)",
          color: "var(--glass-info-ink)",
        }}
      >
        <div className="mb-1 flex items-center gap-1.5 font-bold">
          <Info className="size-3.5" /> {t("pvNoticeTitle")}
        </div>
        <ul className="list-inside list-disc space-y-1 text-[color:var(--glass-info-ink)]">
          <li>{t("pvNoticeBullet1")}</li>
          <li>{t("pvNoticeBullet2")}</li>
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
        {exporting ? t("pvPdfGenerating") : t("pvPdfDownload")}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ligne de détail avec icône (résultat préavis)                     */
/* ------------------------------------------------------------------ */

function ResultDetailRow({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${accent}18`, color: accent }}
      >
        {icon}
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-[11.5px] font-semibold text-[color:var(--glass-ink-soft)]">
          {label}
        </span>
        <span className="text-[13px] font-bold text-[color:var(--glass-ink)]">
          {value}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder : avant le premier calcul                             */
/* ------------------------------------------------------------------ */

function PreavisResultPlaceholder({ accent }: { accent: string }) {
  const t = useTranslations("public.outils");
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
      <span
        className="text-[11px] font-bold uppercase tracking-[0.06em]"
        style={{ color: accent }}
      >
        {t("pvResultEyebrow")}
      </span>
      <div
        className="text-[15px] font-semibold leading-snug text-[color:var(--glass-ink-soft)]"
        style={{ maxWidth: 260 }}
      >
        {t.rich("pvPlaceholderBody", {
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
