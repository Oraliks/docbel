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
 * (≈ 30 % du brut, plafonné à 6 070 €/an en 2026), opter pour la déduction
 * des frais réels. La déduction kilométrique domicile-travail est la part la
 * plus visible de ces frais réels.
 *
 * BARÈMES 2026 (€/km)
 * -------------------
 *  - Voiture personnelle :
 *      * 0,4322 €/km (barème "indemnité km" fonctionnaires) UNIQUEMENT si
 *        l'employeur ne verse PAS d'indemnité km au contribuable. Plafond
 *        100 km aller simple ; au-delà : 0,15 €/km.
 *      * 0,15 €/km (forfait CIR 92 art. 66) dès lors que l'employeur verse
 *        une indemnité km : le contribuable ne peut plus cumuler avec le
 *        tarif fonctionnaires (l'indemnité reçue est défalquée des frais
 *        réels — cf. tolérance admin et jurisprudence Cour de cassation).
 *  - Moto : 0,15 €/km (forfait standard, pas de plafond km/jour).
 *  - Vélo (y compris électrique) : 0,37 €/km (revenus 2026, EI 2027),
 *    plafond annuel de déduction 3 700 €.
 *  - Transports publics : 100 % du coût de l'abonnement annuel
 *    (SNCB, STIB, TEC, De Lijn).
 *  - Covoiturage (passager) : 0,15 €/km plafonné à 100 km aller simple.
 *
 * TÉLÉTRAVAIL
 * -----------
 * Les jours télétravaillés ne génèrent pas de déduction km (pas de
 * déplacement). On les utilise UNIQUEMENT pour afficher, à titre
 * pédagogique, l'estimation des km évités sur l'année.
 *
 * INDEMNITÉ KM EMPLOYEUR
 * ----------------------
 * Lorsque l'employeur verse une indemnité km, celle-ci doit être soustraite
 * de la déduction frais réels (sinon double avantage). On expose deux
 * montants : `deductionKmBrute` (avant compensation) et `deductionKmNette`
 * (après compensation, plancher à 0).
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
  /**
   * Jours télétravaillés par semaine (0-5, défaut 0). Sert UNIQUEMENT à
   * estimer les km évités (information pédagogique) — ne réduit pas
   * la déduction (les jours sur place sont déjà comptés via `joursParSemaine`).
   */
  joursTelework?: number;
  /**
   * Indemnité km annuelle versée par l'employeur (€/an, défaut 0).
   * Si > 0 : applique le forfait 0,15 €/km pour la voiture (au lieu du
   * tarif 0,4322 €/km) et soustrait le montant reçu de la déduction brute.
   */
  indemniteEmployeurAnnuelle?: number;
}

