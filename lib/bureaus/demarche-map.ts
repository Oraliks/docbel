import type { OfficeType } from './finder-model'

/** Démarches câblées (Pension exclue faute de données — cf. plan). Santé =
 * famille MUTUELLE (mutuelles + CAAMI), résolue par CP comme les autres. */
export type Demarche = 'chomage' | 'aide_sociale' | 'documents_communaux' | 'emploi' | 'sante' | 'inconnu'

export const DEMARCHE_ORDER: Demarche[] = [
  'chomage', 'aide_sociale', 'documents_communaux', 'emploi', 'sante', 'inconnu',
]

/** Correspondance démarche → familles d'organismes + présentation.
 * `officeTypes: 'all'` = ne filtre pas (choix « Je ne sais pas »). */
export const DEMARCHE_META: Record<Demarche, { labelKey: string; icon: string; officeTypes: OfficeType[] | 'all' }> = {
  chomage:            { labelKey: 'demarcheChomage',   icon: 'Landmark',      officeTypes: ['ONEM', 'PAIEMENT'] },
  aide_sociale:       { labelKey: 'demarcheAideSociale', icon: 'HeartHandshake', officeTypes: ['CPAS'] },
  documents_communaux:{ labelKey: 'demarcheDocuments', icon: 'Building2',     officeTypes: ['COMMUNE'] },
  emploi:             { labelKey: 'demarcheEmploi',    icon: 'Briefcase',     officeTypes: ['SRE'] },
  sante:              { labelKey: 'demarcheSante',     icon: 'HeartPulse',    officeTypes: ['MUTUELLE'] },
  inconnu:            { labelKey: 'demarcheInconnu',   icon: 'HelpCircle',    officeTypes: 'all' },
}

export function demarcheToOfficeTypes(d: Demarche): OfficeType[] | 'all' {
  return DEMARCHE_META[d].officeTypes
}
