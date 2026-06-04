/**
 * Rendu PDF du planning des shifts (modèle « PLANIFICATION DES SHIFTS »).
 *
 * jsPDF est importé DYNAMIQUEMENT (≈ même motif que les calculateurs DocBel) :
 * la lib n'est chargée que lorsqu'on génère réellement le PDF, côté navigateur.
 * Le tableau est dessiné à la main (pas de dépendance `jspdf-autotable`).
 *
 * Format : A4 paysage. Une COLONNE par créneau, les noms empilés dessous, une
 * ligne « Total » en pied. Couleur dérivée du jour (cf. `planning.ts`).
 */

import type { Planning } from "@/lib/rendez-vous/planning";

const MARGIN = 12; // mm
const TABLE_TOP = 40;
const HEADER_H = 11;
const ROW_H = 8;

// Police DejaVu Sans (sous-ensemble latin étendu, ~40 ko) servie depuis
// /public/fonts. Contrairement aux polices intégrées de jsPDF (WinAnsi), elle
// couvre les caractères des noms étrangers : « ı » turc, « ş », « ğ », etc.
const UNICODE_FONT_URL = "/fonts/DejaVuSans-Latin.ttf";
const UNICODE_FONT_VFS = "DejaVuSans-Latin.ttf";
const UNICODE_FONT_NAME = "DejaVuSans";

// Téléchargement mémoïsé : le binaire (base64) n'est récupéré qu'une fois par
// session, puis réenregistré sur chaque document jsPDF.
let fontBase64Promise: Promise<string | null> | null = null;

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000; // évite « Maximum call stack » sur les gros buffers
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadUnicodeFontBase64(): Promise<string | null> {
  if (!fontBase64Promise) {
    fontBase64Promise = (async () => {
      const res = await fetch(UNICODE_FONT_URL);
      if (!res.ok) throw new Error(`Police HTTP ${res.status}`);
      return bytesToBase64(await res.arrayBuffer());
    })();
    // Un échec transitoire (hors-ligne) ne doit pas désactiver la police pour
    // toute la session : on oublie la promesse rejetée pour réessayer ensuite.
    fontBase64Promise.catch(() => {
      fontBase64Promise = null;
    });
  }
  try {
    return await fontBase64Promise;
  } catch {
    return null; // repli sur Helvetica
  }
}

