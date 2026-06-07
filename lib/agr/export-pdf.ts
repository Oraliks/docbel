/**
 * Export PDF d'un calcul AGR — récapitulatif complet, design « sectionné »
 * DocBel : en-tête DOCBEL, titre centré, sections numérotées en cartes,
 * deux encadrés de résultat, grilles de cartes pour les détails, encart
 * d'avertissement et bandeau de pied violet (« Docbel © | https://www.docbel.be »).
 *
 * jsPDF en import dynamique. `buildAgrPdf` retourne le document (testable hors
 * navigateur) ; `exportAgrPdf` déclenche le téléchargement.
 */

import { getBareme } from "./baremes";
import type { AgrGlobalInput, AgrResult, OccupationInput } from "./types";

export interface OccPdfMeta {
  filename?: string;
  nom?: string | null;
  periode?: string | null;
}
export interface AgrPdfData {
  global: Omit<AgrGlobalInput, "occupations">;
  occupations: OccupationInput[];
  metas: OccPdfMeta[];
  result: AgrResult;
}

const VIOLET: [number, number, number] = [124, 58, 237];
const VIOLET_DARK: [number, number, number] = [88, 28, 135];
const NAVY: [number, number, number] = [30, 27, 75];
const GREY: [number, number, number] = [115, 115, 125];
const CARD_FILL: [number, number, number] = [250, 249, 255];
const CARD_BORDER: [number, number, number] = [224, 218, 247];

