"use client";

import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { User, Building2, Calendar, Clock, BarChart3, Download, AlertCircle, Lightbulb, Info } from "lucide-react";
import { SearchIcon, BelgianFlag, ArrowIcon } from "./icons";
import { Tool, NOTICE_PERIODS_EMPLOYE_AVANT_2014 } from "@/lib/docbel-data";
import {
  NOTICE_PERIODS_POST_2014,
  NOTICE_PERIODS_DEMISSION_POST_2014,
  NOTICE_PERIODS_OUVRIER_PRE_2014_CCT75,
  getNoticeDaysFromTable,
  getNoticeWeeksFromTable,
} from "@/lib/notice-periods-spf";
import { parseDate, formatDate, calculateSeniority, addDaysToDate, isBeforeThreshold, isValidDate } from "@/lib/date-utils";
import { getCommissionsParitaires, searchCommissions, CommissionParitaire } from "@/lib/data-client";
import { BureauLocator } from "./bureau-locator";
import { BureauCallout } from "./bureau-callout";

interface ViewProps {
  accent: string;
  colors?: Record<string, string>;
}

interface ToolViewProps extends ViewProps {
  tool: Tool;
}

interface PrevisResult {
  regime: "avant2014" | "après2014";
  delaiJours: number;
  delaiSemaines: number;
  dateFinPreavis: string;
  details: string;
  icl?: { jours: number; raison: string };
}

