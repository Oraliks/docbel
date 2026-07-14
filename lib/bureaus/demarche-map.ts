import type { OfficeType } from './finder-model'

/** Démarches câblées (Pension/Mutuelle exclues faute de données — cf. plan). */
export type Demarche = 'chomage' | 'aide_sociale' | 'documents_communaux' | 'emploi' | 'inconnu'

export const DEMARCHE_ORDER: Demarche[] = [
  'chomage', 'aide_sociale', 'documents_communaux', 'emploi', 'inconnu',
]

/** Correspondance démarche → familles d'organismes + présentation.
 * `officeTypes: 'all'` = ne filtre pas (choix « Je ne sais pas »). */
export const DEMARCHE_META: Record<Demarche, { labelKey: string; icon: string; officeTypes: OfficeType[] | 'all' }> = {
  chomage:            { labelKey: 'demarcheChomage',   icon: 'Landmark',      officeTypes: ['ONEM', 'PAIEMENT'] },
  aide_sociale:       { labelKey: 'demarcheAideSociale', icon: 'HeartHandshake', officeTypes: ['CPAS'] },
  documents_communaux:{ labelKey: 'demarcheDocuments', icon: 'Building2',     officeTypes: ['COMMUNE'] },
  emploi:             { labelKey: 'demarcheEmploi',    icon: 'Briefcase',     officeTypes: ['SRE'] },
  inconnu:            { labelKey: 'demarcheInconnu',   icon: 'HelpCircle',    officeTypes: 'all' },
}

export function demarcheToOfficeTypes(d: Demarche): OfficeType[] | 'all' {
  return DEMARCHE_META[d].officeTypes
}
