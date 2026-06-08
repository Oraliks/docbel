/**
 * Moteur de calcul de l'Allocation de Garantie de Revenus (AGR).
 *
 * Portage fidèle de la feuille Excel FGTB « Calcul AGR » (`calcul 0104xx`).
 * Chaque étape référence la cellule Excel correspondante pour audit.
 *
 * Principe :
 *  - Barème 57 = min(Formule 1A, Formule 1B), 0 si l'une < demi-allocation min.
 *  - Barème 05 = max(Barème 57, min(Formule 2A, 2B)).
 *  - Formule 1A : (F1·F2 + F4·(ΣF8 − comp2) − Y_net) × 100/89,91.
 *  - Formule 1B : plafond fondé sur le VTL (limitation).
 * Voir `types.ts` pour les entrées/sorties et `baremes.ts` pour les constantes.
 */

import {
  getBareme,
  type Bareme,
  COEF_IMPOSABLE,
  COEF_BRUT,
  COEF_B1,
  FACTEUR_MENSUEL,
} from "./baremes";
import { precompteMensuel } from "./precompte";
import { truncN, arrondiB, arrondiD, joursRound } from "./rounding";
import type {
  AgrGlobalInput,
  AgrResult,
  CategorieTravailleur,
  OccupationResult,
} from "./types";

/** Premier chiffre de la catégorie travailleur (1/2/3). */
function catIndex(cat: CategorieTravailleur): number {
  return parseInt(cat[0] ?? "0", 10) || 0;
}

/**
 * Bonus à l'emploi (BONUS FT) en fonction du VTL. Tranches dégressives.
 * (Le commentaire « 288,87 » de l'Excel est un reliquat : la formule active
 * utilise les constantes AI ci-dessous.)
 *
 * ⚠️ `cat2Global` reproduit FIDÈLEMENT une anomalie de l'Excel : pour le
 * BONUS TOTAL des catégories 2 (cellule `D299`/`I299`, utilisé par la formule
 * 1B), la 3ᵉ tranche soustrait `AI13` (3336,99) au lieu de `AI15` (2880,32) —
 * très probablement une coquille de l'Excel. On la reproduit pour que l'outil
 * donne EXACTEMENT le même montant que l'Excel FGTB (le bonus par occupation,
 * lui, utilise correctement AI15). Voir [[project-calcul-agr]].
 */
function bonusFT(vtl: number, b: Bareme, cat2Global = false): number {
  const p = b.bonus;
  let raw: number;
  if (vtl < p.seuil1Ex) raw = p.base;
  else if (vtl > p.seuil1 && vtl < p.seuil2Ex) raw = p.base - p.pente1 * (vtl - p.seuil1);
  else if (vtl > p.seuil2 && vtl < p.seuil3Ex)
    raw = p.base2 - p.pente2 * (vtl - (cat2Global ? p.seuil3Ex : p.seuil2));
  else raw = 0;
  return arrondiB(raw);
}

const SUP_FAMILLE = (cat: string): "A" | "N" | "B" => (cat === "A" ? "A" : cat === "N" ? "N" : "B");