/** Génère le PDF et le renvoie sous forme de `Blob` prêt au téléchargement. */
export async function renderPlanningPdf(planning: Planning): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

  // Police Unicode pour les noms (cellules) ; repli Helvetica si indisponible.
  let bodyFont = "helvetica";
  const fontBase64 = await loadUnicodeFontBase64();
  if (fontBase64) {
    doc.addFileToVFS(UNICODE_FONT_VFS, fontBase64);
    doc.addFont(UNICODE_FONT_VFS, UNICODE_FONT_NAME, "normal");
    bodyFont = UNICODE_FONT_NAME;
  }

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const [ar, ag, ab] = planning.theme.accent;
  const [tr, tg, tb] = planning.theme.tint;

  const tableX = MARGIN;
  const tableW = pageW - 2 * MARGIN;
  const nCols = planning.columns.length;
  const colW = tableW / nCols;

  /* ── Bandeau d'en-tête ──────────────────────────────────────────────── */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(125, 125, 125);
  doc.text("PLANIFICATION DES SHIFTS", MARGIN, 15, { charSpace: 0.8 });

  doc.setFontSize(30);
  doc.setTextColor(ar, ag, ab);
  doc.text(planning.theme.name, MARGIN, 28);

  doc.setDrawColor(ar, ag, ab);
  doc.setLineWidth(1);
  doc.line(MARGIN, 31, MARGIN + 72, 31);

  // Encadré « Pour la semaine du : » / « Nom du service : »
  const boxW = 96;
  const boxX = pageW - MARGIN - boxW;
  const boxY = 12;
  const boxH = 18;
  const labelW = 42;
  doc.setFillColor(tr, tg, tb);
  doc.setDrawColor(ar, ag, ab);
  doc.setLineWidth(0.4);
  doc.rect(boxX, boxY, boxW, boxH, "FD");
  doc.setDrawColor(205, 205, 205);
  doc.setLineWidth(0.2);
  doc.line(boxX, boxY + boxH / 2, boxX + boxW, boxY + boxH / 2);
  doc.line(boxX + labelW, boxY, boxX + labelW, boxY + boxH);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("Pour la semaine du :", boxX + 3, boxY + 6);
  doc.text("Nom du service :", boxX + 3, boxY + 15);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(planning.dateLabel, boxX + labelW + 3, boxY + 6);

  /* ── Tableau ────────────────────────────────────────────────────────── */
  const drawColumnHeader = (top: number): number => {
    doc.setFillColor(ar, ag, ab);
    doc.rect(tableX, top, tableW, HEADER_H, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    for (let c = 0; c < nCols; c += 1) {
      const cx = tableX + c * colW;
      if (c > 0) doc.line(cx, top, cx, top + HEADER_H);
      const col = planning.columns[c];
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(col.time, cx + colW / 2, top + 5, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(col.range, cx + colW / 2, top + 8.6, { align: "center" });
    }
    return top + HEADER_H;
  };

  // Hauteur de ligne ADAPTATIVE : tout doit tenir sur UNE seule page A4. On
  // répartit la place verticale restante entre les lignes (plafonnée à ROW_H
  // pour les listes courtes), puis on dimensionne la police en conséquence.
  const TOTAL_ROW_H = 8;
  const CAPTION_H = 8;
  const availH = pageH - TABLE_TOP - HEADER_H - TOTAL_ROW_H - CAPTION_H - 4;
  const rowH =
    planning.rowCount > 0
      ? Math.min(ROW_H, availH / planning.rowCount)
      : ROW_H;
  const nameFont = Math.max(5, Math.min(7.5, rowH * 1.05));
  const lineMm = nameFont * 0.36; // hauteur de ligne approx. (pt → mm)
  const maxLines = rowH >= 7 ? 2 : 1;

  const drawBodyRow = (r: number, y: number): void => {
    if (r % 2 === 1) {
      doc.setFillColor(tr, tg, tb);
      doc.rect(tableX, y, tableW, rowH, "F");
    }
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.setFont(bodyFont, "normal");
    doc.setFontSize(nameFont);
    doc.setTextColor(30, 30, 30);
    for (let c = 0; c < nCols; c += 1) {
      const cx = tableX + c * colW;
      doc.rect(cx, y, colW, rowH, "S");
      const name = planning.columns[c].names[r];
      if (!name) continue;
      const lines = (doc.splitTextToSize(name, colW - 3) as string[]).slice(
        0,
        maxLines,
      );
      const startY =
        y + rowH / 2 - ((lines.length - 1) * lineMm) / 2 + lineMm / 2;
      lines.forEach((line, i) => {
        doc.text(line, cx + 2, startY + i * lineMm);
      });
    }
  };

  const drawTotalRow = (y: number): void => {
    doc.setFillColor(ar, ag, ab);
    doc.rect(tableX, y, tableW, TOTAL_ROW_H, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    for (let c = 0; c < nCols; c += 1) {
      const cx = tableX + c * colW;
      if (c > 0) doc.line(cx, y, cx, y + TOTAL_ROW_H);
      doc.text(
        String(planning.columns[c].names.length),
        cx + colW / 2,
        y + 5.4,
        { align: "center" },
      );
    }
  };

  let y = drawColumnHeader(TABLE_TOP);
  for (let r = 0; r < planning.rowCount; r += 1) {
    drawBodyRow(r, y);
    y += rowH;
  }
  drawTotalRow(y);
  y += TOTAL_ROW_H;

  // Légende de pied : rappel que la ligne accentuée est le total par créneau.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Total par créneau", tableX, y + 5);
  doc.text(
    `${planning.total} rendez-vous`,
    tableX + tableW,
    y + 5,
    { align: "right" },
  );

  return doc.output("blob");
}
