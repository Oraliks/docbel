/**
 * Calcul brut → net (et net → brut) — salarié belge, exercice 2026.
 *
 * NOTE IMPORTANTE
 * ---------------
 * Ce calcul est INDICATIF (fiabilité "high"). Il reproduit la logique
 * macro du précompte professionnel mensuel (barème "ordinaire" SPF
 * Finances) avec les approximations suivantes :
 *   - barème par tranches simplifié (5 tranches mensuelles)
 *   - quotités exemptées dégressives par paliers SPF (fonction)
 *   - réduction "enfants à charge" approchée (tableau officiel SPF)
 *   - bonus à l'emploi (workbonus) approché linéairement
 *   - ATN voiture de société : formule 2026 simplifiée (coef CO2 +
 *     décote vétusté + minimum légal 1 660 €/an)
 *   - indemnité télétravail forfaitaire (plafond 154,74 €/mois 2026)
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
 *   - ATN voitures : AR 14/01/2014, mise à jour CO2 réf. 2026
 *   - indemnité télétravail : circulaire 2021/C/20 + indexation 2026
 */

export type StatutFiscal =
  | "isole"
  | "cohabitant"
  | "marie_un_revenu"
  | "marie_deux_revenus";

export type Region = "wallonie" | "bruxelles" | "flandre";

export type MotorisationVehicule =
  | "essence"
  | "diesel"
  | "hybride"
  | "electrique";

export interface VoitureSocieteInput {
  hasVehicule: boolean;
  valeurCatalogueHT: number;
  ageVehicule: number;
  motorisation: MotorisationVehicule;
}

export interface BrutNetInput {
  brut: number;
  statut: StatutFiscal;
  enfants: number;
  region: Region;
  chequesRepas: boolean;
  /** Voiture de société (avantage en nature). Optionnel, défaut "pas de voiture". */
  voitureSociete?: VoitureSocieteInput;
  /** Indemnité télétravail forfaitaire mensuelle (0-200 €). Plafond légal 154,74 €/mois. */
  indemniteTelework?: number;
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
  /** ATN mensuel voiture de société (s'ajoute à l'imposable pour le précompte). */
  atn: number;
  /** Indemnité télétravail nette (non imposable, non ONSS). */
  indemniteTelework: number;
}

export interface BrutNetError {
  error: string;
}

/* ------------------------------------------------------------------ */
/*  Constantes — barème 2026                                          */
/* ------------------------------------------------------------------ */

const ONSS_TRAVAILLEUR = 0.1307;

/**
 * Bonus à l'emploi (workbonus) — barème 2026.
 *
 * Volet A max consolidé : 229,32 €/mois en 2026 (source Securex).
 * Dégressivité linéaire entre le RMMMG (≈ 2 154,11 €/mois au 1er mars 2026)
 * et le seuil de sortie (≈ 3 271,48 €/mois pour le volet A).
 *
 * Approximation : la formule réelle utilise 2 volets distincts (A et B) avec
 * des paliers, ici linéarisée pour rester pédagogique.
 */
const BONUS_PLAFOND = 229.32;
const BONUS_BRUT_MIN_PLEIN = 2154.11;
const BONUS_BRUT_MAX = 3271.48;

/** Tranches mensuelles de précompte (sur l'imposable mensuel). */
const TRANCHES: { plafond: number; taux: number }[] = [
  { plafond: 1360, taux: 0 },
  { plafond: 2400, taux: 0.2675 },
  { plafond: 4100, taux: 0.428 },
  { plafond: 7070, taux: 0.4815 },
  { plafond: Infinity, taux: 0.535 },
];

/** Réduction mensuelle pour enfants à charge (barème SPF approché). */
function reductionEnfants(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 45;
  if (n === 2) return 120;
  if (n === 3) return 320;
  if (n === 4) return 580;
  return 580 + (n - 4) * 250;
}

/**
 * Chèques-repas : depuis 2026, valeur faciale max 10 €/jour dont 8,91 €
 * de contribution employeur (non imposable, non soumise ONSS) et
 * 1,09 € de contribution travailleur.
 *
 * On retient ici la part employeur (≈ gain net pour le travailleur).
 * Source : UCM / Liantis (titres-repas 2026).
 */
const CHEQUES_REPAS_PAR_JOUR = 8.91;
const JOURS_PAR_MOIS = 21;

/**
 * Avantage en nature voiture de société — formule 2026.
 *
 * ATN annuel = valeur_catalogue_HT × 6/7 × coef_CO2 × décote_age
 * Minimum légal 2026 : 1 660 €/an (indexé annuellement).
 *
 * Coefficients CO2 (moyennes 2026) :
 *   - essence / hybride : 0,055
 *   - diesel            : 0,065
 *   - électrique         : 0,041
 *
 * Décote selon âge du véhicule (par tranche annuelle) :
 *   - 0-1 an  : 100 %
 *   - 2e an   : 94 %
 *   - 3e an   : 88 %
 *   - 4e an   : 82 %
 *   - 5e an   : 76 %
 *   - 6e an + : 70 %
 *
 * Source : AR du 14/01/2014, indexation 2026.
 */
const ATN_MIN_ANNUEL = 1660;
const ATN_FRACTION = 6 / 7;
const ATN_COEF_CO2: Record<MotorisationVehicule, number> = {
  essence: 0.055,
  hybride: 0.055,
  diesel: 0.065,
  electrique: 0.041,
};

function decoteAgeVehicule(age: number): number {
  if (!Number.isFinite(age) || age < 0) return 1;
  if (age <= 1) return 1;
  if (age === 2) return 0.94;
  if (age === 3) return 0.88;
  if (age === 4) return 0.82;
  if (age === 5) return 0.76;
  return 0.7;
}

