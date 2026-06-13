/**
 * Export PDF d'un dossier employeur (checklist + alertes + sources), design
 * « sectionné » DocBel aligné sur lib/agr/export-pdf.ts. `buildChecklistPdf`
 * retourne le document jsPDF (utilisable côté serveur via import dynamique).
 *
 * Inclut l'avertissement OBLIGATOIRE (spec §5) sur le document préparatoire.
 */
import {
  PRIORITY_RANK,
  labelItemStatus,
  labelPriority,
  labelSeverity,
  labelReliability,
  type AlertSeverity,
  type ItemPriority,
  type ItemStatus,
  type ReliabilityLevel,
} from "./constants";

const VIOLET: [number, number, number] = [124, 58, 237];
const VIOLET_DARK: [number, number, number] = [88, 28, 135];
const NAVY: [number, number, number] = [30, 27, 75];
const GREY: [number, number, number] = [115, 115, 125];

export const PDF_DISCLAIMER =
  "Document préparatoire généré par Docbel. À valider avant usage officiel. Les règles sociales peuvent dépendre de la situation exacte, de la commission paritaire, des conventions collectives, des statuts applicables et des mises à jour légales.";

export interface ChecklistPdfItem {
  title: string;
  priority: ItemPriority;
  status: ItemStatus;
  sourceCode?: string | null;
}

export interface ChecklistPdfAlert {
  severity: AlertSeverity;
  message: string;
  sourceCode?: string | null;
}

export interface ChecklistPdfSource {
  code: string;
  title: string;
  institution: string;
  url: string;
}

export interface ChecklistPdfData {
  title: string;
  subtitle: string;
  categoryLabel: string;
  reliability: ReliabilityLevel;
  complexity: string;
  facts: [string, string][];
  items: ChecklistPdfItem[];
  alerts: ChecklistPdfAlert[];
  sources: ChecklistPdfSource[];
}

export async function buildChecklistPdf(data: ChecklistPdfData) {
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
    `${data.subtitle}  ·  ${data.categoryLabel}  ·  Fiabilité : ${labelReliability(
      data.reliability
    ).toLowerCase()}  ·  Complexité : ${data.complexity}`,
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

  /* 1. Résumé */
  sectionHeader(1, "Résumé du scénario");
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

  /* 2. Checklist (groupée par priorité) */
  sectionHeader(2, "Checklist");
  const sorted = [...data.items].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  let currentPriority: ItemPriority | null = null;
  for (const item of sorted) {
    if (item.priority !== currentPriority) {
      currentPriority = item.priority;
      ensure(7);
      doc.setFont("", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...VIOLET);
      doc.text(labelPriority(item.priority).toUpperCase(), M + 2, y);
      y += 5;
    }
    const tag = item.sourceCode ? `  [${item.sourceCode}]` : "";
    const statusTag = `  (${labelItemStatus(item.status)})`;
    const lines = doc.splitTextToSize(`•  ${item.title}`, contentW - 36) as string[];
    ensure(lines.length * 4.4 + 1);
    doc.setFont("", "normal");
    doc.setFontSize(9);
    doc.setTextColor(25, 25, 25);
    doc.text(lines, M + 4, y);
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(`${statusTag}${tag}`.trim(), W - M, y, { align: "right" });
    y += lines.length * 4.4 + 1.5;
  }
  y += 3;

  /* 3. Alertes */
  if (data.alerts.length > 0) {
    sectionHeader(3, "Alertes");
    for (const a of data.alerts) {
      const head = `[${labelSeverity(a.severity)}]${a.sourceCode ? ` (${a.sourceCode})` : ""}`;
      const lines = doc.splitTextToSize(`${head}  ${a.message}`, contentW - 6) as string[];
      ensure(lines.length * 4.4 + 2);
      doc.setFont("", "normal");
      doc.setFontSize(9);
      doc.setTextColor(150, 90, 10);
      doc.text(lines, M + 2, y);
      y += lines.length * 4.4 + 2;
    }
    y += 2;
  }

  /* 4. Sources */
  if (data.sources.length > 0) {
    sectionHeader(4, "Sources officielles");
    for (const s of data.sources) {
      ensure(8);
      doc.setFont("", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(20, 20, 20);
      doc.text(`${s.code} — ${s.title}`, M + 2, y);
      y += 4;
      doc.setFont("", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      doc.text(`${s.institution} · ${s.url}`, M + 2, y);
      y += 5;
    }
    y += 2;
  }

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
