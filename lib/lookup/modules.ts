/**
 * Modules ONEM — chaque "module" correspond à un écran/cadre du logiciel
 * services.onem.be (ex: S01 = signalétique du chômeur, S02 = dispenses,
 * S10 = sanctions). Le `prefix` d'une LookupTable indique à quel module
 * elle se rattache, ce qui permet de grouper les tables par contexte
 * fonctionnel dans l'UI (picker partenaire + bandeau d'anatomie).
 *
 * Source : titres des sections sur services.onem.be/lookupweb +
 * nomenclature partagée par l'utilisateur (expert chômage).
 */

export interface ModuleInfo {
  /** Identifiant court affiché en badge (ex: "S01", "G"). */
  prefix: string
  /** Nom court du module (ex: "Signalétique"). */
  label: string
  /** Phrase complète pour le hover / le bandeau anatomy. */
  description: string
  /** Ordre d'affichage dans le picker (croissant). */
  order: number
}

export const MODULES: ModuleInfo[] = [
  // ─── S-flows ONEM (ordre fonctionnel : signalétique → décision) ─────
  { prefix: 'S01', label: 'Signalétique',         description: 'Signalétique du chômeur (NISS, nom, prénom, date de naissance…)', order: 1 },
  { prefix: 'S02', label: 'Dispenses',            description: 'Dispenses (formation, recherche d\'emploi…)',                      order: 2 },
  { prefix: 'S04', label: 'Admissibilité',        description: 'Admissibilité aux allocations',                                    order: 4 },
  { prefix: 'S04/S36', label: 'Admissibilité / Complément', description: 'Articles d\'admission et d\'indemnisation (S04 + S36)',  order: 5 },
  { prefix: 'S05', label: 'Retenue',              description: 'Retenues sur allocations',                                         order: 6 },
  { prefix: 'S07', label: "Données d'occupation", description: "Données d'occupation (ONSS, contrats)",                            order: 7 },
  { prefix: 'S10', label: 'Sanction',             description: 'Sanctions (suspensions, exclusions)',                              order: 10 },
  { prefix: 'S11', label: 'Hors chômage',         description: 'Périodes hors chômage (maladie, vacances…)',                       order: 11 },
  { prefix: 'S15', label: 'Récupération',         description: 'Récupération des indus',                                           order: 15 },
  { prefix: 'S16', label: 'Article spécial',      description: "Article d'indemnisation spécial",                                  order: 16 },
  { prefix: 'S17', label: 'Taux de change',       description: 'Supplément taux de change',                                        order: 17 },
  { prefix: 'S24', label: 'Traitement C9',        description: 'Traitement du formulaire C9 (décision DISPO)',                     order: 24 },
  { prefix: 'S25', label: 'RCC',                  description: "Chômage avec complément d'entreprise (ex-prépension)",             order: 25 },
  { prefix: 'S26', label: 'ALE / PWA',            description: "Agence locale pour l'emploi",                                      order: 26 },
  { prefix: 'S27', label: 'Données ONSS',         description: 'Données R.S.Z. / ONSS',                                            order: 27 },
  { prefix: 'S29', label: 'Activation',           description: 'Activation des allocations de chômage',                            order: 29 },
  { prefix: 'S31', label: 'Attestations',         description: 'Attestations (S31)',                                               order: 31 },
  { prefix: 'S38', label: 'DISPO',                description: 'Suivi de la disponibilité (DISPO)',                                order: 38 },
  { prefix: 'S42', label: "Suivi d'enquête",      description: "Suivi du dossier d'enquête",                                       order: 42 },
  { prefix: 'S43', label: 'Info régions',         description: 'Suivi info régions (VDAB / Forem / Actiris)',                      order: 43 },
  { prefix: 'S47', label: 'Accueil',              description: 'Écran d\'accueil',                                                  order: 47 },
  { prefix: 'S52', label: 'Décisions négatives',  description: 'Décisions négatives',                                              order: 52 },

  // ─── Autres modules (hors S-flows) ───────────────────────────────────
  { prefix: 'A27',  label: 'Périodes assimilées',     description: 'Périodes assimilées (A27)',                                    order: 200 },
  { prefix: 'H33',  label: 'Documents scannés',        description: 'Catégories de documents scannés (H33)',                       order: 210 },
  { prefix: 'TW',   label: 'Chômage temporaire',       description: 'Chômage temporaire (force majeure, économique…)',             order: 220 },
  { prefix: 'V',    label: 'Vérification',             description: 'Vérification des déclarations',                                order: 230 },
  { prefix: 'DMFA', label: 'DmfA',                     description: 'Déclaration multifonctionnelle ONSS (DmfA)',                  order: 240 },
  { prefix: 'DRS',  label: 'DRS',                      description: 'Déclaration des Risques Sociaux',                              order: 250 },
  { prefix: 'G',    label: 'Référentiels généraux',    description: 'Référentiels transversaux (bureaux, communes, codes postaux…)', order: 900 },
  { prefix: 'S',    label: 'Divers (S-flows)',         description: 'Tables S-flows non rattachées à un module précis',            order: 950 },
]

const BY_PREFIX = new Map(MODULES.map((m) => [m.prefix, m]))

/** Renvoie les infos du module pour un prefix donné, ou un fallback générique. */
export function getModuleInfo(prefix: string): ModuleInfo {
  return (
    BY_PREFIX.get(prefix) ?? {
      prefix,
      label: prefix,
      description: prefix,
      order: 999,
    }
  )
}
