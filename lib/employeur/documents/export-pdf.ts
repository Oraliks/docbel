/**
 * Module 5 — Export PDF d'un document préparatoire employeur.
 *
 * Réutilise le style « sectionné » DOCBEL (en-tête violet + pied de page) et
 * l'avertissement OBLIGATOIRE `PDF_DISCLAIMER` (spec §5). Le corps du document
 * est rendu via `splitTextToSize`. `buildDocumentPdf` retourne le document jsPDF
 * (utilisable côté serveur via import dynamique).
 */

import { PDF_DISCLAIMER } from "@/lib/employeur/export-checklist-pdf";
import { DOCUMENT_CONFIGS, type DocumentType, type DocumentValues } from "./types";

const VIOLET: [number, number, number] = [124, 58, 237];
const VIOLET_DARK: [number, number, number] = [88, 28, 135];
const NAVY: [number, number, number] = [30, 27, 75];
const GREY: [number, number, number] = [115, 115, 125];

export interface DocumentPdfInput {
  type: DocumentType;
  title: string;
  values: DocumentValues;
  bodyText: string;
}

export async function buildDocumentPdf({ type, title, bodyText }: DocumentPdfInput) {
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
  const typeLabel = DOCUMENT_CONFIGS[type]?.label ?? "Document";

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
  doc.text(doc.splitTextToSize(title, contentW) as string[], W / 2, 33, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("", "normal");
  doc.setTextColor(...GREY);
  doc.text(`Document préparatoire · ${typeLabel}`, W / 2, 39, { align: "center" });
  y = 47;

  /* Corps du document (texte FR) */
  doc.setFont("", "normal");
  doc.setFontSize(10);
  doc.setTextColor(25, 25, 25);
  const lines = doc.splitTextToSize(bodyText, contentW) as string[];
  for (const line of lines) {
    ensure(5.4);
    doc.text(line, M, y);
    y += 5.2;
  }
  y += 4;

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
