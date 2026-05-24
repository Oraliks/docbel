/**
 * Frais professionnels domicile-travail — déduction fiscale belge 2026.
 *
 * SOURCES
 * -------
 *  - SPF Finances — finances.belgium.be
 *  - Code des impôts sur les revenus (CIR92), art. 51 (forfait légal) et
 *    art. 66 (déduction forfaitaire kilométrique).
 *  - Communiqué SPF Finances 2025 sur les barèmes kilométriques 2026.
 *
 * PRINCIPE
 * --------
 * Le contribuable peut, à la place du forfait légal de frais professionnels
 * (≈ 30 % du brut, plafonné à 5 720 €/an en 2026), opter pour la déduction
 * des frais réels. La déduction kilométrique domicile-travail est la part la
 * plus visible de ces frais réels.
 *
 * BARÈMES 2026 (€/km)
 * -------------------
 *  - Voiture personnelle : 0,4322 €/km, mais plafonné à 100 km aller simple.
 *    Au-delà de ce plafond : 0,15 €/km pour les km en excédent.
 *  - Moto : 0,15 €/km (forfait standard, pas de plafond km/jour).
 *  - Vélo (y compris électrique) : 0,36 €/km, déductible intégralement.
 *  - Transports publics : 100 % du coût de l'abonnement annuel
 *    (SNCB, STIB, TEC, De Lijn).
 *  - Covoiturage (passager) : 0,15 €/km plafonné à 100 km aller simple.
 *
 * AVERTISSEMENT
 * -------------
 * Calcul indicatif. L'option pour les frais réels n'est intéressante QUE si
 * la somme des frais réels (km + repas, vêtements pro, formation…) dépasse
 * le forfait légal de l'année.
 */

export type TransportMode =
  | "voiture"
  | "velo"
  | "transports_publics"
  | "moto"
  | "covoiturage";

export interface FraisKmInput {
  /** Distance domicile-travail (aller simple), en km. */
  kmAllerSimple: number;
  /** Nombre de jours travaillés sur place par semaine (1-7). */
  joursParSemaine: number;
  /** Nombre de semaines travaillées par an (1-52, défaut 44). */
  semainesParAn: number;
  /** Mode de transport principal. */
  transport: TransportMode;
  /** Si `transport === "transports_publics"` : coût annuel de l'abonnement (€). */
  coutAbonnement: number;
}

