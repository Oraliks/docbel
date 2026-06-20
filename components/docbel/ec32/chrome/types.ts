// =====================================================================
//  eC3.2 — Types locaux du sous-système « chrome » pédagogique.
// ---------------------------------------------------------------------
//  NOTE : ces types sont volontairement *autonomes* — ils ne dépendent
//  pas de `lib/ec32/types` pour rester strictement UI et permettre
//  une démo isolée (données fictives, anonymisées).
// =====================================================================

/** Employeur fictif affiché dans la liste "Mes employeurs". */
export interface Ec32ChromeEmployer {
  /** Identifiant interne stable (slug / uuid). */
  id: string
  /** Raison sociale, ex. « Docbel Entreprise ». */
  name: string
  /** Numéro d'entreprise belge formaté, ex. « 0123.456.789 ». */
  enterpriseNumber: string
  /** Date de début d'emploi (ISO court, yyyy-mm-dd). */
  employmentSince: string
}

/** Carte mensuelle de contrôle (un mois = une carte). */
export interface Ec32ChromeMonthCard {
  /** Clé canonique du mois, format yyyy-mm (sert d'identifiant unique). */
  key: string
  /** Libellé affiché, ex. « JUILLET 2026 » (déjà en majuscules). */
  label: string
  /** Indique si la carte est archivée (filtre d'onglet). */
  archived?: boolean
}
