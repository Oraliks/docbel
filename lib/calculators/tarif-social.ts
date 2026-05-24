/**
 * Tarif social fédéral énergie (électricité + gaz naturel) — version 2026.
 *
 * Sources :
 *  - SPF Économie (Service Public Fédéral) — economie.fgov.be
 *  - CREG (Commission de Régulation de l'Électricité et du Gaz) — creg.be
 *    Note Z3153 : tarifs maximaux sociaux, recalculés chaque trimestre.
 *  - Arrêté ministériel fixant les tarifs sociaux maximaux.
 *
 * Principe :
 *  Certains ménages bénéficient automatiquement du tarif social fédéral, soit
 *  le tarif commercial le plus bas du marché belge (calculé chaque trimestre
 *  par la CREG). Application automatique depuis 2010, vérifiée 4x par an par
 *  croisement de bases de données — aucune démarche à effectuer.
 *
 * Bénéficiaires (au moins UN suffit) :
 *  - BIM (Bénéficiaire de l'Intervention Majorée, ex-OMNIO) via mutuelle
 *  - Revenu d'Intégration Sociale (RIS) du CPAS
 *  - GRAPA (Garantie de Revenus Aux Personnes Âgées)
 *  - Allocation aux personnes handicapées (DG HAN du SPF Sécurité Sociale)
 *  - Aide sociale équivalente accordée par le CPAS
 *  - Locataire d'un logement social agréé chauffé au gaz collectif
 *
 * Plafonds de consommation : au-delà, le tarif standard du fournisseur
 *  s'applique sur l'excédent (et non sur la totalité). Cette simu modélise
 *  cette règle exactement (calcul split tarif social ≤ plafond + tarif
 *  standard sur l'excédent).
 *
 * AVERTISSEMENT : les tarifs varient chaque TRIMESTRE (note CREG Z3153).
 *  Ceux utilisés ici sont les valeurs indicatives Q2 2026, TVAC. Le gain
 *  réel dépend de votre fournisseur actuel, votre profil et le trimestre.
 */

export interface TarifSocialInput {
  /** Bénéficiaire de l'Intervention Majorée (ex-OMNIO). */
  bim: boolean;
  /** Revenu d'Intégration Sociale (CPAS). */
  ris: boolean;
  /** Garantie de Revenus Aux Personnes Âgées. */
  grapa: boolean;
  /** Allocation aux personnes handicapées (DG HAN). */
  handicap: boolean;
  /** Aide sociale équivalente accordée par le CPAS. */
  aideEquivalente: boolean;
  /** Locataire d'un logement social agréé. */
  logementSocial: boolean;
  /** Consommation annuelle d'électricité (kWh). */
  consoElecKwh: number;
  /** Consommation annuelle de gaz naturel (kWh). 0 si pas de gaz. */
  consoGazKwh: number;
  /** Chauffage électrique (consommation plus élevée → plafond plus haut). */
  chauffageElec: boolean;
  /** Chauffage au gaz (impacte le plafond gaz). Défaut : true. */
  chauffageGaz?: boolean;
  /** Nombre de personnes dans le ménage (1-15). Défaut : 2. */
  tailleMenage?: number;
}

export interface TarifSocialResult {
  /** Le ménage est-il éligible au tarif social automatique. */
  eligible: boolean;
  /** Liste lisible des statuts qui ouvrent le droit. */
  motifsEligibilite: string[];
  /** Économie totale annuelle estimée (électricité + gaz). */
  gainAnnuel: number;
  /** Économie mensuelle moyenne. */
  gainMensuel: number;
  /** Économie annuelle sur l'électricité. */
  gainElec: number;
  /** Économie annuelle sur le gaz naturel. */
  gainGaz: number;
  /** Facture totale au tarif standard moyen. */
  coutStandardTotal: number;
  /** Facture totale au tarif social (avec excédents au tarif standard). */
  coutSocialTotal: number;
  /** Plafond élec appliqué (kWh) — au-delà, tarif standard sur excédent. */
  plafondElec: number;
  /** Plafond gaz appliqué (kWh). */
  plafondGaz: number;
  /** kWh élec au-dessus du plafond (facturés au tarif standard). */
  consoExcedentElec: number;
  /** kWh gaz au-dessus du plafond (facturés au tarif standard). */
  consoExcedentGaz: number;
}

