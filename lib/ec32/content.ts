// =====================================================================
//  eC3.2 — Contenu pédagogique par défaut (source de repli du builder)
// ---------------------------------------------------------------------
//  Objet `ec32DefaultContent` complet et conforme au type `Ec32Content`
//  (dérivé du schéma Zod de `schema.ts`). Il alimente :
//    1. la valeur initiale du bloc dans le page-builder ;
//    2. le rendu de secours lorsqu'aucun bloc n'est enregistré.
//
//  IMPORTANT — ce module est PUR (aucune dépendance React). Il réutilise
//  les jeux de données frères (`situations`, `scenarios`, `faq`,
//  `mistakes`) et dérive `labels`/`notices` du vocabulaire partagé
//  (`labels.ts`) afin de garantir une couverture exhaustive des clés.
//
//  Simulation pédagogique NON officielle : données fictives, rien n'est
//  transmis à l'ONEM, aucun logo officiel, aucune donnée réelle demandée.
// =====================================================================

import { ec32DefaultScenarios } from './scenarios'
import { ec32DefaultFaq } from './faq'
import { ec32DefaultMistakes } from './mistakes'
import { ec32DefaultSituations } from './situations'
import { EC32_LABELS, EC32_NOTICES } from './labels'
import type { Ec32Content } from './schema'

// ─────────────────────────── Contenu par défaut ───────────────────────────

