/**
 * Export PDF d'un calcul AGR — récapitulatif complet, design « sectionné »
 * DocBel : en-tête DOCBEL, titre centré, sections numérotées en cartes,
 * deux encadrés de résultat, grilles de cartes pour les détails, encart
 * d'avertissement et bandeau de pied violet (« Docbel © | https://www.docbel.be »).
 *
 * jsPDF en import dynamique. `buildAgrPdf` retourne le document (testable hors
 * navigateur) ; `exportAgrPdf` déclenche le téléchargement.
 *
 * i18n : tous les libellés FR ont une clé parallèle dans `AGR_PDF_LABEL_KEYS`
 * (namespace `public.agrExport.*`). Pour rendre le PDF localisé, passer
 * un translator `t` (ex: `useTranslations()` côté client) via `i18n`. FR
 * reste le fallback par défaut.
 */

import { getBareme } from "./baremes";
import type { AgrGlobalInput, AgrResult, OccupationInput } from "./types";

export interface OccPdfMeta {
  filename?: string;
  nom?: string | null;
  periode?: string | null;
}

/**
 * Translator callback compatible avec next-intl. Reçoit la clé COMPLÈTE
 * (incluant le namespace `public.agrExport.*`) et un objet de paramètres
 * ICU optionnels. Doit retourner la chaîne résolue dans la locale active.
 */
export type AgrPdfTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export interface AgrPdfData {
  global: Omit<AgrGlobalInput, "occupations">;
  occupations: OccupationInput[];
  metas: OccPdfMeta[];
  result: AgrResult;
  /**
   * Translator optionnel. Si fourni, les libellés du PDF sont résolus via
   * `t(<labelKey>, <values>)`. Sinon, fallback FR (chaînes en dur).
   */
  i18n?: AgrPdfTranslator;
}

/**
 * Cartographie des libellés FR vers leurs clés i18n
 * (`public.agrExport.*`). Permet aux consommateurs de résoudre les
 * traductions sans répéter le namespace.
 */