export function calculerAgr(g: AgrGlobalInput): AgrResult {
  const b = getBareme(g.bareme);
  const occs = g.occupations.slice(0, 4);
  const estChefMenage = g.categorieFamiliale === "A";
  const demiMin = b.demiAllocationMin;

  // Nombre d'occupations actives (Q > 0) — B11.
  const actifs = occs.map((o) => o.q > 0);
  const nbOcc = actifs.filter(Boolean).length;

  // ─── Étape 1 : F6, salaire théorique mensuel ajusté, fermeture ───────────
  const w = occs.map((o, i) => {
    if (!actifs[i]) {
      return {
        ...o, f6: 0, salMois: 0, fermAccept: 0, prc: 0, pwc: 0, closureByJ: 0,
        soldeS32after: 0, ha: 0, haReq: 0, hvRecalc: 0, haRecalc: 0,
        f7: 0, f8: 0, vtl: 0, bft: 0, bonusFtProp: 0, bonusPt: 0,
        pwPrDays: 0, pwDays: 0, closureDaysF1: 0, closureCtDays: 0,
        sansSalaire: false,
      };
    }
    // I30 / B31 : salaire mensuel ajusté si Qinfo = 3, tronqué à 2 décimales.
    const i30 = o.qinfo === 3 ? (o.salaireTheoriqueMois * o.q) / o.s : o.salaireTheoriqueMois;
    const salMois = truncN(i30, 2);
    // M31 : occupation active sans aucun salaire théorique → calcul impossible.
    const sansSalaire = o.salaireTheoriqueHeure + salMois === 0;
    // F6 (D130/D133) : salaire horaire fourni, sinon salaire mensuel / (4,3333·Q).
    const f6 = o.salaireTheoriqueHeure > 0
      ? o.salaireTheoriqueHeure
      : salMois > 0 ? truncN(salMois / (FACTEUR_MENSUEL * o.q), 4) : 0;
    // B43 / B42 : heures de fermeture acceptées (plafonnées au solde Q×4).
    const fermAccept = o.fermetureTotal === 0 ? 0 : Math.min(o.fermetureTotal, o.soldeQ4);
    const prc = o.fermetureTotal - fermAccept;
    return {
      ...o, f6, salMois, fermAccept, prc, pwc: 0, closureByJ: 0,
      soldeS32after: 0, ha: 0, haReq: 0, hvRecalc: 0, haRecalc: 0,
      f7: 0, f8: 0, vtl: 0, bft: 0, bonusFtProp: 0, bonusPt: 0,
      pwPrDays: 0, pwDays: 0, closureDaysF1: 0, closureCtDays: 0, sansSalaire,
    };
  });

  // ─── Étape 2 : cascade du solde J (couverture des fermetures) ────────────
  // Le solde J est consommé occupation par occupation (O17 → O18 → …).
  let soldeJrest = g.soldeJ;
  for (const o of w) {
    if (o.fermAccept === 0) continue;
    const i17 = truncN((soldeJrest * o.s) / 6, 2); // heures de fermeture couvrables par J
    o.pwc = o.fermAccept > i17 ? o.fermAccept - i17 : 0; // J17 : fermeture non couverte = PWC
    o.closureByJ = o.fermAccept - o.pwc; // I41 : fermeture couverte par J
    const joursConsommes = joursRound((o.fermAccept - o.pwc) * 6 / o.s); // N17
    soldeJrest -= joursConsommes;
  }
  const soldeJfinal = soldeJrest; // O20

  // ─── Étape 3 : recalcul vacances / absences, F7, F8, VTL, bonus FT ───────
  for (const o of w) {
    if (o.q <= 0) continue;
    o.soldeS32after = Math.max(0, o.soldeS32 - o.fermAccept - o.heuresV); // B44
    o.ha = o.requalifier ? Math.max(0, o.heuresA - o.soldeS32after) : o.heuresA; // B36
    o.haReq = o.heuresA - o.ha; // B37
    o.hvRecalc = (o.heuresV > o.soldeS32 ? o.soldeS32 : o.heuresV) + o.closureByJ; // B50
    o.haRecalc = o.heuresV > o.soldeS32 ? o.ha + (o.heuresV - o.soldeS32) : o.ha; // B51
    o.f8 = truncN((o.heures + o.hvRecalc + o.haReq + o.pwc) * 38 / o.s, 4); // D127
    // F7 (D136/D139) : ouvrier privé inclut HV ; les autres seulement HA_REQ.
    o.f7 = o.categorieTravailleur === "1O"
      ? arrondiD(o.f6 * (o.hvRecalc + o.haReq))
      : arrondiD(o.f6 * o.haReq);
    o.vtl = arrondiB(o.f6 * o.s * FACTEUR_MENSUEL); // D142
    o.bft = catIndex(o.categorieTravailleur) <= 2 ? bonusFT(o.vtl, b) : 0; // D147/D153
  }

  // ─── Étape 4 : conversions en jours (absences, CT) ───────────────────────
  // Jours d'absence : moyenne pondérée si cumul temps partiel multi-occupations.
  const absenceDays: number[] = w.map(() => 0);
  if (nbOcc > 1 && g.cumulTempsPartiel) {
    const num = w.reduce((s, o) => s + (o.q > 0 ? (o.haRecalc * 38 * 6) / o.s : 0), 0); // ΣM106
    const den = w.reduce((s, o) => s + (o.q > 0 ? (o.q * 38) / o.s : 0), 0); // ΣQ106
    absenceDays[0] = den > 0 ? joursRound(num / den) : 0; // I106 combiné → B106
  } else {
    w.forEach((o, i) => {
      if (o.q > 0) absenceDays[i] = joursRound((o.haRecalc * 6) / o.q);
    });
  }

  w.forEach((o, i) => {
    // Jours CT pour F1 (PW + PR), arrondis séparément — B109.
    o.pwPrDays = o.q > 0 ? joursRound(((o.pw1 + o.pr) * 6) / o.s) + joursRound((o.pw2 * 6) / o.s) : 0;
    // Jours CT pour le CT (PW seul) — B108.
    o.pwDays = o.q > 0 ? joursRound((o.pw1 * 6) / o.s) + joursRound((o.pw2 * 6) / o.s) : 0;
    // Jours fermeture pour F1 (PWC + PRC ; occ. > 1 exclut PRC si HV recalculé) — B112.
    o.closureDaysF1 = o.q > 0
      ? (i === 0 || o.hvRecalc === 0
          ? joursRound(((o.pwc + o.prc) * 6) / o.s)
          : joursRound((o.pwc * 6) / o.s))
      : 0;
    // Jours fermeture CT (PWC) pour le CT — M58.
    o.closureCtDays = o.q > 0 ? joursRound((o.pwc * 6) / o.s) : 0;
  });

  // ─── Étape 5 : F1 (nombre d'allocations) ─────────────────────────────────
  const sumAbsence = absenceDays.reduce((s, d) => s + d, 0);
  const sumPwPr = w.reduce((s, o) => s + o.pwPrDays, 0);
  const sumClosureF1 = w.reduce((s, o) => s + o.closureDaysF1, 0);
  const sumJoursNI = w.reduce((s, o) => s + (o.q > 0 ? o.joursNI : 0), 0);
  const deductions = sumJoursNI + g.joursCC + sumAbsence + sumPwPr + sumClosureF1;
  let f1 = deductions > 26 ? 0 : 26 - deductions; // I105
  if (g.moisDecembre) {
    // N33 : solde J restant non couvert par les heures de vacances → décompte.
    const sumLV = w.reduce((s, o) => {
      if (o.q <= 0) return s;
      const i33 = o.soldeS32 > o.heuresV
        ? ((o.heuresV + o.haReq) * 6) / o.s
        : ((o.soldeS32 + o.haReq) * 6) / o.s;
      return s + joursRound(i33);
    }, 0);
    const n33 = sumLV > soldeJfinal ? 0 : soldeJfinal - sumLV;
    f1 = f1 - n33;
  }

  // ─── Étape 6 : F2, F3, F4, F9, VTLTOT, bonus total ───────────────────────
  const f2 = g.categorieFamiliale === "B1" ? arrondiD(g.allocationJournaliere * COEF_B1) : g.allocationJournaliere; // D114
  const supKey = SUP_FAMILLE(g.categorieFamiliale);
  const f3 = b.supplementJour[supKey]; // D118
  const f4 = b.supplementHoraire[supKey]; // D121

  const sumF6S38 = w.reduce((s, o) => s + (o.q > 0 ? (o.f6 * o.s) / 38 : 0), 0); // ΣI286
  const f9 = nbOcc > 0 ? arrondiD(sumF6S38 / nbOcc) : 0; // D287
  const single = w.find((o) => o.q > 0);
  const vtlTot = nbOcc === 1 && single
    ? arrondiB(single.f6 * single.s * FACTEUR_MENSUEL)
    : arrondiD(f9 * 38 * FACTEUR_MENSUEL); // D291
  const minCatIdx = Math.min(...w.filter((o) => o.q > 0).map((o) => catIndex(o.categorieTravailleur)), 99);
  // D295 (cat 1, formule correcte) / D299 (cat 2, reproduit la coquille AI13).
  const bonusTot = minCatIdx === 1 ? bonusFT(vtlTot, b) : minCatIdx === 2 ? bonusFT(vtlTot, b, true) : 0;
  const f1over26 = truncN(f1 / 26, 4); // J334
  const bonusTotProp = arrondiB(bonusTot * f1over26); // D303

  // ─── Étape 7 : bonus FT prop. et bonus PT par occupation ─────────────────
  for (const o of w) {
    if (o.q <= 0) continue;
    o.bonusFtProp = arrondiB(o.bft * f1over26); // D159
    o.bonusPt = o.vtl > 0 ? arrondiB((o.bonusFtProp * o.ybrut) / o.vtl) : 0; // D162
  }

  // ─── Étape 8 : salaire imposable, retenues, Y net ────────────────────────
  const sumImpos = w.reduce(
    (s, o) => s + (o.q > 0 ? arrondiD((o.ybrut + o.f7) * COEF_IMPOSABLE) : 0),
    0,
  ); // ΣM310
  const sumBonusPt = w.reduce((s, o) => s + o.bonusPt, 0);
  const totSalImpos = sumImpos + sumBonusPt; // D313
  const retenues = precompteMensuel(totSalImpos, estChefMenage, b.precompte); // D321
  const totYnetBis = totSalImpos - retenues; // D326

  const sumYbrutF7 = w.reduce((s, o) => s + (o.q > 0 ? o.ybrut + o.f7 : 0), 0);
  const salaireRefAtteint = sumYbrutF7 > b.salaireReference - 0.01;

  // ─── Étape 9 : formules 1A / 1B / 2A / 2B ────────────────────────────────
  const inc = g.incapaciteOuSanctionTotalite;

  // 1A
  const comp1_1A = f2 * f1; // I333
  const comp2_1A = truncN(55 * f1over26, 4); // J335
  const sumF8 = w.reduce((s, o) => s + o.f8, 0);
  const comp3_1A = truncN(f4 * Math.max(0, sumF8 - comp2_1A), 4); // J337
  const raw1A = totYnetBis > comp1_1A + comp3_1A ? 0 : (comp1_1A + comp3_1A - totYnetBis) * COEF_BRUT;
  const f1A = inc || salaireRefAtteint ? 0 : arrondiD(raw1A); // D339

  // 1B
  const vtlBase = nbOcc > 1 ? f9 * 38 * FACTEUR_MENSUEL : (single ? single.f6 * single.s * FACTEUR_MENSUEL : 0);
  const comp2_1B = arrondiD(vtlBase * f1over26 * COEF_IMPOSABLE); // M345
  const comp3_1B = Math.min(6000, comp2_1B + bonusTotProp); // I346
  const retenues1B = precompteMensuel(comp3_1B, estChefMenage, b.precompte); // I347
  const rawP345 = salaireRefAtteint
    ? 0
    : totYnetBis + retenues1B > comp3_1B
      ? 0
      : (comp3_1B - retenues1B - totYnetBis) * COEF_BRUT;
  const f1B = inc ? 0 : arrondiD(rawP345); // D345

  // 2A
  const comp1_2A = arrondiD(f1 * (f2 + f3)); // M350
  const comp2_2A = Math.max(0, comp1_2A - totYnetBis); // I351
  const f2A = inc || salaireRefAtteint ? 0 : arrondiD(comp2_2A * COEF_BRUT); // D352

  // 2B
  const f2B = inc || salaireRefAtteint ? 0 : arrondiD(f2 * 23.4 * COEF_BRUT); // D355

  // ─── Étape 10 : barèmes 57 / 05, chômage temporaire, totaux ──────────────
  const sansSalaire = w.some((o) => o.q > 0 && o.sansSalaire);
  const catManquante = w.some((o) => o.q > 0 && !o.categorieTravailleur);
  let erreur = "";
  if (sansSalaire) erreur = "Calcul impossible : il manque un salaire théorique.";
  else if (catManquante) erreur = "Veuillez indiquer la catégorie du travailleur.";

  let bareme57: number | null = null;
  let bareme05: number | null = null;
  if (!erreur) {
    bareme57 = f1A < demiMin ? 0 : f1B < demiMin ? 0 : Math.min(f1A, f1B); // B59
    const i56 = f2A < demiMin ? 0 : Math.min(f2A, f2B); // I56
    bareme05 = Math.max(bareme57, i56); // B60
  }

  // Chômage temporaire (CT) — D59 → K62.
  const ctDays = w.reduce((s, o) => s + o.closureCtDays + o.pwDays, 0); // D59
  const ctWhole = Math.trunc(ctDays);
  const ctHalf = ctDays - ctWhole;
  const chomageTemporaire = ctWhole * g.allocationJournaliere + (ctHalf > 0 ? g.demiAllocation : 0); // K62
  const ccWhole = Math.trunc(g.joursCC);
  const ccHalf = g.joursCC - ccWhole;
  const ccAmount = ccWhole * g.allocationJournaliere + (ccHalf > 0 ? g.demiAllocation : 0); // K63

  const total57 = (bareme57 ?? 0) + chomageTemporaire + ccAmount; // E59
  const total05 = (bareme05 ?? 0) + chomageTemporaire + ccAmount; // E60

  // Explique pourquoi un barème vaut 0 €. N'affiche rien tant que le résultat
  // est positif. L'ordre des tests va du plus « donnée manquante » (le plus
  // courant) vers le plus « calculé ».
  const fmtEur = (x: number) => `${x.toFixed(2).replace(".", ",")} €`;
  const motifFor = (v: number | null): string => {
    if (v !== null && v > 0) return "";
    if (nbOcc === 0) return "Aucune occupation renseignée (facteur Q manquant).";
    if (g.allocationJournaliere <= 0) return "Allocation journalière non renseignée.";
    if (inc) return "Incapacité ou sanction sur la totalité du mois : pas d'AGR.";
    if (salaireRefAtteint)
      return "Salaire de référence atteint : le salaire dépasse le plafond, plus de droit à l'AGR.";
    if (f1 <= 0) return "Aucun jour indemnisable ce mois (déductions ≥ 26 jours).";
    if (v !== null && v < demiMin)
      return `Inférieure à la ½ allocation minimum (${fmtEur(demiMin)}) : ramenée à 0.`;
    return "Le salaire atteint déjà le revenu garanti : aucun complément AGR dû.";
  };

  const occupations: OccupationResult[] = w.map((o, i) => ({
    f6: o.f6, f7: o.f7, f8: o.f8, vtl: o.vtl, bonusFt: o.bft,
    bonusFtProp: o.bonusFtProp, bonusPt: o.bonusPt,
    ybrutTotal: o.q > 0 ? o.ybrut + o.f7 : 0,
    hvRecalcule: o.hvRecalc, haRecalcule: o.haRecalc, haReqRecalcule: o.haReq,
    pwcRecalcule: o.pwc, prcRecalcule: o.prc,
    joursNonIndemn: o.q > 0 ? o.joursNI + (i === 0 ? g.joursCC : 0) : 0,
    haX6surQ: absenceDays[i], pwX6surS: o.pwPrDays, pwcX6surS: o.closureDaysF1,
  }));

  return {
    bareme57: bareme57 === null ? null : round2(bareme57),
    bareme05: bareme05 === null ? null : round2(bareme05),
    chomageTemporaire: round2(chomageTemporaire),
    total57: round2(total57),
    total05: round2(total05),
    salaireReference: b.salaireReference,
    motif57: motifFor(bareme57),
    motif05: motifFor(bareme05),
    erreur,
    intermediaires: {
      nombreOccupations: nbOcc,
      f1, f2, f3, f4, f9, vtlTot, bonusTot, bonusTotProp,
      totalSalaireImposable: round2(totSalImpos),
      totalRetenues: round2(retenues),
      totalYnetBis: round2(totYnetBis),
      formule1A: f1A, formule1B: f1B, formule2A: f2A, formule2B: f2B,
      occupations,
    },
  };
}

function round2(x: number): number {
  return Math.round((x + 1e-9) * 100) / 100;
}
