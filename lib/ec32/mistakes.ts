// =====================================================================
//  eC3.2 — Erreurs fréquentes par défaut (données pures)
// ---------------------------------------------------------------------
//  16 erreurs courantes pour la page /onem/ec32, avec explication simple
//  et conseil concret. Server-safe : pas de React, simple liste typée
//  par le schéma Zod (`Ec32MistakeItem` = { key, title, explanation,
//  advice, link }). `link` = ancre interne de la page.
//  SIMULATION NON OFFICIELLE : contenu pédagogique, aucune donnée réelle.
// =====================================================================

import type { Ec32MistakeItem } from '@/lib/ec32/schema'

export const ec32DefaultMistakes: Ec32MistakeItem[] = [
  {
    key: 'confondre-ec32-et-ec3',
    title: 'Confondre eC3.2 et eC3',
    explanation:
      'L’eC3.2 concerne le chômage temporaire, alors que l’eC3 concerne le chômage complet. Les deux cartes ne s’utilisent pas dans la même situation.',
    advice:
      'Vérifiez votre situation avant de commencer : si vous êtes en chômage temporaire, c’est bien l’eC3.2 qu’il faut compléter.',
    link: '#faq',
  },
  {
    key: 'croire-simulation-officielle',
    title: 'Croire que la simulation Docbel est une vraie démarche officielle',
    explanation:
      'Le simulateur Docbel sert uniquement à comprendre et à s’entraîner. Aucune donnée n’est envoyée et rien n’est transmis à l’ONEM.',
    advice:
      'Pour une démarche réelle, utilisez l’application officielle eC3.2. Le simulateur reste un outil d’apprentissage.',
    link: '#simulateur',
  },
  {
    key: 'oublier-indiquer-travail-avant',
    title: 'Oublier d’indiquer le travail avant de commencer',
    explanation:
      'Un travail effectué pendant le chômage temporaire doit être indiqué sur la carte avant de commencer à travailler, pas après.',
    advice:
      'Prenez le réflexe d’encoder le jour de travail dès que vous savez que vous allez travailler, avant la prestation.',
    link: '#simulateur',
  },
  {
    key: 'attendre-fin-du-mois',
    title: 'Attendre la fin du mois pour tout remplir',
    explanation:
      'Reporter le remplissage à la fin du mois fait courir le risque d’oublier des journées ou des situations particulières.',
    advice:
      'Complétez la carte au fil des jours, dès qu’une situation se présente, pour ne rien oublier.',
    link: '#simulateur',
  },
  {
    key: 'choisir-mauvais-employeur',
    title: 'Choisir le mauvais employeur',
    explanation:
      'La carte doit être complétée pour l’employeur qui vous a réellement mis en chômage temporaire.',
    advice:
      'Sélectionnez l’employeur concerné avec attention ; en cas de doute, vérifiez quel employeur a déclaré le chômage temporaire.',
    link: '#simulateur',
  },
  {
    key: 'ne-pas-mentionner-autre-travail',
    title: 'Ne pas mentionner un autre travail',
    explanation:
      'Un travail effectué ailleurs pendant le chômage temporaire doit toujours être signalé sur la carte, même s’il s’agit d’un autre employeur.',
    advice:
      'Indiquez chaque journée travaillée ailleurs avec la situation « Travail ailleurs » adaptée au jour concerné.',
    link: '#simulateur',
  },
  {
    key: 'oublier-de-sauvegarder',
    title: 'Oublier de sauvegarder',
    explanation:
      'Une situation encodée mais non sauvegardée risque de ne pas être prise en compte sur la carte.',
    advice:
      'Après chaque modification, vérifiez que vos changements sont bien enregistrés avant de quitter.',
    link: '#simulateur',
  },
  {
    key: 'croire-carte-envoyee-modifiable',
    title: 'Croire qu’une carte envoyée peut être librement modifiée',
    explanation:
      'Une fois la carte envoyée, elle est verrouillée : il n’est plus possible de la modifier librement.',
    advice:
      'Vérifiez attentivement chaque journée avant d’envoyer ; les corrections ne sont possibles que tant que la carte n’est pas envoyée.',
    link: '#simulateur',
  },
  {
    key: 'corriger-sans-explication',
    title: 'Corriger sans explication',
    explanation:
      'Une correction peut nécessiter une explication. Sans justification, la modification ne peut pas être sauvegardée.',
    advice:
      'Quand vous corrigez un jour, prenez le temps d’indiquer une explication claire de la modification.',
    link: '#simulateur',
  },
  {
    key: 'pas-inscrit-organisme-paiement',
    title: 'Ne pas être inscrit auprès d’un organisme de paiement',
    explanation:
      'Sans inscription auprès d’un organisme de paiement (CAPAC, CSC, FGTB ou CGSLB), la carte peut être complétée mais ne peut pas être envoyée.',
    advice:
      'Inscrivez-vous auprès d’un organisme de paiement dès que possible pour pouvoir envoyer votre carte et percevoir vos allocations.',
    link: '#faq',
  },
  {
    key: 'oublier-jours-maladie',
    title: 'Oublier les jours de maladie',
    explanation:
      'Les jours de maladie ne sont pas des jours de chômage : ils doivent être indiqués comme inaptitude au travail.',
    advice:
      'Sélectionnez les jours concernés, choisissez « Inaptitude au travail » et prévenez votre mutualité dans les 48 heures.',
    link: '#simulateur',
  },
  {
    key: 'oublier-vacances',
    title: 'Oublier les vacances',
    explanation:
      'Les jours de vacances ne sont pas des jours de chômage et doivent être indiqués comme tels sur la carte.',
    advice:
      'Pour chaque jour de congé, choisissez la situation « Vacances » plutôt que de laisser la situation par défaut.',
    link: '#simulateur',
  },
  {
    key: 'ignorer-autre-situation',
    title: 'Ne pas tenir compte des jours « autre situation »',
    explanation:
      'Certains jours sans prestation (jour férié, formation rémunérée, etc.) ne sont pas du chômage et relèvent d’une autre situation.',
    advice:
      'Quand un jour est couvert autrement que par le chômage, choisissez « Autre situation » pour ce jour.',
    link: '#simulateur',
  },
  {
    key: 'pas-remplir-premier-jour-effectif',
    title: 'Ne pas remplir à partir du premier jour effectif de chômage',
    explanation:
      'Quand le chômage temporaire commence en cours de mois, la carte se remplit à partir du premier jour de chômage effectif, pas depuis le 1er du mois.',
    advice:
      'Repérez le premier jour de chômage effectif et complétez la carte de ce jour jusqu’à la fin du mois.',
    link: '#simulateur',
  },
  {
    key: 'ignorer-regle-cp124',
    title: 'Ne pas tenir compte de la règle CP 124 construction',
    explanation:
      'Dans le secteur de la construction (CP 124), la carte doit toujours être complétée pour l’employeur concerné.',
    advice:
      'Si vous relevez de la CP 124, complétez systématiquement votre carte de contrôle, sans exception.',
    link: '#simulateur',
  },
  {
    key: 'pas-informer-organisme-autre-employeur',
    title: 'Ne pas informer l’organisme de paiement en cas d’autre employeur habituel',
    explanation:
      'Si vous combinez plusieurs emplois habituels, l’autre occupation doit être communiquée à votre organisme de paiement.',
    advice:
      'Signalez toutes vos occupations habituelles à votre organisme de paiement pour éviter tout malentendu.',
    link: '#faq',
  },
]
