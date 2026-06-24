// =====================================================================
//  eC3.2 — Contenu par défaut des situations encodables (pur, server-safe)
// ---------------------------------------------------------------------
//  Transcription fidèle et pédagogique des 10 types de situation d'une
//  case du calendrier eC3.2, dans l'ordre de l'enum `EC32_SITUATION_TYPES`.
//  Chaque entrée respecte le type `Ec32SituationContent` dérivé du schéma
//  Zod (`@/lib/ec32/schema`). AUCUNE dépendance React : ce module est
//  importable côté serveur (contenu par défaut, validation) comme côté
//  client (simulateur). SIMULATION NON OFFICIELLE — textes pédagogiques,
//  ne remplacent pas le manuel ni les instructions de l'ONEM.
// =====================================================================

import type { Ec32SituationContent } from '@/lib/ec32/schema'

/**
 * Contenu par défaut des 10 situations, dans l'ordre exact de
 * `EC32_SITUATION_TYPES`. Les 8 premières sont sélectionnables ;
 * `not_applicable` et `first_effective_unemployment_day` sont automatiques.
 */
export const ec32DefaultSituations: Ec32SituationContent[] = [
  {
    type: 'temporary_unemployment',
    label: 'Chômage temporaire',
    labelKey: 'public.ec32Content.situations.temporary_unemployment.label',
    shortLabel: 'Chômage',
    shortLabelKey: 'public.ec32Content.situations.temporary_unemployment.shortLabel',
    description:
      'Situation par défaut. Vous ne devez rien indiquer si vous êtes effectivement en chômage temporaire ce jour-là.',
    descriptionKey: 'public.ec32Content.situations.temporary_unemployment.description',
    examples: [
      'Jours où vous êtes chômeur temporaire',
      'Jours sans travail dus à un crédit-temps ou une interruption de carrière',
      'Jours où vous ne travaillez habituellement pas chez cet employeur (certains week-ends, jours d’inactivité habituels)',
    ],
    examplesKey: 'public.ec32Content.situations.temporary_unemployment.examples',
    warning: 'Si vous travaillez ailleurs pendant ces jours, vous devez l’indiquer.',
    warningKey: 'public.ec32Content.situations.temporary_unemployment.warning',
    helpDetail:
      'Par défaut, toutes les cases du calendrier sont déjà sur « Chômage ». Vous n’avez donc rien à encoder pour ces jours : il suffit de modifier uniquement les jours qui correspondent à une autre situation (travail, inaptitude, vacances, etc.).',
    helpDetailKey: 'public.ec32Content.situations.temporary_unemployment.helpDetail',
  },
  {
    type: 'work_own_employer',
    label: 'Travail chez l’employeur',
    labelKey: 'public.ec32Content.situations.work_own_employer.label',
    shortLabel: 'Travail (employeur)',
    shortLabelKey: 'public.ec32Content.situations.work_own_employer.shortLabel',
    description:
      'À choisir lorsque vous travaillez chez l’employeur pour lequel vous remplissez la carte. À indiquer aussi si ce travail est effectué le week-end ou un jour habituel d’inactivité chez cet employeur.',
    descriptionKey: 'public.ec32Content.situations.work_own_employer.description',
    examples: [
      'Jour travaillé chez l’employeur qui remplit la carte',
      'Travail le week-end chez cet employeur',
      'Travail un jour habituel d’inactivité chez cet employeur',
    ],
    examplesKey: 'public.ec32Content.situations.work_own_employer.examples',
    warning: 'Le travail doit être enregistré AVANT de commencer à travailler.',
    warningKey: 'public.ec32Content.situations.work_own_employer.warning',
    helpDetail:
      'Pour un travail de nuit, indiquez le jour où l’activité commence. Le travail de nuit est une prestation entre 20 h et 6 h. Si la prestation compte plus d’heures qu’un jour normal de travail, deux cases doivent être indiquées.',
    helpDetailKey: 'public.ec32Content.situations.work_own_employer.helpDetail',
  },
  {
    type: 'work_elsewhere_usual_day',
    label: 'Travail ailleurs — jour normalement travaillé',
    labelKey: 'public.ec32Content.situations.work_elsewhere_usual_day.label',
    shortLabel: 'Ailleurs (jour travaillé)',
    shortLabelKey: 'public.ec32Content.situations.work_elsewhere_usual_day.shortLabel',
    description:
      'À choisir lorsque vous travaillez ailleurs un jour où vous travaillez normalement pour l’employeur habituel.',
    descriptionKey: 'public.ec32Content.situations.work_elsewhere_usual_day.description',
    examples: [
      'Autre employeur non habituel',
      'Flexi-job',
      'Travail pour son propre compte',
      'Travail pour un tiers',
      'Activité occasionnelle',
      'Activité accessoire acceptée par l’ONEM entre 7 h et 18 h',
    ],
    examplesKey: 'public.ec32Content.situations.work_elsewhere_usual_day.examples',
    warning: 'À enregistrer avant de commencer à travailler.',
    warningKey: 'public.ec32Content.situations.work_elsewhere_usual_day.warning',
    helpDetail:
      'Exceptions : l’activité accessoire dans le cadre de la mesure Tremplin-indépendants ne doit pas être mentionnée ; pour les travailleurs des arts (chapitre XII), certaines activités propres, accessoires ou occasionnelles non rémunérées ne doivent pas être mentionnées.',
    helpDetailKey: 'public.ec32Content.situations.work_elsewhere_usual_day.helpDetail',
  },
  {
    type: 'work_elsewhere_non_usual_day',
    label: 'Travail ailleurs — jour normalement non travaillé',
    labelKey: 'public.ec32Content.situations.work_elsewhere_non_usual_day.label',
    shortLabel: 'Ailleurs (jour non travaillé)',
    shortLabelKey: 'public.ec32Content.situations.work_elsewhere_non_usual_day.shortLabel',
    description:
      'À choisir lorsque vous travaillez ailleurs un jour où vous ne travaillez normalement pas pour l’employeur habituel.',
    descriptionKey: 'public.ec32Content.situations.work_elsewhere_non_usual_day.description',
    examples: [
      'Week-end',
      'Jour habituel d’inactivité',
      'Autre employeur non habituel',
      'Flexi-job',
      'Travail pour son propre compte',
      'Travail pour un tiers',
      'Activité occasionnelle',
      'Activité accessoire acceptée par l’ONEM, quel que soit le moment',
    ],
    examplesKey: 'public.ec32Content.situations.work_elsewhere_non_usual_day.examples',
    warning: 'À enregistrer avant de commencer à travailler.',
    warningKey: 'public.ec32Content.situations.work_elsewhere_non_usual_day.warning',
    helpDetail:
      'Exceptions : l’activité accessoire dans le cadre de la mesure Tremplin-indépendants ne doit pas être mentionnée ; pour les travailleurs des arts (chapitre XII), certaines activités propres, accessoires ou occasionnelles non rémunérées ne doivent pas être mentionnées.',
    helpDetailKey: 'public.ec32Content.situations.work_elsewhere_non_usual_day.helpDetail',
  },
  {
    type: 'work_other_regular_employer',
    label: 'Travail auprès d’un autre employeur habituel',
    labelKey: 'public.ec32Content.situations.work_other_regular_employer.label',
    shortLabel: 'Autre employeur habituel',
    shortLabelKey: 'public.ec32Content.situations.work_other_regular_employer.shortLabel',
    description:
      'Vous combinez deux emplois à temps partiel de longue durée. Ce cas ne concerne ni le flexi-job ni l’activité indépendante.',
    descriptionKey: 'public.ec32Content.situations.work_other_regular_employer.description',
    examples: [
      'Second emploi à temps partiel de longue durée',
      'Combinaison de deux occupations habituelles à temps partiel',
    ],
    examplesKey: 'public.ec32Content.situations.work_other_regular_employer.examples',
    warning: 'À enregistrer avant de commencer à travailler.',
    warningKey: 'public.ec32Content.situations.work_other_regular_employer.warning',
    helpDetail:
      'Vous devez informer votre organisme de paiement de cette autre occupation.',
    helpDetailKey: 'public.ec32Content.situations.work_other_regular_employer.helpDetail',
  },
  {
    type: 'incapacity',
    label: 'Inaptitude au travail',
    labelKey: 'public.ec32Content.situations.incapacity.label',
    shortLabel: 'Inaptitude',
    shortLabelKey: 'public.ec32Content.situations.incapacity.shortLabel',
    description:
      'À choisir en cas de maladie, d’accident du travail ou de repos d’accouchement. Incluez aussi les samedis, dimanches et jours fériés si ces jours font partie de la période d’inaptitude.',
    descriptionKey: 'public.ec32Content.situations.incapacity.description',
    examples: ['Maladie', 'Accident du travail', 'Repos d’accouchement'],
    examplesKey: 'public.ec32Content.situations.incapacity.examples',
    warning: 'Prévenez votre mutualité dans les 48 heures.',
    warningKey: 'public.ec32Content.situations.incapacity.warning',
    helpDetail:
      'Indiquez « Inaptitude au travail » pour toute la période concernée, y compris les jours non travaillés (week-ends et jours fériés) qui tombent à l’intérieur de cette période.',
    helpDetailKey: 'public.ec32Content.situations.incapacity.helpDetail',
  },
  {
    type: 'vacation',
    label: 'Vacances',
    labelKey: 'public.ec32Content.situations.vacation.label',
    shortLabel: 'Vacances',
    shortLabelKey: 'public.ec32Content.situations.vacation.shortLabel',
    description:
      'À choisir pour les jours de vacances annuelles individuelles ou pendant une fermeture collective pour vacances annuelles, que les jours soient couverts ou non par un pécule de vacances.',
    descriptionKey: 'public.ec32Content.situations.vacation.description',
    examples: [
      'Vacances annuelles individuelles',
      'Fermeture collective pour vacances annuelles',
    ],
    examplesKey: 'public.ec32Content.situations.vacation.examples',
    warning: '',
    warningKey: 'public.ec32Content.situations.vacation.warning',
    helpDetail:
      'Force majeure médicale : en cas de reprise progressive à temps partiel autorisée par le médecin-conseil, indiquez aussi « Vacances » pour les jours de vacances pris. Les congés extralégaux ne doivent pas nécessairement être épuisés pendant la fermeture collective ; s’ils le sont, indiquez-les comme « Autre situation ».',
    helpDetailKey: 'public.ec32Content.situations.vacation.helpDetail',
  },
  {
    type: 'other',
    label: 'Autre situation',
    labelKey: 'public.ec32Content.situations.other.label',
    shortLabel: 'Autre',
    shortLabelKey: 'public.ec32Content.situations.other.shortLabel',
    description:
      'À choisir pour les jours sans prestation mais couverts par une autre situation.',
    descriptionKey: 'public.ec32Content.situations.other.description',
    examples: [
      'Jour férié',
      'Repos compensatoire',
      'Formation rémunérée',
      'Journée couverte par une indemnité en compensation du licenciement',
      'Congé sans solde',
      'Absence injustifiée',
      'Détention',
      'Congé de paternité',
      'Congé extralégal pendant une fermeture collective pour vacances annuelles',
    ],
    examplesKey: 'public.ec32Content.situations.other.examples',
    warning: '',
    warningKey: 'public.ec32Content.situations.other.warning',
    helpDetail: '',
    helpDetailKey: 'public.ec32Content.situations.other.helpDetail',
  },
  {
    type: 'not_applicable',
    label: 'Pas d’application',
    labelKey: 'public.ec32Content.situations.not_applicable.label',
    shortLabel: 'Grisé',
    shortLabelKey: 'public.ec32Content.situations.not_applicable.shortLabel',
    description:
      'Cases grisées : jours où vous n’êtes pas lié par un contrat de travail auprès de l’employeur choisi (contrat débuté ou terminé en cours de mois), et jours hors du mois sélectionné.',
    descriptionKey: 'public.ec32Content.situations.not_applicable.description',
    examples: [
      'Jours avant le début du contrat dans le mois',
      'Jours après la fin du contrat dans le mois',
      'Jours hors du mois sélectionné',
    ],
    examplesKey: 'public.ec32Content.situations.not_applicable.examples',
    warning: '',
    warningKey: 'public.ec32Content.situations.not_applicable.warning',
    helpDetail:
      'Vous ne pouvez pas encoder ces jours. Cette situation est attribuée automatiquement, vous n’avez rien à faire.',
    helpDetailKey: 'public.ec32Content.situations.not_applicable.helpDetail',
  },
  {
    type: 'first_effective_unemployment_day',
    label: 'Premier jour de chômage effectif',
    labelKey: 'public.ec32Content.situations.first_effective_unemployment_day.label',
    shortLabel: '1er jour effectif',
    shortLabelKey: 'public.ec32Content.situations.first_effective_unemployment_day.shortLabel',
    description:
      'Premier jour de chômage du mois pour l’employeur sélectionné, tel que communiqué par l’employeur à l’ONEM. Apparaît en cas de chômage temporaire pour raisons économiques, intempéries ou accident technique. Pour les autres types, aucune icône n’est affichée.',
    descriptionKey: 'public.ec32Content.situations.first_effective_unemployment_day.description',
    examples: [
      'Chômage temporaire pour raisons économiques',
      'Chômage temporaire pour intempéries',
      'Chômage temporaire pour accident technique',
    ],
    examplesKey: 'public.ec32Content.situations.first_effective_unemployment_day.examples',
    warning:
      'Remplissez la carte à partir du premier jour de chômage effectif jusqu’à la fin du mois. Pour la construction, la carte doit toujours être remplie.',
    warningKey: 'public.ec32Content.situations.first_effective_unemployment_day.warning',
    helpDetail:
      'L’absence de cette icône pendant le premier mois d’utilisation ne bloque pas le fonctionnement de la carte. Cette situation est signalée automatiquement, vous n’avez rien à encoder.',
    helpDetailKey: 'public.ec32Content.situations.first_effective_unemployment_day.helpDetail',
  },
]
