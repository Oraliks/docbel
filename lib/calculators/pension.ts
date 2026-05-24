/**
 * Calcul de la pension légale belge — salarié, version simplifiée 2026.
 *
 * SOURCES
 * -------
 *  - SFP (Service Fédéral des Pensions) — sfpd.fgov.be
 *  - mypension.be (compte de carrière officiel)
 *  - Loi du 10 août 2015 relevant l'âge légal de la pension et durcissant
 *    les conditions de pension anticipée (carrière minimum par âge).
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
 *   pension_annuelle = salaire_pris × taux × (carriere_totale / 45)
 *
 *   où :
 *     - salaire_pris     = min(salaire_moyen_carriere, plafond_salarial_2026)
 *     - taux             = 0,60 (isolé) ou 0,75 (ménage)
 *     - carrière complète conventionnelle = 45 ans
 *     - carriere_totale  = annees_carriere + periodes_assimilees
 *
 * ÉLIGIBILITÉ AU DÉPART ANTICIPÉ
 * ------------------------------
 * Le régime belge n'applique pas de malus linéaire. Soit la personne remplit
 * les conditions de carrière minimum, soit elle ne peut pas partir avant
 * l'âge légal :
 *   - 60 ans → carrière ≥ 44 ans
 *   - 61 ans → carrière ≥ 43 ans
 *   - 62 ans → carrière ≥ 42 ans
 *   - 63-64 ans → carrière ≥ 42 ans (41 ans dans certains cas transitoires)
 *   - âge légal → pas de condition
 */

export interface PensionInput {
  /** Date de naissance au format ISO YYYY-MM-DD. */
  dateNaissance: string;
  /** Années de carrière effectives prévues à la date de départ (0-50). */
  anneesCarriere: number;
  /** Salaire annuel brut moyen sur l'ensemble de la carrière (€). */
  salaireMoyen: number;
  /** Statut civil : isolé (60 %) ou ménage (75 %). */
  statut: "isole" | "menage";
  /** Âge de départ envisagé (60-70). */
  ageDepart: number;
  /**
   * Années équivalentes de périodes assimilées (chômage indemnisé, maladie,
   * congé parental, service militaire, crédit-temps reconnu, etc.).
   * Comptent comme carrière pour l'éligibilité à l'anticipation et pour le
   * calcul de la pension. Optionnel, défaut 0.
   */
  periodesAssimilees?: number;
}

