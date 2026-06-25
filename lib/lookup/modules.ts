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
  /** Clé i18n optionnelle pour `label` (namespace `public.lookupLib.modules.{KEY}.label`). */
  labelKey?: string
  /** Phrase complète pour le hover / le bandeau anatomy. */
  description: string
  /** Clé i18n optionnelle pour `description` (namespace `public.lookupLib.modules.{KEY}.description`). */
  descriptionKey?: string
  /** Ordre d'affichage dans le picker (croissant). */
  order: number
}

export const MODULES: ModuleInfo[] = [
  // ─── S-flows ONEM (ordre fonctionnel : signalétique → décision) ─────
  { prefix: 'S01', label: 'Signalétique',         labelKey: 'public.lookupLib.modules.S01.label',     description: 'Signalétique du chômeur (NISS, nom, prénom, date de naissance…)', descriptionKey: 'public.lookupLib.modules.S01.description', order: 1 },
  { prefix: 'S02', label: 'Dispenses',            labelKey: 'public.lookupLib.modules.S02.label',     description: 'Dispenses (formation, recherche d\'emploi…)',                      descriptionKey: 'public.lookupLib.modules.S02.description', order: 2 },
  { prefix: 'S04', label: 'Admissibilité',        labelKey: 'public.lookupLib.modules.S04.label',     description: 'Admissibilité aux allocations',                                    descriptionKey: 'public.lookupLib.modules.S04.description', order: 4 },
  { prefix: 'S04/S36', label: 'Admissibilité / Complément', labelKey: 'public.lookupLib.modules.S04_S36.label', description: 'Articles d\'admission et d\'indemnisation (S04 + S36)',  descriptionKey: 'public.lookupLib.modules.S04_S36.description', order: 5 },
  { prefix: 'S05', label: 'Retenue',              labelKey: 'public.lookupLib.modules.S05.label',     description: 'Retenues sur allocations',                                         descriptionKey: 'public.lookupLib.modules.S05.description', order: 6 },
  { prefix: 'S07', label: "Données d'occupation", labelKey: 'public.lookupLib.modules.S07.label',     description: "Données d'occupation (ONSS, contrats)",                            descriptionKey: 'public.lookupLib.modules.S07.description', order: 7 },
  { prefix: 'S10', label: 'Sanction',             labelKey: 'public.lookupLib.modules.S10.label',     description: 'Sanctions (suspensions, exclusions)',                              descriptionKey: 'public.lookupLib.modules.S10.description', order: 10 },
  { prefix: 'S11', label: 'Hors chômage',         labelKey: 'public.lookupLib.modules.S11.label',     description: 'Périodes hors chômage (maladie, vacances…)',                       descriptionKey: 'public.lookupLib.modules.S11.description', order: 11 },
  { prefix: 'S15', label: 'Récupération',         labelKey: 'public.lookupLib.modules.S15.label',     description: 'Récupération des indus',                                           descriptionKey: 'public.lookupLib.modules.S15.description', order: 15 },
  { prefix: 'S16', label: 'Article spécial',      labelKey: 'public.lookupLib.modules.S16.label',     description: "Article d'indemnisation spécial",                                  descriptionKey: 'public.lookupLib.modules.S16.description', order: 16 },
  { prefix: 'S17', label: 'Taux de change',       labelKey: 'public.lookupLib.modules.S17.label',     description: 'Supplément taux de change',                                        descriptionKey: 'public.lookupLib.modules.S17.description', order: 17 },
  { prefix: 'S24', label: 'Traitement C9',        labelKey: 'public.lookupLib.modules.S24.label',     description: 'Traitement du formulaire C9 (décision DISPO)',                     descriptionKey: 'public.lookupLib.modules.S24.description', order: 24 },
  { prefix: 'S25', label: 'RCC',                  labelKey: 'public.lookupLib.modules.S25.label',     description: "Chômage avec complément d'entreprise (ex-prépension)",             descriptionKey: 'public.lookupLib.modules.S25.description', order: 25 },
  { prefix: 'S26', label: 'ALE / PWA',            labelKey: 'public.lookupLib.modules.S26.label',     description: "Agence locale pour l'emploi",                                      descriptionKey: 'public.lookupLib.modules.S26.description', order: 26 },
  { prefix: 'S27', label: 'Données ONSS',         labelKey: 'public.lookupLib.modules.S27.label',     description: 'Données R.S.Z. / ONSS',                                            descriptionKey: 'public.lookupLib.modules.S27.description', order: 27 },
  { prefix: 'S29', label: 'Activation',           labelKey: 'public.lookupLib.modules.S29.label',     description: 'Activation des allocations de chômage',                            descriptionKey: 'public.lookupLib.modules.S29.description', order: 29 },
  { prefix: 'S31', label: 'Attestations',         labelKey: 'public.lookupLib.modules.S31.label',     description: 'Attestations (S31)',                                               descriptionKey: 'public.lookupLib.modules.S31.description', order: 31 },
  { prefix: 'S38', label: 'DISPO',                labelKey: 'public.lookupLib.modules.S38.label',     description: 'Suivi de la disponibilité (DISPO)',                                descriptionKey: 'public.lookupLib.modules.S38.description', order: 38 },
  { prefix: 'S42', label: "Suivi d'enquête",      labelKey: 'public.lookupLib.modules.S42.label',     description: "Suivi du dossier d'enquête",                                       descriptionKey: 'public.lookupLib.modules.S42.description', order: 42 },
  { prefix: 'S43', label: 'Info régions',         labelKey: 'public.lookupLib.modules.S43.label',     description: 'Suivi info régions (VDAB / Forem / Actiris)',                      descriptionKey: 'public.lookupLib.modules.S43.description', order: 43 },
  { prefix: 'S47', label: 'Accueil',              labelKey: 'public.lookupLib.modules.S47.label',     description: 'Écran d\'accueil',                                                  descriptionKey: 'public.lookupLib.modules.S47.description', order: 47 },
  { prefix: 'S52', label: 'Décisions négatives',  labelKey: 'public.lookupLib.modules.S52.label',     description: 'Décisions négatives',                                              descriptionKey: 'public.lookupLib.modules.S52.description', order: 52 },

  // ─── Autres modules (hors S-flows) ───────────────────────────────────
  { prefix: 'A27',  label: 'Périodes assimilées',     labelKey: 'public.lookupLib.modules.A27.label',  description: 'Périodes assimilées (A27)',                                    descriptionKey: 'public.lookupLib.modules.A27.description',  order: 200 },
  { prefix: 'H33',  label: 'Documents scannés',        labelKey: 'public.lookupLib.modules.H33.label',  description: 'Catégories de documents scannés (H33)',                       descriptionKey: 'public.lookupLib.modules.H33.description',  order: 210 },
  { prefix: 'TW',   label: 'Chômage temporaire',       labelKey: 'public.lookupLib.modules.TW.label',   description: 'Chômage temporaire (force majeure, économique…)',             descriptionKey: 'public.lookupLib.modules.TW.description',   order: 220 },
  { prefix: 'V',    label: 'Vérification',             labelKey: 'public.lookupLib.modules.V.label',    description: 'Vérification des déclarations',                                descriptionKey: 'public.lookupLib.modules.V.description',    order: 230 },
  { prefix: 'DMFA', label: 'DmfA',                     labelKey: 'public.lookupLib.modules.DMFA.label', description: 'Déclaration multifonctionnelle ONSS (DmfA)',                  descriptionKey: 'public.lookupLib.modules.DMFA.description', order: 240 },
  { prefix: 'DRS',  label: 'DRS',                      labelKey: 'public.lookupLib.modules.DRS.label',  description: 'Déclaration des Risques Sociaux',                              descriptionKey: 'public.lookupLib.modules.DRS.description',  order: 250 },
  { prefix: 'G',    label: 'Référentiels généraux',    labelKey: 'public.lookupLib.modules.G.label',    description: 'Référentiels transversaux (bureaux, communes, codes postaux…)', descriptionKey: 'public.lookupLib.modules.G.description',  order: 900 },
  { prefix: 'S',    label: 'Divers (S-flows)',         labelKey: 'public.lookupLib.modules.S.label',    description: 'Tables S-flows non rattachées à un module précis',            descriptionKey: 'public.lookupLib.modules.S.description',    order: 950 },
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