function eur(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `${x.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function num(x: number): string {
  return x.toLocaleString("fr-BE", { maximumFractionDigits: 4 });
}

const CAT_FAMILIALE: Record<string, string> = {
  A: "A — chef de ménage", N: "N — isolé", B1: "B1 — cohabitant 1ʳᵉ pér.",
  B2: "B2 — cohabitant 2ᵉ pér.", P: "P — cohabitant forfait",
};
const CAT_TRAV: Record<string, string> = {
  "1O": "1O — ouvrier privé", "1E": "1E — employé privé", "2E": "2E — employé public",
  "2P": "2P — ouvrier public", "3": "3 — statutaire",
};

export async function buildAgrPdf(data: AgrPdfData) {
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
    if (y + needed > H - 22) { doc.addPage(); y = M + 4; }
  };

  /* ── En-tête ─────────────────────────────────────────────────────────── */
  // Pastille logo + DOCBEL.
  doc.setFillColor(...VIOLET);
  doc.roundedRect(M, 12, 9, 9, 2, 2, "F");
  doc.setFontSize(18);
  doc.setFont("", "bold");
  doc.setTextColor(...NAVY);
  doc.text("DOCBEL", M + 12, 18.5);
  doc.setFontSize(7.5);
  doc.setFont("", "normal");
  doc.setTextColor(...VIOLET);
  doc.text("Piloter · Valoriser · Confiance", M + 12, 23);
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text(`Généré le ${dateStr} à ${timeStr}`, W - M, 15, { align: "right" });
  doc.text("https://www.docbel.be", W - M, 19.5, { align: "right" });

  // Titre centré.
  doc.setFontSize(17);
  doc.setFont("", "bold");
  doc.setTextColor(...VIOLET_DARK);
  doc.text("Calcul AGR — Allocation de Garantie de Revenus", W / 2, 33, { align: "center" });
  const bar = getBareme(data.global.bareme);
  doc.setFontSize(9);
  doc.setFont("", "normal");
  doc.setTextColor(...GREY);
  doc.text(
    `${bar.libelle}  ·  Salaire de référence : ${eur(data.result.salaireReference)}`,
    W / 2, 39, { align: "center" },
  );
  y = 46;

  /* ── Helpers de mise en page ─────────────────────────────────────────── */
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

  const half = contentW / 2;
  const kvGrid = (rows: [string, string][]) => {
    for (let i = 0; i < rows.length; i += 2) {
      ensure(5.4);
      const draw = (pair: [string, string] | undefined, x: number) => {
        if (!pair) return;
        doc.setFont("", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...GREY);
        doc.text(pair[0], x + 2, y);
        doc.setFont("", "bold");
        doc.setTextColor(20, 20, 20);
        doc.text(pair[1], x + half - 4, y, { align: "right" });
      };
      draw(rows[i], M);
      draw(rows[i + 1], M + half);
      y += 5.4;
    }
  };

  // Grille de cartes (label + valeur) — 4 par ligne.
  const miniCards = (items: { label: string; value: string; accent?: boolean }[]) => {
    const perRow = 4;
    const gap = 3;
    const cardW = (contentW - gap * (perRow - 1)) / perRow;
    const cardH = 14;
    for (let i = 0; i < items.length; i += perRow) {
      ensure(cardH + 2);
      const rowItems = items.slice(i, i + perRow);
      rowItems.forEach((it, c) => {
        const x = M + c * (cardW + gap);
        const fill = it.accent ? ([243, 240, 255] as const) : CARD_FILL;
        doc.setFillColor(fill[0], fill[1], fill[2]);
        doc.setDrawColor(...CARD_BORDER);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, cardW, cardH, 1.6, 1.6, "FD");
        doc.setFillColor(...VIOLET);
        doc.circle(x + 4, y + 5, 1.1, "F");
        doc.setFont("", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...GREY);
        const label = doc.splitTextToSize(it.label, cardW - 9) as string[];
        doc.text(label.slice(0, 2), x + 6.5, y + 4.6);
        doc.setFont("", "bold");
        doc.setFontSize(11);
        doc.setTextColor(20, 20, 20);
        doc.text(it.value, x + 4, y + cardH - 3.5);
      });
      y += cardH + gap;
    }
  };

  /* ── 1. Paramètres du dossier ────────────────────────────────────────── */
  sectionHeader(1, "Paramètres du dossier");
  kvGrid([
    ["Allocation journalière", eur(data.global.allocationJournaliere)],
    ["Demi-allocation", eur(data.global.demiAllocation)],
    ["Catégorie familiale", CAT_FAMILIALE[data.global.categorieFamiliale] ?? data.global.categorieFamiliale],
    ["Solde J (jours)", num(data.global.soldeJ)],
    ["Jours CC", num(data.global.joursCC)],
    ["Mois de décembre", data.global.moisDecembre ? "oui" : "non"],
    ["Cumul temps partiel", data.global.cumulTempsPartiel ? "oui" : "non"],
    ["Incapacité/sanction tout le mois", data.global.incapaciteOuSanctionTotalite ? "oui" : "non"],
  ]);
  y += 2;

  data.occupations.forEach((o, i) => {
    if (o.q <= 0) return;
    const meta = data.metas[i] ?? {};
    const sub = [meta.nom, meta.periode].filter(Boolean).join(" · ");
    ensure(8);
    doc.setFont("", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...VIOLET);
    doc.text(`Occupation ${i + 1}${sub ? ` — ${sub}` : ""}`, M + 2, y);
    y += 5;
    const orows: [string, string][] = [
      ["Facteur Q / S", `${num(o.q)} / ${num(o.s)}`],
      ["Catégorie travailleur", CAT_TRAV[o.categorieTravailleur] ?? o.categorieTravailleur],
      ["Qinfo", String(o.qinfo)],
      ["Y-Brut", eur(o.ybrut)],
      ["Salaire théo. / mois", eur(o.salaireTheoriqueMois)],
      ["Salaire théo. / heure", eur(o.salaireTheoriqueHeure)],
      ["Heures (HT)", num(o.heures)],
    ];
    // Les postes nuls sont masqués pour garder la fiche compacte.
    if (o.heuresV || o.heuresA) orows.push(["Vacances (V) / Absence (A)", `${num(o.heuresV)} / ${num(o.heuresA)}`]);
    if (o.fermetureTotal) orows.push(["Fermeture", num(o.fermetureTotal)]);
    if (o.pw1 || o.pr) orows.push(["PW (CT) / PR", `${num(o.pw1)} / ${num(o.pr)}`]);
    if (o.soldeS32 || o.soldeQ4) orows.push(["Solde S×3,2 / Q×4", `${num(o.soldeS32)} / ${num(o.soldeQ4)}`]);
    if (o.joursNI) orows.push(["Jours NI", num(o.joursNI)]);
    if (o.requalifier) orows.push(["Requalifier A → V", "oui"]);
    kvGrid(orows);
    y += 2;
  });

  /* ── Encadrés de résultat ────────────────────────────────────────────── */
  ensure(26);
  const gap = 4;
  const boxW = (contentW - gap) / 2;
  const boxH = 22;
  const drawBox = (x: number, title: string, value: string) => {
    doc.setFillColor(243, 240, 255);
    doc.setDrawColor(...VIOLET);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, y, boxW, boxH, 2.2, 2.2, "FD");
    doc.setFont("", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...VIOLET_DARK);
    doc.text(title, x + 5, y + 7);
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text(value, x + 5, y + 17);
  };
  drawBox(M, "AGR BRUT — BARÈME 57/-", eur(data.result.bareme57));
  drawBox(M + boxW + gap, "BARÈME 05/-", eur(data.result.bareme05));
  if (data.result.erreur) {
    doc.setFont("", "italic");
    doc.setFontSize(8);
    doc.setTextColor(200, 16, 46);
    doc.text(data.result.erreur, M + 5, y + boxH - 2);
  }
  y += boxH + 8;

  /* ── 2. Résultats ────────────────────────────────────────────────────── */
  sectionHeader(2, "Résultats");
  miniCards([
    { label: "AGR barème 57/-", value: eur(data.result.bareme57), accent: true },
    { label: "AGR barème 05/-", value: eur(data.result.bareme05), accent: true },
    { label: "Chômage temporaire", value: eur(data.result.chomageTemporaire) },
    { label: "Salaire de référence", value: eur(data.result.salaireReference) },
    { label: "Total 57 (AGR+CT+CC)", value: eur(data.result.total57) },
    { label: "Total 05 (AGR+CT+CC)", value: eur(data.result.total05) },
  ]);
  y += 2;

  /* ── 3. Résultats intermédiaires ─────────────────────────────────────── */
  const im = data.result.intermediaires;
  sectionHeader(3, "Résultats intermédiaires");
  miniCards([
    { label: "Nombre d'occupations", value: String(im.nombreOccupations) },
    { label: "F1 (allocations)", value: num(im.f1) },
    { label: "F2 (allocation jour)", value: eur(im.f2) },
    { label: "F3 / F4", value: `${num(im.f3)} / ${num(im.f4)}` },
    { label: "VTL total", value: num(im.vtlTot) },
    { label: "Bonus total", value: eur(im.bonusTot) },
    { label: "Salaire imposable", value: eur(im.totalSalaireImposable) },
    { label: "Retenues (précompte)", value: eur(im.totalRetenues) },
    { label: "Formule 1A (AGR 57)", value: eur(im.formule1A), accent: true },
    { label: "Formule 1B (limite 57)", value: eur(im.formule1B) },
    { label: "Formule 2A (AGR 05)", value: eur(im.formule2A), accent: true },
    { label: "Formule 2B (limite 05)", value: eur(im.formule2B) },
  ]);
  y += 2;

  /* ── Avertissement ───────────────────────────────────────────────────── */
  ensure(18);
  const warnLines = doc.splitTextToSize(
    "Montants bruts. L'AGR doit être au moins égale à la demi-allocation. Document destiné à l'usage interne, généré automatiquement à partir des données saisies — vérifiez toujours les valeurs extraites du WECH 506 avant toute validation de paiement.",
    contentW - 14,
  ) as string[];
  const warnH = warnLines.length * 4 + 8;
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

  /* ── Bandeau de pied (chaque page) ───────────────────────────────────── */
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

/** Génère le PDF et déclenche son téléchargement (navigateur uniquement). */
export async function exportAgrPdf(data: AgrPdfData): Promise<void> {
  const doc = await buildAgrPdf(data);
  doc.save(`docbel-calcul-agr-${new Date().toISOString().split("T")[0]}.pdf`);
}
