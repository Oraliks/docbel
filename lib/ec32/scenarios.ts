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
    level: 'Débutant',
    duration: '2 min',
    context:
      'Votre employeur vous a mis en chômage temporaire pour l’ensemble du mois. Aucun jour de travail, aucune autre situation à signaler.',
    objective:
      'Comprendre que « Chômage » est la situation par défaut : pour un jour réellement en chômage temporaire, il n’y a rien à modifier.',
    expectedAction:
      'Ne rien modifier pour les jours réellement en chômage, sauf si une autre situation s’applique.',
    feedbackCorrect:
      'Correct : si vous êtes en chômage temporaire ce jour-là, la situation par défaut suffit.',
    feedbackError:
      'Pas tout à fait : pour un jour réellement en chômage, la situation par défaut convient déjà. Inutile d’ajouter une autre situation.',
    ruleRef: 'Situation par défaut',
  },
  {
    key: 'work-own',
    title: 'Je travaille un jour chez mon employeur',
    level: 'Débutant',
    duration: '3 min',
    context:
      'Vous êtes en chômage temporaire plusieurs jours, mais le mercredi vous travaillez chez l’employeur qui vous a mis en chômage.',
    objective:
      'Savoir signaler une reprise ponctuelle de travail chez l’employeur qui complète la carte.',
    expectedAction:
      'Sélectionner le jour concerné et choisir « Travail chez l’employeur ».',
    feedbackCorrect:
      'Correct : le travail chez l’employeur habituel doit être indiqué avant de commencer.',
    feedbackError:
      'Pas tout à fait : un jour travaillé chez votre employeur n’est pas un jour de chômage. Sélectionnez le jour et choisissez « Travail chez l’employeur ».',
    ruleRef: 'Travail chez l’employeur',
  },
  {
    key: 'work-elsewhere-usual',
    title: 'Je fais un flexi-job un jour où je travaille normalement',
    level: 'Intermédiaire',
    duration: '3 min',
    context:
      'Pendant votre chômage temporaire, vous effectuez un travail ailleurs (par exemple un flexi-job) un jour où vous travaillez normalement chez votre employeur habituel.',
    objective:
      'Distinguer un travail effectué ailleurs un jour normalement travaillé chez l’employeur habituel.',
    expectedAction:
      'Choisir « Travail ailleurs — jour normalement travaillé chez l’employeur habituel ».',
    feedbackCorrect:
      'Correct : un travail ailleurs pendant un jour normalement travaillé doit être indiqué.',
    feedbackError:
      'Pas tout à fait : comme ce jour est normalement travaillé chez votre employeur habituel, choisissez « Travail ailleurs — jour normalement travaillé chez l’employeur habituel ».',
    ruleRef: 'Travail ailleurs',
  },
  {
    key: 'work-elsewhere-weekend',
    title: 'Je travaille samedi chez un autre employeur',
    level: 'Intermédiaire',
    duration: '3 min',
    context:
      'Vous ne travaillez normalement pas le samedi chez votre employeur habituel, mais vous effectuez ce jour-là un travail occasionnel ailleurs.',
    objective:
      'Comprendre qu’un travail ailleurs doit être signalé même un jour normalement non travaillé, comme le week-end.',
    expectedAction:
      'Choisir « Travail ailleurs — jour normalement non travaillé ».',
    feedbackCorrect:
      'Correct : même le week-end, un travail ailleurs doit être indiqué.',
    feedbackError:
      'Pas tout à fait : un travail effectué un samedi normalement non travaillé doit quand même être signalé. Choisissez « Travail ailleurs — jour normalement non travaillé ».',
    ruleRef: 'Travail ailleurs',
  },
  {
    key: 'other-regular',
    title: 'J’ai deux emplois à temps partiel',
    level: 'Avancé',
    duration: '4 min',
    context:
      'Vous combinez deux emplois habituels à temps partiel et l’un d’eux vous met en chômage temporaire, tandis que l’autre se poursuit normalement.',
    objective:
      'Savoir signaler la poursuite d’un autre emploi habituel pendant le chômage temporaire.',
    expectedAction:
      'Choisir « Travail auprès d’un autre employeur habituel ».',
    feedbackCorrect:
      'Correct : si vous combinez plusieurs emplois habituels, l’autre occupation doit être communiquée à l’organisme de paiement.',
    feedbackError:
      'Pas tout à fait : votre second emploi habituel continue. Choisissez « Travail auprès d’un autre employeur habituel » et informez l’organisme de paiement.',
    ruleRef: 'Autre employeur habituel',
  },
  {
    key: 'sick',
    title: 'Je tombe malade pendant le chômage temporaire',
    level: 'Débutant',
    duration: '3 min',
    context:
      'Pendant une période de chômage temporaire, vous tombez malade quelques jours et êtes en incapacité de travail.',
    objective:
      'Savoir indiquer les jours de maladie comme inaptitude au travail et penser à avertir la mutualité.',
    expectedAction:
      'Sélectionner les jours de maladie et choisir « Inaptitude au travail ».',
    feedbackCorrect:
      'Correct : la maladie, l’accident du travail ou le repos d’accouchement doivent être indiqués comme inaptitude au travail. La mutualité doit être avertie dans les 48 heures.',
    feedbackError:
      'Pas tout à fait : un jour de maladie n’est pas un jour de chômage. Sélectionnez les jours concernés, choisissez « Inaptitude au travail » et avertissez votre mutualité dans les 48 heures.',
    ruleRef: 'Inaptitude au travail',
  },
  {
    key: 'vacation',
    title: 'Je prends des vacances',
    level: 'Débutant',
    duration: '2 min',
    context:
      'Pendant votre période de chômage temporaire, vous prenez quelques jours de vacances annuelles.',
    objective:
      'Savoir distinguer les jours de vacances des jours de chômage temporaire.',
    expectedAction: 'Choisir « Vacances » pour les jours concernés.',
    feedbackCorrect:
      'Correct : les vacances annuelles individuelles ou collectives doivent être indiquées.',
    feedbackError:
      'Pas tout à fait : un jour de vacances n’est pas un jour de chômage. Choisissez « Vacances » pour les jours concernés.',
    ruleRef: 'Vacances',
  },
  {
    key: 'other-situation',
    title: 'J’ai un jour férié ou une formation rémunérée',
    level: 'Débutant',
    duration: '3 min',
    context:
      'Pendant votre chômage temporaire, un jour est couvert par une autre situation : un jour férié ou une formation rémunérée, par exemple.',
    objective:
      'Comprendre quand utiliser « Autre situation » pour un jour sans prestation mais couvert autrement.',
    expectedAction: 'Choisir « Autre situation ».',
    feedbackCorrect:
      'Correct : certains jours sans prestation mais couverts par une autre situation doivent être indiqués comme autre situation.',
    feedbackError:
      'Pas tout à fait : un jour férié ou une formation rémunérée n’est pas un jour de chômage. Choisissez « Autre situation ».',
    ruleRef: 'Autre situation',
  },
  {
    key: 'multiple-employers',
    title: 'Je suis en chômage temporaire chez deux employeurs',
    level: 'Avancé',
    duration: '4 min',
    context:
      'Deux de vos employeurs vous mettent en chômage temporaire au cours du même mois. Une seule carte ne suffit pas.',
    objective:
      'Comprendre qu’une carte distincte doit être complétée pour chaque employeur concerné.',
    expectedAction:
      'Remplir deux cartes fictives, une par employeur concerné.',
    feedbackCorrect:
      'Correct : lorsqu’il y a chômage temporaire chez plusieurs employeurs, une carte doit être complétée pour chaque employeur concerné.',
    feedbackError:
      'Pas tout à fait : une seule carte ne couvre pas deux employeurs. Complétez une carte distincte pour chaque employeur qui vous a mis en chômage.',
    ruleRef: 'Plusieurs employeurs',
  },
  {
    key: 'no-payment-org',
    title: 'Je ne suis pas encore inscrit auprès d’un organisme de paiement',
    level: 'Intermédiaire',
    duration: '3 min',
    context:
      'Vous complétez votre carte, mais vous n’êtes pas encore inscrit auprès d’un organisme de paiement (CAPAC, CSC, FGTB ou CGSLB).',
    objective:
      'Comprendre que la carte peut être complétée sans inscription, mais ne peut pas être envoyée.',
    expectedAction:
      'Compléter la carte mais constater que l’envoi est bloqué.',
    feedbackCorrect:
      'Correct : sans inscription auprès d’un organisme de paiement, la carte peut être complétée mais ne peut pas être envoyée.',
    feedbackError:
      'Pas tout à fait : sans organisme de paiement, l’envoi reste bloqué. Vous pouvez compléter la carte, mais l’inscription est nécessaire pour l’envoyer.',
    ruleRef: 'Organisme de paiement',
  },
  {
    key: 'correction',
    title: 'J’ai oublié d’indiquer un travail',
    level: 'Intermédiaire',
    duration: '4 min',
    context:
      'Vous vous rendez compte qu’un jour de travail a été enregistré comme chômage. La carte n’est pas encore envoyée : une correction est possible.',
    objective:
      'Savoir corriger un jour mal encodé et fournir l’explication demandée avant de sauvegarder.',
    expectedAction:
      'Modifier le jour concerné, choisir la bonne situation, fournir une explication.',
    feedbackCorrect:
      'Correct : une correction doit être expliquée avant d’être sauvegardée.',
    feedbackError:
      'Pas tout à fait : une correction ne peut pas être sauvegardée sans explication. Sélectionnez le jour, choisissez la bonne situation et justifiez la modification.',
    ruleRef: 'Correction',
  },
  {
    key: 'construction-cp124',
    title: 'Je travaille dans la construction',
    level: 'Intermédiaire',
    duration: '3 min',
    context:
      'Vous relevez de la commission paritaire 124 (construction) et votre employeur vous met en chômage temporaire.',
    objective:
      'Comprendre la règle propre au secteur de la construction : la carte doit toujours être remplie pour l’employeur concerné.',
    expectedAction:
      'Comprendre que la carte doit toujours être remplie pour l’employeur du secteur construction.',
    feedbackCorrect:
      'Correct : en CP 124, la carte doit toujours être complétée pour l’employeur concerné.',
    feedbackError:
      'Pas tout à fait : dans la construction (CP 124), la carte doit toujours être complétée pour l’employeur concerné, sans exception.',
    ruleRef: 'CP 124 construction',
  },
  {
    key: 'first-effective-day',
    title: 'Je commence le chômage temporaire en cours de mois',
    level: 'Intermédiaire',
    duration: '3 min',
    context:
      'Votre chômage temporaire ne débute pas le 1er du mois mais en cours de mois. Le premier jour effectif est signalé automatiquement.',
    objective:
      'Savoir à partir de quel jour la carte doit être complétée lorsque le chômage commence en cours de mois.',
    expectedAction:
      'Remplir la carte à partir du premier jour de chômage effectif jusqu’à la fin du mois.',
    feedbackCorrect:
      'Correct : la carte doit être complétée à partir du premier jour de chômage effectif du mois.',
    feedbackError:
      'Pas tout à fait : la carte se remplit à partir du premier jour de chômage effectif, pas depuis le 1er du mois. Continuez jusqu’au dernier jour du mois.',
    ruleRef: 'Premier jour effectif',
  },
  {
    key: 'wrong-month',
    title: 'J’ai choisi le mauvais premier mois',
    level: 'Avancé',
    duration: '4 min',
    context:
      'Vous constatez qu’un mois antérieur aurait dû être déclaré et activé en premier. Une nouvelle déclaration simulée est nécessaire.',
    objective:
      'Comprendre qu’un mois antérieur peut être activé si nécessaire, via une nouvelle déclaration.',
    expectedAction:
      'Sélectionner un mois antérieur et accepter une nouvelle déclaration simulée.',
    feedbackCorrect: 'Correct : un mois antérieur peut être activé si nécessaire.',
    feedbackError:
      'Pas tout à fait : si le mauvais mois a été activé, sélectionnez le mois antérieur concerné et acceptez la nouvelle déclaration simulée.',
    ruleRef: 'Choix du mois',
  },
]
