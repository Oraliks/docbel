/**
 * Calcul des allocations familiales belges — version 2026 (mars 2026 indexé).
 *
 * Depuis la régionalisation (2019/2020), chaque entité gère son propre régime
 * d'allocations familiales :
 *
 *  - WALLONIE        → FAMIWAL (et caisses privées agréées en Wallonie)
 *                      → famiwal.be / aviq.be (Agence pour une Vie de Qualité)
 *                      → pivot ancien/nouveau régime : 1ᵉʳ janvier **2020**
 *  - BRUXELLES       → FAMIRIS (et caisses privées agréées à Bruxelles)
 *                      → famiris.brussels / iriscare.brussels
 *                      → pivot ancien/nouveau régime : 1ᵉʳ janvier **2020** (réforme entrée en vigueur 01/12/2019)
 *  - FLANDRE         → Groeipakket (« paquet de croissance »)
 *                      → groeipakket.be / opgroeien.be
 *                      → pivot ancien/nouveau régime : 1ᵉʳ janvier **2019**
 *  - GERMANOPHONE    → Ministerium der Deutschsprachigen Gemeinschaft
 *                      → Kindergeld DG / ostbelgienlive.be
 *                      → régime unique depuis 2019 (Basiskindergeld + suppléments)
 *
 * Les montants 2026 ici sont issus des sites OFFICIELS des organismes
 * régionaux (FAMIWAL/FAMIRIS/Groeipakket/Ostbelgien Familie) au printemps
 * 2026. Indexation au 1ᵉʳ mars (FAMIWAL/FAMIRIS) ou au 1ᵉʳ septembre
 * (Groeipakket). La réalité dépend de la date exacte de naissance, du
 * revenu cadastral, et du nombre de points AVIQ / Iriscare / Opgroeien.
 *
 * AVERTISSEMENT : ce calcul ne remplace pas un avis officiel. Il vise
 * juste à donner un ordre de grandeur réaliste au citoyen avant qu'il
 * contacte sa caisse.
 */

export type Region = "wallonie" | "bruxelles" | "flandre" | "germanophone";

export type OrphelinStatus = "aucun" | "un_parent" | "deux_parents";

export interface EnfantInput {
  /** Année de naissance de l'enfant (entre 2000 et l'année courante). */
  anneeNaissance: number;
  /**
   * Enfant reconnu en situation de handicap (catégorie médiane — au sens
   * AVIQ : 6-8 points sur les 3 piliers et ≥4 points sur le pilier 1).
   * Le montant réel va de ~141 € (atteinte modérée) à ~621 € (handicap sévère).
   */
  handicap?: boolean;
  /**
   * Statut d'orphelin de l'enfant. Par défaut `aucun`.
   *  - `un_parent`  : un parent décédé (orphelin partiel)
   *  - `deux_parents` : deux parents décédés (orphelin complet)
   */
  orphelin?: OrphelinStatus;
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
  /** Suppléments mensuels cumulés pour cet enfant (tous suppléments confondus). */
  supplements: number;
  /** Supplément social bas/intermédiaire revenu (inclus dans `supplements`). */
  supplementSocial?: number;
  /** Supplément monoparental (inclus dans `supplements`). */
  supplementMonoparental?: number;
  /** Supplément handicap mensuel (inclus dans `supplements`). */
  supplementHandicap?: number;
  /** Supplément orphelin mensuel (inclus dans `supplements`). */
  supplementOrphelin?: number;
  /** Supplément large famille (3e enfant Bruxelles / DG) (inclus). */
  supplement3eEnfant?: number;
  /** Total mensuel pour cet enfant (base + suppléments). */
  total: number;
}

export interface AllocsFamResult {
  /** Total mensuel toutes lignes additionnées. */
  totalMensuel: number;
  /** Bonus rentrée scolaire annuel (versé une fois par an, été). */
  bonusRentreeAnnuel: number;
  /**
   * Allocation de naissance versée une fois (one-shot) pour les enfants
   * nés cette année. Somme indicative pour info aux jeunes parents.
   */
  allocationNaissanceTotale: number;
  /** Détail par enfant (1 ligne = 1 enfant). */
  detail: AllocsFamDetailRow[];
  /** Libellé lisible du régime appliqué (« FAMIWAL », etc.). */
  regionLabel: string;
}