/** Trimestre de référence des tarifs codés ci-dessous (affichage UI). */
export const Q_REFERENCE = "Q2 2026";

/**
 * Tarifs indicatifs 2026 (Q2), en €/kWh, tout inclus (énergie + transport +
 * distribution + taxes + TVA 6 % sur le social, 21 % sur le standard).
 */
export const TARIFS_2026 = {
  /**
   * Tarif social électricité — uniforme partout en Belgique.
   * Q2 2026 : 0,248 €/kWh TVAC monohoraire (source CREG note Z3153).
   * Tarif recalculé chaque trimestre.
   */
  ELEC_SOCIAL: 0.248,
  /** Tarif standard moyen électricité (moyenne nationale 2026). */
  ELEC_STANDARD: 0.35,
  /** Tarif social gaz naturel. */
  GAZ_SOCIAL: 0.047,
  /** Tarif standard moyen gaz naturel. */
  GAZ_STANDARD: 0.105,
} as const;

/** Plafonds de consommation au-delà desquels le tarif social ne s'applique plus. */
export const PLAFONDS_2026 = {
  /** Électricité : 1800 kWh + 200/personne supplémentaire (sans chauffage élec). */
  ELEC_BASE: 1800,
  /** Électricité avec chauffage élec : 4600 kWh + 200/personne supplémentaire. */
  ELEC_CHAUFFAGE: 4600,
  /** Par personne supplémentaire dans le ménage (au-delà de la première). */
  ELEC_PAR_PERSONNE: 200,
  /** Gaz sans chauffage gaz (cuisine + eau chaude). */
  GAZ_NON_CHAUFFAGE: 12000,
  /** Gaz avec chauffage gaz (cas le plus courant). */
  GAZ_CHAUFFAGE: 23260,
} as const;

const MOTIFS_LABELS: Record<string, string> = {
  bim: "Statut BIM (Intervention Majorée)",
  ris: "Revenu d'Intégration Sociale (RIS)",
  grapa: "GRAPA (Garantie de Revenus Aux Personnes Âgées)",
  handicap: "Allocation aux personnes handicapées",
  aideEquivalente: "Aide sociale équivalente du CPAS",
  logementSocial: "Locataire d'un logement social agréé",
};

/**
 * Calcule le plafond électrique applicable au ménage.
 *   - Base : 1 800 kWh (sans chauffage élec) ou 4 600 kWh (avec chauffage élec).
 *   - +200 kWh par personne supplémentaire (au-delà de la première).
 */
export function plafondElecKwh(
  chauffageElec: boolean,
  tailleMenage: number,
): number {
  const base = chauffageElec
    ? PLAFONDS_2026.ELEC_CHAUFFAGE
    : PLAFONDS_2026.ELEC_BASE;
  const supplement =
    Math.max(0, tailleMenage - 1) * PLAFONDS_2026.ELEC_PAR_PERSONNE;
  return base + supplement;
}

/** Calcule le plafond gaz selon le type de chauffage. */
export function plafondGazKwh(chauffageGaz: boolean): number {
  return chauffageGaz
    ? PLAFONDS_2026.GAZ_CHAUFFAGE
    : PLAFONDS_2026.GAZ_NON_CHAUFFAGE;
}

