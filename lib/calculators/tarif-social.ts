/**
 * Tarif social fédéral énergie (électricité + gaz naturel) — version 2026.
 *
 * Sources officielles (uniquement organismes publics de l'État belge) :
 *  - CREG (Commission de Régulation de l'Électricité et du Gaz) — creg.be
 *    Notes trimestrielles fixant les prix maximaux sociaux (note Z3153 pour
 *    Q1 2026 ; mise à jour chaque trimestre).
 *  - SPF Économie — economie.fgov.be (liste officielle des bénéficiaires).
 *  - Moniteur belge — AR du 29 mars 2012 (catégories de bénéficiaires) et
 *    AR du 28 juin 2009 (encadrement des tarifs sociaux).
 *
 * Principe :
 *  Certains ménages bénéficient automatiquement du tarif social fédéral, soit
 *  le tarif commercial le plus bas du marché belge (calculé chaque trimestre
 *  par la CREG). Application automatique depuis 2010, vérifiée 4× par an par
 *  croisement de bases de données — aucune démarche à effectuer.
 *
 * Bénéficiaires automatiques (au moins UN suffit) — situation 2026 :
 *  - RIS (Revenu d'Intégration Sociale) accordé par le CPAS
 *  - GRAPA (Garantie de Revenus Aux Personnes Âgées) versée par le SFP
 *  - Allocation aux personnes handicapées (DG HAN du SPF Sécurité Sociale)
 *  - Aide sociale équivalente accordée par le CPAS
 *  - Allocation pour l'aide aux personnes âgées (APA)
 *  - Allocations familiales supplémentaires (enfant handicapé)
 *  - Locataire d'un logement social agréé (immeuble chauffé au gaz naturel
 *    via une installation collective ou raccordement individuel)
 *
 * IMPORTANT — Statut BIM :
 *  L'extension provisoire aux Bénéficiaires de l'Intervention Majorée (BIM)
 *  introduite pendant la crise énergétique de 2021 a pris fin le 30 juin 2023.
 *  Depuis le 1er juillet 2023, le statut BIM ne suffit plus pour l'application
 *  automatique du tarif social fédéral. Le BIM peut toutefois rester un
 *  indicateur d'éligibilité à d'autres mesures sociales régionales.
 *
 * Plafonds de consommation :
 *  Les plafonds appliqués ici reflètent l'usage technique d'« habitation
 *  résidentielle normale » communément observé. La législation 2026 n'impose
 *  pas de plafond strict à la portée publique : pour l'immense majorité des
 *  ménages, le tarif social s'applique à toute la consommation. Ce calc
 *  modélise toutefois un excédent éventuel pour donner un ordre de grandeur
 *  réaliste en cas de très forte consommation (>4 600 kWh élec sans chauffage
 *  élec, >23 260 kWh gaz). Les plafonds sont marqués indicatifs.
 *
 * AVERTISSEMENT : les tarifs varient chaque TRIMESTRE.
 *  Q1 2026 (CREG note Z3153, 01.01-31.03) : élec 23,767 c€/kWh, gaz 4,514 c€/kWh.
 *  Q2 2026 (01.04-30.06)                   : élec 23,767 c€/kWh, gaz 4,746 c€/kWh.
 *  Source : CREG — www.creg.be/fr/consommateurs/prix-et-tarifs/tarif-social
 *
 * --- i18n ------------------------------------------------------------------
 * Module PUR (client + serveur). Les chaînes FR (`error`, `motifsEligibilite`,
 * `notes`) restent en source de vérité fallback. Chacune a un jumeau de clé
 * i18n (sous `public.calculatorsLib.tarifSocial.*`) :
 *   - `errorKey` parallèle à `error`
 *   - `motifsEligibiliteKeys[]` parallèle à `motifsEligibilite[]`
 *   - `notesKeys[]` parallèle à `notes[]`
 * À résoudre côté composant via `t(key as Parameters<typeof t>[0])`.
 */