export interface PensionEligibiliteAnticipee {
  /** True si la personne peut effectivement partir à l'âge demandé. */
  possible: boolean;
  /** Phrase explicative quand `possible === false`. */
  raison?: string;
  /** Carrière minimum requise à cet âge pour partir anticipé. */
  conditionCarriere?: number;
  /** Âge anticipé évalué. */
  conditionAge?: number;
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
  /**
   * Âge effectivement utilisé pour le calcul : min(ageDepart, ageLegal) si
   * la personne est éligible à l'anticipation, sinon ageLegal (calcul à
   * l'âge légal donné à titre d'information).
   */
  ageEffectif: number;
  /**
   * Conservé pour rétrocompatibilité. Toujours 0 : le régime salarié belge
   * n'a pas de malus linéaire. Voir `eligibiliteAnticipee` à la place.
   * @deprecated
   */
  malusPourcent: number;
  /** Années de carrière effectives (recopiées). */
  anneesCarriere: number;
  /** Périodes assimilées prises en compte (recopiées). */
  periodesAssimilees: number;
  /** Carrière totale = anneesCarriere + periodesAssimilees. */
  carriereTotale: number;
  /** True si la carrière totale dépasse 45 ans (proratisée à 45/45). */
  longueCarriere: boolean;
  /** True si le salaire moyen a été plafonné par le maximum 2026. */
  plafondAtteint: boolean;
  /** Libellé lisible du statut ("Isolé" / "Ménage"). */
  statutLabel: string;
  /** Éligibilité au départ anticipé à l'âge demandé. */
  eligibiliteAnticipee: PensionEligibiliteAnticipee;
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

/**
 * Retourne la condition d'éligibilité à la pension anticipée pour un âge
 * donné. Retourne `null` si l'âge correspond à l'âge légal ou au-delà
 * (aucune condition de carrière requise).
 *
 * Loi du 10/08/2015 — conditions stabilisées :
 *   - 60 ans → carrière ≥ 44 ans
 *   - 61 ans → carrière ≥ 43 ans
 *   - 62 ans → carrière ≥ 42 ans
 *   - 63-64 ans → carrière ≥ 42 ans
 */
export function getConditionAnticipation(
  age: number,
): { conditionAge: number; conditionCarriere: number } | null {
  if (!Number.isFinite(age) || age >= 65) return null;
  if (age <= 60) return { conditionAge: 60, conditionCarriere: 44 };
  if (age === 61) return { conditionAge: 61, conditionCarriere: 43 };
  // 62, 63, 64 → 42 ans
  return { conditionAge: age, conditionCarriere: 42 };
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
  const {
    dateNaissance,
    anneesCarriere,
    salaireMoyen,
    statut,
    ageDepart,
    periodesAssimilees = 0,
  } = input;

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
  if (
    !Number.isFinite(periodesAssimilees) ||
    periodesAssimilees < 0 ||
    periodesAssimilees > 50
  ) {
    return {
      error:
        "Les périodes assimilées doivent être comprises entre 0 et 50 ans.",
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

  // --- 0. Carrière totale + éligibilité anticipée ---------------------
  const carriereTotale = anneesCarriere + periodesAssimilees;
  const ageLegal = getAgeLegal(dateNaissance);

  let eligibiliteAnticipee: PensionEligibiliteAnticipee;
  let ageEffectif = ageDepart;

  if (ageDepart >= ageLegal) {
    eligibiliteAnticipee = { possible: true };
    ageEffectif = ageDepart;
  } else {
    const cond = getConditionAnticipation(ageDepart);
    if (cond && carriereTotale >= cond.conditionCarriere) {
      eligibiliteAnticipee = {
        possible: true,
        conditionAge: cond.conditionAge,
        conditionCarriere: cond.conditionCarriere,
      };
      ageEffectif = ageDepart;
    } else if (cond) {
      // Inéligible : on calcule à titre informatif à l'âge légal.
      eligibiliteAnticipee = {
        possible: false,
        conditionAge: cond.conditionAge,
        conditionCarriere: cond.conditionCarriere,
        raison: `Pour partir à ${ageDepart} ans, il faut justifier d'au moins ${cond.conditionCarriere} ans de carrière (assimilations comprises). Vous totalisez ${carriereTotale.toFixed(carriereTotale % 1 === 0 ? 0 : 1)} an${carriereTotale > 1 ? "s" : ""}.`,
      };
      ageEffectif = ageLegal;
    } else {
      // Sécurité : âge < 60 ans → impossible quelle que soit la carrière.
      eligibiliteAnticipee = {
        possible: false,
        raison: `La pension anticipée n'est pas accessible avant 60 ans.`,
      };
      ageEffectif = ageLegal;
    }
  }

  // --- 1. Plafonnement du salaire -------------------------------------
  const plafondAtteint = salaireMoyen > PLAFOND_SALARIAL_2026;
  const salairePris = Math.min(salaireMoyen, PLAFOND_SALARIAL_2026);

  // --- 2. Taux selon statut -------------------------------------------
  const taux = statut === "menage" ? TAUX_MENAGE : TAUX_ISOLE;
  const statutLabel =
    statut === "menage" ? "Ménage (75 %)" : "Isolé (60 %)";

  // --- 3. Formule de base (utilise la carrière totale) ----------------
  const longueCarriere = carriereTotale > CARRIERE_COMPLETE;
  const fractionCarriere =
    Math.min(carriereTotale, CARRIERE_COMPLETE) / CARRIERE_COMPLETE;
  let pensionAnnuelle = salairePris * taux * fractionCarriere;
  let pensionMensuelle = pensionAnnuelle / 12;

  // --- 4. Plancher : minimum garanti si carrière totale ≥ 30 ans ------
  if (carriereTotale >= SEUIL_CARRIERE_MINIMUM) {
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

  // --- 6. Pas de malus linéaire (régime belge) -------------------------
  // Le régime salarié belge ne pénalise pas le départ anticipé par un malus :
  // soit la personne remplit les conditions de carrière, soit elle ne peut
  // pas partir avant l'âge légal. Voir `eligibiliteAnticipee`.

  return {
    pensionMensuelle,
    pensionAnnuelle,
    ageLegal,
    ageDepart,
    ageEffectif,
    malusPourcent: 0,
    anneesCarriere,
    periodesAssimilees,
    carriereTotale,
    longueCarriere,
    plafondAtteint,
    statutLabel,
    eligibiliteAnticipee,
  };
}
