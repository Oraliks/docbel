/**
 * Module 2 — Export PDF d'une simulation de coût employeur.
 *
 * Design « sectionné » DocBel aligné sur lib/employeur/export-checklist-pdf.ts
 * (en-tête violet, bandeau de pied, encart d'avertissement). `buildCostPdf`
 * retourne le document jsPDF (utilisable côté serveur via import dynamique) ;
 * la route API fait `Buffer.from(doc.output("arraybuffer"))`.
 */
import { labelReliability, type ReliabilityLevel } from "@/lib/employeur/constants";
import { PDF_DISCLAIMER } from "@/lib/employeur/export-checklist-pdf";

const VIOLET: [number, number, number] = [124, 58, 237];
const VIOLET_DARK: [number, number, number] = [88, 28, 135];
const NAVY: [number, number, number] = [30, 27, 75];
const GREY: [number, number, number] = [115, 115, 125];

/** Caveat additionnel obligatoire pour les simulations (spec §7.3). */
export const COST_PDF_CAVEAT =
  "Simulation indicative et non certifiée. Elle ne constitue pas un calcul payroll officiel et ne vérifie pas le salaire minimum sectoriel. Un secrétariat social agréé doit valider le calcul final.";

const EUR = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n)
    ? "—"
    : `${n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export interface CostPdfData {
  title: string;
  reliability: ReliabilityLevel;
  /** Paires libellé → valeur affichées dans la section « Hypothèses ». */
  facts: [string, string][];
  estimatedEmployerContributions: number;
  estimatedMonthlyEmployerCost: number;
  estimatedAnnualEmployerCost: number;
  estimatedNetSalary?: number | null;
  assumptions: string[];
  missingData: string[];
  warnings: string[];
}

export async function buildCostPdf(data: CostPdfData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const contentW = W - 2 * M;
  let y = 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-BE");
  const timeStr = now.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

  const ensure = (needed: number) => {
    if (y + needed > H - 22) {
      doc.addPage();
      y = M + 4;
    }
  };

  /* En-tête DOCBEL */
  doc.setFillColor(...VIOLET);
  doc.roundedRect(M, 12, 9, 9, 2, 2, "F");
  doc.setFontSize(18);
  doc.setFont("", "bold");
  doc.setTextColor(...NAVY);
  doc.text("DOCBEL", M + 12, 18.5);
  doc.setFontSize(7.5);
  doc.setFont("", "normal");
  doc.setTextColor(...VIOLET);
  doc.text("Espace Employeur", M + 12, 23);
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text(`Généré le ${dateStr} à ${timeStr}`, W - M, 15, { align: "right" });
  doc.text("https://www.docbel.be", W - M, 19.5, { align: "right" });

  /* Titre */
  doc.setFontSize(16);
  doc.setFont("", "bold");
  doc.setTextColor(...VIOLET_DARK);
  doc.text(doc.splitTextToSize(data.title, contentW) as string[], W / 2, 33, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("", "normal");
  doc.setTextColor(...GREY);
  doc.text(
    `Simulation de coût employeur  ·  Fiabilité : ${labelReliability(data.reliability).toLowerCase()}`,
    W / 2,
    39,
    { align: "center" }
  );
  y = 47;

  const sectionHeader = (n: number, label: string) => {
    ensure(14);
    doc.setFillColor(...VIOLET);
    doc.roundedRect(M, y, 6, 6, 1.4, 1.4, "F");
    doc.setFontSize(9);
    doc.setFont("", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(String(n), M + 3, y + 4.2, { align: "center" });
    doc.setFontSize(10.5);
    doc.setTextColor(...VIOLET_DARK);
    doc.text(label.toUpperCase(), M + 9, y + 4.6, { charSpace: 0.4 });
    y += 9;
  };

  const bulletList = (lines: string[]) => {
    for (const line of lines) {
      const wrapped = doc.splitTextToSize(`•  ${line}`, contentW - 6) as string[];
      ensure(wrapped.length * 4.4 + 1);
      doc.setFont("", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(45, 45, 45);
      doc.text(wrapped, M + 2, y);
      y += wrapped.length * 4.4 + 1.5;
    }
  };

  /* 1. Hypothèses */
  sectionHeader(1, "Hypothèses");
  const half = contentW / 2;
  for (let i = 0; i < data.facts.length; i += 2) {
    ensure(5.4);
    const draw = (pair: [string, string] | undefined, x: number) => {
      if (!pair) return;
      doc.setFont("", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...GREY);
      doc.text(pair[0], x + 2, y);
      doc.setFont("", "bold");
      doc.setTextColor(20, 20, 20);
      doc.text(doc.splitTextToSize(pair[1], half - 8) as string[], x + half - 4, y, {
        align: "right",
      });
    };
    draw(data.facts[i], M);
    draw(data.facts[i + 1], M + half);
    y += 5.4;
  }
  y += 3;

  /* 2. Résultats */
  sectionHeader(2, "Résultats (indicatifs)");
  const results: [string, string][] = [
    ["Cotisations patronales (mensuel)", EUR(data.estimatedEmployerContributions)],
    ["Coût employeur mensuel total", EUR(data.estimatedMonthlyEmployerCost)],
    ["Coût employeur annuel total", EUR(data.estimatedAnnualEmployerCost)],
    ["Net salarié indicatif (mensuel)", EUR(data.estimatedNetSalary)],
  ];
  for (const [label, value] of results) {
    ensure(7);
    doc.setFont("", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(45, 45, 45);
    doc.text(label, M + 2, y);
    doc.setFont("", "bold");
    doc.setTextColor(...VIOLET_DARK);
    doc.text(value, W - M, y, { align: "right" });
    y += 6.2;
  }
  y += 3;

  /* 3. Détail des hypothèses de calcul */
  if (data.assumptions.length > 0) {
    sectionHeader(3, "Détail des hypothèses de calcul");
    bulletList(data.assumptions);
    y += 2;
  }

  /* 4. Données manquantes */
  if (data.missingData.length > 0) {
    sectionHeader(4, "Données manquantes / non chiffrées");
    bulletList(data.missingData);
    y += 2;
  }

  /* 5. Avertissements */
  if (data.warnings.length > 0) {
    sectionHeader(5, "Avertissements");
    for (const w of data.warnings) {
      const wrapped = doc.splitTextToSize(`•  ${w}`, contentW - 6) as string[];
      ensure(wrapped.length * 4.4 + 1);
      doc.setFont("", "normal");
      doc.setFontSize(9);
      doc.setTextColor(150, 90, 10);
      doc.text(wrapped, M + 2, y);
      y += wrapped.length * 4.4 + 1.5;
    }
    y += 2;
  }

  /* Encart caveat « simulation indicative » + disclaimer obligatoire */
  const warnText = `${COST_PDF_CAVEAT} ${PDF_DISCLAIMER}`;
  const warnLines = doc.splitTextToSize(warnText, contentW - 14) as string[];
  const warnH = warnLines.length * 4 + 8;
  ensure(warnH + 2);
  doc.setFillColor(255, 249, 240);
  doc.setDrawColor(240, 200, 120);
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y, contentW, warnH, 2, 2, "FD");
  doc.setFillColor(230, 160, 30);
  doc.circle(M + 6, y + warnH / 2, 2.4, "F");
  doc.setFont("", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("!", M + 6, y + warnH / 2 + 1.4, { align: "center" });
  doc.setFont("", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 100, 20);
  doc.text(warnLines, M + 11, y + 6);

  /* Bandeau de pied */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFillColor(...VIOLET);
    doc.rect(0, H - 11, W, 11, "F");
    doc.setFont("", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Docbel © ${now.getFullYear()}  |  https://www.docbel.be`, M, H - 4);
    doc.text(`${p} / ${pages}`, W - M, H - 4, { align: "right" });
  }

  return doc;
}