export interface TarifSocialInput {
  /** Bénéficiaire de l'Intervention Majorée — n'est plus éligible en 2026. */
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
  /** Liste lisible des statuts qui ouvrent le droit (FR — fallback). */
  motifsEligibilite: string[];
  /**
   * Clés i18n (sous `public.calculatorsLib`) parallèles à `motifsEligibilite`.
   * À résoudre côté composant via `t(key as Parameters<typeof t>[0])`.
   */
  motifsEligibiliteKeys: string[];
  /** Notes pédagogiques additionnelles (ex: BIM seul ne suffit plus) — FR fallback. */
  notes: string[];
  /**
   * Clés i18n (sous `public.calculatorsLib`) parallèles à `notes`.
   * À résoudre côté composant via `t(key as Parameters<typeof t>[0])`.
   */
  notesKeys: string[];
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
 * Tarifs CREG 2026, en €/kWh, tout inclus TVAC (énergie + transport +
 * distribution + taxes + TVA 6 % sur le social, ~21 % en moyenne sur le
 * standard).
 *
 * SOURCES OFFICIELLES :
 *  - CREG (Commission de Régulation de l'Électricité et du Gaz)
 *  - Élec Q1+Q2 2026 monohoraire : 23,767 c€/kWh (TVA 6 % incluse)
 *  - Gaz Q1 2026 : 4,514 c€/kWh ; Q2 2026 : 4,746 c€/kWh (+5,14 %)
 *
 * Le tarif standard moyen national est calculé à partir des observatoires
 * CREG (fourchette résidentielle 0,30-0,40 €/kWh élec et 0,06-0,11 €/kWh gaz
 * selon les composantes régionales et trimestrielles).
 */
export const TARIFS_2026 = {
  /**
   * Tarif social électricité monohoraire — uniforme partout en Belgique.
   * Q2 2026 : 23,767 c€/kWh TVAC (CREG, 01.04-30.06).
   * Tarif recalculé chaque trimestre par la CREG (article 4 AR 28.06.2009).
   */
  ELEC_SOCIAL: 0.23767,
  /**
   * Tarif standard moyen électricité (moyenne nationale résidentielle 2026,
   * TVAC, observatoire CREG). Utilisé comme référence pour calculer le gain.
   */
  ELEC_STANDARD: 0.35,
  /**
   * Tarif social gaz naturel — Q2 2026 : 4,746 c€/kWh TVAC.
   * Source : CREG (note trimestrielle).
   */
  GAZ_SOCIAL: 0.04746,
  /**
   * Tarif standard moyen gaz naturel (moyenne nationale résidentielle 2026,
   * TVAC). Référence pour calculer le gain.
   */
  GAZ_STANDARD: 0.105,
} as const;

/**
 * Plafonds techniques indicatifs au-delà desquels une partie de la conso
 * peut être facturée au tarif standard (anti-abus pour les très gros
 * consommateurs). Pour 95 % des ménages, ces plafonds ne sont jamais
 * atteints et le tarif social s'applique à toute la consommation.
 */
export const PLAFONDS_2026 = {
  /** Électricité base (sans chauffage élec). */
  ELEC_BASE: 1800,
  /** Électricité avec chauffage élec. */
  ELEC_CHAUFFAGE: 4600,
  /** Par personne supplémentaire dans le ménage (au-delà de la première). */
  ELEC_PAR_PERSONNE: 200,
  /** Gaz sans chauffage gaz (cuisine + eau chaude). */
  GAZ_NON_CHAUFFAGE: 12000,
  /** Gaz avec chauffage gaz (cas le plus courant). */
  GAZ_CHAUFFAGE: 23260,
} as const;

const MOTIFS_LABELS: Record<string, string> = {
  ris: "Revenu d'Intégration Sociale (RIS)",
  grapa: "GRAPA (Garantie de Revenus Aux Personnes Âgées)",
  handicap: "Allocation aux personnes handicapées (DG HAN)",
  aideEquivalente: "Aide sociale équivalente du CPAS",
  logementSocial: "Locataire d'un logement social agréé",
};

/**
 * Clés i18n (sous `public.calculatorsLib`) jumelles de `MOTIFS_LABELS`.
 * À résoudre côté composant via `t(key as Parameters<typeof t>[0])`.
 */
const MOTIFS_LABEL_KEYS: Record<string, string> = {
  ris: "tarifSocial.motifs.ris",
  grapa: "tarifSocial.motifs.grapa",
  handicap: "tarifSocial.motifs.handicap",
  aideEquivalente: "tarifSocial.motifs.aideEquivalente",
  logementSocial: "tarifSocial.motifs.logementSocial",
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
      errorKey: "tarifSocial.errors.consoElec",
    } as { error: string; errorKey: string };
  }
  if (
    !Number.isFinite(consoGazKwh) ||
    consoGazKwh < 0 ||
    consoGazKwh >= 100000
  ) {
    return {
      error:
        "La consommation de gaz doit être comprise entre 0 et 100 000 kWh (0 si pas de gaz).",
      errorKey: "tarifSocial.errors.consoGaz",
    } as { error: string; errorKey: string };
  }
  if (
    !Number.isFinite(tailleMenage) ||
    tailleMenage < 1 ||
    tailleMenage > 15
  ) {
    return {
      error: "La taille du ménage doit être comprise entre 1 et 15 personnes.",
      errorKey: "tarifSocial.errors.tailleMenage",
    } as { error: string; errorKey: string };
  }

  // --- Éligibilité automatique : au moins UN statut éligible suffit -----
  // ATTENTION : le BIM seul n'ouvre PLUS droit au tarif social depuis le
  // 01.07.2023. Il est ici accepté en entrée pour informer l'utilisateur
  // mais ne compte pas comme motif d'éligibilité.
  const statuts: Record<string, boolean> = {
    ris,
    grapa,
    handicap,
    aideEquivalente,
    logementSocial,
  };
  const motifsEligibilite: string[] = [];
  const motifsEligibiliteKeys: string[] = [];
  for (const [key, actif] of Object.entries(statuts)) {
    if (actif) {
      motifsEligibilite.push(MOTIFS_LABELS[key]);
      motifsEligibiliteKeys.push(MOTIFS_LABEL_KEYS[key]);
    }
  }
  const eligible = motifsEligibilite.length > 0;

  const notes: string[] = [];
  const notesKeys: string[] = [];
  if (bim && !eligible) {
    notes.push(
      "Le statut BIM seul n'ouvre plus le droit au tarif social automatique " +
        "depuis le 1ᵉʳ juillet 2023 (fin de l'extension crise énergétique). " +
        "Vous pouvez toutefois bénéficier d'aides régionales (prime énergie, " +
        "fonds gaz/élec) ou contacter votre CPAS.",
    );
    notesKeys.push("tarifSocial.notes.bimNotEligible");
  } else if (bim && eligible) {
    notes.push(
      "Note : votre statut BIM ne suffit plus seul depuis le 1ᵉʳ juillet " +
        "2023, mais l'un de vos autres statuts ouvre bien le droit.",
    );
    notesKeys.push("tarifSocial.notes.bimEligible");
  }

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
    motifsEligibiliteKeys,
    notes,
    notesKeys,
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