export const AGR_PDF_LABEL_KEYS = {
  brandName: "public.agrExport.brand.name",
  brandTagline: "public.agrExport.brand.tagline",
  brandWebsite: "public.agrExport.brand.website",
  headerGeneratedAt: "public.agrExport.header.generatedAt",
  headerTitle: "public.agrExport.header.title",
  headerSubtitle: "public.agrExport.header.subtitle",
  sectionParams: "public.agrExport.sections.params",
  sectionResults: "public.agrExport.sections.results",
  sectionIntermediaires: "public.agrExport.sections.intermediaires",
  occupationLabel: "public.agrExport.occupation.label",
  occupationLabelWithSub: "public.agrExport.occupation.labelWithSub",
  paramsAllocationJournaliere: "public.agrExport.params.allocationJournaliere",
  paramsDemiAllocation: "public.agrExport.params.demiAllocation",
  paramsCategorieFamiliale: "public.agrExport.params.categorieFamiliale",
  paramsSoldeJ: "public.agrExport.params.soldeJ",
  paramsJoursCC: "public.agrExport.params.joursCC",
  paramsMoisDecembre: "public.agrExport.params.moisDecembre",
  paramsCumulTempsPartiel: "public.agrExport.params.cumulTempsPartiel",
  paramsIncapaciteOuSanctionTotalite:
    "public.agrExport.params.incapaciteOuSanctionTotalite",
  paramsYes: "public.agrExport.params.yes",
  paramsNo: "public.agrExport.params.no",
  occFacteurQS: "public.agrExport.occupationFields.facteurQS",
  occCategorieTravailleur: "public.agrExport.occupationFields.categorieTravailleur",
  occQinfo: "public.agrExport.occupationFields.qinfo",
  occYbrut: "public.agrExport.occupationFields.ybrut",
  occSalaireTheoMois: "public.agrExport.occupationFields.salaireTheoMois",
  occSalaireTheoHeure: "public.agrExport.occupationFields.salaireTheoHeure",
  occHeuresHT: "public.agrExport.occupationFields.heuresHT",
  occVacancesAbsence: "public.agrExport.occupationFields.vacancesAbsence",
  occFermeture: "public.agrExport.occupationFields.fermeture",
  occPwCtPr: "public.agrExport.occupationFields.pwCtPr",
  occSoldeS32Q4: "public.agrExport.occupationFields.soldeS32Q4",
  occJoursNI: "public.agrExport.occupationFields.joursNI",
  occRequalifier: "public.agrExport.occupationFields.requalifier",
  resultBoxBareme57: "public.agrExport.resultBoxes.bareme57",
  resultBoxBareme05: "public.agrExport.resultBoxes.bareme05",
  resultBareme57: "public.agrExport.results.bareme57",
  resultBareme05: "public.agrExport.results.bareme05",
  resultChomageTemporaire: "public.agrExport.results.chomageTemporaire",
  resultSalaireReference: "public.agrExport.results.salaireReference",
  resultTotal57: "public.agrExport.results.total57",
  resultTotal05: "public.agrExport.results.total05",
  imNombreOccupations: "public.agrExport.intermediaires.nombreOccupations",
  imF1: "public.agrExport.intermediaires.f1",
  imF2: "public.agrExport.intermediaires.f2",
  imF3F4: "public.agrExport.intermediaires.f3f4",
  imVtlTot: "public.agrExport.intermediaires.vtlTot",
  imBonusTot: "public.agrExport.intermediaires.bonusTot",
  imTotalSalaireImposable:
    "public.agrExport.intermediaires.totalSalaireImposable",
  imTotalRetenues: "public.agrExport.intermediaires.totalRetenues",
  imFormule1A: "public.agrExport.intermediaires.formule1A",
  imFormule1B: "public.agrExport.intermediaires.formule1B",
  imFormule2A: "public.agrExport.intermediaires.formule2A",
  imFormule2B: "public.agrExport.intermediaires.formule2B",
  catFamilialeA: "public.agrExport.categorieFamiliale.A",
  catFamilialeN: "public.agrExport.categorieFamiliale.N",
  catFamilialeB1: "public.agrExport.categorieFamiliale.B1",
  catFamilialeB2: "public.agrExport.categorieFamiliale.B2",
  catFamilialeP: "public.agrExport.categorieFamiliale.P",
  catTrav1O: "public.agrExport.categorieTravailleur._1O",
  catTrav1E: "public.agrExport.categorieTravailleur._1E",
  catTrav2E: "public.agrExport.categorieTravailleur._2E",
  catTrav2P: "public.agrExport.categorieTravailleur._2P",
  catTrav3: "public.agrExport.categorieTravailleur._3",
  warning: "public.agrExport.warning",
  footer: "public.agrExport.footer",
  pagination: "public.agrExport.pagination",
  filename: "public.agrExport.filename",
} as const;

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

/**
 * Construit le translator effectif : si `i18n` fourni, l'utilise ; sinon
 * applique le fallback FR (interpolation ICU minimale `{name}` -> valeur).
 */
