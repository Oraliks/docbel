/**
 * Types du moteur de calcul AGR (Allocation de Garantie de Revenus).
 *
 * Reproduit la feuille Excel FGTB « Calcul AGR » : jusqu'à 4 occupations
 * simultanées, données globales du dossier chômage + données par occupation
 * (issues du WECH 506). Voir `calcul.ts` pour l'implémentation des formules.
 */

/** Statut du travailleur (détermine F6/F7 et le bonus à l'emploi). */
export type CategorieTravailleur = "1O" | "1E" | "2E" | "2P" | "3";

/**
 * Catégorie familiale du dossier chômage.
 *  - A  = chef de ménage
 *  - N  = isolé
 *  - B1 = cohabitant 1ʳᵉ période
 *  - B2 = cohabitant 2ᵉ période
 *  - P  = cohabitant au forfait
 */
export type CategorieFamiliale = "A" | "N" | "B1" | "B2" | "P";

/** Données d'une occupation (1 WECH 506 = 1 occupation). */
export interface OccupationInput {
  /** Qinfo : 2 = même facteur Q tout le mois ; 3 = facteur Q moyen. */
  qinfo: 2 | 3;
  /** Facteur Q (heures/semaine de l'occupation). */
  q: number;
  /** Facteur S (heures/semaine temps plein de référence). */
  s: number;
  /** Catégorie du travailleur. */
  categorieTravailleur: CategorieTravailleur;
  /** Y-Brut : salaire des prestations effectives du mois. */
  ybrut: number;
  /** Salaire théorique moyen par heure (0 si non communiqué). */
  salaireTheoriqueHeure: number;
  /** Salaire théorique moyen par mois (0 si non communiqué). */
  salaireTheoriqueMois: number;
  /** « Heures » du C131B : heures de travail et assimilées (HT). */
  heures: number;
  /** Heures de vacances « V » (hors fermeture d'entreprise). */
  heuresV: number;
  /** Heures d'absence « A ». */
  heuresA: number;
  /** Requalifier les heures A en heures V (si solde S×3,2 suffisant). */
  requalifier: boolean;
  /** Solde de S × 3,2 (compteur vacances, en heures). */
  soldeS32: number;
  /** Solde de Q × 4 (compteur vacances jeunes/seniors). */
  soldeQ4: number;
  /** PW — heures de chômage temporaire (autres que fermeture), 1ᵉʳ poste. */
  pw1: number;
  /** PW — 2ᵉ poste de chômage temporaire (Pw2), généralement 0. */
  pw2: number;
  /** PR — CT non indemnisable + congés allaitement/adoption/paternité. */
  pr: number;
  /** Total des heures de fermeture d'entreprise. */
  fermetureTotal: number;
  /** Jours non indemnisables (rubrique II C3TP noircie, maladie, sanction…). */
  joursNI: number;
}

/** Données globales du dossier (hors WECH 506). */
export interface AgrGlobalInput {
  /** Montant de l'allocation journalière (selon barème + dégressivité). */
  allocationJournaliere: number;
  /** Montant de la demi-allocation (pour le chômage temporaire). */
  demiAllocation: number;
  /** Catégorie familiale. */
  categorieFamiliale: CategorieFamiliale;
  /** Âgé d'au moins 21 ans à la fin du mois. */
  ageAuMoins21: boolean;
  /** Solde « J » + « TXP » au 1ᵉʳ jour du mois (jours de vacances restants). */
  soldeJ: number;
  /** S'agit-il du mois de décembre ? (décompte vacances). */
  moisDecembre: boolean;
  /** Les emplois à temps partiel se cumulent-ils ? */
  cumulTempsPartiel: boolean;
  /** Jours de chômage complet indemnisables avant/après l'AGR. */
  joursCC: number;
  /** Travailleur en incapacité/sanction durant la totalité du mois → AGR = 0. */
  incapaciteOuSanctionTotalite: boolean;
  /** Clé de barème applicable (période du mois de référence). */
  bareme: string;
  occupations: OccupationInput[];
}

/** Détail recalculé par occupation (équiv. lignes « Données recalculées »). */
export interface OccupationResult {
  f6: number;
  f7: number;
  f8: number;
  vtl: number;
  bonusFt: number;
  bonusFtProp: number;
  bonusPt: number;
  ybrutTotal: number;
  hvRecalcule: number;
  haRecalcule: number;
  haReqRecalcule: number;
  pwcRecalcule: number;
  prcRecalcule: number;
  joursNonIndemn: number;
  haX6surQ: number;
  pwX6surS: number;
  pwcX6surS: number;
}

/** Résultat complet du calcul AGR. */
export interface AgrResult {
  /** AGR brut barème 57 (€), ou null si calcul impossible. */
  bareme57: number | null;
  /** AGR brut barème 05 (€), ou null si calcul impossible. */
  bareme05: number | null;
  /** Allocations de chômage temporaire (€). */
  chomageTemporaire: number;
  /** Total AGR + CT + CC barème 57 (€). */
  total57: number;
  /** Total AGR + CT + CC barème 05 (€). */
  total05: number;
  /** Salaire de référence appliqué. */
  salaireReference: number;
  /** Motif de non-indemnisation barème 57 (vide si indemnisable). */
  motif57: string;
  /** Motif de non-indemnisation barème 05. */
  motif05: string;
  /** Message d'erreur global (catégorie/salaire manquant…), ou vide. */
  erreur: string;
  /** Résultats intermédiaires (audit / parité avec l'Excel). */
  intermediaires: {
    nombreOccupations: number;
    f1: number;
    f2: number;
    f3: number;
    f4: number;
    f9: number;
    vtlTot: number;
    bonusTot: number;
    bonusTotProp: number;
    totalSalaireImposable: number;
    totalRetenues: number;
    totalYnetBis: number;
    formule1A: number;
    formule1B: number;
    formule2A: number;
    formule2B: number;
    occupations: OccupationResult[];
  };
}