/* ------------------------------------------------------------------ */
/*  Constantes — montants 2026 indexés (mars 2026 / sept 2025)         */
/* ------------------------------------------------------------------ */

/**
 * Date pivot ancien/nouveau régime :
 *  - Wallonie / Bruxelles : nés à partir du 1ᵉʳ janvier 2020.
 *  - Flandre : nés à partir du 1ᵉʳ janvier 2019.
 */
const PIVOT_WAL_BXL = 2020;
const PIVOT_FLANDRE = 2019;

/* ----- WALLONIE — FAMIWAL (sources : famiwal.be, mars 2026) -------- */

const WAL_BASE_NOUVEAU_0_17 = 196.57;
const WAL_BASE_NOUVEAU_18_24 = 209.25;
const WAL_BASE_ANCIEN = { rang1: 121.5, rang2: 224.82, rang3plus: 335.66 };

/** Seuils de revenu FAMIWAL 2026 (€/an brut). */
const WAL_SEUIL_BAS = 34_000.47;
const WAL_SEUIL_INTERMEDIAIRE = 54_867.79;

/** Supplément social par enfant nouveau régime (≥2020). */
const WAL_SUPP_SOCIAL_NOUVEAU_BAS = 69.75;
const WAL_SUPP_SOCIAL_NOUVEAU_INT = 31.71;

/** Supplément social par enfant ancien régime (<2020) selon rang. */
const WAL_SUPP_SOCIAL_ANCIEN = { rang1: 61.85, rang2: 38.34, rang3plus: 6.73 };

/**
 * Supplément monoparental, nouveau régime (≥2020), s'ajoute au supplément
 * social (les deux sont cumulables — info FAMIWAL « le supplément
 * monoparental s'ajoute au supplément social »).
 */
const WAL_SUPP_MONO_NOUVEAU_BAS = 25.36;
const WAL_SUPP_MONO_NOUVEAU_INT = 12.68;

/** Supplément monoparental ancien régime — assimilé au supplément social. */
const WAL_SUPP_MONO_ANCIEN = { rang1: 61.85, rang2: 38.34, rang3plus: 30.92 };

/** Supplément handicap médian FAMIWAL (catégorie 6-8 pts, 4+ pilier 1). */
const WAL_SUPP_HANDICAP_MEDIAN = 141.9; // valeur médiane "douce" (≥ 6-8 pts, < 4 pilier 1)
const WAL_SUPP_HANDICAP_GRAVE = 546.61; // catégorie 6-8 + ≥4 pilier 1

/** Supplément orphelin FAMIWAL nouveau régime (≥2020). */
const WAL_SUPP_ORPHELIN_UN_0_17 = 98.29;
const WAL_SUPP_ORPHELIN_UN_18_24 = 104.63;
const WAL_SUPP_ORPHELIN_DEUX = 443.87;

/** Supplément orphelin FAMIWAL ancien régime (<2020) — décès antérieurs. */
const WAL_SUPP_ORPHELIN_ANCIEN_UN = 466.75;
const WAL_SUPP_ORPHELIN_ANCIEN_DEUX = 466.75;

/** Prime de naissance FAMIWAL 2026 (forfait unique, ≥2020). */
const WAL_PRIME_NAISSANCE = 1_395.02;
const WAL_PRIME_NAISSANCE_ANCIEN = 1_646.08; // pour mémoire (rang 1 ancien)

/** Prime scolaire FAMIWAL 2026 — nouveau régime (€/an). */
function walBonusRentree(age: number): number {
  if (age < 0) return 0;
  if (age <= 4) return 25.36;
  if (age <= 10) return 38.05;
  if (age <= 16) return 63.41;
  if (age <= 24) return 101.46;
  return 0;
}

/* ----- BRUXELLES — FAMIRIS (sources : famiris.brussels, mars 2026) - */

/** Base mensuelle FAMIRIS par âge — nouveau régime (≥01/12/2019). */
const BXL_BASE_NOUVEAU_0_11 = 190.23;
const BXL_BASE_NOUVEAU_12_17 = 202.91;
const BXL_BASE_NOUVEAU_18_24 = 215.59;

