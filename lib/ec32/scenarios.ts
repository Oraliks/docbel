// =====================================================================
//  eC3.2 — Cas pratiques par défaut du simulateur (données pures)
// ---------------------------------------------------------------------
//  14 scénarios pédagogiques chargeables dans le simulateur de la page
//  /onem/ec32. Server-safe : pas de React, simple liste typée par le
//  schéma Zod (`Ec32ScenarioContent`). SIMULATION NON OFFICIELLE :
//  contenus 100 % fictifs, aucun envoi réel à l'ONEM.
//
//  Chaque entrée renseigne : key, title, level, duration, context,
//  objective, expectedAction, feedbackCorrect, feedbackError, ruleRef.
//  L'ordre est intentionnel (du plus simple au plus avancé).
// =====================================================================

import type { Ec32ScenarioContent } from '@/lib/ec32/schema'

export const ec32DefaultScenarios: Ec32ScenarioContent[] = [
  {
    key: 'all-month',
    title: 'Je suis en chômage temporaire tout le mois',
    titleKey: 'public.ec32Content.scenarios.all-month.title',
    level: 'Débutant',
    levelKey: 'public.ec32Content.scenarios.all-month.level',
    duration: '2 min',
    durationKey: 'public.ec32Content.scenarios.all-month.duration',
    context:
      'Votre employeur vous a mis en chômage temporaire pour l’ensemble du mois. Aucun jour de travail, aucune autre situation à signaler.',
    contextKey: 'public.ec32Content.scenarios.all-month.context',
    objective:
      'Comprendre que « Chômage » est la situation par défaut : pour un jour réellement en chômage temporaire, il n’y a rien à modifier.',
    objectiveKey: 'public.ec32Content.scenarios.all-month.objective',
    expectedAction:
      'Ne rien modifier pour les jours réellement en chômage, sauf si une autre situation s’applique.',
    expectedActionKey: 'public.ec32Content.scenarios.all-month.expectedAction',
    feedbackCorrect:
      'Correct : si vous êtes en chômage temporaire ce jour-là, la situation par défaut suffit.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.all-month.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : pour un jour réellement en chômage, la situation par défaut convient déjà. Inutile d’ajouter une autre situation.',
    feedbackErrorKey: 'public.ec32Content.scenarios.all-month.feedbackError',
    ruleRef: 'Situation par défaut',
    ruleRefKey: 'public.ec32Content.scenarios.all-month.ruleRef',
  },
  {
    key: 'work-own',
    title: 'Je travaille un jour chez mon employeur',
    titleKey: 'public.ec32Content.scenarios.work-own.title',
    level: 'Débutant',
    levelKey: 'public.ec32Content.scenarios.work-own.level',
    duration: '3 min',
    durationKey: 'public.ec32Content.scenarios.work-own.duration',
    context:
      'Vous êtes en chômage temporaire plusieurs jours, mais le mercredi vous travaillez chez l’employeur qui vous a mis en chômage.',
    contextKey: 'public.ec32Content.scenarios.work-own.context',
    objective:
      'Savoir signaler une reprise ponctuelle de travail chez l’employeur qui complète la carte.',
    objectiveKey: 'public.ec32Content.scenarios.work-own.objective',
    expectedAction:
      'Sélectionner le jour concerné et choisir « Travail chez l’employeur ».',
    expectedActionKey: 'public.ec32Content.scenarios.work-own.expectedAction',
    feedbackCorrect:
      'Correct : le travail chez l’employeur habituel doit être indiqué avant de commencer.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.work-own.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : un jour travaillé chez votre employeur n’est pas un jour de chômage. Sélectionnez le jour et choisissez « Travail chez l’employeur ».',
    feedbackErrorKey: 'public.ec32Content.scenarios.work-own.feedbackError',
    ruleRef: 'Travail chez l’employeur',
    ruleRefKey: 'public.ec32Content.scenarios.work-own.ruleRef',
  },
  {
    key: 'work-elsewhere-usual',
    title: 'Je fais un flexi-job un jour où je travaille normalement',
    titleKey: 'public.ec32Content.scenarios.work-elsewhere-usual.title',
    level: 'Intermédiaire',
    levelKey: 'public.ec32Content.scenarios.work-elsewhere-usual.level',
    duration: '3 min',
    durationKey: 'public.ec32Content.scenarios.work-elsewhere-usual.duration',
    context:
      'Pendant votre chômage temporaire, vous effectuez un travail ailleurs (par exemple un flexi-job) un jour où vous travaillez normalement chez votre employeur habituel.',
    contextKey: 'public.ec32Content.scenarios.work-elsewhere-usual.context',
    objective:
      'Distinguer un travail effectué ailleurs un jour normalement travaillé chez l’employeur habituel.',
    objectiveKey: 'public.ec32Content.scenarios.work-elsewhere-usual.objective',
    expectedAction:
      'Choisir « Travail ailleurs — jour normalement travaillé chez l’employeur habituel ».',
    expectedActionKey: 'public.ec32Content.scenarios.work-elsewhere-usual.expectedAction',
    feedbackCorrect:
      'Correct : un travail ailleurs pendant un jour normalement travaillé doit être indiqué.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.work-elsewhere-usual.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : comme ce jour est normalement travaillé chez votre employeur habituel, choisissez « Travail ailleurs — jour normalement travaillé chez l’employeur habituel ».',
    feedbackErrorKey: 'public.ec32Content.scenarios.work-elsewhere-usual.feedbackError',
    ruleRef: 'Travail ailleurs',
    ruleRefKey: 'public.ec32Content.scenarios.work-elsewhere-usual.ruleRef',
  },
  {
    key: 'work-elsewhere-weekend',
    title: 'Je travaille samedi chez un autre employeur',
    titleKey: 'public.ec32Content.scenarios.work-elsewhere-weekend.title',
    level: 'Intermédiaire',
    levelKey: 'public.ec32Content.scenarios.work-elsewhere-weekend.level',
    duration: '3 min',
    durationKey: 'public.ec32Content.scenarios.work-elsewhere-weekend.duration',
    context:
      'Vous ne travaillez normalement pas le samedi chez votre employeur habituel, mais vous effectuez ce jour-là un travail occasionnel ailleurs.',
    contextKey: 'public.ec32Content.scenarios.work-elsewhere-weekend.context',
    objective:
      'Comprendre qu’un travail ailleurs doit être signalé même un jour normalement non travaillé, comme le week-end.',
    objectiveKey: 'public.ec32Content.scenarios.work-elsewhere-weekend.objective',
    expectedAction:
      'Choisir « Travail ailleurs — jour normalement non travaillé ».',
    expectedActionKey: 'public.ec32Content.scenarios.work-elsewhere-weekend.expectedAction',
    feedbackCorrect:
      'Correct : même le week-end, un travail ailleurs doit être indiqué.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.work-elsewhere-weekend.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : un travail effectué un samedi normalement non travaillé doit quand même être signalé. Choisissez « Travail ailleurs — jour normalement non travaillé ».',
    feedbackErrorKey: 'public.ec32Content.scenarios.work-elsewhere-weekend.feedbackError',
    ruleRef: 'Travail ailleurs',
    ruleRefKey: 'public.ec32Content.scenarios.work-elsewhere-weekend.ruleRef',
  },
  {
    key: 'other-regular',
    title: 'J’ai deux emplois à temps partiel',
    titleKey: 'public.ec32Content.scenarios.other-regular.title',
    level: 'Avancé',
    levelKey: 'public.ec32Content.scenarios.other-regular.level',
    duration: '4 min',
    durationKey: 'public.ec32Content.scenarios.other-regular.duration',
    context:
      'Vous combinez deux emplois habituels à temps partiel et l’un d’eux vous met en chômage temporaire, tandis que l’autre se poursuit normalement.',
    contextKey: 'public.ec32Content.scenarios.other-regular.context',
    objective:
      'Savoir signaler la poursuite d’un autre emploi habituel pendant le chômage temporaire.',
    objectiveKey: 'public.ec32Content.scenarios.other-regular.objective',
    expectedAction:
      'Choisir « Travail auprès d’un autre employeur habituel ».',
    expectedActionKey: 'public.ec32Content.scenarios.other-regular.expectedAction',
    feedbackCorrect:
      'Correct : si vous combinez plusieurs emplois habituels, l’autre occupation doit être communiquée à l’organisme de paiement.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.other-regular.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : votre second emploi habituel continue. Choisissez « Travail auprès d’un autre employeur habituel » et informez l’organisme de paiement.',
    feedbackErrorKey: 'public.ec32Content.scenarios.other-regular.feedbackError',
    ruleRef: 'Autre employeur habituel',
    ruleRefKey: 'public.ec32Content.scenarios.other-regular.ruleRef',
  },
  {
    key: 'sick',
    title: 'Je tombe malade pendant le chômage temporaire',
    titleKey: 'public.ec32Content.scenarios.sick.title',
    level: 'Débutant',
    levelKey: 'public.ec32Content.scenarios.sick.level',
    duration: '3 min',
    durationKey: 'public.ec32Content.scenarios.sick.duration',
    context:
      'Pendant une période de chômage temporaire, vous tombez malade quelques jours et êtes en incapacité de travail.',
    contextKey: 'public.ec32Content.scenarios.sick.context',
    objective:
      'Savoir indiquer les jours de maladie comme inaptitude au travail et penser à avertir la mutualité.',
    objectiveKey: 'public.ec32Content.scenarios.sick.objective',
    expectedAction:
      'Sélectionner les jours de maladie et choisir « Inaptitude au travail ».',
    expectedActionKey: 'public.ec32Content.scenarios.sick.expectedAction',
    feedbackCorrect:
      'Correct : la maladie, l’accident du travail ou le repos d’accouchement doivent être indiqués comme inaptitude au travail. La mutualité doit être avertie dans les 48 heures.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.sick.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : un jour de maladie n’est pas un jour de chômage. Sélectionnez les jours concernés, choisissez « Inaptitude au travail » et avertissez votre mutualité dans les 48 heures.',
    feedbackErrorKey: 'public.ec32Content.scenarios.sick.feedbackError',
    ruleRef: 'Inaptitude au travail',
    ruleRefKey: 'public.ec32Content.scenarios.sick.ruleRef',
  },
  {
    key: 'vacation',
    title: 'Je prends des vacances',
    titleKey: 'public.ec32Content.scenarios.vacation.title',
    level: 'Débutant',
    levelKey: 'public.ec32Content.scenarios.vacation.level',
    duration: '2 min',
    durationKey: 'public.ec32Content.scenarios.vacation.duration',
    context:
      'Pendant votre période de chômage temporaire, vous prenez quelques jours de vacances annuelles.',
    contextKey: 'public.ec32Content.scenarios.vacation.context',
    objective:
      'Savoir distinguer les jours de vacances des jours de chômage temporaire.',
    objectiveKey: 'public.ec32Content.scenarios.vacation.objective',
    expectedAction: 'Choisir « Vacances » pour les jours concernés.',
    expectedActionKey: 'public.ec32Content.scenarios.vacation.expectedAction',
    feedbackCorrect:
      'Correct : les vacances annuelles individuelles ou collectives doivent être indiquées.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.vacation.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : un jour de vacances n’est pas un jour de chômage. Choisissez « Vacances » pour les jours concernés.',
    feedbackErrorKey: 'public.ec32Content.scenarios.vacation.feedbackError',
    ruleRef: 'Vacances',
    ruleRefKey: 'public.ec32Content.scenarios.vacation.ruleRef',
  },
  {
    key: 'other-situation',
    title: 'J’ai un jour férié ou une formation rémunérée',
    titleKey: 'public.ec32Content.scenarios.other-situation.title',
    level: 'Débutant',
    levelKey: 'public.ec32Content.scenarios.other-situation.level',
    duration: '3 min',
    durationKey: 'public.ec32Content.scenarios.other-situation.duration',
    context:
      'Pendant votre chômage temporaire, un jour est couvert par une autre situation : un jour férié ou une formation rémunérée, par exemple.',
    contextKey: 'public.ec32Content.scenarios.other-situation.context',
    objective:
      'Comprendre quand utiliser « Autre situation » pour un jour sans prestation mais couvert autrement.',
    objectiveKey: 'public.ec32Content.scenarios.other-situation.objective',
    expectedAction: 'Choisir « Autre situation ».',
    expectedActionKey: 'public.ec32Content.scenarios.other-situation.expectedAction',
    feedbackCorrect:
      'Correct : certains jours sans prestation mais couverts par une autre situation doivent être indiqués comme autre situation.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.other-situation.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : un jour férié ou une formation rémunérée n’est pas un jour de chômage. Choisissez « Autre situation ».',
    feedbackErrorKey: 'public.ec32Content.scenarios.other-situation.feedbackError',
    ruleRef: 'Autre situation',
    ruleRefKey: 'public.ec32Content.scenarios.other-situation.ruleRef',
  },
  {
    key: 'multiple-employers',
    title: 'Je suis en chômage temporaire chez deux employeurs',
    titleKey: 'public.ec32Content.scenarios.multiple-employers.title',
    level: 'Avancé',
    levelKey: 'public.ec32Content.scenarios.multiple-employers.level',
    duration: '4 min',
    durationKey: 'public.ec32Content.scenarios.multiple-employers.duration',
    context:
      'Deux de vos employeurs vous mettent en chômage temporaire au cours du même mois. Une seule carte ne suffit pas.',
    contextKey: 'public.ec32Content.scenarios.multiple-employers.context',
    objective:
      'Comprendre qu’une carte distincte doit être complétée pour chaque employeur concerné.',
    objectiveKey: 'public.ec32Content.scenarios.multiple-employers.objective',
    expectedAction:
      'Remplir deux cartes fictives, une par employeur concerné.',
    expectedActionKey: 'public.ec32Content.scenarios.multiple-employers.expectedAction',
    feedbackCorrect:
      'Correct : lorsqu’il y a chômage temporaire chez plusieurs employeurs, une carte doit être complétée pour chaque employeur concerné.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.multiple-employers.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : une seule carte ne couvre pas deux employeurs. Complétez une carte distincte pour chaque employeur qui vous a mis en chômage.',
    feedbackErrorKey: 'public.ec32Content.scenarios.multiple-employers.feedbackError',
    ruleRef: 'Plusieurs employeurs',
    ruleRefKey: 'public.ec32Content.scenarios.multiple-employers.ruleRef',
  },
  {
    key: 'no-payment-org',
    title: 'Je ne suis pas encore inscrit auprès d’un organisme de paiement',
    titleKey: 'public.ec32Content.scenarios.no-payment-org.title',
    level: 'Intermédiaire',
    levelKey: 'public.ec32Content.scenarios.no-payment-org.level',
    duration: '3 min',
    durationKey: 'public.ec32Content.scenarios.no-payment-org.duration',
    context:
      'Vous complétez votre carte, mais vous n’êtes pas encore inscrit auprès d’un organisme de paiement (CAPAC, CSC, FGTB ou CGSLB).',
    contextKey: 'public.ec32Content.scenarios.no-payment-org.context',
    objective:
      'Comprendre que la carte peut être complétée sans inscription, mais ne peut pas être envoyée.',
    objectiveKey: 'public.ec32Content.scenarios.no-payment-org.objective',
    expectedAction:
      'Compléter la carte mais constater que l’envoi est bloqué.',
    expectedActionKey: 'public.ec32Content.scenarios.no-payment-org.expectedAction',
    feedbackCorrect:
      'Correct : sans inscription auprès d’un organisme de paiement, la carte peut être complétée mais ne peut pas être envoyée.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.no-payment-org.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : sans organisme de paiement, l’envoi reste bloqué. Vous pouvez compléter la carte, mais l’inscription est nécessaire pour l’envoyer.',
    feedbackErrorKey: 'public.ec32Content.scenarios.no-payment-org.feedbackError',
    ruleRef: 'Organisme de paiement',
    ruleRefKey: 'public.ec32Content.scenarios.no-payment-org.ruleRef',
  },
  {
    key: 'correction',
    title: 'J’ai oublié d’indiquer un travail',
    titleKey: 'public.ec32Content.scenarios.correction.title',
    level: 'Intermédiaire',
    levelKey: 'public.ec32Content.scenarios.correction.level',
    duration: '4 min',
    durationKey: 'public.ec32Content.scenarios.correction.duration',
    context:
      'Vous vous rendez compte qu’un jour de travail a été enregistré comme chômage. La carte n’est pas encore envoyée : une correction est possible.',
    contextKey: 'public.ec32Content.scenarios.correction.context',
    objective:
      'Savoir corriger un jour mal encodé et fournir l’explication demandée avant de sauvegarder.',
    objectiveKey: 'public.ec32Content.scenarios.correction.objective',
    expectedAction:
      'Modifier le jour concerné, choisir la bonne situation, fournir une explication.',
    expectedActionKey: 'public.ec32Content.scenarios.correction.expectedAction',
    feedbackCorrect:
      'Correct : une correction doit être expliquée avant d’être sauvegardée.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.correction.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : une correction ne peut pas être sauvegardée sans explication. Sélectionnez le jour, choisissez la bonne situation et justifiez la modification.',
    feedbackErrorKey: 'public.ec32Content.scenarios.correction.feedbackError',
    ruleRef: 'Correction',
    ruleRefKey: 'public.ec32Content.scenarios.correction.ruleRef',
  },
  {
    key: 'construction-cp124',
    title: 'Je travaille dans la construction',
    titleKey: 'public.ec32Content.scenarios.construction-cp124.title',
    level: 'Intermédiaire',
    levelKey: 'public.ec32Content.scenarios.construction-cp124.level',
    duration: '3 min',
    durationKey: 'public.ec32Content.scenarios.construction-cp124.duration',
    context:
      'Vous relevez de la commission paritaire 124 (construction) et votre employeur vous met en chômage temporaire.',
    contextKey: 'public.ec32Content.scenarios.construction-cp124.context',
    objective:
      'Comprendre la règle propre au secteur de la construction : la carte doit toujours être remplie pour l’employeur concerné.',
    objectiveKey: 'public.ec32Content.scenarios.construction-cp124.objective',
    expectedAction:
      'Comprendre que la carte doit toujours être remplie pour l’employeur du secteur construction.',
    expectedActionKey: 'public.ec32Content.scenarios.construction-cp124.expectedAction',
    feedbackCorrect:
      'Correct : en CP 124, la carte doit toujours être complétée pour l’employeur concerné.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.construction-cp124.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : dans la construction (CP 124), la carte doit toujours être complétée pour l’employeur concerné, sans exception.',
    feedbackErrorKey: 'public.ec32Content.scenarios.construction-cp124.feedbackError',
    ruleRef: 'CP 124 construction',
    ruleRefKey: 'public.ec32Content.scenarios.construction-cp124.ruleRef',
  },
  {
    key: 'first-effective-day',
    title: 'Je commence le chômage temporaire en cours de mois',
    titleKey: 'public.ec32Content.scenarios.first-effective-day.title',
    level: 'Intermédiaire',
    levelKey: 'public.ec32Content.scenarios.first-effective-day.level',
    duration: '3 min',
    durationKey: 'public.ec32Content.scenarios.first-effective-day.duration',
    context:
      'Votre chômage temporaire ne débute pas le 1er du mois mais en cours de mois. Le premier jour effectif est signalé automatiquement.',
    contextKey: 'public.ec32Content.scenarios.first-effective-day.context',
    objective:
      'Savoir à partir de quel jour la carte doit être complétée lorsque le chômage commence en cours de mois.',
    objectiveKey: 'public.ec32Content.scenarios.first-effective-day.objective',
    expectedAction:
      'Remplir la carte à partir du premier jour de chômage effectif jusqu’à la fin du mois.',
    expectedActionKey: 'public.ec32Content.scenarios.first-effective-day.expectedAction',
    feedbackCorrect:
      'Correct : la carte doit être complétée à partir du premier jour de chômage effectif du mois.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.first-effective-day.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : la carte se remplit à partir du premier jour de chômage effectif, pas depuis le 1er du mois. Continuez jusqu’au dernier jour du mois.',
    feedbackErrorKey: 'public.ec32Content.scenarios.first-effective-day.feedbackError',
    ruleRef: 'Premier jour effectif',
    ruleRefKey: 'public.ec32Content.scenarios.first-effective-day.ruleRef',
  },
  {
    key: 'wrong-month',
    title: 'J’ai choisi le mauvais premier mois',
    titleKey: 'public.ec32Content.scenarios.wrong-month.title',
    level: 'Avancé',
    levelKey: 'public.ec32Content.scenarios.wrong-month.level',
    duration: '4 min',
    durationKey: 'public.ec32Content.scenarios.wrong-month.duration',
    context:
      'Vous constatez qu’un mois antérieur aurait dû être déclaré et activé en premier. Une nouvelle déclaration simulée est nécessaire.',
    contextKey: 'public.ec32Content.scenarios.wrong-month.context',
    objective:
      'Comprendre qu’un mois antérieur peut être activé si nécessaire, via une nouvelle déclaration.',
    objectiveKey: 'public.ec32Content.scenarios.wrong-month.objective',
    expectedAction:
      'Sélectionner un mois antérieur et accepter une nouvelle déclaration simulée.',
    expectedActionKey: 'public.ec32Content.scenarios.wrong-month.expectedAction',
    feedbackCorrect: 'Correct : un mois antérieur peut être activé si nécessaire.',
    feedbackCorrectKey: 'public.ec32Content.scenarios.wrong-month.feedbackCorrect',
    feedbackError:
      'Pas tout à fait : si le mauvais mois a été activé, sélectionnez le mois antérieur concerné et acceptez la nouvelle déclaration simulée.',
    feedbackErrorKey: 'public.ec32Content.scenarios.wrong-month.feedbackError',
    ruleRef: 'Choix du mois',
    ruleRefKey: 'public.ec32Content.scenarios.wrong-month.ruleRef',
  },
]
