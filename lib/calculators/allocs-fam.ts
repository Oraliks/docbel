/**
 * Calcul des allocations familiales belges — version simplifiée 2026.
 *
 * Depuis la régionalisation (2019), chaque entité gère son propre régime
 * d'allocations familiales :
 *
 *  - WALLONIE        → FAMIWAL (et caisses privées agréées en Wallonie)
 *                      → famiwal.be / aviq.be (Agence pour une Vie de Qualité)
 *  - BRUXELLES       → FAMIRIS (et caisses privées agréées à Bruxelles)
 *                      → famiris.brussels / iriscare.brussels
 *  - FLANDRE         → Groeipakket (« paquet de croissance »)
 *                      → groeipakket.be / opgroeien.be
 *  - GERMANOPHONE    → Ministerium der Deutschsprachigen Gemeinschaft
 *                      → Kindergeld DG / ostbelgienlive.be
 *
 * Les montants 2026 utilisés ici sont INDICATIFS et arrondis à l'euro :
 * la réalité dépend de la date exacte de naissance (régime « ancien »
 * vs « nouveau » selon la région), de la composition du ménage, du
 * revenu imposable du ménage, du handicap éventuel, et d'autres
 * suppléments. Pour le montant officiel, il faut interroger sa caisse.
 *
 * AVERTISSEMENT : ce calcul ne remplace pas un avis officiel. Il vise
 * juste à donner un ordre de grandeur réaliste au citoyen avant qu'il
 * contacte sa caisse.
 */

export type Region = "wallonie" | "bruxelles" | "flandre" | "germanophone";

export interface EnfantInput {
  /** Année de naissance de l'enfant (entre 2000 et l'année courante). */
  anneeNaissance: number;
}

export interface AllocsFamInput {
  region: Region;
  enfants: EnfantInput[];
  /** Revenu annuel brut imposable du ménage en euros. */
  revenuMenageAnnuel: number;
  /** True = ménage monoparental (un seul adulte assume la charge). */
  monoparental: boolean;
}

export interface AllocsFamDetailRow {
  /** Rang de l'enfant (1 = premier, 2 = deuxième, etc.). */
  rang: number;
  /** Âge calculé (année courante - anneeNaissance). */
  age: number;
  /** Montant de base mensuel pour cet enfant. */
  montantBase: number;
  /** Suppléments mensuels cumulés pour cet enfant. */
  supplements: number;
  /** Total mensuel pour cet enfant (base + suppléments). */
  total: number;
}

export interface AllocsFamResult {
  /** Total mensuel toutes lignes additionnées. */
  totalMensuel: number;
  /** Bonus rentrée scolaire annuel (versé une fois par an, été). */
  bonusRentreeAnnuel: number;
  /** Détail par enfant (1 ligne = 1 enfant). */
  detail: AllocsFamDetailRow[];
  /** Libellé lisible du régime appliqué (« FAMIWAL », etc.). */
  regionLabel: string;
}

/* ------------------------------------------------------------------ */
/*  Constantes — montants 2026 indicatifs                             */
/* ------------------------------------------------------------------ */

/** Seuil « bas revenu » utilisé par la plupart des régimes (€/an). */
const SEUIL_BAS_REVENU = 36_000;
/** Seuil intermédiaire Flandre. */
const SEUIL_FLANDRE_INTERMEDIAIRE = 62_000;
/** Seuil bas Flandre. */
const SEUIL_FLANDRE_BAS = 32_000;

/**
 * Date pivot ancien/nouveau régime — IDENTIQUE pour les 3 régions :
 * enfants nés à partir du 1er janvier 2019 → nouveau régime régional.
 * (Auparavant on utilisait 2020 pour WAL/BXL — c'était une erreur.)
 */
const PIVOT_NOUVEAU_REGIME = 2019;
const PIVOT_FLANDRE = 2019;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const REGION_LABELS: Record<Region, string> = {
  wallonie: "FAMIWAL (Wallonie)",
  bruxelles: "FAMIRIS (Bruxelles)",
  flandre: "Groeipakket (Flandre)",
  germanophone: "Kindergeld DG (Ostbelgien)",
};

/** Bonus rentrée scolaire indicatif par tranche d'âge (€/an). */
function bonusRentreeParAge(age: number): number {
  if (age < 0) return 0;
  if (age <= 5) return 22;
  if (age <= 11) return 47;
  if (age <= 17) return 65;
  return 87;
}

/* ------------------------------------------------------------------ */
/*  Régime WALLONIE (FAMIWAL)                                          */
/* ------------------------------------------------------------------ */

function calcWallonie(
  rang: number,
  age: number,
  anneeNaissance: number,
  revenuBas: boolean,
  monoparental: boolean,
): { base: number; supplements: number } {
  let base: number;
  if (anneeNaissance < PIVOT_NOUVEAU_REGIME) {
    // Ancien régime wallon (nés avant 2019).
    if (rang === 1) base = 119;
    else if (rang === 2) base = 219;
    else base = 327;
  } else {
    // Nouveau régime FAMIWAL (nés ≥ 2019) — barème indexé fév 2026.
    base = age <= 17 ? 181.61 : 202;
  }

  // Suppléments indexés FAMIWAL 2026 (source famiwal.be).
  let supplements = 0;
  if (monoparental) {
    // Supplément monoparental — montant unique, peu dépendant du revenu.
    supplements += 22.88;
  }
  if (revenuBas) {
    // Supplément social bas revenu.
    supplements += 33.69;
  }

  return { base, supplements };
}

/* ------------------------------------------------------------------ */
/*  Régime BRUXELLES (FAMIRIS)                                         */
/* ------------------------------------------------------------------ */