/** Base mensuelle FAMIRIS par âge — ancien régime (<01/12/2019). */
const BXL_BASE_ANCIEN_0_11 = 177.55;
const BXL_BASE_ANCIEN_12_17 = 190.23;
const BXL_BASE_ANCIEN_18_24 = 202.91;

/** Seuils de revenu FAMIRIS 2026 (€/an). */
const BXL_SEUIL_BAS = 40_586.52;
const BXL_SEUIL_INTERMEDIAIRE = 58_915.92;

/**
 * Supplément social FAMIRIS (Article 9, ordonnance 25/04/2019) — barème
 * officiel mars 2026.
 *
 * Le montant est versé PAR ENFANT, mais il dépend de la TAILLE de la
 * famille (1 / 2 / 3+ enfants), de l'ÂGE de l'enfant (0-11 vs 12-24) et
 * du statut MONOPARENTAL (uniquement pour 2+ enfants — pour 1 enfant le
 * barème est identique mono/cohabitant).
 *
 * Référence officielle :
 *   PDF FAMIRIS — Barème 01/03/2026 (Article 9, points 3.2 et 3.3)
 *   https://famiris.brussels/wp-content/uploads/2026/02/2026-03-01-Famiris-montant-allocations-familiales-indexation.pdf
 *
 * Section 3.2 — revenus ≤ 1ᵉʳ plafond (40 586,52 €) :
 *                  1 enfant   2 enfants mono   2 enfants autre   3+ mono   3+ autre
 *  0-11 ans         50,73 €   101,46 €         88,77 €           164,87 €  139,50 €
 *  12-24 ans        63,41 €   114,14 €         101,46 €          177,55 €  152,18 €
 *
 * Section 3.3 — revenus entre 1ᵉʳ et 2ᵉ plafond (40 586,52 → 58 915,92 €) :
 *                  1 enfant   2 enfants   3+ enfants
 *  tous âges        0 €       31,71 €     91,31 €
 *
 * (au-delà de 58 915,92 € → aucun supplément)
 */
type BxlSuppBande = "0_11" | "12_24";
type BxlSuppTaille = "un" | "deux" | "trois_plus";

/** Bas revenu (≤ 40 586,52 €) — montant par enfant. */
const BXL_SUPP_SOCIAL_BAS: Record<
  BxlSuppTaille,
  { mono: Record<BxlSuppBande, number>; autre: Record<BxlSuppBande, number> }
> = {
  un: {
    // 1 enfant : barème identique mono/cohabitant.
    mono: { "0_11": 50.73, "12_24": 63.41 },
    autre: { "0_11": 50.73, "12_24": 63.41 },
  },
  deux: {
    mono: { "0_11": 101.46, "12_24": 114.14 },
    autre: { "0_11": 88.77, "12_24": 101.46 },
  },
  trois_plus: {
    mono: { "0_11": 164.87, "12_24": 177.55 },
    autre: { "0_11": 139.50, "12_24": 152.18 },
  },
};

/**
 * Revenu intermédiaire (40 586,52 → 58 915,92 €) — montant par enfant.
 * Pas de différenciation mono/cohabitant ni d'âge selon le barème officiel
 * (article 9 §3.3).
 */
const BXL_SUPP_SOCIAL_INT: Record<BxlSuppTaille, number> = {
  un: 0,
  deux: 31.71,
  trois_plus: 91.31,
};

/** Supplément orphelin FAMIRIS — % de la base de l'enfant. */
// 1 parent : base + 50 % de base ; 2 parents : 2× base.
// On stocke les coefficients (calculés au moment du calcul sur la base).

/** Supplément handicap médian FAMIRIS 2026 (6-8 pts pilier 1 ≥ 4). */
const BXL_SUPP_HANDICAP_MEDIAN = 546.58;

/** Allocation de naissance FAMIRIS 2026. */
const BXL_PRIME_NAISSANCE_RANG_1 = 1_395.02;
const BXL_PRIME_NAISSANCE_SUIVANTS = 634.1;

/** Prime de rentrée scolaire FAMIRIS 2026 (annuel). */
function bxlBonusRentree(age: number): number {
  if (age < 0) return 0;
  if (age <= 5) return 25.36;
  if (age <= 11) return 38.05;
  if (age <= 17) return 63.41;
  if (age <= 24) return 101.46;
  return 0;
}

