/**
 * Tarif social fédéral énergie (électricité + gaz naturel) — version 2026 S1.
 *
 * Sources :
 *  - SPF Économie (Service Public Fédéral) — economie.fgov.be
 *  - CREG (Commission de Régulation de l'Électricité et du Gaz) — creg.be
 *  - Arrêté ministériel fixant les tarifs sociaux maximaux, semestriel.
 *
 * Principe :
 *  Certains ménages bénéficient automatiquement du tarif social fédéral, soit
 *  le tarif commercial le plus bas du marché belge (calculé chaque semestre
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
 *  s'applique. Cette simu ne demande pas la taille du ménage pour rester
 *  simple — on applique le tarif sur la consommation déclarée sans gérer
 *  le dépassement (à mentionner en disclaimer).
 *
 * AVERTISSEMENT : les tarifs varient chaque semestre. Ceux utilisés ici
 *  sont les valeurs moyennes indicatives 2026 S1, tout inclus (TVAC).
 *  Le gain réel dépend de votre fournisseur actuel et de votre profil.
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
  /** Chauffage électrique (consommation plus élevée). */
  chauffageElec: boolean;
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
  /** Facture totale au tarif social. */
  coutSocialTotal: number;
}

/**
 * Tarifs indicatifs 2026 S1, en €/kWh, tout inclus (énergie + transport +
 * distribution + taxes + TVA 6 % sur le social, 21 % sur le standard).
 */
export const TARIFS_2026 = {
  /** Tarif social électricité — uniforme partout en Belgique. */
  ELEC_SOCIAL: 0.22,
  /** Tarif standard moyen électricité — moyenne marché belge. */
  ELEC_STANDARD: 0.385,
  /** Tarif social gaz naturel. */
  GAZ_SOCIAL: 0.047,
  /** Tarif standard moyen gaz naturel. */
  GAZ_STANDARD: 0.105,
} as const;

/** Plafonds de consommation au-delà desquels le tarif social ne s'applique plus. */
export const PLAFONDS_2026 = {
  /** Électricité : 1800 kWh + 200/personne (sans chauffage élec). */
  ELEC_BASE: 1800,
  /** Électricité avec chauffage élec : 4600 kWh + 200/personne. */
  ELEC_CHAUFFAGE: 4600,
  /** Par personne supplémentaire dans le ménage. */
  ELEC_PAR_PERSONNE: 200,
  /** Gaz sans chauffage gaz (cuisine + eau chaude). */
  GAZ_NON_CHAUFFAGE: 12000,
  /** Gaz avec chauffage gaz (cas le plus courant). */
  GAZ_CHAUFFAGE: 23260,
} as const;

const MOTIFS_LABELS: Record<keyof TarifSocialInput, string> = {
  bim: "Statut BIM (Intervention Majorée)",
  ris: "Revenu d'Intégration Sociale (RIS)",
  grapa: "GRAPA (Garantie de Revenus Aux Personnes Âgées)",
  handicap: "Allocation aux personnes handicapées",
  aideEquivalente: "Aide sociale équivalente du CPAS",
  logementSocial: "Locataire d'un logement social agréé",
  // Champs non-statut, jamais affichés comme motif.
  consoElecKwh: "",
  consoGazKwh: "",
  chauffageElec: "",
};

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

  // --- Éligibilité : au moins UN statut suffit --------------------------
  const statuts = { bim, ris, grapa, handicap, aideEquivalente, logementSocial };
  const motifsEligibilite: string[] = [];
  for (const [key, actif] of Object.entries(statuts)) {
    if (actif) motifsEligibilite.push(MOTIFS_LABELS[key as keyof TarifSocialInput]);
  }
  const eligible = motifsEligibilite.length > 0;

  // --- Estimation du gain (qu'on calcule même si pas éligible, comme
  //     "ce que vous pourriez économiser") ------------------------------
  const coutStandardElec = consoElecKwh * TARIFS_2026.ELEC_STANDARD;
  const coutSocialElec = consoElecKwh * TARIFS_2026.ELEC_SOCIAL;
  const gainElec = coutStandardElec - coutSocialElec;

  const coutStandardGaz = consoGazKwh * TARIFS_2026.GAZ_STANDARD;
  const coutSocialGaz = consoGazKwh * TARIFS_2026.GAZ_SOCIAL;
  const gainGaz = coutStandardGaz - coutSocialGaz;

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
  };
}
