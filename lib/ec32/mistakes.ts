// =====================================================================
//  eC3.2 — Erreurs fréquentes par défaut (données pures)
// ---------------------------------------------------------------------
//  16 erreurs courantes pour la page /onem/ec32, avec explication simple
//  et conseil concret. Server-safe : pas de React, simple liste typée
//  par le schéma Zod (`Ec32MistakeItem` = { key, title, explanation,
//  advice, link }). `link` = ancre interne de la page.
//  SIMULATION NON OFFICIELLE : contenu pédagogique, aucune donnée réelle.
//
//  i18n : chaque entrée porte aussi `titleKey`/`explanationKey`/`adviceKey`
//  (next-intl, namespace `public.ec32Content.mistakes.<key>`). Les
//  champs FR restent le fallback affiché si la clé n'est pas résolue.
// =====================================================================

import type { Ec32MistakeItem } from '@/lib/ec32/schema'

export const ec32DefaultMistakes: Ec32MistakeItem[] = [
  {
    key: 'confondre-ec32-et-ec3',
    title: 'Confondre eC3.2 et eC3',
    titleKey: 'public.ec32Content.mistakes.confondre-ec32-et-ec3.title',
    explanation:
      'L’eC3.2 concerne le chômage temporaire, alors que l’eC3 concerne le chômage complet. Les deux cartes ne s’utilisent pas dans la même situation.',
    explanationKey: 'public.ec32Content.mistakes.confondre-ec32-et-ec3.explanation',
    advice:
      'Vérifiez votre situation avant de commencer : si vous êtes en chômage temporaire, c’est bien l’eC3.2 qu’il faut compléter.',
    adviceKey: 'public.ec32Content.mistakes.confondre-ec32-et-ec3.advice',
    link: '#faq',
  },
  {
    key: 'croire-simulation-officielle',
    title: 'Croire que la simulation Docbel est une vraie démarche officielle',
    titleKey: 'public.ec32Content.mistakes.croire-simulation-officielle.title',
    explanation:
      'Le simulateur Docbel sert uniquement à comprendre et à s’entraîner. Aucune donnée n’est envoyée et rien n’est transmis à l’ONEM.',
    explanationKey: 'public.ec32Content.mistakes.croire-simulation-officielle.explanation',
    advice:
      'Pour une démarche réelle, utilisez l’application officielle eC3.2. Le simulateur reste un outil d’apprentissage.',
    adviceKey: 'public.ec32Content.mistakes.croire-simulation-officielle.advice',
    link: '#simulateur',
  },
  {
    key: 'oublier-indiquer-travail-avant',
    title: 'Oublier d’indiquer le travail avant de commencer',
    titleKey: 'public.ec32Content.mistakes.oublier-indiquer-travail-avant.title',
    explanation:
      'Un travail effectué pendant le chômage temporaire doit être indiqué sur la carte avant de commencer à travailler, pas après.',
    explanationKey: 'public.ec32Content.mistakes.oublier-indiquer-travail-avant.explanation',
    advice:
      'Prenez le réflexe d’encoder le jour de travail dès que vous savez que vous allez travailler, avant la prestation.',
    adviceKey: 'public.ec32Content.mistakes.oublier-indiquer-travail-avant.advice',
    link: '#simulateur',
  },
  {
    key: 'attendre-fin-du-mois',
    title: 'Attendre la fin du mois pour tout remplir',
    titleKey: 'public.ec32Content.mistakes.attendre-fin-du-mois.title',
    explanation:
      'Reporter le remplissage à la fin du mois fait courir le risque d’oublier des journées ou des situations particulières.',
    explanationKey: 'public.ec32Content.mistakes.attendre-fin-du-mois.explanation',
    advice:
      'Complétez la carte au fil des jours, dès qu’une situation se présente, pour ne rien oublier.',
    adviceKey: 'public.ec32Content.mistakes.attendre-fin-du-mois.advice',
    link: '#simulateur',
  },
  {
    key: 'choisir-mauvais-employeur',
    title: 'Choisir le mauvais employeur',
    titleKey: 'public.ec32Content.mistakes.choisir-mauvais-employeur.title',
    explanation:
      'La carte doit être complétée pour l’employeur qui vous a réellement mis en chômage temporaire.',
    explanationKey: 'public.ec32Content.mistakes.choisir-mauvais-employeur.explanation',
    advice:
      'Sélectionnez l’employeur concerné avec attention ; en cas de doute, vérifiez quel employeur a déclaré le chômage temporaire.',
    adviceKey: 'public.ec32Content.mistakes.choisir-mauvais-employeur.advice',
    link: '#simulateur',
  },
  {
    key: 'ne-pas-mentionner-autre-travail',
    title: 'Ne pas mentionner un autre travail',
    titleKey: 'public.ec32Content.mistakes.ne-pas-mentionner-autre-travail.title',
    explanation:
      'Un travail effectué ailleurs pendant le chômage temporaire doit toujours être signalé sur la carte, même s’il s’agit d’un autre employeur.',
    explanationKey: 'public.ec32Content.mistakes.ne-pas-mentionner-autre-travail.explanation',
    advice:
      'Indiquez chaque journée travaillée ailleurs avec la situation « Travail ailleurs » adaptée au jour concerné.',
    adviceKey: 'public.ec32Content.mistakes.ne-pas-mentionner-autre-travail.advice',
    link: '#simulateur',
  },
  {
    key: 'oublier-de-sauvegarder',
    title: 'Oublier de sauvegarder',
    titleKey: 'public.ec32Content.mistakes.oublier-de-sauvegarder.title',
    explanation:
      'Une situation encodée mais non sauvegardée risque de ne pas être prise en compte sur la carte.',
    explanationKey: 'public.ec32Content.mistakes.oublier-de-sauvegarder.explanation',
    advice:
      'Après chaque modification, vérifiez que vos changements sont bien enregistrés avant de quitter.',
    adviceKey: 'public.ec32Content.mistakes.oublier-de-sauvegarder.advice',
    link: '#simulateur',
  },
  {
    key: 'croire-carte-envoyee-modifiable',
    title: 'Croire qu’une carte envoyée peut être librement modifiée',
    titleKey: 'public.ec32Content.mistakes.croire-carte-envoyee-modifiable.title',
    explanation:
      'Une fois la carte envoyée, elle est verrouillée : il n’est plus possible de la modifier librement.',
    explanationKey: 'public.ec32Content.mistakes.croire-carte-envoyee-modifiable.explanation',
    advice:
      'Vérifiez attentivement chaque journée avant d’envoyer ; les corrections ne sont possibles que tant que la carte n’est pas envoyée.',
    adviceKey: 'public.ec32Content.mistakes.croire-carte-envoyee-modifiable.advice',
    link: '#simulateur',
  },
  {
    key: 'corriger-sans-explication',
    title: 'Corriger sans explication',
    titleKey: 'public.ec32Content.mistakes.corriger-sans-explication.title',
    explanation:
      'Une correction peut nécessiter une explication. Sans justification, la modification ne peut pas être sauvegardée.',
    explanationKey: 'public.ec32Content.mistakes.corriger-sans-explication.explanation',
    advice:
      'Quand vous corrigez un jour, prenez le temps d’indiquer une explication claire de la modification.',
    adviceKey: 'public.ec32Content.mistakes.corriger-sans-explication.advice',
    link: '#simulateur',
  },
  {
    key: 'pas-inscrit-organisme-paiement',
    title: 'Ne pas être inscrit auprès d’un organisme de paiement',
    titleKey: 'public.ec32Content.mistakes.pas-inscrit-organisme-paiement.title',
    explanation:
      'Sans inscription auprès d’un organisme de paiement (CAPAC, CSC, FGTB ou SYNOVA), la carte peut être complétée mais ne peut pas être envoyée.',
    explanationKey: 'public.ec32Content.mistakes.pas-inscrit-organisme-paiement.explanation',
    advice:
      'Inscrivez-vous auprès d’un organisme de paiement dès que possible pour pouvoir envoyer votre carte et percevoir vos allocations.',
    adviceKey: 'public.ec32Content.mistakes.pas-inscrit-organisme-paiement.advice',
    link: '#faq',
  },
  {
    key: 'oublier-jours-maladie',
    title: 'Oublier les jours de maladie',
    titleKey: 'public.ec32Content.mistakes.oublier-jours-maladie.title',
    explanation:
      'Les jours de maladie ne sont pas des jours de chômage : ils doivent être indiqués comme inaptitude au travail.',
    explanationKey: 'public.ec32Content.mistakes.oublier-jours-maladie.explanation',
    advice:
      'Sélectionnez les jours concernés, choisissez « Inaptitude au travail » et prévenez votre mutualité dans les 48 heures.',
    adviceKey: 'public.ec32Content.mistakes.oublier-jours-maladie.advice',
    link: '#simulateur',
  },
  {
    key: 'oublier-vacances',
    title: 'Oublier les vacances',
    titleKey: 'public.ec32Content.mistakes.oublier-vacances.title',
    explanation:
      'Les jours de vacances ne sont pas des jours de chômage et doivent être indiqués comme tels sur la carte.',
    explanationKey: 'public.ec32Content.mistakes.oublier-vacances.explanation',
    advice:
      'Pour chaque jour de congé, choisissez la situation « Vacances » plutôt que de laisser la situation par défaut.',
    adviceKey: 'public.ec32Content.mistakes.oublier-vacances.advice',
    link: '#simulateur',
  },
  {
    key: 'ignorer-autre-situation',
    title: 'Ne pas tenir compte des jours « autre situation »',
    titleKey: 'public.ec32Content.mistakes.ignorer-autre-situation.title',
    explanation:
      'Certains jours sans prestation (jour férié, formation rémunérée, etc.) ne sont pas du chômage et relèvent d’une autre situation.',
    explanationKey: 'public.ec32Content.mistakes.ignorer-autre-situation.explanation',
    advice:
      'Quand un jour est couvert autrement que par le chômage, choisissez « Autre situation » pour ce jour.',
    adviceKey: 'public.ec32Content.mistakes.ignorer-autre-situation.advice',
    link: '#simulateur',
  },
  {
    key: 'pas-remplir-premier-jour-effectif',
    title: 'Ne pas remplir à partir du premier jour effectif de chômage',
    titleKey: 'public.ec32Content.mistakes.pas-remplir-premier-jour-effectif.title',
    explanation:
      'Quand le chômage temporaire commence en cours de mois, la carte se remplit à partir du premier jour de chômage effectif, pas depuis le 1er du mois.',
    explanationKey:
      'public.ec32Content.mistakes.pas-remplir-premier-jour-effectif.explanation',
    advice:
      'Repérez le premier jour de chômage effectif et complétez la carte de ce jour jusqu’à la fin du mois.',
    adviceKey: 'public.ec32Content.mistakes.pas-remplir-premier-jour-effectif.advice',
    link: '#simulateur',
  },
  {
    key: 'ignorer-regle-cp124',
    title: 'Ne pas tenir compte de la règle CP 124 construction',
    titleKey: 'public.ec32Content.mistakes.ignorer-regle-cp124.title',
    explanation:
      'Dans le secteur de la construction (CP 124), la carte doit toujours être complétée pour l’employeur concerné.',
    explanationKey: 'public.ec32Content.mistakes.ignorer-regle-cp124.explanation',
    advice:
      'Si vous relevez de la CP 124, complétez systématiquement votre carte de contrôle, sans exception.',
    adviceKey: 'public.ec32Content.mistakes.ignorer-regle-cp124.advice',
    link: '#simulateur',
  },
  {
    key: 'pas-informer-organisme-autre-employeur',
    title: 'Ne pas informer l’organisme de paiement en cas d’autre employeur habituel',
    titleKey: 'public.ec32Content.mistakes.pas-informer-organisme-autre-employeur.title',
    explanation:
      'Si vous combinez plusieurs emplois habituels, l’autre occupation doit être communiquée à votre organisme de paiement.',
    explanationKey:
      'public.ec32Content.mistakes.pas-informer-organisme-autre-employeur.explanation',
    advice:
      'Signalez toutes vos occupations habituelles à votre organisme de paiement pour éviter tout malentendu.',
    adviceKey: 'public.ec32Content.mistakes.pas-informer-organisme-autre-employeur.advice',
    link: '#faq',
  },
]
