/**
 * Calcul brut → net (et net → brut) — salarié belge, exercice 2026.
 *
 * NOTE IMPORTANTE
 * ---------------
 * Ce calcul est INDICATIF. Il reproduit la logique macro du précompte
 * professionnel mensuel (barème "ordinaire" SPF Finances) avec les
 * approximations suivantes :
 *   - barème par tranches simplifié (5 tranches mensuelles)
 *   - quotités exemptées arrondies par statut civil
 *   - réduction "enfants à charge" approchée (tableau officiel SPF)
 *   - bonus à l'emploi (workbonus) approché linéairement
 *   - taxe régionale ignorée (impact négligeable au niveau du précompte
 *     mensuel — l'additionnel communal s'applique au calcul annuel
 *     définitif, pas au précompte)
 *
 * Pour le calcul officiel et exact : SPF Finances "Calculator personal
 * income tax" + fiche de paie.
 *
 * Sources des chiffres :
 *   - taux ONSS travailleur : 13,07 % (inchangé depuis 1981)
 *   - barème précompte : Annexe III AR/CIR 92 — fiches officielles 2026
 *   - quotités exemptées : Code des impôts sur les revenus, art. 131
 *   - bonus à l'emploi : Loi-programme du 24 décembre 2002, indexation 2026
 */

export type StatutFiscal =
  | "isole"
  | "cohabitant"
  | "marie_un_revenu"
  | "marie_deux_revenus";

export type Region = "wallonie" | "bruxelles" | "flandre";

export interface BrutNetInput {
  brut: number;
  statut: StatutFiscal;
  enfants: number;
  region: Region;
  chequesRepas: boolean;
}

export interface BrutNetResult {
  brut: number;
  onss: number;
  imposable: number;
  precompte: number;
  bonus: number;
  net: number;
  tauxNetBrut: number;
  chequesRepas: number;
}

export interface BrutNetError {
  error: string;
}

/* ------------------------------------------------------------------ */
/*  Constantes — barème 2026                                          */
/* ------------------------------------------------------------------ */

const ONSS_TRAVAILLEUR = 0.1307;

/** Bonus à l'emploi : ~264 €/mois max, dégressif entre ~1 900 et 3 300 €. */
const BONUS_PLAFOND = 264;
const BONUS_BRUT_MIN_PLEIN = 1900;
const BONUS_BRUT_MAX = 3300;

/** Tranches mensuelles de précompte (sur l'imposable mensuel). */
const TRANCHES: { plafond: number; taux: number }[] = [
  { plafond: 1360, taux: 0 },
  { plafond: 2400, taux: 0.2675 },
  { plafond: 4100, taux: 0.428 },
  { plafond: 7070, taux: 0.4815 },
  { plafond: Infinity, taux: 0.535 },
];

/** Quotités exemptées mensuelles (réduction directe sur le précompte). */
const QUOTITE_EXEMPTEE: Record<StatutFiscal, number> = {
  isole: 245,
  cohabitant: 240,
  marie_un_revenu: 380,
  marie_deux_revenus: 245,
};

/** Réduction mensuelle pour enfants à charge (barème SPF approché). */
function reductionEnfants(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 45;
  if (n === 2) return 120;
  if (n === 3) return 320;
  if (n === 4) return 580;
  return 580 + (n - 4) * 250;
}

/** Chèques-repas : ~6,91 €/jour × 21 jours/mois (avantage non-imposable). */
const CHEQUES_REPAS_PAR_JOUR = 6.91;
const JOURS_PAR_MOIS = 21;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Bonus à l'emploi mensuel approché. */
function calcBonusEmploi(brut: number): number {
  if (brut >= BONUS_BRUT_MAX) return 0;
  if (brut <= BONUS_BRUT_MIN_PLEIN) return BONUS_PLAFOND;
  // Dégressivité linéaire entre 1 900 et 3 300.
  const range = BONUS_BRUT_MAX - BONUS_BRUT_MIN_PLEIN;
  return BONUS_PLAFOND * ((BONUS_BRUT_MAX - brut) / range);
}

/** Précompte mensuel par tranches sur l'imposable. */
function calcPrecompteParTranches(imposable: number): number {
  let restant = imposable;
  let plancher = 0;
  let total = 0;
  for (const t of TRANCHES) {
    const largeur = t.plafond - plancher;
    const part = Math.min(restant, largeur);
    if (part <= 0) break;
    total += part * t.taux;
    restant -= part;
    plancher = t.plafond;
    if (restant <= 0) break;
  }
  return total;
}

/* ------------------------------------------------------------------ */
/*  Calcul principal — brut → net                                     */
/* ------------------------------------------------------------------ */

export function calcBrutNet(
  input: BrutNetInput,
): BrutNetResult | BrutNetError {
  const { brut, statut, enfants, chequesRepas } = input;

  if (!Number.isFinite(brut) || brut < 100 || brut > 50000) {
    return {
      error:
        "Le salaire brut doit être compris entre 100 € et 50 000 € par mois.",
    };
  }
  if (!Number.isFinite(enfants) || enfants < 0 || enfants > 12) {
    return { error: "Le nombre d'enfants à charge doit être entre 0 et 12." };
  }

  // 1. ONSS travailleur (13,07 %)
  const onss = brut * ONSS_TRAVAILLEUR;

  // 2. Salaire imposable mensuel
  const imposable = brut - onss;

  // 3. Bonus à l'emploi (réduit l'ONSS effective → augmente le net)
  const bonus = calcBonusEmploi(brut);

  // 4. Précompte par tranches sur l'imposable
  const precompteBrut = calcPrecompteParTranches(imposable);

  // 5. Réductions : quotité exemptée + enfants à charge
  const quotite = QUOTITE_EXEMPTEE[statut];
  const reducEnfants = reductionEnfants(enfants);
  const precompte = Math.max(0, precompteBrut - quotite - reducEnfants);

  // 6. Avantage chèques-repas (non imposable, ajouté hors net "fiscal")
  const cr = chequesRepas ? CHEQUES_REPAS_PAR_JOUR * JOURS_PAR_MOIS : 0;

  // 7. Net = imposable - précompte + bonus + chèques-repas
  const net = imposable - precompte + bonus + cr;

  return {
    brut,
    onss,
    imposable,
    precompte,
    bonus,
    net,
    tauxNetBrut: brut > 0 ? net / brut : 0,
    chequesRepas: cr,
  };
}

/* ------------------------------------------------------------------ */
/*  Inverse — net → brut (par dichotomie)                             */
/* ------------------------------------------------------------------ */

/**
 * Trouve par dichotomie le brut qui produit le net souhaité.
 * Précision visée : ±1 €. Renvoie null si le net est hors plage.
 */
export function calcNetToBrut(
  netVoulu: number,
  params: Omit<BrutNetInput, "brut">,
): BrutNetResult | BrutNetError {
  if (!Number.isFinite(netVoulu) || netVoulu < 100 || netVoulu > 30000) {
    return {
      error: "Le net visé doit être compris entre 100 € et 30 000 € par mois.",
    };
  }

  let lo = 100;
  let hi = 50000;
  let best: BrutNetResult | null = null;

  // 60 itérations suffisent largement pour une précision < 0,01 €.
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const res = calcBrutNet({ ...params, brut: mid });
    if ("error" in res) {
      return res;
    }
    best = res;
    if (Math.abs(res.net - netVoulu) < 0.5) break;
    if (res.net < netVoulu) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (!best) {
    return { error: "Impossible de calculer le brut correspondant." };
  }
  return best;
}
