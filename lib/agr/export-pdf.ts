/**
 * Export PDF d'un calcul AGR (récapitulatif complet : paramètres dossier,
 * occupations, résultats barème 57/05 et résultats intermédiaires).
 *
 * Style « fameux PDF DocBel » (cf. components/docbel/calculators/*) : en-tête
 * DOCBEL + filet rouge, URL du site, « Généré le … », pied « Docbel © …
 * | https://www.docbel.be ». jsPDF en import dynamique (bundle initial léger).
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

const NAVY: [number, number, number] = [0, 51, 102];
const RED: [number, number, number] = [200, 16, 46];
const VIOLET: [number, number, number] = [90, 42, 140];

function eur(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `${x.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function num(x: number): string {
  return x.toLocaleString("fr-BE", { maximumFractionDigits: 4 });
}

const CAT_FAMILIALE: Record<string, string> = {
  A: "A — chef de ménage",
  N: "N — isolé",
  B1: "B1 — cohabitant 1ʳᵉ période",
  B2: "B2 — cohabitant 2ᵉ période",
  P: "P — cohabitant forfait",
};
const CAT_TRAV: Record<string, string> = {
  "1O": "1O — ouvrier privé",
  "1E": "1E — employé privé",
  "2E": "2E — employé public",
  "2P": "2P — ouvrier public",
  "3": "3 — statutaire",
};

/** Construit le document PDF (sans le sauvegarder) — testable hors navigateur. */
export async function buildAgrPdf(data: AgrPdfData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const lineGap = 5.6;
  const colKey = margin + 2;
  let y = 20;

  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-BE");
  const timeStr = now.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 16) {
      doc.addPage();
      y = 20;
    }
  };

  const sectionTitle = (label: string) => {
    ensureSpace(12);
    doc.setFontSize(11);
    doc.setFont("", "bold");
    doc.setTextColor(...RED);
    doc.text(label, margin, y);
    y += 6;
    doc.setFontSize(9.5);
    doc.setFont("", "normal");
    doc.setTextColor(0, 0, 0);
  };

  // Paire clé/valeur sur une demi-largeur (2 colonnes par ligne).
  const half = (pageW - margin * 2) / 2;
  const kvGrid = (rows: [string, string][]) => {
    for (let i = 0; i < rows.length; i += 2) {
      ensureSpace(lineGap);
      const draw = (pair: [string, string] | undefined, x: number) => {
        if (!pair) return;
        doc.setTextColor(90, 90, 90);
        doc.setFont("", "normal");
        doc.text(pair[0], x, y);
        doc.setTextColor(0, 0, 0);
        doc.setFont("", "bold");
        doc.text(pair[1], x + half - 4, y, { align: "right" });
        doc.setFont("", "normal");
      };
      draw(rows[i], colKey);
      draw(rows[i + 1], colKey + half);
      y += lineGap;
    }
  };

  /* ── En-tête ─────────────────────────────────────────────────────────── */
  doc.setFontSize(18);
  doc.setFont("", "bold");
  doc.setTextColor(...NAVY);
  doc.text("DOCBEL", margin, y);
  y += 7;
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text("https://www.docbel.be", margin, y);
  doc.text(`Généré le ${dateStr} à ${timeStr}`, pageW - margin, y, { align: "right" });
  y += 10;

  doc.setFontSize(15);
  doc.setFont("", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Calcul AGR — Allocation de Garantie de Revenus", margin, y);
  y += 6;
  const bar = getBareme(data.global.bareme);
  doc.setFontSize(9);
  doc.setFont("", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(`Barème : ${bar.libelle} · salaire de référence ${eur(data.result.salaireReference)}`, margin, y);
  y += 9;

  /* ── Paramètres du dossier ───────────────────────────────────────────── */
  sectionTitle("Paramètres du dossier");
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
  y += 3;

  /* ── Occupations ─────────────────────────────────────────────────────── */
  data.occupations.forEach((o, i) => {
    if (o.q <= 0) return;
    const meta = data.metas[i] ?? {};
    const sub = [meta.nom, meta.periode].filter(Boolean).join(" · ");
    sectionTitle(`Occupation ${i + 1}${sub ? ` — ${sub}` : ""}`);
    kvGrid([
      ["Facteur Q", num(o.q)],
      ["Facteur S", num(o.s)],
      ["Catégorie travailleur", CAT_TRAV[o.categorieTravailleur] ?? o.categorieTravailleur],
      ["Qinfo", String(o.qinfo)],
      ["Y-Brut", eur(o.ybrut)],
      ["Salaire théorique / mois", eur(o.salaireTheoriqueMois)],
      ["Salaire théorique / heure", eur(o.salaireTheoriqueHeure)],
      ["Heures (HT)", num(o.heures)],
      ["Vacances (V)", num(o.heuresV)],
      ["Absence (A)", num(o.heuresA)],
      ["Fermeture", num(o.fermetureTotal)],
      ["PW (CT)", num(o.pw1)],
      ["PR", num(o.pr)],
      ["Solde S×3,2", num(o.soldeS32)],
      ["Solde Q×4", num(o.soldeQ4)],
      ["Jours NI", num(o.joursNI)],
      ["Requalifier A → V", o.requalifier ? "oui" : "non"],
    ]);
    y += 3;
  });

  /* ── Résultat (encadré) ──────────────────────────────────────────────── */
  ensureSpace(30);
  const boxH = 26;
  doc.setFillColor(248, 244, 252);
  doc.setDrawColor(159, 124, 255);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, y, pageW - margin * 2, boxH, 2, 2, "FD");
  if (data.result.erreur) {
    doc.setFontSize(11);
    doc.setFont("", "bold");
    doc.setTextColor(...RED);
    doc.text(data.result.erreur, margin + 4, y + 14);
  } else {
    doc.setFontSize(10);
    doc.setFont("", "bold");
    doc.setTextColor(...VIOLET);
    doc.text("AGR BRUT — BARÈME 57/-", margin + 4, y + 7);
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text(eur(data.result.bareme57), margin + 4, y + 17);
    doc.setFontSize(10);
    doc.setFont("", "bold");
    doc.setTextColor(...VIOLET);
    doc.text("BARÈME 05/-", pageW / 2 + 6, y + 7);
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text(eur(data.result.bareme05), pageW / 2 + 6, y + 17);
    if (data.result.motif57 || data.result.motif05) {
      doc.setFontSize(8);
      doc.setFont("", "normal");
      doc.setTextColor(180, 120, 20);
      doc.text(
        [data.result.motif57, data.result.motif05].filter(Boolean).join(" · "),
        margin + 4,
        y + 23,
      );
    }
  }
  y += boxH + 8;

  /* ── Résultats détaillés ─────────────────────────────────────────────── */
  sectionTitle("Résultats");
  kvGrid([
    ["AGR barème 57/-", eur(data.result.bareme57)],
    ["AGR barème 05/-", eur(data.result.bareme05)],
    ["Chômage temporaire", eur(data.result.chomageTemporaire)],
    ["Total 57 (AGR+CT+CC)", eur(data.result.total57)],
    ["Total 05 (AGR+CT+CC)", eur(data.result.total05)],
    ["Salaire de référence", eur(data.result.salaireReference)],
  ]);
  y += 3;

  /* ── Résultats intermédiaires ────────────────────────────────────────── */
  const im = data.result.intermediaires;
  sectionTitle("Résultats intermédiaires");
  kvGrid([
    ["Nombre d'occupations", String(im.nombreOccupations)],
    ["F1 (allocations)", num(im.f1)],
    ["F2 (allocation jour)", eur(im.f2)],
    ["F3 / F4", `${num(im.f3)} / ${num(im.f4)}`],
    ["VTL total", num(im.vtlTot)],
    ["Bonus total", eur(im.bonusTot)],
    ["Salaire imposable", eur(im.totalSalaireImposable)],
    ["Retenues (précompte)", eur(im.totalRetenues)],
    ["Y net BIS", eur(im.totalYnetBis)],
    ["", ""],
    ["Formule 1A", eur(im.formule1A)],
    ["Formule 1B", eur(im.formule1B)],
    ["Formule 2A", eur(im.formule2A)],
    ["Formule 2B", eur(im.formule2B)],
  ]);
  y += 4;

  /* ── Avertissement ───────────────────────────────────────────────────── */
  ensureSpace(20);
  doc.setFontSize(8);
  doc.setFont("", "italic");
  doc.setTextColor(120, 120, 120);
  const disclaimer = doc.splitTextToSize(
    "Montants bruts. L'AGR doit être au moins égale à la demi-allocation. Document indicatif généré automatiquement à partir des données saisies — vérifiez toujours les valeurs extraites du WECH 506 avant validation du paiement.",
    pageW - margin * 2,
  );
  doc.text(disclaimer, margin, y);

  /* ── Pied de page sur chaque page ────────────────────────────────────── */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont("", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Docbel © ${now.getFullYear()} | https://www.docbel.be`,
      pageW / 2,
      pageH - 8,
      { align: "center" },
    );
    doc.text(`${p} / ${pages}`, pageW - margin, pageH - 8, { align: "right" });
  }

  return doc;
}

/** Génère le PDF et déclenche son téléchargement (navigateur uniquement). */
export async function exportAgrPdf(data: AgrPdfData): Promise<void> {
  const doc = await buildAgrPdf(data);
  doc.save(`docbel-calcul-agr-${new Date().toISOString().split("T")[0]}.pdf`);
}
