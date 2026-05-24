/**
 * Calcul de la pension légale belge — salarié, version simplifiée 2026.
 *
 * SOURCES
 * -------
 *  - SFP (Service Fédéral des Pensions) — sfpd.fgov.be
 *  - mypension.be (compte de carrière officiel)
 *  - Loi du 10 août 2015 relevant l'âge légal de la pension
 *  - AR 21/12/1967 (régime général de la pension de retraite des salariés)
 *
 * AVERTISSEMENT TRÈS FORT
 * -----------------------
 * Ce calcul est INDICATIF — pédagogique uniquement. La pension réelle dépend
 * du compte de carrière individuel (salaires plafonnés annuellement, périodes
 * assimilées : chômage, maladie, service militaire, crédit-temps, etc.) et de
 * règles d'unités de carrière (jours équivalents temps plein).
 *
 * Pour le calcul officiel et personnalisé : mypension.be
 *
 * FORMULE GÉNÉRALE (simplifiée)
 * -----------------------------
 *   pension_annuelle = salaire_pris × taux × (annees_carriere / 45)
 *
 *   où :
 *     - salaire_pris = min(salaire_moyen_carriere, plafond_salarial_2026)
 *     - taux         = 0,60 (isolé) ou 0,75 (ménage)
 *     - carrière complète conventionnelle = 45 ans
 *
 * On applique ensuite :
 *   - un plancher (minimum garanti) si carrière >= 30 ans
 *   - un plafond légal indicatif
 *   - un malus en cas de départ anticipé avant l'âge légal
 */

export interface PensionInput {
  /** Date de naissance au format ISO YYYY-MM-DD. */
  dateNaissance: string;
  /** Années de carrière prévues à la date de départ (0-50). */
  anneesCarriere: number;
  /** Salaire annuel brut moyen sur l'ensemble de la carrière (€). */
  salaireMoyen: number;
  /** Statut civil : isolé (60 %) ou ménage (75 %). */
  statut: "isole" | "menage";
  /** Âge de départ envisagé (60-70). */
  ageDepart: number;
}

export interface PensionResult {
  /** Pension mensuelle brute estimée (€). */
  pensionMensuelle: number;
  /** Pension annuelle brute estimée (€). */
  pensionAnnuelle: number;
  /** Âge légal de la pension selon l'année de naissance. */
  ageLegal: number;
  /** Âge de départ envisagé (recopié pour affichage). */
  ageDepart: number;
  /** Pourcentage de malus appliqué (0 si départ ≥ âge légal). */
  malusPourcent: number;
  /** Années de carrière prises en compte (recopiées). */
  anneesCarriere: number;
  /** True si le salaire moyen a été plafonné par le maximum 2026. */
  plafondAtteint: boolean;
  /** Libellé lisible du statut ("Isolé" / "Ménage"). */
  statutLabel: string;
}

/* ------------------------------------------------------------------ */
/*  Constantes — barème 2026                                          */
/* ------------------------------------------------------------------ */

/**
 * Plafond salarial annuel pris en compte pour la pension (2026).
 * Source : SFPD (Service Fédéral des Pensions Données) — barème indexé.
 * La valeur précédente (78 690) correspondait à une projection erronée.
 */
const PLAFOND_SALARIAL_2026 = 69521;

/** Carrière complète conventionnelle (en années). */
const CARRIERE_COMPLETE = 45;

/** Taux selon le statut civil. */
const TAUX_ISOLE = 0.6;
const TAUX_MENAGE = 0.75;

/** Minimum garanti mensuel (carrière complète ≥ 30 ans). */
const MINIMUM_ISOLE = 1700;
const MINIMUM_MENAGE = 2100;
const SEUIL_CARRIERE_MINIMUM = 30;

/** Plafond légal indicatif de la pension (mensuel). */
const PLAFOND_PENSION_ISOLE = 3500;
const PLAFOND_PENSION_MENAGE = 4350;

/** Malus indicatif en cas de départ anticipé (par année anticipée). */
const MALUS_PAR_AN_ANTICIPE = 0.05;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Détermine l'âge légal de la pension selon l'année de naissance.
 *
 *  - né avant 1960          → 65 ans
 *  - né entre 1960 et 1963  → 66 ans
 *  - né en 1964 et après    → 67 ans
 */