function makeT(data: AgrPdfData) {
  const fallbackFr: Record<string, string> = {
    [AGR_PDF_LABEL_KEYS.brandName]: "DOCBEL",
    [AGR_PDF_LABEL_KEYS.brandTagline]: "Piloter · Valoriser · Confiance",
    [AGR_PDF_LABEL_KEYS.brandWebsite]: "https://www.docbel.be",
    [AGR_PDF_LABEL_KEYS.headerGeneratedAt]: "Généré le {date} à {time}",
    [AGR_PDF_LABEL_KEYS.headerTitle]: "Calcul AGR — Allocation de Garantie de Revenus",
    [AGR_PDF_LABEL_KEYS.headerSubtitle]: "{bareme}  ·  Salaire de référence : {salary}",
    [AGR_PDF_LABEL_KEYS.sectionParams]: "Paramètres du dossier",
    [AGR_PDF_LABEL_KEYS.sectionResults]: "Résultats",
    [AGR_PDF_LABEL_KEYS.sectionIntermediaires]: "Résultats intermédiaires",
    [AGR_PDF_LABEL_KEYS.occupationLabel]: "Occupation {n}",
    [AGR_PDF_LABEL_KEYS.occupationLabelWithSub]: "Occupation {n} — {sub}",
    [AGR_PDF_LABEL_KEYS.paramsAllocationJournaliere]: "Allocation journalière",
    [AGR_PDF_LABEL_KEYS.paramsDemiAllocation]: "Demi-allocation",
    [AGR_PDF_LABEL_KEYS.paramsCategorieFamiliale]: "Catégorie familiale",
    [AGR_PDF_LABEL_KEYS.paramsSoldeJ]: "Solde J (jours)",
    [AGR_PDF_LABEL_KEYS.paramsJoursCC]: "Jours CC",
    [AGR_PDF_LABEL_KEYS.paramsMoisDecembre]: "Mois de décembre",
    [AGR_PDF_LABEL_KEYS.paramsCumulTempsPartiel]: "Cumul temps partiel",
    [AGR_PDF_LABEL_KEYS.paramsIncapaciteOuSanctionTotalite]: "Incapacité/sanction tout le mois",
    [AGR_PDF_LABEL_KEYS.paramsYes]: "oui",
    [AGR_PDF_LABEL_KEYS.paramsNo]: "non",
    [AGR_PDF_LABEL_KEYS.occFacteurQS]: "Facteur Q / S",
    [AGR_PDF_LABEL_KEYS.occCategorieTravailleur]: "Catégorie travailleur",
    [AGR_PDF_LABEL_KEYS.occQinfo]: "Qinfo",
    [AGR_PDF_LABEL_KEYS.occYbrut]: "Y-Brut",
    [AGR_PDF_LABEL_KEYS.occSalaireTheoMois]: "Salaire théo. / mois",
    [AGR_PDF_LABEL_KEYS.occSalaireTheoHeure]: "Salaire théo. / heure",
    [AGR_PDF_LABEL_KEYS.occHeuresHT]: "Heures (HT)",
    [AGR_PDF_LABEL_KEYS.occVacancesAbsence]: "Vacances (V) / Absence (A)",
    [AGR_PDF_LABEL_KEYS.occFermeture]: "Fermeture",
    [AGR_PDF_LABEL_KEYS.occPwCtPr]: "PW (CT) / PR",
    [AGR_PDF_LABEL_KEYS.occSoldeS32Q4]: "Solde S×3,2 / Q×4",
    [AGR_PDF_LABEL_KEYS.occJoursNI]: "Jours NI",
    [AGR_PDF_LABEL_KEYS.occRequalifier]: "Requalifier A → V",
    [AGR_PDF_LABEL_KEYS.resultBoxBareme57]: "AGR BRUT — BARÈME 57/-",
    [AGR_PDF_LABEL_KEYS.resultBoxBareme05]: "BARÈME 05/-",
    [AGR_PDF_LABEL_KEYS.resultBareme57]: "AGR barème 57/-",
    [AGR_PDF_LABEL_KEYS.resultBareme05]: "AGR barème 05/-",
    [AGR_PDF_LABEL_KEYS.resultChomageTemporaire]: "Chômage temporaire",
    [AGR_PDF_LABEL_KEYS.resultSalaireReference]: "Salaire de référence",
    [AGR_PDF_LABEL_KEYS.resultTotal57]: "Total 57 (AGR+CT+CC)",
    [AGR_PDF_LABEL_KEYS.resultTotal05]: "Total 05 (AGR+CT+CC)",
    [AGR_PDF_LABEL_KEYS.imNombreOccupations]: "Nombre d'occupations",
    [AGR_PDF_LABEL_KEYS.imF1]: "F1 (allocations)",
    [AGR_PDF_LABEL_KEYS.imF2]: "F2 (allocation jour)",
    [AGR_PDF_LABEL_KEYS.imF3F4]: "F3 / F4",
    [AGR_PDF_LABEL_KEYS.imVtlTot]: "VTL total",
    [AGR_PDF_LABEL_KEYS.imBonusTot]: "Bonus total",
    [AGR_PDF_LABEL_KEYS.imTotalSalaireImposable]: "Salaire imposable",
    [AGR_PDF_LABEL_KEYS.imTotalRetenues]: "Retenues (précompte)",
    [AGR_PDF_LABEL_KEYS.imFormule1A]: "Formule 1A (AGR 57)",
    [AGR_PDF_LABEL_KEYS.imFormule1B]: "Formule 1B (limite 57)",
    [AGR_PDF_LABEL_KEYS.imFormule2A]: "Formule 2A (AGR 05)",
    [AGR_PDF_LABEL_KEYS.imFormule2B]: "Formule 2B (limite 05)",
    [AGR_PDF_LABEL_KEYS.catFamilialeA]: "A — chef de ménage",
    [AGR_PDF_LABEL_KEYS.catFamilialeN]: "N — isolé",
    [AGR_PDF_LABEL_KEYS.catFamilialeB1]: "B1 — cohabitant 1ʳᵉ pér.",
    [AGR_PDF_LABEL_KEYS.catFamilialeB2]: "B2 — cohabitant 2ᵉ pér.",
    [AGR_PDF_LABEL_KEYS.catFamilialeP]: "P — cohabitant forfait",
    [AGR_PDF_LABEL_KEYS.catTrav1O]: "1O — ouvrier privé",
    [AGR_PDF_LABEL_KEYS.catTrav1E]: "1E — employé privé",
    [AGR_PDF_LABEL_KEYS.catTrav2E]: "2E — employé public",
    [AGR_PDF_LABEL_KEYS.catTrav2P]: "2P — ouvrier public",
    [AGR_PDF_LABEL_KEYS.catTrav3]: "3 — statutaire",
    [AGR_PDF_LABEL_KEYS.warning]:
      "Montants bruts. L'AGR doit être au moins égale à la demi-allocation. Document destiné à l'usage interne, généré automatiquement à partir des données saisies — vérifiez toujours les valeurs extraites du WECH 506 avant toute validation de paiement.",
    [AGR_PDF_LABEL_KEYS.footer]: "Docbel © {year}  |  https://www.docbel.be",
    [AGR_PDF_LABEL_KEYS.pagination]: "{p} / {total}",
    [AGR_PDF_LABEL_KEYS.filename]: "docbel-calcul-agr-{date}.pdf",
  };
  const interp = (s: string, values?: Record<string, string | number>) => {
    if (!values) return s;
    return s.replace(/\{(\w+)\}/g, (_, k) =>
      values[k] !== undefined ? String(values[k]) : `{${k}}`,
    );
  };
  return (key: string, values?: Record<string, string | number>) => {
    if (data.i18n) return data.i18n(key, values);
    return interp(fallbackFr[key] ?? key, values);
  };
}

