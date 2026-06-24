// =====================================================================
//  eC3.2 — Foire aux questions par défaut (données pures)
// ---------------------------------------------------------------------
//  20 questions/réponses pédagogiques pour la page /onem/ec32.
//  Server-safe : pas de React, simple liste typée par le schéma Zod
//  (`Ec32FaqItem` = { q, a }). SIMULATION NON OFFICIELLE : aucune donnée
//  réelle n'est envoyée à l'ONEM, ce contenu est purement informatif et
//  ne remplace pas l'information officielle.
//
//  i18n : chaque entrée porte aussi `questionKey`/`answerKey` (next-intl,
//  namespace `public.ec32Content.faq.<index>`). `q`/`a` (FR) restent le
//  fallback affiché si la clé n'est pas résolue.
// =====================================================================

import type { Ec32FaqItem } from '@/lib/ec32/schema'

export const ec32DefaultFaq: Ec32FaqItem[] = [
  {
    q: 'Qu’est-ce que l’eC3.2 ?',
    questionKey: 'public.ec32Content.faq.0.q',
    a: 'L’eC3.2 est la carte de contrôle électronique pour le chômage temporaire. Elle permet de compléter et d’envoyer sa carte de contrôle par voie électronique, sans version papier.',
    answerKey: 'public.ec32Content.faq.0.a',
  },
  {
    q: 'Est-ce la même chose que l’eC3 ?',
    questionKey: 'public.ec32Content.faq.1.q',
    a: 'Non. L’eC3.2 concerne le chômage temporaire, tandis que l’eC3 concerne le chômage complet. Il s’agit de deux cartes de contrôle distinctes.',
    answerKey: 'public.ec32Content.faq.1.a',
  },
  {
    q: 'Cette page Docbel permet-elle d’envoyer une vraie carte ?',
    questionKey: 'public.ec32Content.faq.2.q',
    a: 'Non. Il s’agit d’une simulation pédagogique : aucune donnée réelle n’est envoyée et rien n’est transmis à l’ONEM. Le simulateur sert uniquement à comprendre et à s’entraîner.',
    answerKey: 'public.ec32Content.faq.2.a',
  },
  {
    q: 'Où se trouve la vraie application eC3.2 ?',
    questionKey: 'public.ec32Content.faq.3.q',
    a: 'La véritable application est accessible via le portail de la sécurité sociale ou via l’application mobile « eC3.2 Chômage temporaire ».',
    answerKey: 'public.ec32Content.faq.3.a',
  },
  {
    q: 'Comment se connecter à la vraie application ?',
    questionKey: 'public.ec32Content.faq.4.q',
    a: 'La connexion se fait avec un moyen d’identification sécurisé : eID, itsme, code de sécurité (par e-mail ou via l’application mobile) ou un moyen d’identification européen reconnu.',
    answerKey: 'public.ec32Content.faq.4.a',
  },
  {
    q: 'Que faire si je suis travailleur frontalier ?',
    questionKey: 'public.ec32Content.faq.5.q',
    a: 'Avec un numéro de registre national ou un numéro BIS, vous pouvez utiliser un moyen d’identification électronique européen. À défaut, une clé numérique alternative peut être nécessaire.',
    answerKey: 'public.ec32Content.faq.5.a',
  },
  {
    q: 'Dois-je être inscrit auprès d’un organisme de paiement ?',
    questionKey: 'public.ec32Content.faq.6.q',
    a: 'Oui. Pour percevoir des allocations et pour envoyer la carte, vous devez être inscrit auprès d’un organisme de paiement : la CAPAC, la CSC, la FGTB ou la CGSLB.',
    answerKey: 'public.ec32Content.faq.6.a',
  },
  {
    q: 'Puis-je compléter la carte sans organisme de paiement ?',
    questionKey: 'public.ec32Content.faq.7.q',
    a: 'Oui, vous pouvez compléter la carte, mais elle ne pourra pas être envoyée tant que votre inscription auprès d’un organisme de paiement n’est pas effectuée.',
    answerKey: 'public.ec32Content.faq.7.a',
  },
  {
    q: 'Quel employeur dois-je choisir ?',
    questionKey: 'public.ec32Content.faq.8.q',
    a: 'Choisissez l’employeur qui vous a mis en chômage temporaire. Si plusieurs employeurs vous ont mis en chômage temporaire, une carte distincte doit être complétée pour chaque employeur concerné.',
    answerKey: 'public.ec32Content.faq.8.a',
  },
  {
    q: 'Que faire si j’ai plusieurs employeurs ?',
    questionKey: 'public.ec32Content.faq.9.q',
    a: 'Vous devez informer votre organisme de paiement de toutes vos occupations. En cas de chômage temporaire chez plusieurs employeurs, une carte doit être complétée pour chaque employeur concerné.',
    answerKey: 'public.ec32Content.faq.9.a',
  },
  {
    q: 'Que dois-je faire si je travaille pendant une période de chômage temporaire ?',
    questionKey: 'public.ec32Content.faq.10.q',
    a: 'Vous devez indiquer le travail sur la carte avant de commencer à travailler, et non après.',
    answerKey: 'public.ec32Content.faq.10.a',
  },
  {
    q: 'Que dois-je indiquer si je suis malade ?',
    questionKey: 'public.ec32Content.faq.11.q',
    a: 'Indiquez « Inaptitude au travail » pour les jours concernés, y compris les week-ends et jours fériés s’ils sont couverts. Pensez aussi à prévenir votre mutualité dans les 48 heures.',
    answerKey: 'public.ec32Content.faq.11.a',
  },
  {
    q: 'Que dois-je indiquer si je prends des vacances ?',
    questionKey: 'public.ec32Content.faq.12.q',
    a: 'Indiquez « Vacances » pour les jours concernés.',
    answerKey: 'public.ec32Content.faq.12.a',
  },
  {
    q: 'Que signifie « Autre situation » ?',
    questionKey: 'public.ec32Content.faq.13.q',
    a: 'Cette catégorie couvre par exemple les jours fériés, les repos compensatoires, les formations rémunérées, les congés sans solde, les absences injustifiées, la détention, le congé de paternité ou certains congés extralégaux.',
    answerKey: 'public.ec32Content.faq.13.a',
  },
  {
    q: 'Puis-je corriger une erreur ?',
    questionKey: 'public.ec32Content.faq.14.q',
    a: 'Oui, tant que la carte n’est pas envoyée. Une explication peut être demandée pour justifier la correction.',
    answerKey: 'public.ec32Content.faq.14.a',
  },
  {
    q: 'L’ONEM est-il informé des corrections ?',
    questionKey: 'public.ec32Content.faq.15.q',
    a: 'Dans la véritable application, l’ONEM est informé des modifications apportées à la carte.',
    answerKey: 'public.ec32Content.faq.15.a',
  },
  {
    q: 'Quand puis-je envoyer ma carte ?',
    questionKey: 'public.ec32Content.faq.16.q',
    a: 'Vous pouvez l’envoyer à partir de la première date d’envoi possible. Même si cette date tombe avant la fin du mois, complétez correctement la carte jusqu’au dernier jour du mois.',
    answerKey: 'public.ec32Content.faq.16.a',
  },
  {
    q: 'Que se passe-t-il après l’envoi ?',
    questionKey: 'public.ec32Content.faq.17.q',
    a: 'Dans la véritable application, la carte est envoyée à votre organisme de paiement. Dans la simulation Docbel, aucun envoi réel n’a lieu.',
    answerKey: 'public.ec32Content.faq.17.a',
  },
  {
    q: 'La CP 327 est-elle concernée ?',
    questionKey: 'public.ec32Content.faq.18.q',
    a: 'Le webinaire mentionne une dérogation permanente pour la CP 327. Cette information reste à vérifier et à mettre à jour avant la publication finale.',
    answerKey: 'public.ec32Content.faq.18.a',
  },
  {
    q: 'Les employeurs doivent-ils encore donner une carte papier ?',
    questionKey: 'public.ec32Content.faq.19.q',
    a: 'Depuis l’obligation de l’eC3.2, il n’y a en principe plus de carte papier, sauf en cas de dérogation applicable.',
    answerKey: 'public.ec32Content.faq.19.a',
  },
]