export function getAgeLegal(dateNaissance: string): number {
  const annee = parseAnneeNaissance(dateNaissance);
  if (!Number.isFinite(annee)) return 67;
  if (annee < 1960) return 65;
  if (annee < 1964) return 66;
  return 67;
}

/** Extrait l'année de naissance d'une date ISO. Retourne NaN si invalide. */
function parseAnneeNaissance(dateNaissance: string): number {
  if (!dateNaissance) return NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateNaissance);
  if (!m) return NaN;
  const annee = parseInt(m[1], 10);
  if (annee < 1900 || annee > 2050) return NaN;
  return annee;
}

/* ------------------------------------------------------------------ */
/*  Calcul principal                                                  */
/* ------------------------------------------------------------------ */

export function calcPension(
  input: PensionInput,
): PensionResult | { error: string } {
  const { dateNaissance, anneesCarriere, salaireMoyen, statut, ageDepart } =
    input;

  // --- Validation ------------------------------------------------------
  if (!Number.isFinite(parseAnneeNaissance(dateNaissance))) {
    return { error: "Indiquez une date de naissance valide (JJ/MM/AAAA)." };
  }
  if (
    !Number.isFinite(anneesCarriere) ||
    anneesCarriere < 0 ||
    anneesCarriere > 50
  ) {
    return {
      error: "Les années de carrière doivent être comprises entre 0 et 50.",
    };
  }
  if (!Number.isFinite(salaireMoyen) || salaireMoyen <= 1000) {
    return {
      error: "Le salaire annuel moyen doit être supérieur à 1 000 €.",
    };
  }
  if (!Number.isFinite(ageDepart) || ageDepart < 60 || ageDepart > 70) {
    return {
      error: "L'âge de départ doit être compris entre 60 et 70 ans.",
    };
  }

  // --- 1. Plafonnement du salaire -------------------------------------
  const plafondAtteint = salaireMoyen > PLAFOND_SALARIAL_2026;
  const salairePris = Math.min(salaireMoyen, PLAFOND_SALARIAL_2026);

  // --- 2. Taux selon statut -------------------------------------------
  const taux = statut === "menage" ? TAUX_MENAGE : TAUX_ISOLE;
  const statutLabel =
    statut === "menage" ? "Ménage (75 %)" : "Isolé (60 %)";

  // --- 3. Formule de base ---------------------------------------------
  const fractionCarriere = Math.min(anneesCarriere, CARRIERE_COMPLETE) /
    CARRIERE_COMPLETE;
  let pensionAnnuelle = salairePris * taux * fractionCarriere;
  let pensionMensuelle = pensionAnnuelle / 12;

  // --- 4. Plancher : minimum garanti si carrière ≥ 30 ans -------------
  if (anneesCarriere >= SEUIL_CARRIERE_MINIMUM) {
    const minimum = statut === "menage" ? MINIMUM_MENAGE : MINIMUM_ISOLE;
    // Proratisé : le minimum garanti correspond à 45 ans, on l'ajuste.
    const minimumProratise = minimum * fractionCarriere;
    if (pensionMensuelle < minimumProratise) {
      pensionMensuelle = minimumProratise;
      pensionAnnuelle = pensionMensuelle * 12;
    }
  }

  // --- 5. Plafond légal indicatif -------------------------------------
  const plafondPension =
    statut === "menage" ? PLAFOND_PENSION_MENAGE : PLAFOND_PENSION_ISOLE;
  if (pensionMensuelle > plafondPension) {
    pensionMensuelle = plafondPension;
    pensionAnnuelle = pensionMensuelle * 12;
  }

  // --- 6. Malus départ anticipé ---------------------------------------
  const ageLegal = getAgeLegal(dateNaissance);
  let malusPourcent = 0;
  if (ageDepart < ageLegal) {
    const anneesAnticipees = ageLegal - ageDepart;
    malusPourcent = anneesAnticipees * MALUS_PAR_AN_ANTICIPE * 100;
    const coefMalus = 1 - anneesAnticipees * MALUS_PAR_AN_ANTICIPE;
    pensionMensuelle = pensionMensuelle * Math.max(coefMalus, 0);
    pensionAnnuelle = pensionMensuelle * 12;
  }

  return {
    pensionMensuelle,
    pensionAnnuelle,
    ageLegal,
    ageDepart,
    malusPourcent,
    anneesCarriere,
    plafondAtteint,
    statutLabel,
  };
}
