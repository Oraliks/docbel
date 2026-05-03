// Tables officielles du gouvernement belge (SPF Emploi)
// Source: https://emploi.belgique.be/fr/themes/contrats-de-travail/fin-du-contrat-de-travail

import noticePeriodsData from './notice-periods-official.json';

export interface NoticeEntry {
  anMin: number;
  anMax: number | null;
  jours?: number;
  semaines?: number | string;
  label: string;
}

// CDI — Licenciement par employeur (post 2014)
export const NOTICE_PERIODS_POST_2014 = noticePeriodsData.cdi_licenciement_post_2014.table as NoticeEntry[];

// CDI — Démission par travailleur (post 2014)
export const NOTICE_PERIODS_DEMISSION_POST_2014 = noticePeriodsData.cdi_demission_post_2014.table as NoticeEntry[];

// CDI — Contre-préavis
export const NOTICE_PERIODS_CONTRE_PREAVIS = noticePeriodsData.cdi_contre_preavis.table as NoticeEntry[];

// CDI pré-2014 — Ouvrier — CCT n°75 (avant 01/01/2012)
export const NOTICE_PERIODS_OUVRIER_PRE_2014_CCT75 = noticePeriodsData.cdi_pre_2014_ouvrier.cct_75.table as NoticeEntry[];

// CDI pré-2014 — Ouvrier — Loi générale (avant 01/01/2012, pas de CCT)
export const NOTICE_PERIODS_OUVRIER_PRE_2014_LOI = noticePeriodsData.cdi_pre_2014_ouvrier.loi_generale.table as NoticeEntry[];

// CDI pré-2014 — Ouvrier — Loi (01/01/2012 à 31/12/2013)
export const NOTICE_PERIODS_OUVRIER_PRE_2014_2012_2014 = noticePeriodsData.cdi_pre_2014_ouvrier.post_2012_pre_2014.table as NoticeEntry[];

// CDI pré-2014 — Ouvrier secteur public (avant 01/01/2012)
export const NOTICE_PERIODS_OUVRIER_PUBLIC_PRE_2014 = noticePeriodsData.cdi_pre_2014_ouvrier.secteur_public_pre_2012.table as NoticeEntry[];

/**
 * Cherche le délai de préavis pour une ancienneté donnée
 * @param ancienneteYears Ancienneté en années
 * @param table Table de délais à utiliser
 * @returns L'entrée correspondante ou undefined
 */
export function findNoticeEntry(ancienneteYears: number, table: NoticeEntry[]): NoticeEntry | undefined {
  return table.find(
    entry => ancienneteYears >= entry.anMin && (entry.anMax === null || ancienneteYears < entry.anMax)
  );
}

/**
 * Obtient le délai en jours pour une ancienneté donnée
 * @param ancienneteYears Ancienneté en années
 * @param table Table de délais
 * @returns Nombre de jours, ou undefined si non trouvé
 */
export function getNoticeDaysFromTable(ancienneteYears: number, table: NoticeEntry[]): number | undefined {
  const entry = findNoticeEntry(ancienneteYears, table);
  return entry?.jours;
}

/**
 * Obtient le délai en semaines pour une ancienneté donnée
 * @param ancienneteYears Ancienneté en années
 * @param table Table de délais
 * @returns Nombre de semaines, ou undefined si non trouvé ou "formula"
 */
export function getNoticeWeeksFromTable(
  ancienneteYears: number,
  table: NoticeEntry[]
): number | undefined {
  const entry = findNoticeEntry(ancienneteYears, table);
  if (!entry) return undefined;
  if (entry.semaines === 'formula') {
    // Pour le cas spécial post-2014 après 24 ans: 65 + (years - 24)
    return 65 + (ancienneteYears - 24);
  }
  return entry.semaines as number | undefined;
}

/**
 * Détermine quelle table d'ouvrier pré-2014 utiliser selon la date d'entrée
 * @param dateEntree Date d'entrée
 * @param isSecteurPublic Est-ce le secteur public?
 * @returns La table appropriée
 */
export function selectOuvrierPre2014Table(
  dateEntree: Date,
  isSecteurPublic: boolean = false
): NoticeEntry[] {
  if (isSecteurPublic) {
    return NOTICE_PERIODS_OUVRIER_PUBLIC_PRE_2014;
  }

  // Secteur privé
  const beforeJan2012 = dateEntree < new Date(2012, 0, 1);
  if (beforeJan2012) {
    // Avant 01/01/2012 : utiliser CCT n°75 par défaut
    // (Le SPF dit de vérifier les règles sectorielles d'abord)
    return NOTICE_PERIODS_OUVRIER_PRE_2014_CCT75;
  } else {
    // Entre 01/01/2012 et 31/12/2013
    return NOTICE_PERIODS_OUVRIER_PRE_2014_2012_2014;
  }
}

/**
 * Calcul de l'ICL (Indemnité Compensatoire de Licenciement)
 * ICL = (salaire mensuel × 3 / 13) × nombre de semaines de préavis
 * @param salaireMensuelBrut Salaire mensuel brut en euros
 * @param semainesToIndemnise Nombre de semaines à indemniser
 * @returns Montant de l'ICL brute en euros
 */
export function calculateICL(salaireMensuelBrut: number, semainesToIndemnise: number): number {
  const salaireSemainaire = (salaireMensuelBrut * 3) / 13;
  return salaireSemainaire * semainesToIndemnise;
}

/**
 * Convertit des jours en semaines
 * @param jours Nombre de jours
 * @returns Nombre de semaines (arrondi)
 */
export function jours2semaines(jours: number): number {
  return Math.ceil(jours / 7);
}

/**
 * Convertit des semaines en jours
 * @param semaines Nombre de semaines
 * @returns Nombre de jours
 */
export function semaines2jours(semaines: number): number {
  return semaines * 7;
}

/**
 * Convertit des jours en mois approximatifs
 * @param jours Nombre de jours
 * @returns Nombre de mois (approximatif, basé sur 30.44 jours/mois)
 */
export function jours2mois(jours: number): number {
  return jours / 30.44;
}

// Export des données complètes pour référence
export const OFFICIAL_DATA = noticePeriodsData;