export interface FraisKmResult {
  /** Distance totale parcourue dans l'année (aller-retour × jours × semaines). */
  kmTotalAnnuel: number;
  /** Déduction fiscale annuelle estimée (€). */
  deductionKm: number;
  /** Libellé lisible du mode de transport. */
  modeLabel: string;
  /** Taux appliqué (€/km), ou libellé spécial pour les transports publics. */
  tauxApplique: number | string;
  /** Coût de l'abonnement effectivement déduit (0 hors transports publics). */
  abonnementInclus: number;
  /** True si la déduction est probablement plus avantageuse que le forfait légal. */
  recommandationFraisReels: boolean;
  /** True si le plafond de 100 km aller simple a été atteint (voiture / covoit.). */
  plafondAtteint: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constantes — barème 2026                                          */
/* ------------------------------------------------------------------ */

/** Taux kilométriques 2026 (€/km), par mode de transport. */
export const TAUX_KM_2026 = {
  voiture: 0.4322,
  velo: 0.36,
  moto: 0.15,
  covoiturage: 0.15,
} as const;

/** Tarif de remplacement (€/km) pour les km au-delà du plafond (voiture). */
const TAUX_VOITURE_AU_DELA = 0.15;

/** Plafond de km aller simple soumis au forfait préférentiel voiture / covoit. */
const PLAFOND_KM_ALLER_SIMPLE = 100;

/** Forfait légal de frais professionnels 2026 (€). */
const FORFAIT_LEGAL_2026 = 5720;

/** Seuil de recommandation : au-delà, les frais réels deviennent crédibles. */
const SEUIL_RECOMMANDATION = 3000;

const MODE_LABELS: Record<TransportMode, string> = {
  voiture: "Voiture personnelle",
  velo: "Vélo (y compris électrique)",
  transports_publics: "Transports publics",
  moto: "Moto",
  covoiturage: "Covoiturage (passager)",
};

/* ------------------------------------------------------------------ */
/*  Calcul principal                                                  */
/* ------------------------------------------------------------------ */

export function calcFraisKm(
  input: FraisKmInput,
): FraisKmResult | { error: string } {
  const {
    kmAllerSimple,
    joursParSemaine,
    semainesParAn,
    transport,
    coutAbonnement,
  } = input;

  // --- Validation ------------------------------------------------------
  if (
    !Number.isFinite(kmAllerSimple) ||
    kmAllerSimple <= 0 ||
    kmAllerSimple >= 500
  ) {
    return {
      error:
        "La distance domicile-travail doit être comprise entre 0 et 500 km (aller simple).",
    };
  }
  if (
    !Number.isFinite(joursParSemaine) ||
    joursParSemaine < 1 ||
    joursParSemaine > 7
  ) {
    return {
      error: "Le nombre de jours par semaine doit être compris entre 1 et 7.",
    };
  }
  if (
    !Number.isFinite(semainesParAn) ||
    semainesParAn < 1 ||
    semainesParAn > 52
  ) {
    return {
      error: "Le nombre de semaines par an doit être compris entre 1 et 52.",
    };
  }
  if (
    transport === "transports_publics" &&
    (!Number.isFinite(coutAbonnement) || coutAbonnement <= 0)
  ) {
    return {
      error:
        "Indiquez le coût annuel de votre abonnement de transports publics.",
    };
  }

  // --- 1. Distance annuelle parcourue ---------------------------------
  const kmTotalAnnuel =
    kmAllerSimple * 2 * joursParSemaine * semainesParAn;
  const modeLabel = MODE_LABELS[transport];

  // --- 2. Cas spécial : transports publics ----------------------------
  if (transport === "transports_publics") {
    const deductionKm = coutAbonnement;
    return {
      kmTotalAnnuel,
      deductionKm,
      modeLabel,
      tauxApplique: "100 % de l'abonnement",
      abonnementInclus: coutAbonnement,
      recommandationFraisReels: deductionKm > SEUIL_RECOMMANDATION,
      plafondAtteint: false,
    };
  }

  // --- 3. Voiture : barème préférentiel + plafond 100 km AS -----------
  if (transport === "voiture") {
    const plafondAtteint = kmAllerSimple > PLAFOND_KM_ALLER_SIMPLE;
    const jours = joursParSemaine * semainesParAn;
    const kmPlafonnes =
      Math.min(kmAllerSimple, PLAFOND_KM_ALLER_SIMPLE) * 2 * jours;
    const kmExcedent = plafondAtteint
      ? (kmAllerSimple - PLAFOND_KM_ALLER_SIMPLE) * 2 * jours
      : 0;
    const deductionKm =
      kmPlafonnes * TAUX_KM_2026.voiture +
      kmExcedent * TAUX_VOITURE_AU_DELA;
    return {
      kmTotalAnnuel,
      deductionKm,
      modeLabel,
      tauxApplique: TAUX_KM_2026.voiture,
      abonnementInclus: 0,
      recommandationFraisReels: deductionKm > SEUIL_RECOMMANDATION,
      plafondAtteint,
    };
  }

  // --- 4. Covoiturage : 0,15 €/km plafonné à 100 km aller simple ------
  if (transport === "covoiturage") {
    const plafondAtteint = kmAllerSimple > PLAFOND_KM_ALLER_SIMPLE;
    const kmRetenu = Math.min(kmAllerSimple, PLAFOND_KM_ALLER_SIMPLE);
    const deductionKm =
      kmRetenu * 2 * joursParSemaine * semainesParAn * TAUX_KM_2026.covoiturage;
    return {
      kmTotalAnnuel,
      deductionKm,
      modeLabel,
      tauxApplique: TAUX_KM_2026.covoiturage,
      abonnementInclus: 0,
      recommandationFraisReels: deductionKm > SEUIL_RECOMMANDATION,
      plafondAtteint,
    };
  }

  // --- 5. Vélo / moto : taux uniforme, pas de plafond -----------------
  const taux = TAUX_KM_2026[transport];
  const deductionKm = kmTotalAnnuel * taux;
  return {
    kmTotalAnnuel,
    deductionKm,
    modeLabel,
    tauxApplique: taux,
    abonnementInclus: 0,
    recommandationFraisReels: deductionKm > SEUIL_RECOMMANDATION,
    plafondAtteint: false,
  };
}

/** Forfait légal 2026 exposé pour l'UI (comparaison frais réels). */
export const FORFAIT_LEGAL_FRAIS_PRO_2026 = FORFAIT_LEGAL_2026;