/* ----- FLANDRE — Groeipakket (sources : groeipakket.be, sept 2025) - */

const FLA_BASE_NOUVEAU = 184.62;
const FLA_BASE_ANCIEN = { rang1: 100, rang2: 185, rang3plus: 277 };

/** Seuils Groeipakket 2026 (€/an). */
const FLA_SEUIL_BAS = 40_701.59;
const FLA_SEUIL_INT_1_2 = 47_485.19;
const FLA_SEUIL_INT_3PLUS = 76_560.64;

/** Supplément social Groeipakket — selon nombre d'enfants. */
const FLA_SUPP_1_2_BAS = 73.68;
const FLA_SUPP_1_2_INT = 37.31;
const FLA_SUPP_3PLUS_BAS = 108.29;
const FLA_SUPP_3PLUS_INT = 85.22;

/** Supplément handicap médian Groeipakket (zorgtoeslag). */
const FLA_SUPP_HANDICAP_MEDIAN = 192.91; // ~9-11 pts, valeur médiane

/** Supplément orphelin Groeipakket. */
const FLA_SUPP_ORPHELIN_UN = 199.6;
const FLA_SUPP_ORPHELIN_DEUX = 399.21;

/** Startbedrag Flandre 2026 (forfait). */
const FLA_PRIME_NAISSANCE = 1_269.25;

/** Schoolbonus Flandre 2026 (annuel, sept 2025). */
function flaBonusRentree(age: number): number {
  if (age < 0) return 0;
  if (age <= 4) return 23.07;
  if (age <= 11) return 40.38;
  if (age <= 17) return 57.68;
  if (age <= 25) return 69.22;
  return 0;
}

/* ----- GERMANOPHONE — Kindergeld DG (sources : ostbelgienfamilie.be) */

const DG_BASE = 188.89;
const DG_SEUIL_BAS = 34_000;

const DG_SUPP_SOCIAL = 93.23;
const DG_SUPP_LARGE_FAMILLE = 165.4; // dès le 3e enfant
const DG_SUPP_HANDICAP_MEDIAN = 141.9;
const DG_SUPP_ORPHELIN_UN = 180;
const DG_SUPP_ORPHELIN_DEUX = 400;

const DG_PRIME_NAISSANCE = 1_296;

