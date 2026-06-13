/**
 * Export PDF d'un contrôle de fiche (Module 6), design « sectionné » DocBel
 * aligné sur lib/employeur/export-checklist-pdf.ts. `buildControlPdf` retourne
 * le document jsPDF (utilisable côté serveur via import dynamique).
 *
 * Réutilise l'en-tête / le pied / l'avertissement obligatoire (PDF_DISCLAIMER).
 */
import { PDF_DISCLAIMER } from "../export-checklist-pdf";
import { labelWorkerType, labelBenefit } from "../constants";
import type { Finding, FindingLevel, PayslipControlInput, PayslipControlResult } from "./engine";

const VIOLET: [number, number, number] = [124, 58, 237];
const VIOLET_DARK: [number, number, number] = [88, 28, 135];
const NAVY: [number, number, number] = [30, 27, 75];
const GREY: [number, number, number] = [115, 115, 125];

const LEVEL_LABEL: Record<FindingLevel, string> = {
  critique: "Critique",
  attention: "Attention",
  info: "Info",
};

const VERDICT_LABEL: Record<PayslipControlResult["verdict"], string> = {
  ok: "Aucune incohérence évidente détectée.",
  points_to_check: "Points à vérifier",
  insufficient: "Document insuffisant pour un contrôle fiable.",
};

/** Ordre d'affichage : critique d'abord. */
const LEVEL_RANK: Record<FindingLevel, number> = {
  critique: 0,
  attention: 1,
  info: 2,
};

function fmtAmount(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(2)} €` : "—";
}

function fmtText(v: string | null | undefined): string {
  return v && v.trim() ? v.trim() : "—";
}

export interface BuildControlPdfArgs {
  input: PayslipControlInput;
  result: PayslipControlResult;
}

export async function buildControlPdf({ input, result }: BuildControlPdfArgs) {
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
  doc.text("Contrôle de cohérence — fiche de paie", W / 2, 33, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("", "normal");
  doc.setTextColor(...GREY);
  doc.text(
    `Période : ${fmtText(input.period)}  ·  Contrôle indicatif, non certifié`,
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

  /* 1. Verdict */
  sectionHeader(1, "Verdict");
  ensure(9);
  doc.setFont("", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(
    doc.splitTextToSize(VERDICT_LABEL[result.verdict], contentW) as string[],
    M + 2,
    y
  );
  y += 9;

  /* 2. Données encodées */
  sectionHeader(2, "Données encodées");
  const facts: [string, string][] = [
    ["Période", fmtText(input.period)],
    ["Type de travailleur", input.workerType ? labelWorkerType(input.workerType) : "—"],
    ["Régime", input.regime === "temps_plein" ? "Temps plein" : input.regime === "temps_partiel" ? "Temps partiel" : "—"],
    ["Commission paritaire", fmtText(input.jointCommitteeNumber)],
    ["Salaire brut mensuel", fmtAmount(input.grossMonthlySalary)],
    ["Net reçu", fmtAmount(input.netReceived)],
    ["Cotisations affichées", fmtAmount(input.contributionsShown)],
    ["Prime", fmtAmount(input.prime)],
    ["Pécule de vacances", fmtAmount(input.pecule)],
    [
      "Horaire",
      typeof input.weeklyHours === "number" && Number.isFinite(input.weeklyHours)
        ? `${input.weeklyHours} h/sem${typeof input.fullTimeReferenceHours === "number" ? ` (réf. ${input.fullTimeReferenceHours} h)` : ""}`
        : "—",
    ],
    [
      "Avantages déclarés",
      input.benefits && input.benefits.length > 0
        ? input.benefits.map((b) => labelBenefit(b)).join(", ")
        : "—",
    ],
  ];
  const half = contentW / 2;
  for (let i = 0; i < facts.length; i += 2) {
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
    draw(facts[i], M);
    draw(facts[i + 1], M + half);
    y += 5.4;
  }
  if (input.remarque && input.remarque.trim()) {
    ensure(8);
    doc.setFont("", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GREY);
    doc.text("Remarque", M + 2, y);
    y += 4;
    doc.setTextColor(20, 20, 20);
    const remLines = doc.splitTextToSize(input.remarque.trim(), contentW - 4) as string[];
    ensure(remLines.length * 4.4);
    doc.text(remLines, M + 2, y);
    y += remLines.length * 4.4;
  }
  y += 3;

  /* 3. Constats (groupés par niveau) */
  sectionHeader(3, "Constats");
  if (result.findings.length === 0) {
    ensure(6);
    doc.setFont("", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text("Aucun constat.", M + 2, y);
    y += 6;
  } else {
    const sorted: Finding[] = [...result.findings].sort(
      (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]
    );
    let currentLevel: FindingLevel | null = null;
    for (const f of sorted) {
      if (f.level !== currentLevel) {
        currentLevel = f.level;
        ensure(7);
        doc.setFont("", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...VIOLET);
        doc.text(LEVEL_LABEL[f.level].toUpperCase(), M + 2, y);
        y += 5;
      }
      const tag = f.sourceCode ? `  [${f.sourceCode}]` : "";
      const msgLines = doc.splitTextToSize(`•  ${f.message}${tag}`, contentW - 4) as string[];
      ensure(msgLines.length * 4.4 + 1);
      doc.setFont("", "normal");
      doc.setFontSize(9);
      doc.setTextColor(25, 25, 25);
      doc.text(msgLines, M + 4, y);
      y += msgLines.length * 4.4 + 1;
      const recLines = doc.splitTextToSize(`→ ${f.recommendation}`, contentW - 8) as string[];
      ensure(recLines.length * 4 + 2);
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text(recLines, M + 8, y);
      y += recLines.length * 4 + 2.5;
    }
  }
  y += 2;

  /* Avertissement obligatoire (spec §5) */
  const warnLines = doc.splitTextToSize(PDF_DISCLAIMER, contentW - 14) as string[];
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