// Fallback FR conservé pour les libellés des catégories familiales/travailleurs.
const CAT_FAMILIALE: Record<string, string> = {
  A: "A — chef de ménage", N: "N — isolé", B1: "B1 — cohabitant 1ʳᵉ pér.",
  B2: "B2 — cohabitant 2ᵉ pér.", P: "P — cohabitant forfait",
};
const CAT_TRAV: Record<string, string> = {
  "1O": "1O — ouvrier privé", "1E": "1E — employé privé", "2E": "2E — employé public",
  "2P": "2P — ouvrier public", "3": "3 — statutaire",
};

/** Résout la catégorie familiale via i18n si dispo, sinon fallback FR. */
function resolveCatFam(t: (key: string, v?: Record<string, string | number>) => string, code: string): string {
  const map: Record<string, string> = {
    A: AGR_PDF_LABEL_KEYS.catFamilialeA,
    N: AGR_PDF_LABEL_KEYS.catFamilialeN,
    B1: AGR_PDF_LABEL_KEYS.catFamilialeB1,
    B2: AGR_PDF_LABEL_KEYS.catFamilialeB2,
    P: AGR_PDF_LABEL_KEYS.catFamilialeP,
  };
  return map[code] ? t(map[code]) : (CAT_FAMILIALE[code] ?? code);
}

/** Résout la catégorie travailleur via i18n si dispo, sinon fallback FR. */
function resolveCatTrav(t: (key: string, v?: Record<string, string | number>) => string, code: string): string {
  const map: Record<string, string> = {
    "1O": AGR_PDF_LABEL_KEYS.catTrav1O,
    "1E": AGR_PDF_LABEL_KEYS.catTrav1E,
    "2E": AGR_PDF_LABEL_KEYS.catTrav2E,
    "2P": AGR_PDF_LABEL_KEYS.catTrav2P,
    "3": AGR_PDF_LABEL_KEYS.catTrav3,
  };
  return map[code] ? t(map[code]) : (CAT_TRAV[code] ?? code);
}