/** Schulbonus DG — montants approchés (régime aligné Wallonie). */
function dgBonusRentree(age: number): number {
  if (age < 0) return 0;
  if (age <= 5) return 25.36;
  if (age <= 11) return 38.05;
  if (age <= 17) return 63.41;
  if (age <= 24) return 101.46;
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const REGION_LABELS: Record<Region, string> = {
  wallonie: "FAMIWAL (Wallonie)",
  bruxelles: "FAMIRIS (Bruxelles)",
  flandre: "Groeipakket (Flandre)",
  germanophone: "Kindergeld DG (Ostbelgien)",
};

/* ------------------------------------------------------------------ */
/*  Régime WALLONIE (FAMIWAL)                                          */
/* ------------------------------------------------------------------ */

function calcWallonie(
  rang: number,
  age: number,
  anneeNaissance: number,
  revenuMenage: number,
  monoparental: boolean,
): {
  base: number;
  supplements: number;
  supplementSocial: number;
  supplementMono: number;
} {
  let base: number;
  if (anneeNaissance < PIVOT_WAL_BXL) {
    // Ancien régime wallon (nés avant 2020).
    if (rang === 1) base = WAL_BASE_ANCIEN.rang1;
    else if (rang === 2) base = WAL_BASE_ANCIEN.rang2;
    else base = WAL_BASE_ANCIEN.rang3plus;
  } else {
    // Nouveau régime FAMIWAL (nés ≥ 2020).
    base = age <= 17 ? WAL_BASE_NOUVEAU_0_17 : WAL_BASE_NOUVEAU_18_24;
  }

  // Supplément social FAMIWAL 2026.
  let supplementSocial = 0;
  let supplementMono = 0;

  if (anneeNaissance >= PIVOT_WAL_BXL) {
    // Nouveau régime : forfait par tranche de revenu.
    if (revenuMenage <= WAL_SEUIL_BAS) {
      supplementSocial = WAL_SUPP_SOCIAL_NOUVEAU_BAS;
    } else if (revenuMenage <= WAL_SEUIL_INTERMEDIAIRE) {
      supplementSocial = WAL_SUPP_SOCIAL_NOUVEAU_INT;
    }
    // Supplément monoparental s'ajoute au social.
    if (monoparental) {
      if (revenuMenage <= WAL_SEUIL_BAS) {
        supplementMono = WAL_SUPP_MONO_NOUVEAU_BAS;
      } else if (revenuMenage <= WAL_SEUIL_INTERMEDIAIRE) {
        supplementMono = WAL_SUPP_MONO_NOUVEAU_INT;
      }
    }
  } else {
    // Ancien régime : barème par rang, uniquement si bas revenu.
    if (revenuMenage <= WAL_SEUIL_BAS) {
      if (rang === 1) supplementSocial = WAL_SUPP_SOCIAL_ANCIEN.rang1;
      else if (rang === 2) supplementSocial = WAL_SUPP_SOCIAL_ANCIEN.rang2;
      else supplementSocial = WAL_SUPP_SOCIAL_ANCIEN.rang3plus;
      if (monoparental) {
        if (rang === 1) supplementMono = WAL_SUPP_MONO_ANCIEN.rang1;
        else if (rang === 2) supplementMono = WAL_SUPP_MONO_ANCIEN.rang2;
        else supplementMono = WAL_SUPP_MONO_ANCIEN.rang3plus;
        // Pour l'ancien régime, mono et social pointent vers le même
        // bénéfice — on évite le double comptage.
        supplementSocial = 0;
      }
    }
  }

  const supplements = supplementSocial + supplementMono;
  return { base, supplements, supplementSocial, supplementMono };
}

/* ------------------------------------------------------------------ */
/*  Régime BRUXELLES (FAMIRIS)                                         */
/* ------------------------------------------------------------------ */

function calcBruxelles(
  _rang: number,
  age: number,
  anneeNaissance: number,
  revenuMenage: number,
  monoparental: boolean,
  nbEnfants: number,
): {
  base: number;
  supplements: number;
  supplementSocial: number;
  supplementMono: number;
} {
  let base: number;
  if (anneeNaissance < PIVOT_WAL_BXL) {
    // Ancien régime bruxellois (nés avant 01/12/2019 → arrondi à <2020).
    if (age <= 11) base = BXL_BASE_ANCIEN_0_11;
    else if (age <= 17) base = BXL_BASE_ANCIEN_12_17;
    else base = BXL_BASE_ANCIEN_18_24;
  } else {
    // Nouveau régime FAMIRIS (nés ≥ 2020).
    if (age <= 11) base = BXL_BASE_NOUVEAU_0_11;
    else if (age <= 17) base = BXL_BASE_NOUVEAU_12_17;
    else base = BXL_BASE_NOUVEAU_18_24;
  }

  // Supplément social FAMIRIS — barème officiel article 9 (PDF 01/03/2026).
  // Le montant par enfant dépend de :
  //   - la tranche de revenu (≤ 40 586,52 € / 40 586,52-58 915,92 € / >)
  //   - la taille de la famille (1 / 2 / 3+ enfants)
  //   - dans la tranche bas revenu : l'âge de l'enfant (0-11 / 12-24) et
  //     le statut monoparental (sauf famille à 1 enfant)
  const taille: BxlSuppTaille =
    nbEnfants >= 3 ? "trois_plus" : nbEnfants === 2 ? "deux" : "un";
  const bande: BxlSuppBande = age <= 11 ? "0_11" : "12_24";

  let supplementSocial = 0;
  if (revenuMenage <= BXL_SEUIL_BAS) {
    const grille = monoparental
      ? BXL_SUPP_SOCIAL_BAS[taille].mono
      : BXL_SUPP_SOCIAL_BAS[taille].autre;
    supplementSocial = grille[bande];
  } else if (revenuMenage <= BXL_SEUIL_INTERMEDIAIRE) {
    supplementSocial = BXL_SUPP_SOCIAL_INT[taille];
  }

  // FAMIRIS n'a pas de supplément monoparental distinct : le barème social
  // mono/cohabitant est déjà appliqué ci-dessus.
  const supplementMono = 0;
  const supplements = supplementSocial + supplementMono;
  return { base, supplements, supplementSocial, supplementMono };
}

/* ------------------------------------------------------------------ */
/*  Régime FLANDRE (Groeipakket)                                       */
/* ------------------------------------------------------------------ */

function calcFlandre(
  _rang: number,
  anneeNaissance: number,
  revenuMenage: number,
  nbEnfants: number,
): {
  base: number;
  supplements: number;
  supplementSocial: number;
  supplementMono: number;
} {
  let base: number;
  if (anneeNaissance >= PIVOT_FLANDRE) {
    base = FLA_BASE_NOUVEAU;
  } else {
    // Ancien régime flamand (enfants nés avant 2019).
    // Barème par rang non détaillé — montant moyen forfaitaire.
    base = FLA_BASE_ANCIEN.rang2;
  }

  // Supplément social Groeipakket — barème à 2 tranches selon nombre d'enfants.
  let supplementSocial = 0;
  if (nbEnfants <= 2) {
    if (revenuMenage <= FLA_SEUIL_BAS) supplementSocial = FLA_SUPP_1_2_BAS;
    else if (revenuMenage <= FLA_SEUIL_INT_1_2)
      supplementSocial = FLA_SUPP_1_2_INT;
  } else {
    if (revenuMenage <= FLA_SEUIL_BAS) supplementSocial = FLA_SUPP_3PLUS_BAS;
    else if (revenuMenage <= FLA_SEUIL_INT_3PLUS)
      supplementSocial = FLA_SUPP_3PLUS_INT;
  }

  // Groeipakket n'a pas de supplément monoparental forfaitaire propre (il
  // est intégré au calcul social via le revenu).
  const supplementMono = 0;
  const supplements = supplementSocial + supplementMono;
  return { base, supplements, supplementSocial, supplementMono };
}

/* ------------------------------------------------------------------ */
/*  Régime GERMANOPHONE (Kindergeld DG)                                */
/* ------------------------------------------------------------------ */

function calcGermanophone(
  rang: number,
  revenuMenage: number,
  monoparental: boolean,
): {
  base: number;
  supplements: number;
  supplementSocial: number;
  supplementMono: number;
  supplementLargeFamille: number;
} {
  const base = DG_BASE;

  // Supplément social bas revenu.
  let supplementSocial = 0;
  if (revenuMenage <= DG_SEUIL_BAS) {
    supplementSocial = DG_SUPP_SOCIAL;
  }
  // Pas de supplément monoparental distinct côté DG (intégré dans le social).
  const supplementMono = monoparental && revenuMenage <= DG_SEUIL_BAS ? 0 : 0;

  // Supplément large famille à partir du 3e enfant.
  const supplementLargeFamille = rang >= 3 ? DG_SUPP_LARGE_FAMILLE : 0;

  const supplements = supplementSocial + supplementMono + supplementLargeFamille;
  return {
    base,
    supplements,
    supplementSocial,
    supplementMono,
    supplementLargeFamille,
  };
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

  // On trie les enfants du plus âgé au plus jeune pour attribuer les rangs
  // (le « 1er enfant » au sens des allocations = le plus âgé).
  const enfantsTries = [...enfants].sort(
    (a, b) => a.anneeNaissance - b.anneeNaissance,
  );
  const nbEnfants = enfantsTries.length;

  const detail: AllocsFamDetailRow[] = [];
  let totalMensuel = 0;
  let bonusRentreeAnnuel = 0;
  let allocationNaissanceTotale = 0;

  enfantsTries.forEach((enfant, idx) => {
    const rang = idx + 1;
    const age = anneeCourante - enfant.anneeNaissance;

    let calc: {
      base: number;
      supplements: number;
      supplementSocial: number;
      supplementMono: number;
      supplementLargeFamille?: number;
    };
    switch (region) {
      case "wallonie":
        calc = calcWallonie(
          rang,
          age,
          enfant.anneeNaissance,
          revenuMenageAnnuel,
          monoparental,
        );
        break;
      case "bruxelles":
        calc = calcBruxelles(
          rang,
          age,
          enfant.anneeNaissance,
          revenuMenageAnnuel,
          monoparental,
          nbEnfants,
        );
        break;
      case "flandre":
        calc = calcFlandre(
          rang,
          enfant.anneeNaissance,
          revenuMenageAnnuel,
          nbEnfants,
        );
        break;
      case "germanophone":
        calc = calcGermanophone(rang, revenuMenageAnnuel, monoparental);
        break;
    }

    // --- Suppléments transversaux (handicap / orphelin / 3e enfant) ----
    let supplementHandicap = 0;
    if (enfant.handicap) {
      // Catégorie médiane "modérée" : ≈ 141,90 € WAL/DG, 192,91 € FLA, 546,58 € BXL
      // On retient la valeur "douce" pour ne pas surévaluer (le réel
      // dépend du nombre de points AVIQ / Iriscare / Opgroeien).
      if (region === "wallonie") supplementHandicap = WAL_SUPP_HANDICAP_MEDIAN;
      else if (region === "bruxelles")
        supplementHandicap = BXL_SUPP_HANDICAP_MEDIAN;
      else if (region === "flandre") supplementHandicap = FLA_SUPP_HANDICAP_MEDIAN;
      else supplementHandicap = DG_SUPP_HANDICAP_MEDIAN;
    }

    let supplementOrphelin = 0;
    const orphelin: OrphelinStatus = enfant.orphelin ?? "aucun";
    if (orphelin === "un_parent") {
      if (region === "wallonie") {
        if (enfant.anneeNaissance >= PIVOT_WAL_BXL) {
          supplementOrphelin =
            age <= 17 ? WAL_SUPP_ORPHELIN_UN_0_17 : WAL_SUPP_ORPHELIN_UN_18_24;
        } else {
          supplementOrphelin = WAL_SUPP_ORPHELIN_ANCIEN_UN;
        }
      } else if (region === "bruxelles") {
        // FAMIRIS : 50 % de la base.
        supplementOrphelin = calc.base * 0.5;
      } else if (region === "flandre") {
        supplementOrphelin = FLA_SUPP_ORPHELIN_UN;
      } else {
        supplementOrphelin = DG_SUPP_ORPHELIN_UN;
      }
    } else if (orphelin === "deux_parents") {
      if (region === "wallonie") {
        if (enfant.anneeNaissance >= PIVOT_WAL_BXL) {
          supplementOrphelin = WAL_SUPP_ORPHELIN_DEUX;
        } else {
          supplementOrphelin = WAL_SUPP_ORPHELIN_ANCIEN_DEUX;
        }
      } else if (region === "bruxelles") {
        // FAMIRIS : double la base (donc supplément = +1× base).
        supplementOrphelin = calc.base;
      } else if (region === "flandre") {
        supplementOrphelin = FLA_SUPP_ORPHELIN_DEUX;
      } else {
        supplementOrphelin = DG_SUPP_ORPHELIN_DEUX;
      }
    }

    // Supplément large famille (rang ≥ 3) — appliqué côté DG via calc.
    // Pour FAMIRIS l'historique avait un "supplément 3e enfant +50" mais
    // depuis 2026 ce supplément n'est plus distinct (intégré au social).
    // On le retire pour rester fidèle à la documentation officielle.
    const supplement3eEnfant = calc.supplementLargeFamille ?? 0;

    const supplementsTotaux =
      calc.supplements +
      supplementHandicap +
      supplementOrphelin +
      // Si supplement3eEnfant déjà inclus dans calc.supplements (DG), ne pas le compter.
      0;
    const total = calc.base + supplementsTotaux;

    detail.push({
      rang,
      age,
      montantBase: calc.base,
      supplements: supplementsTotaux,
      supplementSocial:
        calc.supplementSocial > 0 ? calc.supplementSocial : undefined,
      supplementMonoparental:
        calc.supplementMono > 0 ? calc.supplementMono : undefined,
      supplementHandicap: supplementHandicap > 0 ? supplementHandicap : undefined,
      supplementOrphelin: supplementOrphelin > 0 ? supplementOrphelin : undefined,
      supplement3eEnfant: supplement3eEnfant > 0 ? supplement3eEnfant : undefined,
      total,
    });

    totalMensuel += total;

    // Bonus rentrée scolaire — barème spécifique par région.
    if (region === "wallonie") bonusRentreeAnnuel += walBonusRentree(age);
    else if (region === "bruxelles") bonusRentreeAnnuel += bxlBonusRentree(age);
    else if (region === "flandre") bonusRentreeAnnuel += flaBonusRentree(age);
    else bonusRentreeAnnuel += dgBonusRentree(age);

    // Allocation de naissance — versée uniquement aux enfants nés
    // l'année courante (one-shot). On utilise le rang pour distinguer
    // 1er enfant / suivants à Bruxelles ; WAL/FLA/DG = forfait unique.
    if (enfant.anneeNaissance === anneeCourante) {
      if (region === "wallonie") {
        allocationNaissanceTotale += WAL_PRIME_NAISSANCE;
      } else if (region === "bruxelles") {
        allocationNaissanceTotale +=
          rang === 1 ? BXL_PRIME_NAISSANCE_RANG_1 : BXL_PRIME_NAISSANCE_SUIVANTS;
      } else if (region === "flandre") {
        allocationNaissanceTotale += FLA_PRIME_NAISSANCE;
      } else {
        allocationNaissanceTotale += DG_PRIME_NAISSANCE;
      }
    }
  });

  return {
    totalMensuel,
    bonusRentreeAnnuel,
    allocationNaissanceTotale,
    detail,
    regionLabel: REGION_LABELS[region],
  };
}

/* ------------------------------------------------------------------ */
/*  Exports utiles pour la doc et les tests                            */
/* ------------------------------------------------------------------ */

export const ALLOCS_FAM_CONST = {
  // Wallonie
  WAL_BASE_NOUVEAU_0_17,
  WAL_BASE_NOUVEAU_18_24,
  WAL_SEUIL_BAS,
  WAL_SEUIL_INTERMEDIAIRE,
  WAL_SUPP_SOCIAL_NOUVEAU_BAS,
  WAL_SUPP_SOCIAL_NOUVEAU_INT,
  WAL_SUPP_MONO_NOUVEAU_BAS,
  WAL_SUPP_MONO_NOUVEAU_INT,
  WAL_SUPP_HANDICAP_MEDIAN,
  WAL_SUPP_HANDICAP_GRAVE,
  WAL_SUPP_ORPHELIN_UN_0_17,
  WAL_SUPP_ORPHELIN_DEUX,
  WAL_PRIME_NAISSANCE,
  // Bruxelles
  BXL_BASE_NOUVEAU_0_11,
  BXL_BASE_NOUVEAU_12_17,
  BXL_BASE_NOUVEAU_18_24,
  BXL_SEUIL_BAS,
  BXL_SEUIL_INTERMEDIAIRE,
  BXL_SUPP_SOCIAL_BAS,
  BXL_SUPP_SOCIAL_INT,
  BXL_SUPP_HANDICAP_MEDIAN,
  BXL_PRIME_NAISSANCE_RANG_1,
  BXL_PRIME_NAISSANCE_SUIVANTS,
  // Flandre
  FLA_BASE_NOUVEAU,
  FLA_SEUIL_BAS,
  FLA_SEUIL_INT_1_2,
  FLA_SEUIL_INT_3PLUS,
  FLA_SUPP_1_2_BAS,
  FLA_SUPP_1_2_INT,
  FLA_SUPP_3PLUS_BAS,
  FLA_SUPP_3PLUS_INT,
  FLA_SUPP_HANDICAP_MEDIAN,
  FLA_SUPP_ORPHELIN_UN,
  FLA_SUPP_ORPHELIN_DEUX,
  FLA_PRIME_NAISSANCE,
  // DG
  DG_BASE,
  DG_SEUIL_BAS,
  DG_SUPP_SOCIAL,
  DG_SUPP_LARGE_FAMILLE,
  DG_SUPP_HANDICAP_MEDIAN,
  DG_SUPP_ORPHELIN_UN,
  DG_SUPP_ORPHELIN_DEUX,
  DG_PRIME_NAISSANCE,
  // Pivots
  PIVOT_WAL_BXL,
  PIVOT_FLANDRE,
} as const;