export function CalcPreavis({ accent }: ViewProps) {
  const [statut, setStatut] = useState<"ouvrier" | "employe">("ouvrier");
  const [quiRompt, setQuiRompt] = useState<"employeur" | "travailleur">("employeur");
  const [emploiType, setEmploiType] = useState<"fullTime" | "partTime">("fullTime");
  const [dateEntree, setDateEntree] = useState("");
  const [dateDimission, setDateDimission] = useState("");
  const [commissionSearch, setCommissionSearch] = useState("");
  const [selectedCommission, setSelectedCommission] = useState<CommissionParitaire | null>(null);
  const [salaire, setSalaire] = useState("");
  const [result, setResult] = useState<PrevisResult | null>(null);
  const [showCommissionDropdown, setShowCommissionDropdown] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [allCommissions, setAllCommissions] = useState<CommissionParitaire[]>([]);

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

  // Filter commissions with smart number filter
  const filteredCommissions = searchCommissions(
    allCommissions,
    commissionSearch
  ).slice(0, 8);

  const calc = () => {
    setErrorMsg("");

    // Validation
    if (!dateEntree || !isValidDate(dateEntree)) {
      setErrorMsg("Date d'entrée invalide");
      return;
    }
    if (!dateDimission || !isValidDate(dateDimission)) {
      setErrorMsg("Date de dimission invalide");
      return;
    }
    if (!selectedCommission) {
      setErrorMsg("Sélectionnez une commission paritaire");
      return;
    }

    const dtEntree = parseDate(dateEntree);
    const dtDimission = parseDate(dateDimission);

    if (!dtEntree || !dtDimission || dtDimission <= dtEntree) {
      setErrorMsg("La date de dimission doit être après la date d'entrée");
      return;
    }

    const threshold = new Date(2014, 0, 1); // 01/01/2014
    const isAvant2014 = isBeforeThreshold(dtEntree);
    const contractSpans2014 = dtEntree < threshold && dtDimission >= threshold;

    let calcResult: PrevisResult;

    // Contract spans both regimes (before and after 2014)
    if (contractSpans2014) {
      const lastDayOf2013 = new Date(2013, 11, 31);
      const seniorityBefore2014 = calculateSeniority(dtEntree, lastDayOf2013);
      const seniorityAfter2014 = calculateSeniority(threshold, dtDimission);

      let joursBefore2014 = 0;
      let joursAfter2014 = 0;
      let detailsBefore = "";
      let detailsAfter = "";
      let iclInfo: { jours: number; raison: string } | undefined = undefined;

      // Calculate notice for period before 2014
      if (statut === "ouvrier") {
        // Use CCT 75 table for ouvrier before 2014
        joursBefore2014 = getNoticeDaysFromTable(seniorityBefore2014, NOTICE_PERIODS_OUVRIER_PRE_2014_CCT75) || 112;

        detailsBefore = `${joursBefore2014} jours (régime ouvrier avant 2014, CCT 75)`;
      } else {
        // Employé - salary-based
        if (!salaire) {
          setErrorMsg("Salaire annuel requis pour les employés");
          return;
        }
        const sal = parseFloat(salaire);
        if (isNaN(sal) || sal <= 0) {
          setErrorMsg("Salaire invalide");
          return;
        }

        const tableBefore = quiRompt === "employeur" ? NOTICE_PERIODS_EMPLOYE_AVANT_2014.employeur : NOTICE_PERIODS_EMPLOYE_AVANT_2014.travailleur;
        let moisBefore = 0;
        if (sal <= 32254) {
          moisBefore = tableBefore.salaireMax32254.moisMin + seniorityBefore2014 * tableBefore.salaireMax32254.moisPerAn;
        } else if (sal <= 64508) {
          moisBefore = tableBefore.salaire32254a64508.moisMin + seniorityBefore2014 * tableBefore.salaire32254a64508.moisPerAn;
        } else {
          moisBefore = tableBefore.salaireMax64508.moisMin + seniorityBefore2014 * tableBefore.salaireMax64508.moisPerAn;
        }
        joursBefore2014 = Math.ceil(moisBefore * 30.44);
        detailsBefore = `${moisBefore.toFixed(2)} mois (avant 2014, salaire: ${sal}€)`;
      }

      // Calculate notice for period after 2014 (unified regime)
      const tableAfter = quiRompt === "employeur" ? NOTICE_PERIODS_POST_2014 : NOTICE_PERIODS_DEMISSION_POST_2014;
      const semaines = getNoticeWeeksFromTable(seniorityAfter2014, tableAfter) || 13;

      joursAfter2014 = semaines * 7;
      detailsAfter = `${semaines} semaines (après 2014, ${quiRompt === "employeur" ? "licenciement" : "démission"})`;

      const totalJours = joursBefore2014 + joursAfter2014;

      // ICL: Compensation when old regime is more generous than new regime
      // ICL = (old regime days - new regime days) × daily net salary
      // For now, show ICL info when old > new (requires salary to calculate actual amount)
      if (joursBefore2014 > joursAfter2014) {
        const iclDayDiff = joursBefore2014 - joursAfter2014;
        iclInfo = {
          jours: iclDayDiff,
          raison: `Indemnité en Compensation du Licenciement (ICL): la différence de ${iclDayDiff} jours entre régime ancien et nouveau doit être compensée par une indemnité égale à cette différence × salaire net journalier.`,
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
      // Entièrement avant 2014
      const seniority = calculateSeniority(dtEntree, dtDimission);

      if (statut === "ouvrier") {
        const jours = getNoticeDaysFromTable(seniority, NOTICE_PERIODS_OUVRIER_PRE_2014_CCT75) || 112;

        calcResult = {
          regime: "avant2014",
          delaiJours: jours,
          delaiSemaines: Math.ceil(jours / 7),
          dateFinPreavis: formatDate(addDaysToDate(dtDimission, jours)),
          details: `${jours} jours (régime ouvrier avant 2014, CCT 75)`,
        };
      } else {
        if (!salaire) {
          setErrorMsg("Salaire annuel requis pour les employés avant 2014");
          return;
        }

        const sal = parseFloat(salaire);
        if (isNaN(sal) || sal <= 0) {
          setErrorMsg("Salaire invalide");
          return;
        }

        const table = quiRompt === "employeur" ? NOTICE_PERIODS_EMPLOYE_AVANT_2014.employeur : NOTICE_PERIODS_EMPLOYE_AVANT_2014.travailleur;

        let moisPreavis = 0;
        if (sal <= 32254) {
          moisPreavis = table.salaireMax32254.moisMin + seniority * table.salaireMax32254.moisPerAn;
        } else if (sal <= 64508) {
          moisPreavis = table.salaire32254a64508.moisMin + seniority * table.salaire32254a64508.moisPerAn;
        } else {
          moisPreavis = table.salaireMax64508.moisMin + seniority * table.salaireMax64508.moisPerAn;
        }

        const jours = Math.ceil(moisPreavis * 30.44);

        calcResult = {
          regime: "avant2014",
          delaiJours: jours,
          delaiSemaines: Math.ceil(jours / 7),
          dateFinPreavis: formatDate(addDaysToDate(dtDimission, jours)),
          details: `${moisPreavis.toFixed(2)} mois (régime employé, salaire: ${sal}€)`,
        };
      }
    } else {
      // Entièrement après 2014
      const seniority = calculateSeniority(dtEntree, dtDimission);
      const tableAfter = quiRompt === "employeur" ? NOTICE_PERIODS_POST_2014 : NOTICE_PERIODS_DEMISSION_POST_2014;
      const semaines = getNoticeWeeksFromTable(seniority, tableAfter) || 13;

      const jours = semaines * 7;

      calcResult = {
        regime: "après2014",
        delaiJours: jours,
        delaiSemaines: semaines,
        dateFinPreavis: formatDate(addDaysToDate(dtDimission, jours)),
        details: `Régime unifié 2014+ • ${semaines} semaines (${quiRompt === "employeur" ? "licenciement" : "démission"})`,
      };
    }

    setResult(calcResult);
  };

  const downloadPDF = () => {
    if (!result) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const lineHeight = 6.5;
    let yPos = 20;

    // Logo et en-tête
    doc.setFontSize(18);
    doc.setFont("", "bold");
    doc.setTextColor(0, 51, 102); // Bleu foncé
    doc.text("DOCBEL", margin, yPos);
    yPos += 8;

    // Ligne séparatrice
    doc.setDrawColor(200, 16, 46); // Rouge Belgique
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;

    // Site web et date
    doc.setFontSize(9);
    doc.setFont("", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("https://www.docbel.be", margin, yPos);

    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-BE");
    const timeStr = now.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
    doc.text(`Calcul généré le ${dateStr} à ${timeStr}`, pageWidth - margin - 50, yPos);
    yPos += 10;

    // Titre principal
    doc.setFontSize(16);
    doc.setFont("", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Calcul de délai de préavis", margin, yPos);
    yPos += 12;

    // Section Paramètres d'entrée
    doc.setFontSize(11);
    doc.setFont("", "bold");
    doc.setTextColor(200, 16, 46);
    doc.text("Paramètres d'entrée", margin, yPos);
    yPos += 7;

    doc.setFontSize(9);
    doc.setFont("", "normal");
    doc.setTextColor(0, 0, 0);
    const paramWidth = pageWidth - 2 * margin;
    const colWidth = paramWidth / 2;

    doc.text(`Statut: ${statut === "ouvrier" ? "Ouvrier" : "Employé"}`, margin, yPos);
    doc.text(`Qui rompt: ${quiRompt === "employeur" ? "Employeur" : "Travailleur"}`, margin + colWidth, yPos);
    yPos += lineHeight + 2;

    doc.text(`Date d'entrée: ${dateEntree}`, margin, yPos);
    doc.text(`Date de dimission: ${dateDimission}`, margin + colWidth, yPos);
    yPos += lineHeight + 6;

    // Section Résultats (encadré)
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos - 2, paramWidth, 25, "F");
    doc.setDrawColor(200, 16, 46);
    doc.setLineWidth(1.5);
    doc.rect(margin, yPos - 2, paramWidth, 25);

    doc.setFontSize(13);
    doc.setFont("", "bold");
    doc.setTextColor(200, 16, 46);
    doc.text(`${result.delaiJours} jours`, margin + 5, yPos + 5);

    doc.setFontSize(9);
    doc.setFont("", "normal");
    doc.setTextColor(80, 80, 80);

    // Calculate weeks and remaining days
    const remainingDaysInWeek = result.delaiJours % 7;

    doc.text(`soit ${result.delaiSemaines} semaines et ${remainingDaysInWeek} jours`, margin + 5, yPos + 13);
    doc.text(`Fin du préavis: ${result.dateFinPreavis}`, margin + 5, yPos + 19);
    yPos += 30;

    // Section Détail du calcul
    doc.setFontSize(11);
    doc.setFont("", "bold");
    doc.setTextColor(200, 16, 46);
    doc.text("Détail du calcul", margin, yPos);
    yPos += 7;

    doc.setFontSize(9);
    doc.setFont("", "normal");
    doc.setTextColor(0, 0, 0);
    const wrappedDetails = doc.splitTextToSize(`Régime: ${result.regime === "avant2014" ? "Avant 2014" : "Après 2014"}\n${result.details}`, paramWidth);
    doc.text(wrappedDetails, margin, yPos);
    yPos += wrappedDetails.length * lineHeight + 8;

    // Vérifier si on a besoin d'une nouvelle page
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 20;
    }

    // Disclaimers
    doc.setFontSize(11);
    doc.setFont("", "bold");
    doc.setTextColor(200, 16, 46);
    doc.text("Informations importantes", margin, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont("", "normal");
    doc.setTextColor(0, 0, 0);

    const disclaimers = [
      {
        title: "1. Caractère indicatif",
        text: "Ce calcul est indicatif et fourni à titre informatif uniquement. Il ne constitue pas un conseil juridique ou légal. Des conventions collectives sectorielles, des circonstances particulières ou d'autres facteurs peuvent modifier ce délai.",
      },
      {
        title: "2. Avant toute action",
        text: "Avant de prendre des mesures basées sur ce calcul, consultez votre syndicat si vous en avez un, un conseiller juridique, ou contactez l'ONEM pour obtenir un calcul officiel et exact adaptée à votre situation.",
      },
      {
        title: "3. Réglementation belge",
        text: "Ce calcul est basé sur la réglementation belge actuelle en matière de délais de préavis. Pour plus d'informations officielles, consultez le SPF Emploi, Travail et Concertation sociale.",
      },
    ];

    disclaimers.forEach((disclaimer) => {
      if (yPos > pageHeight - 25) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont("", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(disclaimer.title, margin + 2, yPos);
      yPos += 5;

      doc.setFont("", "normal");
      doc.setTextColor(80, 80, 80);
      const wrappedText = doc.splitTextToSize(disclaimer.text, paramWidth - 4);
      doc.text(wrappedText, margin + 2, yPos);
      yPos += wrappedText.length * (lineHeight - 0.5) + 5;
    });

    // Pied de page
    if (yPos > pageHeight - 15) {
      doc.addPage();
    }

    doc.setFontSize(8);
    doc.setFont("", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("Docbel © 2026 | Tous droits réservés | https://www.docbel.be", pageWidth / 2, pageHeight - 8, { align: "center" });

    // Télécharger
    doc.save(`calcul-preavis-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
    <div>
      {/* Header with title, description, and badge */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--foreground)", margin: 0, marginBottom: 4 }}>
              Calcul du délai de préavis
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
              Renseignez les informations du contrat. Le régime applicable est détecté automatiquement selon les dates.
            </p>
          </div>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 6,
            background: "#E8F5E9",
            border: "1px solid #4CAF50",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#2E7D32 " }}>
              Régime détecté automatiquement
            </span>
          </div>
        </div>
      </div>

      {/* Row 1: 3 columns - Statut | Rupture par | Type d'emploi */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Statut */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
            Statut *
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["ouvrier", "employe"] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setStatut(v);
                  setSalaire("");
                }}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1.5px solid ${statut === v ? accent : "var(--border)"}`,
                  background: "transparent",
                  color: statut === v ? accent : "var(--text-muted)",
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.2s ease",
                }}
              >
                <User size={16} />
                <span>{v === "ouvrier" ? "Ouvrier" : "Employé"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rupture par */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
            Rupture par *
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["employeur", "travailleur"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setQuiRompt(v)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1.5px solid ${quiRompt === v ? accent : "var(--border)"}`,
                  background: "transparent",
                  color: quiRompt === v ? accent : "var(--text-muted)",
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.2s ease",
                }}
              >
                {v === "employeur" ? <Building2 size={16} /> : <User size={16} />}
                <span>{v === "employeur" ? "Employeur" : "Travailleur"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Type d'emploi */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
            Type d&apos;emploi *
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["fullTime", "partTime"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setEmploiType(v)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1.5px solid ${emploiType === v ? accent : "var(--border)"}`,
                  background: "transparent",
                  color: emploiType === v ? accent : "var(--text-muted)",
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.2s ease",
                }}
              >
                {v === "fullTime" ? <Calendar size={16} /> : <Clock size={16} />}
                <span>{v === "fullTime" ? "Temps plein" : "Temps partiel"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Commission Paritaire + Dates - 3 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Commission Paritaire */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
            Commission paritaire *
          </label>
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute",
              left: 12,
              top: 12,
              color: "var(--text-muted)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
            }}>
              <SearchIcon size={16} />
            </div>
            <input
              type="text"
              value={commissionSearch}
              onChange={(e) => {
                setCommissionSearch(e.target.value);
                setShowCommissionDropdown(true);
              }}
              onFocus={() => setShowCommissionDropdown(true)}
              placeholder="Rechercher une CP, ex. 124, construction..."
              style={{
                width: "100%",
                padding: "10px 12px 10px 36px",
                borderRadius: 8,
                border: "1.5px solid var(--border)",
                background: "var(--input)",
                color: "var(--foreground)",
                fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                outline: "none",
              }}
            />
            {showCommissionDropdown && filteredCommissions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  borderRadius: 8,
                  border: "1.5px solid var(--border)",
                  background: "var(--surface)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  zIndex: 10,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                {filteredCommissions.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setSelectedCommission(c);
                      setCommissionSearch(c.label);
                      setShowCommissionDropdown(false);
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      color: "var(--foreground)",
                      cursor: "pointer",
                      fontSize: 13,
                      textAlign: "left",
                      borderBottom: "1px solid var(--border)",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontWeight: 600 }}>{c.numero}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{c.nom}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
            Date d&apos;entrée * <span style={{ fontSize: 11, color: "var(--text-muted)" }}>DD/MM/YYYY</span>
          </label>
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute",
              right: 12,
              top: 11,
              color: "var(--text-muted)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
            }}>
              <Calendar size={16} />
            </div>
            <input
              type="text"
              value={dateEntree}
              onChange={(e) => setDateEntree(e.target.value)}
              placeholder="15/03/2010"
              style={{
                width: "100%",
                padding: "10px 36px 10px 12px",
                borderRadius: 8,
                border: "1.5px solid var(--border)",
                background: "var(--input)",
                color: "var(--foreground)",
                fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
            Date de licenciement * <span style={{ fontSize: 11, color: "var(--text-muted)" }}>DD/MM/YYYY</span>
          </label>
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute",
              right: 12,
              top: 11,
              color: "var(--text-muted)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
            }}>
              <Calendar size={16} />
            </div>
            <input
              type="text"
              value={dateDimission}
              onChange={(e) => setDateDimission(e.target.value)}
              placeholder="15/06/2024"
              style={{
                width: "100%",
                padding: "10px 36px 10px 12px",
                borderRadius: 8,
                border: "1.5px solid var(--border)",
                background: "var(--input)",
                color: "var(--foreground)",
                fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Conditional: Détails du temps partiel */}
      {emploiType === "partTime" && (
        <div style={{
          marginBottom: 20,
          padding: 14,
          borderRadius: 8,
          border: "1.5px solid var(--border)",
          background: "var(--surface-2)",
        }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 12 }}>
            Détails du temps partiel
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>
                Heures/semaine prestées *
              </label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute",
                  right: 10,
                  top: 8,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}>
                  <Clock size={14} />
                </div>
                <input
                  type="text"
                  placeholder="20 h"
                  defaultValue="20"
                  style={{
                    width: "100%",
                    padding: "8px 32px 8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--input)",
                    color: "var(--foreground)",
                    fontSize: 12,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>
                Temps plein de référence *
              </label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute",
                  right: 10,
                  top: 8,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}>
                  <Clock size={14} />
                </div>
                <input
                  type="text"
                  placeholder="38 h"
                  defaultValue="38"
                  style={{
                    width: "100%",
                    padding: "8px 32px 8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--input)",
                    color: "var(--foreground)",
                    fontSize: 12,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>
                Régime
              </label>
              <input
                type="text"
                placeholder="20/38"
                defaultValue="20/38"
                disabled
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  cursor: "not-allowed",
                }}
              />
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, marginBottom: 0 }}>
            Utilisé pour déterminer le régime de travail.
          </p>
        </div>
      )}

      {/* Salaire pour employés avant 2014 */}
      {statut === "employe" && dateEntree && isBeforeThreshold(parseDate(dateEntree) || new Date()) && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>
            Salaire annuel € <span style={{ fontSize: 11, color: "var(--text-muted)" }}>avant 2014</span>
          </label>
          <input
            type="number"
            value={salaire}
            onChange={(e) => setSalaire(e.target.value)}
            placeholder="40000"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1.5px solid var(--border)",
              background: "var(--input)",
              color: "var(--foreground)",
              fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              outline: "none",
            }}
          />
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 6,
            background: "#FFEBEE",
            border: `1px solid #EF5350`,
            color: "#C62828",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Buttons: 2 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <button
          onClick={calc}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "none",
            background: accent,
            color: "white",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          <BarChart3 size={18} />
          Calculer le délai de préavis
        </button>
        <button
          onClick={downloadPDF}
          disabled={!result}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: `1.5px solid ${accent}`,
            background: "transparent",
            color: accent,
            fontWeight: 700,
            fontSize: 13,
            cursor: result ? "pointer" : "not-allowed",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: result ? 1 : 0.5,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (result) e.currentTarget.style.background = `${accent}12`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Download size={18} style={{ marginRight: 6 }} /> Télécharger en PDF
        </button>
      </div>

      {/* Disclaimer */}
      <div style={{
        marginBottom: 0,
        padding: "12px 14px",
        borderRadius: 8,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        fontSize: 11,
        color: "var(--text-muted)",
        lineHeight: 1.6,
        display: "flex",
        gap: 8,
      }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: "var(--foreground)" }}>Simulation</strong> fournie à titre informatif. Le résultat dépend des informations encodées et ne remplace pas un avis juridique. Les données sont utilisées uniquement pour ce calcul.
        </div>
      </div>

      {/* Results */}
      {result && (
        <div
          style={{
            marginTop: 24,
            padding: "20px 22px",
            borderRadius: 14,
            background: `${accent}10`,
            border: `1.5px solid ${accent}30`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: accent,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Résultat — Régime {result.regime === "avant2014" ? "Avant 2014" : "Après 2014"}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-1px" }}>
            {result.delaiSemaines} <span style={{ fontSize: 16, fontWeight: 600 }}>semaines</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span>soit {result.delaiJours} jours</span>
            </div>

            <button
              onClick={downloadPDF}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1.5px solid ${accent}`,
                background: `${accent}12`,
                color: accent,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${accent}25`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${accent}12`;
              }}
            >
              <Download size={18} style={{ marginRight: 6 }} /> Télécharger en PDF
            </button>
          </div>

          {result.icl && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background: `${accent}18`,
                borderLeft: `3px solid ${accent}`,
                fontSize: 12,
                color: "var(--foreground)",
                lineHeight: 1.5,
                display: "flex",
                gap: 10,
              }}
            >
              <Lightbulb size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Attention ICL :</strong> Différence de {result.icl.jours} jours
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{result.icl.raison}</div>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "var(--surface-2)",
              fontSize: 12,
              color: "var(--foreground)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Calendar size={16} style={{ flexShrink: 0 }} />
            <div><strong>Date de fin du préavis :</strong> {result.dateFinPreavis}</div>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: "var(--surface-2)",
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "var(--foreground)" }}>Détail du calcul :</strong> {result.details}
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--surface)",
              fontSize: 11,
              color: "var(--foreground)",
              lineHeight: 1.6,
              borderLeft: "3px solid var(--text-muted)",
              display: "flex",
              gap: 10,
            }}
          >
            <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ display: "block", marginBottom: 8 }}>À savoir</strong>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                <div style={{ marginBottom: 8 }}>
                  • <strong>Début du préavis :</strong> Le délai commence le <strong>premier lundi</strong> après la notification écrite de la rupture.
                </div>
                <div>
                  • <strong>Suspension :</strong> Le préavis est <strong>suspendu</strong> pendant certaines absences (congés payés, congé de maternité/paternité, maladie, accident du travail).
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--surface)",
              fontSize: 11,
              color: "var(--text-muted)",
              lineHeight: 1.6,
              display: "flex",
              gap: 10,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              Ce calcul est <strong>indicatif</strong>. Des conventions collectives sectorielles, des circonstances
              particulières ou d&apos;autres facteurs peuvent modifier ce délai. Consultez votre syndicat si vous en avez un ou l&apos;ONEM
              pour un calcul exact.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CalcAGR({ accent }: ViewProps) {
  const [salaire, setSalaire] = useState("");
  const [heuresSemaine, setHeuresSemaine] = useState("");
  const [heuresSecteur, setHeuresSecteur] = useState("38");
  const [result, setResult] = useState<{ agr: string; tauxTP: string } | null>(null);

  const calc = () => {
    const s = parseFloat(salaire);
    const h = parseFloat(heuresSemaine);
    const hs = parseFloat(heuresSecteur);
    if (isNaN(s) || isNaN(h) || isNaN(hs) || h >= hs) return;
    const tauxTP = h / hs;
    const salaireRef = Math.min(s / tauxTP, 3800);
    const salaireReferenceAGR = salaireRef * 0.765;
    const salaireActuel = s;
    const agr = Math.max(0, Math.min(salaireReferenceAGR - salaireActuel, 1960));
    setResult({ agr: agr.toFixed(2), tauxTP: (tauxTP * 100).toFixed(0) });
  };

  const fields: [string, string, (v: string) => void, string][] = [
    ["Salaire mensuel brut (€)", salaire, setSalaire, "ex : 1200"],
    ["Heures/semaine travaillées", heuresSemaine, setHeuresSemaine, "ex : 24"],
    ["Heures/semaine du secteur", heuresSecteur, setHeuresSecteur, "ex : 38"],
  ];

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        L&apos;<strong>Allocation de Garantie de Revenu (AGR)</strong> complète le salaire des travailleurs à temps
        partiel involontaire inscrits comme demandeurs d&apos;emploi.
      </p>
      {fields.map(([label, val, setter, ph]) => (
        <div key={label} style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--foreground)", marginBottom: 6 }}>
            {label}
          </label>
          <input
            type="number"
            min="0"
            value={val}
            onChange={(e) => setter(e.target.value)}
            placeholder={ph}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1.5px solid var(--border)",
              background: "var(--input)",
              color: "var(--foreground)",
              fontSize: 14,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = accent)}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>
      ))}
      <button
        onClick={calc}
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: 10,
          border: "none",
          background: accent,
          color: "white",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          marginTop: 4,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        Calculer l&apos;AGR estimée
      </button>
      {result && (
        <div
          style={{
            marginTop: 20,
            padding: "20px 22px",
            borderRadius: 14,
            background: `${accent}10`,
            border: `1.5px solid ${accent}30`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: accent,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Résultat estimatif
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--foreground)", letterSpacing: "-1px" }}>
            ± {result.agr} <span style={{ fontSize: 16, fontWeight: 600 }}>€/mois</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Pour un régime à {result.tauxTP}% temps partiel
          </div>
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--surface)",
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}
          >
            ⚠️ Estimation indicative uniquement. Le montant réel est calculé par l&apos;ONEM sur base de votre dossier
            complet. Conditions : être inscrit comme demandeur d&apos;emploi à temps plein et travailler involontairement
            à temps partiel.
          </div>
        </div>
      )}
    </div>
  );
}

const CP_DATA = [
  { cp: "CP 200", nom: "Employés de commerce", smg: "1.954,99 €" },
  { cp: "CP 201", nom: "Employés des industries alimentaires", smg: "2.018,45 €" },
  { cp: "CP 100", nom: "Ouvriers des secteurs complémentaires", smg: "1.806,16 €" },
  { cp: "CP 111", nom: "Mines et carrières", smg: "1.950,00 €" },
  { cp: "CP 118", nom: "Industries alimentaires", smg: "1.901,22 €" },
  { cp: "CP 124", nom: "Construction", smg: "1.933,14 €" },
  { cp: "CP 130", nom: "Pharmacie", smg: "2.110,00 €" },
  { cp: "CP 140", nom: "Transport routier", smg: "1.877,00 €" },
  { cp: "CP 302", nom: "Hôtellerie", smg: "1.852,00 €" },
  { cp: "CP 318", nom: "Services de soins de santé", smg: "2.050,00 €" },
  { cp: "CP 319", nom: "Aide sociale et soins de santé (Brussels)", smg: "2.100,00 €" },
  { cp: "CP 330", nom: "Établissements et services de santé", smg: "1.980,00 €" },
];

export function CalcCP({ accent }: ViewProps) {
  const [search, setSearch] = useState("");
  const filtered = CP_DATA.filter(
    (c) => c.cp.toLowerCase().includes(search.toLowerCase()) || c.nom.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
        Salaires minimums garantis par commission paritaire — données indicatives 2026. Consultez toujours la CCT
        sectorielle officielle.
      </p>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-faint)",
          }}
        >
          <SearchIcon size={15} />
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un secteur ou numéro CP…"
          style={{
            width: "100%",
            padding: "9px 12px 9px 36px",
            borderRadius: 10,
            border: "1.5px solid var(--border)",
            background: "var(--input)",
            color: "var(--foreground)",
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = accent)}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map((c) => (
          <div
            key={c.cp}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: accent }}>{c.cp}</div>
              <div style={{ fontSize: 12.5, color: "var(--foreground)", marginTop: 2 }}>{c.nom}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--foreground)", flexShrink: 0, marginLeft: 12 }}>
              {c.smg}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13 }}>
            Aucun secteur trouvé
          </div>
        )}
      </div>
    </div>
  );
}

export function Locator({ tool, accent }: ToolViewProps) {
  // Le titre détermine le type de bureau initialement mis en avant.
  const initialType: "ONEM" | "SYNDICAT" | "ALL" = tool.title.includes("ONEM")
    ? "ONEM"
    : tool.title.toLowerCase().includes("paiement") || tool.title.toLowerCase().includes("syndicat")
    ? "SYNDICAT"
    : "ALL";
  return <BureauLocator initialFocus={initialType} accent={accent} />;
}

export function Tutorial({ tool, accent }: ToolViewProps) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = tool.title.includes("carte")
    ? [
        {
          title: "Télécharger l'application MyONEM",
          body: "Disponible sur App Store et Google Play. Connectez-vous avec votre eID ou itsme. Vous pouvez aussi utiliser le site web myonem.be depuis un ordinateur.",
        },
        {
          title: "Accéder à « Ma carte de contrôle »",
          body: "Dans le menu principal, sélectionnez « Ma carte de contrôle C ». Vous y verrez le mois en cours et les jours à déclarer.",
        },
        {
          title: "Cocher les jours travaillés",
          body: "Pour chaque jour où vous avez travaillé, reçu une indemnité ou étiez absent, cochez la case correspondante. Les jours non cochés = jours de chômage.",
        },
        {
          title: "Envoyer la carte",
          body: "Cliquez sur « Envoyer ma carte » avant le dernier jour ouvrable du mois. Vous recevrez une confirmation par e-Box. En cas d'erreur, contactez immédiatement votre organisme de paiement.",
        },
      ]
    : tool.title.includes("e-Box")
    ? [
        {
          title: "Activer votre e-Box",
          body: "Rendez-vous sur myebox.be et connectez-vous avec votre eID, itsme ou token. Cliquez sur « Activer mon e-Box » pour recevoir vos documents gouvernementaux numériquement.",
        },
        {
          title: "Gérer vos préférences",
          body: "Dans les paramètres, choisissez de recevoir vos courriers uniquement par e-Box. Vous pouvez aussi configurer des notifications par email ou SMS.",
        },
        {
          title: "Consulter vos documents",
          body: "Tous vos documents officiels (ONEM, SPF Finances, CPAS…) apparaissent dans votre boîte. Vous pouvez les télécharger et les archiver.",
        },
      ]
    : [
        {
          title: "Accéder à MyONEM",
          body: "Rendez-vous sur myonem.be et cliquez sur « S'inscrire ». Vous aurez besoin de votre carte eID ou de l'application itsme.",
        },
        {
          title: "Vérifier votre identité",
          body: "Choisissez votre méthode d'authentification : eID avec lecteur de carte, itsme sur smartphone, ou token/mot de passe.",
        },
        {
          title: "Compléter votre profil",
          body: "Renseignez vos coordonnées bancaires (IBAN) et choisissez votre organisme de paiement si ce n'est pas encore fait.",
        },
        {
          title: "Accéder à vos services",
          body: "Une fois connecté, vous pouvez envoyer votre carte C, consulter vos allocations, mettre à jour votre situation et échanger avec l'ONEM.",
        },
      ];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
        {steps.map((_, i) => (
          <div
            key={i}
            onClick={() => setActiveStep(i)}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              cursor: "pointer",
              background: i <= activeStep ? accent : "var(--border)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: accent,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6,
        }}
      >
        Étape {activeStep + 1} / {steps.length}
      </div>
      <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--foreground)", marginBottom: 12, letterSpacing: "-0.2px" }}>
        {steps[activeStep].title}
      </h4>
      <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.7 }}>{steps[activeStep].body}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          disabled={activeStep === 0}
          style={{
            padding: "9px 18px",
            borderRadius: 9,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            fontWeight: 600,
            fontSize: 13,
            cursor: activeStep === 0 ? "default" : "pointer",
            opacity: activeStep === 0 ? 0.4 : 1,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          ← Précédent
        </button>
        <button
          onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))}
          disabled={activeStep === steps.length - 1}
          style={{
            flex: 1,
            padding: "9px 18px",
            borderRadius: 9,
            border: "none",
            background: accent,
            color: "white",
            fontWeight: 700,
            fontSize: 13,
            cursor: activeStep === steps.length - 1 ? "default" : "pointer",
            opacity: activeStep === steps.length - 1 ? 0.5 : 1,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}

export function InfoPanel({ tool }: ToolViewProps) {
  const isALE = tool.title.includes("ALE");

  const content = isALE
    ? {
        intro:
          "L'ALE (Agence Locale pour l'Emploi) permet aux chômeurs complets et aux bénéficiaires du RIS d'effectuer de petits travaux autorisés contre des chèques-ALE.",
        items: [
          [
            "Qui peut travailler via l'ALE ?",
            "Chômeurs complets indemnisés depuis ≥ 6 mois, bénéficiaires du RIS, chômeurs de 60+.",
          ],
          [
            "Quelles activités ?",
            "Aide à domicile, jardinage, petits travaux, cours particuliers, aide aux personnes âgées...",
          ],
          [
            "Combien peut-on gagner ?",
            "Maximum 630 heures/an (850h si 50+). Pas d'impact sur les allocations dans la limite autorisée.",
          ],
          [
            "Comment s'inscrire ?",
            "Contactez l'ALE de votre commune. Apportez votre carte SIS, carte d'identité et attestation de chômage.",
          ],
        ],
      }
    : {
        intro:
          "Lorsque vos allocations de chômage arrivent à leur terme (fin de droits), le CPAS de votre commune peut vous accorder le Revenu d'Intégration Sociale (RIS).",
        items: [
          [
            "Conditions d'accès",
            "Avoir la nationalité belge ou un titre de séjour valide, résider en Belgique, être dans le besoin, disponible au travail.",
          ],
          [
            "Montants RIS 2026",
            "Personne isolée : 1.409 €/mois. Cohabitant : 940 €/mois. Chef de famille : 1.880 €/mois.",
          ],
          [
            "Documents à apporter",
            "Preuve de fin de droits ONEM, carte d'identité, composition de ménage, preuves de revenus, IBAN.",
          ],
          ["Délai de traitement", "Le CPAS dispose de 30 jours (prolongeable à 45 jours) pour prendre une décision."],
        ],
      };

  return (
    <div>
      <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.65 }}>{content.intro}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {content.items.map(([title, body]) => (
          <div
            key={title}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", marginBottom: 5 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LinkPanel({ tool, accent }: ToolViewProps) {
  const info: Record<string, { url: string; tel: string; desc: string }> = {
    Actiris: {
      url: "actiris.brussels",
      tel: "0800 35 123",
      desc: "Service bruxellois de l'emploi. Inscription obligatoire pour les DE bruxellois. Permanences sans rendez-vous lun-ven 8h30-12h30.",
    },
    VDAB: {
      url: "vdab.be",
      tel: "0800 30 700",
      desc: "Vlaamse Dienst voor Arbeidsbemiddeling. Service flamand de l'emploi et de la formation. Mycareer.be pour votre CV en ligne.",
    },
    FOREM: {
      url: "leforem.be",
      tel: "0800 93 947",
      desc: "Office wallon de la formation et de l'emploi. Inscription en ligne ou dans un bureau local. Accompagnement personnalisé.",
    },
    ADG: {
      url: "adg.be",
      tel: "087 59 64 00",
      desc: "Arbeitsamt der Deutschsprachigen Gemeinschaft. Service de l'emploi pour les 9 communes de la Communauté germanophone.",
    },
  };
  const key = Object.keys(info).find((k) => tool.title.includes(k)) || "Actiris";
  const d = info[key];
  return (
    <div>
      <div
        style={{
          padding: "20px",
          borderRadius: 14,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65, marginBottom: 16 }}>{d.desc}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: "var(--foreground)" }}>
            <strong>🌐 Site web :</strong> <span style={{ color: accent }}>{d.url}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--foreground)" }}>
            <strong>📞 Tél. :</strong> {d.tel}
          </div>
        </div>
      </div>
      <button
        style={{
          width: "100%",
          padding: "11px",
          borderRadius: 10,
          border: "none",
          background: accent,
          color: "white",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
      >
        Visiter le site officiel →
      </button>
    </div>
  );
}

export function FormFlow({ tool, accent, lang }: ToolViewProps & { lang: string }) {
  const [step, setStep] = useState(0);
  const labels: Record<string, string[]> = {
    FR: ["Formulaire", "Prévisualisation", "Téléchargement"],
    NL: ["Formulier", "Voorbeeld", "Download"],
    EN: ["Form", "Preview", "Download"],
    DE: ["Formular", "Vorschau", "Download"],
  };
  const steps = labels[lang] || labels.FR;
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    dob: "",
    adresse: "",
    commune: "",
    nrn: "",
  });
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 1600);
  };

  const fields: [string, keyof typeof formData, string, string][] = [
    ["Nom", "nom", "Dupont", "text"],
    ["Prénom", "prenom", "Jean", "text"],
    ["Date de naissance", "dob", "01/01/1990", "text"],
    ["N° registre national", "nrn", "90.01.01-123.45", "text"],
    ["Adresse", "adresse", "Rue de la Loi 1", "text"],
    ["Commune", "commune", "Bruxelles 1000", "text"],
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 0, marginBottom: 22 }}>
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => i <= step && setStep(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px",
              border: "none",
              background: "none",
              cursor: i <= step ? "pointer" : "default",
              color: i === step ? accent : i < step ? "var(--text-muted)" : "var(--text-faint)",
              fontSize: 12.5,
              fontWeight: i === step ? 700 : 500,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                flexShrink: 0,
                background: i === step ? accent : i < step ? `${accent}20` : "var(--surface-2)",
                color: i === step ? "white" : i < step ? accent : "var(--text-faint)",
                fontSize: 10.5,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i < step ? "✓" : i + 1}
            </span>
            {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {fields.map(([label, key, ph, type]) => (
              <div key={key} style={{ gridColumn: key === "adresse" ? "1 / -1" : "auto" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--foreground)",
                    marginBottom: 5,
                  }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  placeholder={ph}
                  value={formData[key]}
                  onChange={(e) => setFormData((d) => ({ ...d, [key]: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 9,
                    border: "1.5px solid var(--border)",
                    background: "var(--input)",
                    color: "var(--foreground)",
                    fontSize: 13,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    outline: "none",
                    transition: "border 0.15s",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = accent)}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => setStep(1)}
            style={{
              marginTop: 20,
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: accent,
              color: "white",
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Prévisualiser <ArrowIcon size={14} />
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "24px",
              fontFamily: "monospace",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <BelgianFlag />
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginTop: 10 }}>
                ROYAUME DE BELGIQUE — ONEM
              </div>
              <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }}></div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", textTransform: "uppercase" }}>
                {tool.title}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--foreground)", lineHeight: 2 }}>
              <div>
                <strong>Nom :</strong> {formData.nom || "DUPONT"}
              </div>
              <div>
                <strong>Prénom :</strong> {formData.prenom || "Jean"}
              </div>
              <div>
                <strong>Date de naissance :</strong> {formData.dob || "01/01/1990"}
              </div>
              <div>
                <strong>N° Reg. nat. :</strong> {formData.nrn || "90.01.01-123.45"}
              </div>
              <div>
                <strong>Adresse :</strong> {formData.adresse || "Rue de la Loi 1"}
              </div>
              <div>
                <strong>Commune :</strong> {formData.commune || "Bruxelles 1000"}
              </div>
            </div>
            <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }}></div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
              Généré le {new Date().toLocaleDateString("fr-BE")} via DocBel
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={() => setStep(0)}
              style={{
                padding: "9px 18px",
                borderRadius: 9,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-muted)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              ← Modifier
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 24px",
                borderRadius: 10,
                border: "none",
                background: accent,
                color: "white",
                fontWeight: 700,
                fontSize: 13.5,
                cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Génération…" : "Générer le document PDF"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--foreground)", marginBottom: 8 }}>Document prêt !</h3>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 28 }}>
              Votre {tool.title.toLowerCase()} a été généré avec succès.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  border: `1.5px solid ${accent}`,
                  background: "transparent",
                  color: accent,
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Aperçu PDF
              </button>
              <button
                style={{
                  padding: "10px 22px",
                  borderRadius: 10,
                  border: "none",
                  background: accent,
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13.5,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                ↓ Télécharger
              </button>
            </div>
          </div>
          <BureauCallout organismeCode={inferOrganismeFromTool(tool)} accent={accent} />
        </div>
      )}
    </div>
  );
}

/** Heuristique pour déduire l'organisme cible d'un outil (FormFlow démo). */
function inferOrganismeFromTool(tool: Tool): string | null {
  const t = `${tool.title} ${tool.desc}`.toLowerCase();
  if (t.includes("cpas") || t.includes("ris") || t.includes("aide sociale") || t.includes("intégration sociale"))
    return "cpas";
  if (t.includes("commune") || t.includes("hôtel de ville") || t.includes("état civil"))
    return "commune";
  if (t.includes("c4") || t.includes("c1") || t.includes("chômage") || t.includes("onem"))
    return "onem";
  if (t.includes("syndicat") || t.includes("paiement") || t.includes("capac")) return "capac";
  return null;
}
