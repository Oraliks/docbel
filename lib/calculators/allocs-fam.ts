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

/** Date pivot : enfants nés à partir de 2020 = « nouveau régime » WAL/BXL. */
const PIVOT_NOUVEAU_REGIME = 2020;
/** Date pivot Flandre : Groeipakket démarre en 2019. */
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
    // Ancien régime wallon (enfants nés avant 2020).
    if (rang === 1) base = 119;
    else if (rang === 2) base = 219;
    else base = 327;
  } else {
    // Nouveau régime wallon (à partir de 2020) : forfait par tranche d'âge.
    base = age <= 17 ? 175 : 199;
  }

  let supplements = 0;
  if (monoparental) {
    // Le supplément monoparental dépend du revenu.
    supplements += revenuBas ? 73 : 47;
  }
  if (revenuBas) {
    // Supplément social bas revenu (cumulable avec monoparental).
    supplements += 56;
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
    // Ancien régime bruxellois.
    if (rang === 1) base = 113;
    else if (rang === 2) base = 211;
    else base = 314;
  } else {
    // Nouveau régime FAMIRIS (à partir de 2020) : forfait par tranche d'âge.
    if (age <= 11) base = 159;
    else if (age <= 17) base = 169;
    else base = 179;
  }

  // Suppléments revenu (ne se cumulent PAS à Bruxelles : on prend le plus
  // avantageux entre « monoparental + bas revenu » et « bas revenu seul »).
  let supplements = 0;
  if (revenuBas) {
    supplements = monoparental ? 66 : 44;
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
    // Régime Groeipakket : forfait identique pour tous les enfants.
    base = 184;
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