export async function buildAgrPdf(data: AgrPdfData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const contentW = W - 2 * M;
  let y = 0;

  const t = makeT(data);

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
  doc.text(t(AGR_PDF_LABEL_KEYS.brandName), M + 12, 18.5);
  doc.setFontSize(7.5);
  doc.setFont("", "normal");
  doc.setTextColor(...VIOLET);
  doc.text(t(AGR_PDF_LABEL_KEYS.brandTagline), M + 12, 23);
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text(t(AGR_PDF_LABEL_KEYS.headerGeneratedAt, { date: dateStr, time: timeStr }), W - M, 15, { align: "right" });
  doc.text(t(AGR_PDF_LABEL_KEYS.brandWebsite), W - M, 19.5, { align: "right" });

  // Titre centré.
  doc.setFontSize(17);
  doc.setFont("", "bold");
  doc.setTextColor(...VIOLET_DARK);
  doc.text(t(AGR_PDF_LABEL_KEYS.headerTitle), W / 2, 33, { align: "center" });
  const bar = getBareme(data.global.bareme);
  doc.setFontSize(9);
  doc.setFont("", "normal");
  doc.setTextColor(...GREY);
  doc.text(
    t(AGR_PDF_LABEL_KEYS.headerSubtitle, { bareme: bar.libelle, salary: eur(data.result.salaireReference) }),
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
  sectionHeader(1, t(AGR_PDF_LABEL_KEYS.sectionParams));
  const yesStr = t(AGR_PDF_LABEL_KEYS.paramsYes);
  const noStr = t(AGR_PDF_LABEL_KEYS.paramsNo);
  kvGrid([
    [t(AGR_PDF_LABEL_KEYS.paramsAllocationJournaliere), eur(data.global.allocationJournaliere)],
    [t(AGR_PDF_LABEL_KEYS.paramsDemiAllocation), eur(data.global.demiAllocation)],
    [t(AGR_PDF_LABEL_KEYS.paramsCategorieFamiliale), resolveCatFam(t, data.global.categorieFamiliale)],
    [t(AGR_PDF_LABEL_KEYS.paramsSoldeJ), num(data.global.soldeJ)],
    [t(AGR_PDF_LABEL_KEYS.paramsJoursCC), num(data.global.joursCC)],
    [t(AGR_PDF_LABEL_KEYS.paramsMoisDecembre), data.global.moisDecembre ? yesStr : noStr],
    [t(AGR_PDF_LABEL_KEYS.paramsCumulTempsPartiel), data.global.cumulTempsPartiel ? yesStr : noStr],
    [t(AGR_PDF_LABEL_KEYS.paramsIncapaciteOuSanctionTotalite), data.global.incapaciteOuSanctionTotalite ? yesStr : noStr],
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
    const occLabel = sub
      ? t(AGR_PDF_LABEL_KEYS.occupationLabelWithSub, { n: i + 1, sub })
      : t(AGR_PDF_LABEL_KEYS.occupationLabel, { n: i + 1 });
    doc.text(occLabel, M + 2, y);
    y += 5;
    const orows: [string, string][] = [
      [t(AGR_PDF_LABEL_KEYS.occFacteurQS), `${num(o.q)} / ${num(o.s)}`],
      [t(AGR_PDF_LABEL_KEYS.occCategorieTravailleur), resolveCatTrav(t, o.categorieTravailleur)],
      [t(AGR_PDF_LABEL_KEYS.occQinfo), String(o.qinfo)],
      [t(AGR_PDF_LABEL_KEYS.occYbrut), eur(o.ybrut)],
      [t(AGR_PDF_LABEL_KEYS.occSalaireTheoMois), eur(o.salaireTheoriqueMois)],
      [t(AGR_PDF_LABEL_KEYS.occSalaireTheoHeure), eur(o.salaireTheoriqueHeure)],
      [t(AGR_PDF_LABEL_KEYS.occHeuresHT), num(o.heures)],
    ];
    // Les postes nuls sont masqués pour garder la fiche compacte.
    if (o.heuresV || o.heuresA) orows.push([t(AGR_PDF_LABEL_KEYS.occVacancesAbsence), `${num(o.heuresV)} / ${num(o.heuresA)}`]);
    if (o.fermetureTotal) orows.push([t(AGR_PDF_LABEL_KEYS.occFermeture), num(o.fermetureTotal)]);
    if (o.pw1 || o.pr) orows.push([t(AGR_PDF_LABEL_KEYS.occPwCtPr), `${num(o.pw1)} / ${num(o.pr)}`]);
    if (o.soldeS32 || o.soldeQ4) orows.push([t(AGR_PDF_LABEL_KEYS.occSoldeS32Q4), `${num(o.soldeS32)} / ${num(o.soldeQ4)}`]);
    if (o.joursNI) orows.push([t(AGR_PDF_LABEL_KEYS.occJoursNI), num(o.joursNI)]);
    if (o.requalifier) orows.push([t(AGR_PDF_LABEL_KEYS.occRequalifier), yesStr]);
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
  drawBox(M, t(AGR_PDF_LABEL_KEYS.resultBoxBareme57), eur(data.result.bareme57));
  drawBox(M + boxW + gap, t(AGR_PDF_LABEL_KEYS.resultBoxBareme05), eur(data.result.bareme05));
  if (data.result.erreur) {
    doc.setFont("", "italic");
    doc.setFontSize(8);
    doc.setTextColor(200, 16, 46);
    doc.text(data.result.erreur, M + 5, y + boxH - 2);
  }
  y += boxH + 8;

  /* ── 2. Résultats ────────────────────────────────────────────────────── */
  sectionHeader(2, t(AGR_PDF_LABEL_KEYS.sectionResults));
  miniCards([
    { label: t(AGR_PDF_LABEL_KEYS.resultBareme57), value: eur(data.result.bareme57), accent: true },
    { label: t(AGR_PDF_LABEL_KEYS.resultBareme05), value: eur(data.result.bareme05), accent: true },
    { label: t(AGR_PDF_LABEL_KEYS.resultChomageTemporaire), value: eur(data.result.chomageTemporaire) },
    { label: t(AGR_PDF_LABEL_KEYS.resultSalaireReference), value: eur(data.result.salaireReference) },
    { label: t(AGR_PDF_LABEL_KEYS.resultTotal57), value: eur(data.result.total57) },
    { label: t(AGR_PDF_LABEL_KEYS.resultTotal05), value: eur(data.result.total05) },
  ]);
  y += 2;

  /* ── 3. Résultats intermédiaires ─────────────────────────────────────── */
  const im = data.result.intermediaires;
  sectionHeader(3, t(AGR_PDF_LABEL_KEYS.sectionIntermediaires));
  miniCards([
    { label: t(AGR_PDF_LABEL_KEYS.imNombreOccupations), value: String(im.nombreOccupations) },
    { label: t(AGR_PDF_LABEL_KEYS.imF1), value: num(im.f1) },
    { label: t(AGR_PDF_LABEL_KEYS.imF2), value: eur(im.f2) },
    { label: t(AGR_PDF_LABEL_KEYS.imF3F4), value: `${num(im.f3)} / ${num(im.f4)}` },
    { label: t(AGR_PDF_LABEL_KEYS.imVtlTot), value: num(im.vtlTot) },
    { label: t(AGR_PDF_LABEL_KEYS.imBonusTot), value: eur(im.bonusTot) },
    { label: t(AGR_PDF_LABEL_KEYS.imTotalSalaireImposable), value: eur(im.totalSalaireImposable) },
    { label: t(AGR_PDF_LABEL_KEYS.imTotalRetenues), value: eur(im.totalRetenues) },
    { label: t(AGR_PDF_LABEL_KEYS.imFormule1A), value: eur(im.formule1A), accent: true },
    { label: t(AGR_PDF_LABEL_KEYS.imFormule1B), value: eur(im.formule1B) },
    { label: t(AGR_PDF_LABEL_KEYS.imFormule2A), value: eur(im.formule2A), accent: true },
    { label: t(AGR_PDF_LABEL_KEYS.imFormule2B), value: eur(im.formule2B) },
  ]);
  y += 2;

  /* ── Avertissement ───────────────────────────────────────────────────── */
  ensure(18);
  const warnLines = doc.splitTextToSize(
    t(AGR_PDF_LABEL_KEYS.warning),
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
    doc.text(t(AGR_PDF_LABEL_KEYS.footer, { year: now.getFullYear() }), M, H - 4);
    doc.text(t(AGR_PDF_LABEL_KEYS.pagination, { p, total: pages }), W - M, H - 4, { align: "right" });
  }

  return doc;
}

/** Génère le PDF et déclenche son téléchargement (navigateur uniquement). */
export async function exportAgrPdf(data: AgrPdfData): Promise<void> {
  const doc = await buildAgrPdf(data);
  const t = makeT(data);
  const today = new Date().toISOString().split("T")[0];
  doc.save(t(AGR_PDF_LABEL_KEYS.filename, { date: today }));
}