export const ec32DefaultContent: Ec32Content = {
  seo: {
    title:
      'eC3.2 : simulation interactive pour apprendre à remplir sa carte de chômage temporaire | Docbel',
    description:
      'Comprenez comment compléter la carte de contrôle électronique chômage temporaire eC3.2 grâce à une simulation pédagogique non officielle, des cas pratiques et les erreurs à éviter.',
    canonical: '/onem/ec32',
    noIndex: false,
  },

  hero: {
    badge: 'Simulation pédagogique non officielle',
    title: 'eC3.2, expliqué simplement',
    subtitle:
      'Testez vos démarches de contrôle électronique de chômage dans un simulateur clair, sans risque et 100 % confidentiel.',
    primaryCta: 'Lancer la simulation',
    secondaryCta: 'Voir les cas pratiques',
    disclaimer:
      'Aucune donnée réelle n’est demandée. Aucune donnée n’est transmise à l’ONEM.',
  },

  disclaimer: {
    title: 'Simulation pédagogique non officielle',
    points: [
      'Simulation pédagogique non officielle',
      'Aucune donnée réelle n’est demandée',
      'Aucune donnée n’est transmise à l’ONEM',
      'Cette page ne remplace pas l’application officielle eC3.2',
      'Pour effectuer une vraie démarche, utilisez l’application officielle eC3.2',
    ],
  },

  alert: {
    title: 'Avant de commencer',
    content:
      'La carte eC3.2 concerne uniquement le chômage temporaire (réduction ou suspension d’activité chez votre employeur), à ne pas confondre avec l’eC3, qui concerne le chômage complet. Tout ce qui est affiché ici est fictif et sert uniquement à l’apprentissage : aucune connexion, aucun envoi et aucune donnée réelle ne sont en jeu.',
  },

  learningModes: {
    title: 'Comment apprendre',
    subtitle:
      'Trois façons d’aborder la carte eC3.2, selon que vous préférez être guidé, vous exercer sur des cas concrets ou explorer librement.',
    modes: [
      {
        key: 'guided',
        icon: 'compass',
        title: 'Mode guidé pas à pas',
        titleKey: 'public.ec32Content.content.learningModes.modes.guided.title',
        description:
          'Avancez étape par étape, de la connexion simulée à l’envoi fictif. À chaque écran, une explication et un conseil du coach vous accompagnent.',
        descriptionKey: 'public.ec32Content.content.learningModes.modes.guided.description',
        cta: 'Commencer',
        ctaKey: 'public.ec32Content.content.learningModes.modes.guided.cta',
      },
      {
        key: 'scenarios',
        icon: 'layout-list',
        title: 'Cas pratiques',
        titleKey: 'public.ec32Content.content.learningModes.modes.scenarios.title',
        description:
          'Chargez un cas concret (travail un jour de chômage, maladie, vacances, plusieurs employeurs…) directement dans le simulateur pour vous entraîner.',
        descriptionKey: 'public.ec32Content.content.learningModes.modes.scenarios.description',
        cta: 'Explorer les cas',
        ctaKey: 'public.ec32Content.content.learningModes.modes.scenarios.cta',
      },
      {
        key: 'free',
        icon: 'sparkles',
        title: 'Exploration libre',
        titleKey: 'public.ec32Content.content.learningModes.modes.free.title',
        description:
          'Manipulez le calendrier à votre rythme : changez les situations, testez les corrections et observez ce qui se passe, sans aucune contrainte.',
        descriptionKey: 'public.ec32Content.content.learningModes.modes.free.description',
        cta: 'Ouvrir le simulateur',
        ctaKey: 'public.ec32Content.content.learningModes.modes.free.cta',
      },
    ],
  },

  simulator: {
    title: 'Simulateur eC3.2 — carte fictive',
    subtitle:
      'Une reconstitution pédagogique des écrans de l’application : connexion, déclaration, choix de l’employeur et du mois, remplissage du calendrier, corrections, vérification et envoi simulé.',
    fictitiousDataNotice:
      'Les données affichées sont fictives et servent uniquement à l’apprentissage.',
    steps: [
      {
        key: 'login',
        title: 'Connexion simulée',
        titleKey: 'public.ec32Content.content.simulator.steps.login.title',
        description:
          'Découvrez les moyens d’identification (eID, itsme, frontaliers) sans aucune connexion réelle.',
        descriptionKey: 'public.ec32Content.content.simulator.steps.login.description',
      },
      {
        key: 'declaration',
        title: 'Déclaration sur l’honneur',
        titleKey: 'public.ec32Content.content.simulator.steps.declaration.title',
        description:
          'Choisissez votre mois de départ et confirmez le passage à la voie électronique — étape fictive.',
        descriptionKey:
          'public.ec32Content.content.simulator.steps.declaration.description',
      },
      {
        key: 'employer',
        title: 'Choix de l’employeur',
        titleKey: 'public.ec32Content.content.simulator.steps.employer.title',
        description:
          'Sélectionnez l’employeur qui vous a mis en chômage temporaire pour le mois concerné.',
        descriptionKey: 'public.ec32Content.content.simulator.steps.employer.description',
      },
      {
        key: 'month',
        title: 'Choix du mois',
        titleKey: 'public.ec32Content.content.simulator.steps.month.title',
        description:
          'Ouvrez la carte du mois à compléter ; les cartes déjà envoyées sont verrouillées.',
        descriptionKey: 'public.ec32Content.content.simulator.steps.month.description',
      },
      {
        key: 'calendar',
        title: 'Remplir le calendrier',
        titleKey: 'public.ec32Content.content.simulator.steps.calendar.title',
        description:
          'Indiquez vos situations jour par jour : par défaut, chaque case est considérée comme du chômage.',
        descriptionKey: 'public.ec32Content.content.simulator.steps.calendar.description',
      },
      {
        key: 'correction',
        title: 'Corriger une erreur',
        titleKey: 'public.ec32Content.content.simulator.steps.correction.title',
        description:
          'Modifiez un jour déjà encodé et expliquez la correction, tant que la carte n’est pas envoyée.',
        descriptionKey:
          'public.ec32Content.content.simulator.steps.correction.description',
      },
      {
        key: 'verify',
        title: 'Vérifier',
        titleKey: 'public.ec32Content.content.simulator.steps.verify.title',
        description:
          'Relisez l’ensemble de vos encodages avant l’envoi simulé, surtout les jours travaillés.',
        descriptionKey: 'public.ec32Content.content.simulator.steps.verify.description',
      },
      {
        key: 'send',
        title: 'Envoyer',
        titleKey: 'public.ec32Content.content.simulator.steps.send.title',
        description:
          'Confirmez l’envoi fictif de la carte ; aucune donnée réelle n’est transmise.',
        descriptionKey: 'public.ec32Content.content.simulator.steps.send.description',
      },
    ],
    situations: ec32DefaultSituations,
    employers: [
      {
        id: 'emp-a',
        name: 'Boulangerie Dupont — exemple',
        nameKey: 'public.ec32Content.content.simulator.employers.emp-a.name',
        enterpriseNumber: 'BE 0123.456.789 (fictif)',
        sector: 'Commerce de détail (exemple)',
        sectorKey: 'public.ec32Content.content.simulator.employers.emp-a.sector',
        type: 'single',
      },
      {
        id: 'emp-b',
        name: 'Atelier Lambert — exemple',
        nameKey: 'public.ec32Content.content.simulator.employers.emp-b.name',
        enterpriseNumber: 'BE 0987.654.321 (fictif)',
        sector: 'Industrie (exemple)',
        sectorKey: 'public.ec32Content.content.simulator.employers.emp-b.sector',
        type: 'multiple',
      },
      {
        id: 'emp-construction',
        name: 'Toitures Berger — exemple',
        nameKey: 'public.ec32Content.content.simulator.employers.emp-construction.name',
        enterpriseNumber: 'BE 0456.789.123 (fictif)',
        sector: 'Construction · CP 124 (exemple)',
        sectorKey: 'public.ec32Content.content.simulator.employers.emp-construction.sector',
        type: 'construction_cp124',
      },
    ],
    months: [
      {
        key: '2025-05',
        label: 'Mai 2025',
        labelKey: 'public.ec32Content.content.simulator.months.2025-05.label',
        statusNote: 'En cours',
        statusNoteKey: 'public.ec32Content.content.simulator.months.2025-05.statusNote',
      },
      {
        key: '2025-06',
        label: 'Juin 2025',
        labelKey: 'public.ec32Content.content.simulator.months.2025-06.label',
        statusNote: 'Pas encore disponible',
        statusNoteKey: 'public.ec32Content.content.simulator.months.2025-06.statusNote',
      },
      {
        key: '2025-04',
        label: 'Avril 2025',
        labelKey: 'public.ec32Content.content.simulator.months.2025-04.label',
        statusNote: 'Non envoyé',
        statusNoteKey: 'public.ec32Content.content.simulator.months.2025-04.statusNote',
      },
      {
        key: '2025-03',
        label: 'Mars 2025',
        labelKey: 'public.ec32Content.content.simulator.months.2025-03.label',
        statusNote: 'Envoyé · verrouillé',
        statusNoteKey: 'public.ec32Content.content.simulator.months.2025-03.statusNote',
      },
    ],
    labels: Object.entries(EC32_LABELS).map(([key, text]) => ({ key, text })),
    notices: Object.entries(EC32_NOTICES).map(([key, text]) => ({ key, text })),
    coach: {
      title: 'Coach Docbel',
      titleKey: 'public.ec32Content.content.simulator.coach.title',
      intro:
        'Je vous accompagne à chaque étape avec un conseil simple. Prenez votre temps : ici, vous ne risquez rien, c’est fait pour apprendre.',
      introKey: 'public.ec32Content.content.simulator.coach.intro',
      tips: [
        {
          stepKey: 'login',
          message:
            'Choisissez un moyen d’identification pour voir comment se passe la connexion. Rien n’est demandé ici : aucune carte, aucun code, aucune connexion réelle.',
          messageKey: 'public.ec32Content.content.simulator.coach.tips.login',
        },
        {
          stepKey: 'declaration',
          message:
            'Le mois choisi détermine à partir de quand vous utilisez l’eC3.2. Si vous étiez déjà en chômage temporaire avant, vous pourrez activer un mois antérieur plus tard.',
          messageKey: 'public.ec32Content.content.simulator.coach.tips.declaration',
        },
        {
          stepKey: 'employer',
          message:
            'Sélectionnez l’employeur qui vous a mis en chômage temporaire. Vos éventuelles autres occupations seront indiquées sur cette même carte.',
          messageKey: 'public.ec32Content.content.simulator.coach.tips.employer',
        },
        {
          stepKey: 'month',
          message:
            'Ouvrez la carte du mois à compléter. Une carte déjà envoyée est verrouillée : vous ne pourrez plus la modifier.',
          messageKey: 'public.ec32Content.content.simulator.coach.tips.month',
        },
        {
          stepKey: 'calendar',
          message:
            'Par défaut, chaque jour est considéré comme du chômage : vous n’indiquez que ce qui change (travail, maladie, vacances…). Tout travail doit être enregistré avant de commencer.',
          messageKey: 'public.ec32Content.content.simulator.coach.tips.calendar',
        },
        {
          stepKey: 'correction',
          message:
            'Pour corriger un jour, expliquez clairement le changement : cette explication aide les inspecteurs. Seules les cartes non envoyées peuvent être corrigées.',
          messageKey: 'public.ec32Content.content.simulator.coach.tips.correction',
        },
        {
          stepKey: 'verify',
          message:
            'Relisez calmement chaque jour, surtout les jours travaillés et les jours d’inaptitude. Mieux vaut vérifier deux fois qu’envoyer une carte incomplète.',
          messageKey: 'public.ec32Content.content.simulator.coach.tips.verify',
        },
        {
          stepKey: 'send',
          message:
            'Vérifiez que la première date d’envoi possible est atteinte et que vous êtes affilié à un organisme de paiement. Ici, l’envoi est simulé : rien ne part vers l’ONEM.',
          messageKey: 'public.ec32Content.content.simulator.coach.tips.send',
        },
      ],
    },
    correctionModal: {
      title: 'Corriger la situation — simulation',
      helpText: EC32_NOTICES['correction.help'],
      dayLabel: 'Jour concerné',
      fromLabel: 'Ancienne situation',
      toLabel: 'Nouvelle situation',
      reasonLabel: 'Explication (obligatoire)',
      reasonPlaceholder: 'Expliquez la correction…',
      saveLabel: 'Sauvegarder la correction',
      lockedMessage:
        'Cette carte est envoyée et verrouillée dans la simulation.',
      requiredError:
        'L’explication est obligatoire pour enregistrer une correction.',
    },
    sendModal: {
      title: 'Envoyer la carte — simulation',
      body: 'Dans la vraie application, cette étape transmet la carte à votre organisme de paiement. Ici, aucune donnée réelle n’est envoyée.',
      cancelLabel: 'Annuler',
      confirmLabel: 'Confirmer l’envoi simulé',
      successTitle: 'Carte envoyée avec succès — simulation',
      successBody: 'Votre carte fictive est maintenant verrouillée.',
      blockedTitle: 'Envoi impossible — simulation',
      blockedBody:
        'Dans la vraie application, vous pouvez compléter la carte, mais vous devez être affilié à un organisme de paiement pour pouvoir l’envoyer.',
    },
    pdf: {
      buttonLabel: 'Télécharger l’aperçu — simulation',
      docTitle: 'Aperçu pédagogique eC3.2 — simulation',
      fictionMention: 'Document fictif — ne remplace pas une carte officielle.',
      warning: 'Ce document n’est pas une carte officielle.',
    },
  },

  scenarios: {
    title: 'Cas pratiques',
    subtitle: 'Chargez un cas dans le simulateur pour vous entraîner.',
    items: ec32DefaultScenarios,
  },

  mistakes: {
    title: 'Les erreurs fréquentes à éviter',
    subtitle:
      'Les pièges les plus courants au moment de remplir l’eC3.2 — et comment les éviter simplement.',
    items: ec32DefaultMistakes,
  },

  faq: {
    title: 'Foire aux questions',
    subtitle:
      'Les réponses claires aux questions les plus posées sur la carte de contrôle électronique du chômage temporaire.',
    items: ec32DefaultFaq,
  },

  resources: {
    title: 'Ressources officielles',
    subtitle:
      'Les sites et services officiels à utiliser pour vos démarches réelles.',
    intro:
      'Cette page est un outil d’apprentissage. Pour effectuer une véritable démarche, passez toujours par les canaux officiels ci-dessous.',
    officialButtonLabel: 'Accéder au site officiel de l’ONEM',
    officialUrl: 'https://www.onem.be',
    items: [
      {
        label: 'Portail de la sécurité sociale',
        labelKey: 'public.ec32Content.content.resourcesSection.items.secu.label',
        description:
          'Point d’accès officiel aux services en ligne de la sécurité sociale belge, dont l’application eC3.2.',
        descriptionKey: 'public.ec32Content.content.resourcesSection.items.secu.description',
        url: 'https://www.socialsecurity.be',
      },
      {
        label: 'eC3.2 sur Google Play (Android)',
        labelKey: 'public.ec32Content.content.resourcesSection.items.playstore.label',
        description:
          'L’application officielle pour compléter et envoyer votre carte de contrôle de chômage temporaire sur Android.',
        descriptionKey:
          'public.ec32Content.content.resourcesSection.items.playstore.description',
        url: 'https://play.google.com/store/apps/details?id=be.onemrvalfa.ec32',
      },
      {
        label: 'eC3.2 sur l’App Store (iPhone)',
        labelKey: 'public.ec32Content.content.resourcesSection.items.appstore.label',
        description:
          'L’application officielle pour compléter et envoyer votre carte de contrôle de chômage temporaire sur iPhone.',
        descriptionKey:
          'public.ec32Content.content.resourcesSection.items.appstore.description',
        url: 'https://apps.apple.com/be/app/ec3-2-ch%C3%B4mage-temporaire/id1435477924',
      },
      {
        label: 'Organismes de paiement (CAPAC, CSC, FGTB, SYNOVA)',
        labelKey: 'public.ec32Content.content.resourcesSection.items.orgs.label',
        description:
          'Pour percevoir vos allocations, vous devez être affilié à un organisme de paiement : la CAPAC (publique) ou un syndicat (CSC, FGTB, SYNOVA).',
        descriptionKey: 'public.ec32Content.content.resourcesSection.items.orgs.description',
        url: '/organisme-de-paiement',
      },
      {
        label: 'ONEM — Office national de l’emploi',
        labelKey: 'public.ec32Content.content.resourcesSection.items.onem.label',
        description:
          'L’administration responsable de la réglementation du chômage et de l’application eC3.2 en Belgique.',
        descriptionKey: 'public.ec32Content.content.resourcesSection.items.onem.description',
        url: 'https://www.onem.be',
      },
    ],
    note: 'Docbel n’est pas affilié à l’ONEM. Ces liens sont fournis à titre informatif.',
  },

  derogations: {
    title: 'Dérogations',
    subtitle:
      'Les exceptions et reports prévus pendant la période de transition vers l’eC3.2.',
    badge: 'À vérifier avant publication finale',
    items: [
      {
        key: 'cp327',
        title: 'Exception CP 327',
        titleKey: 'public.ec32Content.content.derogationsSection.items.cp327.title',
        summary:
          'Le webinaire mentionne une dérogation permanente pour la CP 327. Cette information doit être vérifiée avant toute publication finale et peut être modifiée dans le builder.',
        summaryKey: 'public.ec32Content.content.derogationsSection.items.cp327.summary',
        conditions: [],
      },
      {
        key: 'worker',
        title: 'Dérogation temporaire demandée par le travailleur',
        titleKey: 'public.ec32Content.content.derogationsSection.items.worker.title',
        summary:
          'Le travailleur informe l’employeur via un formulaire de notification ; l’employeur signe pour accusé de réception ou le travailleur envoie par recommandé ; puis demande auprès de l’ONEM et de son organisme de paiement.',
        summaryKey: 'public.ec32Content.content.derogationsSection.items.worker.summary',
        conditions: [
          'Demande complète',
          'Demande dans les délais',
          'Période maximale de trois mois consécutifs entre janvier 2025 et juin 2025',
          'Le travailleur ne doit pas encore avoir utilisé l’eC3.2',
        ],
        conditionsKey: 'public.ec32Content.content.derogationsSection.items.worker.conditions',
      },
      {
        key: 'employer',
        title: 'Dérogation temporaire demandée par l’employeur',
        titleKey: 'public.ec32Content.content.derogationsSection.items.employer.title',
        summary:
          'L’employeur introduit la demande auprès de l’ONEM. En cas d’accord : les travailleurs déjà sur eC3.2 continuent ; les autres peuvent continuer temporairement avec la carte papier, peuvent commencer l’eC3.2 à tout moment, et doivent l’utiliser après la fin de la période de dérogation.',
        summaryKey: 'public.ec32Content.content.derogationsSection.items.employer.summary',
        conditions: [
          'Informer les travailleurs',
          'S’engager à les accompagner',
          'Période maximale de trois mois consécutifs entre janvier 2025 et juin 2025',
        ],
        conditionsKey:
          'public.ec32Content.content.derogationsSection.items.employer.conditions',
      },
    ],
    transitionNote:
      'Une demande de dérogation pouvait être prolongée une fois si nécessaire jusqu’au 30 juin 2025 au plus tard. À partir du 1er juillet 2025, tous les chômeurs temporaires doivent utiliser l’eC3.2, sauf CP 327. (Ces règles peuvent évoluer — à vérifier avant publication finale.)',
  },

  officialInfo: {
    obligation: {
      title: 'Obligation à partir du 1er janvier 2025',
      intro:
        'Depuis le 1er janvier 2025, la carte de contrôle électronique eC3.2 devient la règle pour le chômage temporaire. Voici ce que cela change concrètement pour les travailleurs et pour les employeurs.',
      workersTitle: 'Pour les travailleurs',
      workers: [
        'Être en règle lors d’un contrôle repose sur une carte électronique correctement remplie',
        'Le travail doit être indiqué avant de commencer',
        'La carte doit être remplie à partir du premier jour effectif de chômage du mois',
        'Dans le secteur de la construction, elle doit toujours être remplie',
        'Le paiement se base sur la carte électronique',
      ],
      employersTitle: 'Pour les employeurs',
      employers: [
        'Ne plus délivrer de cartes papier sauf dérogation',
        'Ne plus remplir le livre de validation sauf pour les travailleurs recevant encore une carte papier',
        'Accompagner les travailleurs si nécessaire',
      ],
    },
    why: {
      title: 'Pourquoi l’eC3.2 ?',
      subtitle:
        'Les bénéfices avancés pour le passage de la carte papier à la carte électronique.',
      items: [
        'Lutte contre la fraude sociale',
        'L’ONEM est informé du remplissage de la carte',
        'Meilleure traçabilité de ce qui est rempli et quand',
        'Moins d’ambiguïté qu’avec le papier',
        'Paiement plus correct',
        'Traitement plus rapide',
        'Envoi numérique à l’organisme de paiement',
        'Processus de paiement automatisés',
        'Perte de carte impossible',
        'Fin de certaines procédures papier longues',
        'Disponible en NL, FR et DE',
      ],
      note: 'L’eC3.2 vise à faciliter un traitement plus rapide. (Docbel ne garantit pas un paiement plus rapide.)',
    },
    help: {
      title: 'Besoin d’aide ?',
      body: [
        'En cas de problème de connexion dans la vraie application, le webinaire mentionne le centre de contact de la sécurité sociale.',
        'En cas de problème d’utilisation de l’application, contactez votre organisme de paiement.',
        'Si vous ne pouvez pas remplir la carte à temps, informez l’ONEM afin d’être en règle en cas de contrôle.',
      ],
      disclaimer:
        'Docbel vous aide à comprendre la procédure, mais ne remplace pas l’ONEM ni votre organisme de paiement.',
    },
  },

  legal: {
    simulationLabel: 'Simulation pédagogique non officielle',
    noRealData: 'Aucune donnée réelle n’est demandée',
    noTransmission: 'Aucune donnée n’est transmise à l’ONEM',
    notReplacement: 'Cette page ne remplace pas l’application officielle eC3.2',
    useOfficial:
      'Pour effectuer une vraie démarche, utilisez l’application officielle eC3.2',
  },

  builderMetadata: {
    version: '1.0',
    lastReviewedNote:
      'Contenu pédagogique basé sur un webinaire ONEM — à vérifier avant publication finale (notamment CP 327 et dérogations).',
  },
}