/** ATN mensuel (≥ minimum légal). Retourne 0 si pas de véhicule. */
function calcAtnMensuel(v?: VoitureSocieteInput): number {
  if (!v || !v.hasVehicule) return 0;
  const valeur = Number.isFinite(v.valeurCatalogueHT) ? v.valeurCatalogueHT : 0;
  if (valeur <= 0) return 0;
  const coef = ATN_COEF_CO2[v.motorisation] ?? 0.055;
  const decote = decoteAgeVehicule(v.ageVehicule);
  const annuel = valeur * ATN_FRACTION * coef * decote;
  const annuelEffectif = Math.max(annuel, ATN_MIN_ANNUEL);
  return annuelEffectif / 12;
}

/**
 * Indemnité télétravail forfaitaire — plafond 2026 : 154,74 €/mois.
 *
 * Non imposable et non soumise à ONSS (circulaire 2021/C/20).
 * Toute somme au-delà du plafond est ignorée (sécurité).
 */
const INDEMNITE_TELEWORK_PLAFOND = 154.74;

function clampIndemniteTelework(montant: number | undefined): number {
  if (!Number.isFinite(montant) || (montant ?? 0) <= 0) return 0;
  return Math.min(montant as number, INDEMNITE_TELEWORK_PLAFOND);
}

/**
 * Quotité exemptée d'impôt mensualisée — paliers SPF 2026.
 *
 * Pour isolé / marié_deux_revenus :
 *   - brut < 1 500 €    : 280 €
 *   - 1 500-2 500 €     : dégressif linéaire 280 → 245
 *   - 2 500-5 000 €     : dégressif linéaire 245 → 210
 *   - > 5 000 €         : 180 €
 *
 * Cohabitant légal : 95 % de la valeur isolé (impact pratique limité).
 * Marié — un revenu : 380 € fixe (quotité conjoint).
 */
export function getQuotiteExemptee(
  statut: StatutFiscal,
  brut: number,
): number {
  if (statut === "marie_un_revenu") return 380;

  const isoleValue = (() => {
    if (!Number.isFinite(brut) || brut < 1500) return 280;
    if (brut <= 2500) {
      const ratio = (brut - 1500) / 1000; // 0 → 1
      return 280 - ratio * (280 - 245);
    }
    if (brut <= 5000) {
      const ratio = (brut - 2500) / 2500; // 0 → 1
      return 245 - ratio * (245 - 210);
    }
    return 180;
  })();

  if (statut === "cohabitant") return isoleValue * 0.95;
  // isole + marie_deux_revenus : barème "isolé"
  return isoleValue;
}

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
  const { brut, statut, enfants, chequesRepas, voitureSociete } = input;

  if (!Number.isFinite(brut) || brut < 100 || brut > 50000) {
    return {
      error:
        "Le salaire brut doit être compris entre 100 € et 50 000 € par mois.",
    };
  }
  if (!Number.isFinite(enfants) || enfants < 0 || enfants > 12) {
    return { error: "Le nombre d'enfants à charge doit être entre 0 et 12." };
  }
  if (voitureSociete?.hasVehicule) {
    const { valeurCatalogueHT, ageVehicule } = voitureSociete;
    if (
      !Number.isFinite(valeurCatalogueHT) ||
      valeurCatalogueHT < 0 ||
      valeurCatalogueHT > 250000
    ) {
      return {
        error:
          "La valeur catalogue HT du véhicule doit être entre 0 € et 250 000 €.",
      };
    }
    if (
      !Number.isFinite(ageVehicule) ||
      ageVehicule < 0 ||
      ageVehicule > 30
    ) {
      return { error: "L'âge du véhicule doit être entre 0 et 30 ans." };
    }
  }

  // 1. ONSS travailleur (13,07 %)
  const onss = brut * ONSS_TRAVAILLEUR;

  // 2. ATN voiture de société (mensuel) — s'ajoute à l'imposable
  const atn = calcAtnMensuel(voitureSociete);

  // 3. Salaire imposable mensuel (incl. ATN)
  const imposable = brut - onss + atn;

  // 4. Bonus à l'emploi (réduit l'ONSS effective → augmente le net)
  const bonus = calcBonusEmploi(brut);

  // 5. Précompte par tranches sur l'imposable
  const precompteBrut = calcPrecompteParTranches(imposable);

  // 6. Réductions : quotité exemptée (paliers SPF) + enfants à charge
  const quotite = getQuotiteExemptee(statut, brut);
  const reducEnfants = reductionEnfants(enfants);
  const precompte = Math.max(0, precompteBrut - quotite - reducEnfants);

  // 7. Avantage chèques-repas (non imposable, ajouté hors net "fiscal")
  const cr = chequesRepas ? CHEQUES_REPAS_PAR_JOUR * JOURS_PAR_MOIS : 0;

  // 8. Indemnité télétravail forfaitaire (non imposable, non ONSS)
  const teleworkNet = clampIndemniteTelework(input.indemniteTelework);

  // 9. Net = (brut - onss - précompte) + bonus + chèques-repas + télétravail
  //    L'ATN est ajouté à l'imposable pour le calcul du précompte mais
  //    n'est pas une somme versée au travailleur : il n'entre donc PAS
  //    dans le net en poche.
  const net = brut - onss - precompte + bonus + cr + teleworkNet;

  return {
    brut,
    onss,
    imposable,
    precompte,
    bonus,
    net,
    tauxNetBrut: brut > 0 ? net / brut : 0,
    chequesRepas: cr,
    atn,
    indemniteTelework: teleworkNet,
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