export function calcTarifSocial(
  input: TarifSocialInput,
): TarifSocialResult | { error: string } {
  const {
    bim,
    ris,
    grapa,
    handicap,
    aideEquivalente,
    logementSocial,
    consoElecKwh,
    consoGazKwh,
    chauffageElec,
    chauffageGaz = true,
    tailleMenage = 2,
  } = input;

  // --- Validation des consommations -------------------------------------
  if (
    !Number.isFinite(consoElecKwh) ||
    consoElecKwh < 0 ||
    consoElecKwh >= 100000
  ) {
    return {
      error:
        "La consommation d'électricité doit être comprise entre 0 et 100 000 kWh.",
    };
  }
  if (
    !Number.isFinite(consoGazKwh) ||
    consoGazKwh < 0 ||
    consoGazKwh >= 100000
  ) {
    return {
      error:
        "La consommation de gaz doit être comprise entre 0 et 100 000 kWh (0 si pas de gaz).",
    };
  }
  if (
    !Number.isFinite(tailleMenage) ||
    tailleMenage < 1 ||
    tailleMenage > 15
  ) {
    return {
      error: "La taille du ménage doit être comprise entre 1 et 15 personnes.",
    };
  }

  // --- Éligibilité : au moins UN statut suffit --------------------------
  const statuts: Record<string, boolean> = {
    bim,
    ris,
    grapa,
    handicap,
    aideEquivalente,
    logementSocial,
  };
  const motifsEligibilite: string[] = [];
  for (const [key, actif] of Object.entries(statuts)) {
    if (actif) motifsEligibilite.push(MOTIFS_LABELS[key]);
  }
  const eligible = motifsEligibilite.length > 0;

  // --- Plafonds applicables ---------------------------------------------
  const plafondElec = plafondElecKwh(chauffageElec, tailleMenage);
  const plafondGaz = plafondGazKwh(chauffageGaz);

  // --- Split conso : tarif social ≤ plafond + tarif standard sur l'excédent
  const elecSousPlafond = Math.min(consoElecKwh, plafondElec);
  const consoExcedentElec = Math.max(0, consoElecKwh - plafondElec);
  const gazSousPlafond = Math.min(consoGazKwh, plafondGaz);
  const consoExcedentGaz = Math.max(0, consoGazKwh - plafondGaz);

  // --- Estimation du gain (qu'on calcule même si pas éligible, comme
  //     "ce que vous pourriez économiser") ------------------------------
  // Coût "tout au tarif standard" (référence sans tarif social).
  const coutStandardElec = consoElecKwh * TARIFS_2026.ELEC_STANDARD;
  const coutStandardGaz = consoGazKwh * TARIFS_2026.GAZ_STANDARD;

  // Coût "tarif social plafonné" : social sous plafond + standard sur excédent.
  const coutSocialElec =
    elecSousPlafond * TARIFS_2026.ELEC_SOCIAL +
    consoExcedentElec * TARIFS_2026.ELEC_STANDARD;
  const coutSocialGaz =
    gazSousPlafond * TARIFS_2026.GAZ_SOCIAL +
    consoExcedentGaz * TARIFS_2026.GAZ_STANDARD;

  // Le gain ne porte que sur la part sous plafond (différentiel de tarif
  // appliqué uniquement aux kWh éligibles).
  const gainElec =
    elecSousPlafond * (TARIFS_2026.ELEC_STANDARD - TARIFS_2026.ELEC_SOCIAL);
  const gainGaz =
    gazSousPlafond * (TARIFS_2026.GAZ_STANDARD - TARIFS_2026.GAZ_SOCIAL);

  const gainAnnuel = gainElec + gainGaz;
  const gainMensuel = gainAnnuel / 12;
  const coutStandardTotal = coutStandardElec + coutStandardGaz;
  const coutSocialTotal = coutSocialElec + coutSocialGaz;

  return {
    eligible,
    motifsEligibilite,
    gainAnnuel,
    gainMensuel,
    gainElec,
    gainGaz,
    coutStandardTotal,
    coutSocialTotal,
    plafondElec,
    plafondGaz,
    consoExcedentElec,
    consoExcedentGaz,
  };
}