export interface FraisKmResult {
  /** Distance totale parcourue dans l'année (aller-retour × jours × semaines). */
  kmTotalAnnuel: number;
  /**
   * Déduction fiscale annuelle estimée (€) — alias de `deductionKmNette`,
   * conservé pour rétro-compatibilité.
   */
  deductionKm: number;
  /** Déduction brute, avant compensation par l'indemnité employeur (€). */
  deductionKmBrute: number;
  /** Déduction nette = max(0, brute − indemnité employeur) (€). */
  deductionKmNette: number;
  /** Indemnité employeur effectivement reprise dans le calcul (€/an). */
  indemniteEmployeurAnnuelle: number;
  /**
   * Estimation des km évités grâce au télétravail sur l'année (info
   * pédagogique, hors calcul de déduction).
   */
  kmTeleworkEvites?: number;
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

/**
 * Taux kilométriques 2026 (€/km), par mode de transport.
 *
 * Pour la VOITURE on expose 0,4322 €/km (tarif "indemnité km" fonctionnaires)
 * applicable comme déduction de frais réels domicile-travail lorsque
 * l'employeur ne verse pas d'indemnité km. Si l'employeur verse une
 * indemnité, on bascule sur le forfait CIR 92 art. 66 = 0,15 €/km
 * (`TAUX_VOITURE_FORFAIT`), choisi à l'exécution du calcul.
 */
export const TAUX_KM_2026 = {
  voiture: 0.4322,
  velo: 0.37, // Revenus 2026 (EI 2027), précédemment 0,36 pour revenus 2025.
  moto: 0.15,
  covoiturage: 0.15,
} as const;

/** Plafond annuel de déduction vélo (revenus 2026). */
export const PLAFOND_ANNUEL_VELO_2026 = 3700;

/**
 * Tarif voiture forfait CIR 92 art. 66 — appliqué lorsque l'employeur verse
 * une indemnité km (le tarif fonctionnaires 0,4322 €/km n'est alors plus
 * cumulable) ET aux km voiture au-delà du plafond 100 km aller simple.
 */
const TAUX_VOITURE_FORFAIT = 0.15;

/** Plafond de km aller simple soumis au forfait préférentiel voiture / covoit. */
const PLAFOND_KM_ALLER_SIMPLE = 100;

/** Forfait légal de frais professionnels — revenus 2026 / EI 2027 (€). */
const FORFAIT_LEGAL_2026 = 6070;

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
    joursTelework: joursTeleworkRaw,
    indemniteEmployeurAnnuelle: indemniteRaw,
  } = input;

  // Normalisations (backwards-compat : champs optionnels).
  const joursTelework =
    Number.isFinite(joursTeleworkRaw) && (joursTeleworkRaw ?? 0) > 0
      ? Math.min(5, Math.max(0, joursTeleworkRaw ?? 0))
      : 0;
  const indemniteEmployeurAnnuelle =
    Number.isFinite(indemniteRaw) && (indemniteRaw ?? 0) > 0
      ? Math.max(0, indemniteRaw ?? 0)
      : 0;

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
  if (joursTelework + joursParSemaine > 7) {
    return {
      error:
        "Jours sur place + télétravail ne peuvent pas dépasser 7 jours/semaine.",
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

  // --- 1. Distances annuelles ----------------------------------------
  const kmTotalAnnuel = kmAllerSimple * 2 * joursParSemaine * semainesParAn;
  // Pédagogique : km évités par les jours de télétravail (non comptés
  // dans la déduction, juste affichés à titre informatif).
  const kmTeleworkEvites =
    joursTelework > 0
      ? joursTelework * 2 * kmAllerSimple * semainesParAn
      : undefined;
  const modeLabel = MODE_LABELS[transport];

  // Helper : applique l'indemnité employeur sur une déduction brute.
  const withIndemnite = (brute: number) => {
    const nette = Math.max(0, brute - indemniteEmployeurAnnuelle);
    return { brute, nette };
  };

  // --- 2. Cas spécial : transports publics ----------------------------
  if (transport === "transports_publics") {
    const { brute, nette } = withIndemnite(coutAbonnement);
    return {
      kmTotalAnnuel,
      deductionKm: nette,
      deductionKmBrute: brute,
      deductionKmNette: nette,
      indemniteEmployeurAnnuelle,
      kmTeleworkEvites,
      modeLabel,
      tauxApplique: "100 % de l'abonnement",
      abonnementInclus: coutAbonnement,
      recommandationFraisReels: nette > SEUIL_RECOMMANDATION,
      plafondAtteint: false,
    };
  }

  // --- 3. Voiture : choix du taux selon présence indemnité employeur --
  // Règle métier (CIR 92 art. 66 + tolérance admin tarif fonctionnaires) :
  //  - indemnité employeur = 0 → tarif 0,4322 €/km (fonctionnaires)
  //  - indemnité employeur > 0 → forfait 0,15 €/km (cumul exclu)
  // Dans les deux cas le plafond 100 km AS s'applique : au-delà = 0,15 €/km.
  if (transport === "voiture") {
    const plafondAtteint = kmAllerSimple > PLAFOND_KM_ALLER_SIMPLE;
    const jours = joursParSemaine * semainesParAn;
    const useForfait = indemniteEmployeurAnnuelle > 0;
    const tauxPlafonne = useForfait
      ? TAUX_VOITURE_FORFAIT
      : TAUX_KM_2026.voiture;
    const kmPlafonnes =
      Math.min(kmAllerSimple, PLAFOND_KM_ALLER_SIMPLE) * 2 * jours;
    const kmExcedent = plafondAtteint
      ? (kmAllerSimple - PLAFOND_KM_ALLER_SIMPLE) * 2 * jours
      : 0;
    const brute =
      kmPlafonnes * tauxPlafonne + kmExcedent * TAUX_VOITURE_FORFAIT;
    const { nette } = withIndemnite(brute);
    return {
      kmTotalAnnuel,
      deductionKm: nette,
      deductionKmBrute: brute,
      deductionKmNette: nette,
      indemniteEmployeurAnnuelle,
      kmTeleworkEvites,
      modeLabel,
      tauxApplique: tauxPlafonne,
      abonnementInclus: 0,
      recommandationFraisReels: nette > SEUIL_RECOMMANDATION,
      plafondAtteint,
    };
  }

  // --- 4. Covoiturage : 0,15 €/km plafonné à 100 km aller simple ------
  if (transport === "covoiturage") {
    const plafondAtteint = kmAllerSimple > PLAFOND_KM_ALLER_SIMPLE;
    const kmRetenu = Math.min(kmAllerSimple, PLAFOND_KM_ALLER_SIMPLE);
    const brute =
      kmRetenu * 2 * joursParSemaine * semainesParAn * TAUX_KM_2026.covoiturage;
    const { nette } = withIndemnite(brute);
    return {
      kmTotalAnnuel,
      deductionKm: nette,
      deductionKmBrute: brute,
      deductionKmNette: nette,
      indemniteEmployeurAnnuelle,
      kmTeleworkEvites,
      modeLabel,
      tauxApplique: TAUX_KM_2026.covoiturage,
      abonnementInclus: 0,
      recommandationFraisReels: nette > SEUIL_RECOMMANDATION,
      plafondAtteint,
    };
  }

  // --- 5. Vélo / moto : taux uniforme ---------------------------------
  // Vélo plafonné à 3 700 €/an (revenus 2026). Moto : pas de plafond.
  const taux = TAUX_KM_2026[transport];
  let brute = kmTotalAnnuel * taux;
  let plafondVeloAtteint = false;
  if (transport === "velo" && brute > PLAFOND_ANNUEL_VELO_2026) {
    brute = PLAFOND_ANNUEL_VELO_2026;
    plafondVeloAtteint = true;
  }
  const { nette } = withIndemnite(brute);
  return {
    kmTotalAnnuel,
    deductionKm: nette,
    deductionKmBrute: brute,
    deductionKmNette: nette,
    indemniteEmployeurAnnuelle,
    kmTeleworkEvites,
    modeLabel,
    tauxApplique: taux,
    abonnementInclus: 0,
    recommandationFraisReels: nette > SEUIL_RECOMMANDATION,
    plafondAtteint: plafondVeloAtteint,
  };
}

/** Forfait légal 2026 exposé pour l'UI (comparaison frais réels). */
export const FORFAIT_LEGAL_FRAIS_PRO_2026 = FORFAIT_LEGAL_2026;