function calcBruxelles(
  rang: number,
  age: number,
  anneeNaissance: number,
  revenuBas: boolean,
  monoparental: boolean,
): { base: number; supplements: number } {
  let base: number;
  if (anneeNaissance < PIVOT_NOUVEAU_REGIME) {
    // Ancien régime bruxellois (nés avant 2019).
    if (rang === 1) base = 113;
    else if (rang === 2) base = 211;
    else base = 314;
  } else {
    // Nouveau régime FAMIRIS (nés ≥ 2019) — montant unique 181,61 €
    // depuis l'harmonisation (le barème dégressif 159/169/179 était erroné).
    base = 181.61;
  }

  // Supplément social FAMIRIS — montant unique 55 €/enfant si revenu bas.
  // Le supplément monoparental ne se cumule pas avec le bas revenu.
  let supplements = 0;
  if (revenuBas) {
    supplements = 55;
  } else if (monoparental) {
    // Cas monoparental sans bas revenu — supplément réduit.
    supplements = 22;
  }

  return { base, supplements };
}

/* ------------------------------------------------------------------ */
/*  Régime FLANDRE (Groeipakket)                                       */
/* ------------------------------------------------------------------ */

function calcFlandre(
  rang: number,
  anneeNaissance: number,
  revenuMenage: number,
): { base: number; supplements: number } {
  let base: number;
  if (anneeNaissance >= PIVOT_FLANDRE) {
    // Régime Groeipakket — basisbedrag indexé sept 2026 : 184,62 €.
    base = 184.62;
  } else {
    // Ancien régime flamand (enfants nés avant 2019).
    if (rang === 1) base = 100;
    else if (rang === 2) base = 185;
    else base = 277;
  }

  // Supplément social Groeipakket selon le revenu annuel du ménage.
  let supplements = 0;
  if (revenuMenage < SEUIL_FLANDRE_BAS) {
    supplements = 93;
  } else if (revenuMenage < SEUIL_FLANDRE_INTERMEDIAIRE) {
    supplements = 21;
  }

  return { base, supplements };
}

/* ------------------------------------------------------------------ */
/*  Régime GERMANOPHONE (Kindergeld DG)                                */
/* ------------------------------------------------------------------ */

function calcGermanophone(
  age: number,
  revenuBas: boolean,
  monoparental: boolean,
): { base: number; supplements: number } {
  // Forfait par tranche d'âge.
  const base = age <= 17 ? 165 : 185;

  // Supplément monoparental + bas revenu cumulés (sinon zéro).
  const supplements = monoparental && revenuBas ? 55 : 0;

  return { base, supplements };
}

/* ------------------------------------------------------------------ */
/*  Fonction principale                                                */
/* ------------------------------------------------------------------ */

export function calcAllocsFam(
  input: AllocsFamInput,
): AllocsFamResult | { error: string } {
  const { region, enfants, revenuMenageAnnuel, monoparental } = input;

  // --- Validation des inputs --------------------------------------------
  if (!Array.isArray(enfants) || enfants.length === 0) {
    return { error: "Ajoutez au moins un enfant pour calculer." };
  }
  if (enfants.length > 10) {
    return { error: "Le calcul est limité à 10 enfants maximum." };
  }
  if (!Number.isFinite(revenuMenageAnnuel) || revenuMenageAnnuel < 0) {
    return { error: "Le revenu annuel du ménage doit être positif ou nul." };
  }

  const anneeCourante = new Date().getFullYear();
  for (const e of enfants) {
    if (
      !Number.isFinite(e.anneeNaissance) ||
      e.anneeNaissance < 2000 ||
      e.anneeNaissance > anneeCourante
    ) {
      return {
        error: `L'année de naissance doit être comprise entre 2000 et ${anneeCourante}.`,
      };
    }
  }

  // Drapeau « bas revenu » partagé par tous les régimes sauf Flandre
  // (qui a son propre barème à 2 seuils).
  const revenuBas = revenuMenageAnnuel < SEUIL_BAS_REVENU;

  // On trie les enfants du plus âgé au plus jeune pour attribuer les rangs
  // (le « 1er enfant » au sens des allocations = le plus âgé).
  const enfantsTries = [...enfants].sort(
    (a, b) => a.anneeNaissance - b.anneeNaissance,
  );

  const detail: AllocsFamDetailRow[] = [];
  let totalMensuel = 0;
  let bonusRentreeAnnuel = 0;

  enfantsTries.forEach((enfant, idx) => {
    const rang = idx + 1;
    const age = anneeCourante - enfant.anneeNaissance;

    let calc: { base: number; supplements: number };
    switch (region) {
      case "wallonie":
        calc = calcWallonie(
          rang,
          age,
          enfant.anneeNaissance,
          revenuBas,
          monoparental,
        );
        break;
      case "bruxelles":
        calc = calcBruxelles(
          rang,
          age,
          enfant.anneeNaissance,
          revenuBas,
          monoparental,
        );
        break;
      case "flandre":
        calc = calcFlandre(rang, enfant.anneeNaissance, revenuMenageAnnuel);
        break;
      case "germanophone":
        calc = calcGermanophone(age, revenuBas, monoparental);
        break;
    }

    const total = calc.base + calc.supplements;
    detail.push({
      rang,
      age,
      montantBase: calc.base,
      supplements: calc.supplements,
      total,
    });

    totalMensuel += total;
    bonusRentreeAnnuel += bonusRentreeParAge(age);
  });

  return {
    totalMensuel,
    bonusRentreeAnnuel,
    detail,
    regionLabel: REGION_LABELS[region],
  };
}
