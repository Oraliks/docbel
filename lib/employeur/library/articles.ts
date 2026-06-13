/**
 * Module 4 — Bibliothèque des démarches employeur.
 *
 * 12 articles pédagogiques (FR) vulgarisant les principales démarches d'un
 * employeur en Belgique. Contenu volontairement GÉNÉRAL et informatif (jamais
 * bloquant) : chaque article renvoie aux sources officielles (codes S1..S13,
 * cf. lib/employeur/data/legal-sources.ts) pour la règle exacte applicable au
 * cas du lecteur (commission paritaire, CCT, statut, mises à jour légales).
 *
 * Aucune nouvelle table : ce contenu est purement statique.
 */

export interface LibraryArticle {
  /** Identifiant d'URL (slug stable). */
  slug: string;
  /** Titre court de l'article. */
  title: string;
  /** Résumé 2-3 lignes, affiché en tête d'article et sur les cartes. */
  summary: string;
  /** « Ce que vous devez savoir » : repères clés. */
  whatToKnow: string[];
  /** « À faire » : étapes concrètes. */
  todo: string[];
  /** « Documents nécessaires ». */
  documents: string[];
  /** « Erreurs fréquentes » à éviter. */
  commonMistakes: string[];
  /** Codes de sources officielles cités (S1..S13). */
  sourceCodes: string[];
  /** Affiche un bouton « Créer ma checklist » (démarches actionnables). */
  checklistCta?: boolean;
}

export const ARTICLES: LibraryArticle[] = [
  {
    slug: "engager-premier-travailleur",
    title: "Engager son premier travailleur",
    summary:
      "Embaucher pour la première fois transforme votre entreprise en employeur. Quelques formalités sociales doivent être réglées avant le premier jour de travail. Voici les grandes étapes, sans jargon.",
    whatToKnow: [
      "Dès le premier engagement, votre entreprise acquiert la « qualité d'employeur » auprès de l'ONSS.",
      "Une déclaration Dimona doit être faite AVANT que le travailleur ne commence à travailler.",
      "Vous serez ensuite redevable de cotisations sociales déclarées trimestriellement (DmfA).",
      "La plupart des employeurs s'affilient à un secrétariat social agréé qui gère ces démarches pour eux.",
    ],
    todo: [
      "Faire identifier votre entreprise comme employeur auprès de l'ONSS (qualité d'employeur).",
      "Souscrire une assurance accidents du travail (obligatoire dès le premier travailleur).",
      "Effectuer la déclaration Dimona avant le premier jour de prestation.",
      "Vérifier la commission paritaire applicable pour connaître le salaire minimum et les conditions de travail.",
      "Préparer le contrat de travail écrit lorsque c'est requis ou recommandé.",
    ],
    documents: [
      "Données d'identification de l'entreprise (numéro BCE).",
      "Données du travailleur (NISS / numéro de registre national).",
      "Police d'assurance accidents du travail.",
      "Projet de contrat de travail.",
    ],
    commonMistakes: [
      "Faire commencer le travailleur avant d'avoir introduit la Dimona.",
      "Oublier l'assurance accidents du travail, obligatoire dès la première embauche.",
      "Ignorer la commission paritaire et appliquer un salaire inférieur au barème.",
    ],
    sourceCodes: ["S1", "S2", "S6", "S8"],
    checklistCta: true,
  },
  {
    slug: "faire-une-dimona",
    title: "Faire une Dimona",
    summary:
      "La Dimona est la déclaration immédiate de l'emploi : elle signale l'entrée (et la sortie) d'un travailleur à la sécurité sociale. Elle est obligatoire et doit précéder le début des prestations.",
    whatToKnow: [
      "Dimona = Déclaration Immédiate / Onmiddellijke Aangifte. Elle se fait en ligne.",
      "La déclaration d'entrée doit être faite au plus tard au moment où le travailleur commence.",
      "Le type de travailleur (ouvrier, employé, étudiant, flexi…) détermine le code et les données à indiquer.",
      "Une déclaration de sortie est faite à la fin du contrat.",
    ],
    todo: [
      "Se connecter au portail de la sécurité sociale (ou laisser faire son secrétariat social).",
      "Encoder les données du travailleur et la date de début.",
      "Valider la Dimona AVANT le premier jour de travail.",
      "Conserver l'accusé de réception (numéro de référence Dimona).",
    ],
    documents: [
      "NISS du travailleur (numéro de registre national).",
      "Numéro d'employeur ONSS.",
      "Date de début (et type de travailleur).",
    ],
    commonMistakes: [
      "Déclarer la Dimona en retard, après le début des prestations.",
      "Se tromper de type de travailleur (impact sur les cotisations).",
      "Oublier la Dimona de sortie en fin de contrat.",
    ],
    sourceCodes: ["S2"],
  },
  {
    slug: "comprendre-dmfa",
    title: "Comprendre la DmfA",
    summary:
      "La DmfA est la déclaration trimestrielle qui détaille les rémunérations, le temps de travail et les cotisations sociales de vos travailleurs. C'est elle qui calcule ce que vous devez à l'ONSS.",
    whatToKnow: [
      "DmfA = Déclaration multifonctionnelle, envoyée chaque trimestre à l'ONSS.",
      "Elle reprend, par travailleur, la rémunération, les jours/heures prestés et les cotisations.",
      "Elle sert à plusieurs institutions (pensions, chômage, soins de santé) : d'où « multifonctionnelle ».",
      "En pratique, le secrétariat social l'établit à partir des données de paie.",
    ],
    todo: [
      "Rassembler chaque trimestre les éléments de rémunération et de temps de travail.",
      "Transmettre les données à votre secrétariat social (ou les encoder vous-même).",
      "Vérifier la cohérence avec les Dimona et les fiches de paie.",
      "Respecter l'échéance trimestrielle de dépôt et de paiement des cotisations.",
    ],
    documents: [
      "Données de paie du trimestre (salaires bruts, primes).",
      "Relevé des jours/heures prestés et des absences.",
      "Numéro d'employeur ONSS.",
    ],
    commonMistakes: [
      "Oublier des éléments de rémunération soumis à cotisations (primes, avantages).",
      "Incohérences entre Dimona, DmfA et fiches de paie.",
      "Déclaration ou paiement hors délai trimestriel.",
    ],
    sourceCodes: ["S3"],
  },
  {
    slug: "choisir-contrat-de-travail",
    title: "Choisir le bon contrat de travail",
    summary:
      "CDI, CDD, temps plein ou partiel, étudiant, flexi-job… Le choix du contrat dépend du besoin et a des conséquences sociales. Certains contrats imposent un écrit obligatoire.",
    whatToKnow: [
      "Le CDI est la règle ; le CDD et les contrats particuliers ont des conditions et un formalisme propres.",
      "Plusieurs contrats exigent un écrit signé AVANT le début (temps partiel, étudiant, flexi-job, intérim).",
      "Le contrat précise notamment la fonction, l'horaire, le lieu et la rémunération.",
      "La commission paritaire fixe des conditions minimales qui s'imposent au contrat.",
    ],
    todo: [
      "Définir le besoin (durée, volume horaire, type de fonction).",
      "Choisir le type de contrat adapté et vérifier s'il impose un écrit.",
      "Rédiger le contrat avec les mentions obligatoires.",
      "Faire signer le contrat avant le premier jour quand l'écrit est requis.",
    ],
    documents: [
      "Modèle de contrat adapté au type choisi.",
      "Données du travailleur et de l'employeur.",
      "Référence de la commission paritaire et du barème applicable.",
    ],
    commonMistakes: [
      "Démarrer un contrat à temps partiel ou étudiant sans écrit signé au préalable.",
      "Omettre des mentions obligatoires (horaire de travail, par exemple).",
      "Choisir un CDD enchaîné sans justification valable.",
    ],
    sourceCodes: ["S6"],
    checklistCta: true,
  },
  {
    slug: "temps-partiel",
    title: "Embaucher à temps partiel",
    summary:
      "Le temps partiel implique des règles spécifiques : contrat écrit, mention claire de l'horaire et publicité des horaires variables. Un cadre précis évite les litiges et les régularisations.",
    whatToKnow: [
      "Le contrat à temps partiel doit être écrit et mentionner le régime et l'horaire de travail.",
      "Pour les horaires variables, les plages et la communication des horaires doivent respecter des règles.",
      "Les horaires doivent pouvoir être affichés/consultables et le règlement de travail en tient compte.",
      "Le travailleur à temps partiel bénéficie de protections (priorité pour des heures complémentaires, p. ex.).",
    ],
    todo: [
      "Établir un contrat écrit précisant la durée de travail et l'horaire.",
      "Définir un horaire fixe ou un cadre clair pour les horaires variables.",
      "Mettre le règlement de travail en cohérence avec les horaires à temps partiel.",
      "Organiser l'affichage / la communication des horaires conformément aux règles.",
    ],
    documents: [
      "Contrat de travail à temps partiel écrit.",
      "Horaire de travail (fixe ou cadre des horaires variables).",
      "Règlement de travail mentionnant les horaires.",
    ],
    commonMistakes: [
      "Absence d'écrit ou horaire imprécis dans le contrat à temps partiel.",
      "Ne pas respecter les règles de communication des horaires variables.",
      "Horaires non repris ou contradictoires dans le règlement de travail.",
    ],
    sourceCodes: ["S6", "S11"],
    checklistCta: true,
  },
  {
    slug: "etudiant",
    title: "Engager un étudiant",
    summary:
      "Le travail étudiant permet, sous conditions, des cotisations réduites pendant un contingent d'heures. Le contrat d'occupation d'étudiant est écrit et comporte des mentions obligatoires.",
    whatToKnow: [
      "Le contrat d'occupation d'étudiant doit être écrit et signé, avec des mentions obligatoires.",
      "Un contingent annuel d'heures donne droit à une cotisation de solidarité réduite.",
      "La Dimona « étudiant » permet de réserver et suivre les heures du contingent.",
      "Au-delà du contingent ou sans les conditions remplies, les cotisations ordinaires s'appliquent.",
    ],
    todo: [
      "Établir un contrat d'occupation d'étudiant écrit avec toutes les mentions obligatoires.",
      "Faire la Dimona « étudiant » en indiquant les heures, avant le début.",
      "Vérifier le solde du contingent d'heures de l'étudiant.",
      "Remettre le règlement de travail et informer l'étudiant de ses conditions.",
    ],
    documents: [
      "Contrat d'occupation d'étudiant signé.",
      "NISS de l'étudiant et données de l'employeur.",
      "Suivi des heures du contingent.",
    ],
    commonMistakes: [
      "Faire travailler l'étudiant sans contrat écrit signé au préalable.",
      "Dépasser le contingent sans anticiper le passage aux cotisations ordinaires.",
      "Oublier la Dimona étudiant ou mal déclarer les heures.",
    ],
    sourceCodes: ["S9", "S2"],
    checklistCta: true,
  },
  {
    slug: "flexi-job",
    title: "Engager en flexi-job",
    summary:
      "Le flexi-job permet, dans certains secteurs et sous conditions, d'occuper une personne déjà suffisamment occupée ailleurs ou pensionnée, avec un régime social spécifique. Un contrat-cadre écrit est requis.",
    whatToKnow: [
      "Le flexi-job suppose des conditions d'accès strictes (occupation suffisante ailleurs ou pension).",
      "Un contrat-cadre écrit est nécessaire, complété par un contrat de travail par période.",
      "Une cotisation patronale spécifique s'applique et la rémunération suit des règles propres.",
      "Le flexi-job n'est ouvert que dans les secteurs et situations prévus par la réglementation.",
    ],
    todo: [
      "Vérifier que le travailleur remplit les conditions d'accès au flexi-job.",
      "Conclure un contrat-cadre écrit, puis un contrat par période d'occupation.",
      "Effectuer la Dimona spécifique au flexi-job.",
      "Appliquer la rémunération et les cotisations propres au régime flexi.",
    ],
    documents: [
      "Contrat-cadre flexi-job écrit.",
      "Contrat de travail par période d'occupation.",
      "Justificatif des conditions d'accès du travailleur.",
    ],
    commonMistakes: [
      "Occuper en flexi-job une personne ne remplissant pas les conditions.",
      "Absence de contrat-cadre écrit préalable.",
      "Appliquer le régime ordinaire de cotisations au lieu du régime flexi (ou l'inverse).",
    ],
    sourceCodes: ["S10", "S2"],
    checklistCta: true,
  },
  {
    slug: "salaire-minimum-et-commission-paritaire",
    title: "Salaire minimum et commission paritaire",
    summary:
      "Le salaire minimum applicable dépend largement de la commission paritaire (CP) du secteur et des CCT. Identifier sa CP est une étape clé pour fixer une rémunération conforme.",
    whatToKnow: [
      "Chaque activité relève d'une commission paritaire qui fixe des conditions minimales par CCT.",
      "Le barème sectoriel prime souvent sur le minimum interprofessionnel national.",
      "Sans connaître la CP, on ne peut pas vérifier précisément le barème applicable.",
      "Les barèmes peuvent dépendre de la fonction, de l'ancienneté et de l'âge.",
    ],
    todo: [
      "Identifier la commission paritaire correspondant à votre activité.",
      "Consulter les CCT et barèmes applicables à la fonction concernée.",
      "Fixer la rémunération au moins au niveau du barème sectoriel.",
      "Tenir compte de l'ancienneté et des indexations éventuelles.",
    ],
    documents: [
      "Référence de la commission paritaire de l'entreprise.",
      "Barèmes sectoriels et CCT applicables.",
      "Description de la fonction et de l'ancienneté.",
    ],
    commonMistakes: [
      "Appliquer le minimum national alors qu'un barème sectoriel plus élevé s'impose.",
      "Ne pas identifier sa commission paritaire.",
      "Oublier d'indexer ou de réviser le salaire selon la CCT.",
    ],
    sourceCodes: ["S8"],
  },
  {
    slug: "reglement-de-travail",
    title: "Le règlement de travail",
    summary:
      "Le règlement de travail fixe les règles internes (horaires, congés, modalités de paie, etc.). Sa mise en place suit une procédure et il doit être remis à chaque travailleur.",
    whatToKnow: [
      "Le règlement de travail est en principe obligatoire dès qu'on occupe du personnel.",
      "Sa mise en place et ses modifications suivent une procédure (information, concertation, dépôt).",
      "Il contient des mentions obligatoires (horaires, paiement de la rémunération, congés…).",
      "Un exemplaire doit être remis à chaque travailleur et tenu à disposition.",
    ],
    todo: [
      "Rédiger le règlement avec les mentions obligatoires.",
      "Suivre la procédure d'introduction (information du personnel, délai d'observation).",
      "Déposer le règlement auprès de l'autorité compétente.",
      "Remettre un exemplaire à chaque travailleur et conserver une preuve.",
    ],
    documents: [
      "Projet de règlement de travail.",
      "Preuve d'information du personnel et de dépôt.",
      "Accusé de remise aux travailleurs.",
    ],
    commonMistakes: [
      "Ne pas établir de règlement de travail alors qu'on occupe du personnel.",
      "Modifier le règlement sans respecter la procédure.",
      "Oublier de remettre le règlement aux nouveaux travailleurs.",
    ],
    sourceCodes: ["S7"],
  },
  {
    slug: "duree-du-travail-et-repos",
    title: "Durée du travail et repos",
    summary:
      "La loi encadre la durée du travail, les pauses et les repos. Des limites journalières et hebdomadaires s'appliquent, avec des exceptions sectorielles et des règles pour le travail du dimanche ou de nuit.",
    whatToKnow: [
      "Des limites journalières et hebdomadaires de durée du travail s'appliquent.",
      "Le repos (intervalle minimal, repos dominical) et les pauses sont réglementés.",
      "Le travail de nuit et le dimanche obéissent à des règles particulières.",
      "Des exceptions et assouplissements existent selon le secteur et les CCT.",
    ],
    todo: [
      "Construire les horaires dans le respect des limites journalières/hebdomadaires.",
      "Garantir les temps de repos et de pause minimaux.",
      "Vérifier les règles propres au travail de nuit/dimanche si concerné.",
      "Intégrer les horaires au règlement de travail.",
    ],
    documents: [
      "Horaires de travail des travailleurs.",
      "Règlement de travail mentionnant les horaires.",
      "Éventuelles CCT sectorielles applicables.",
    ],
    commonMistakes: [
      "Dépasser les limites de durée du travail sans base légale ou CCT.",
      "Ne pas respecter les temps de repos minimaux.",
      "Faire travailler le dimanche/la nuit sans vérifier les conditions.",
    ],
    sourceCodes: ["S11"],
  },
  {
    slug: "chomage-temporaire",
    title: "Recourir au chômage temporaire",
    summary:
      "Le chômage temporaire permet de suspendre l'exécution du contrat dans certaines situations (force majeure, raisons économiques, intempéries…). La procédure et les documents varient selon le motif.",
    whatToKnow: [
      "Le chômage temporaire suspend le contrat sans le rompre, pour un motif reconnu.",
      "Les motifs (force majeure, raisons économiques, intempéries…) ont chacun leurs conditions.",
      "Des communications à l'ONEM et des documents au travailleur sont requis selon le motif.",
      "Le travailleur perçoit des allocations de l'ONEM pour les jours concernés.",
    ],
    todo: [
      "Vérifier que la situation correspond à un motif reconnu de chômage temporaire.",
      "Effectuer les communications/déclarations requises auprès de l'ONEM.",
      "Informer les travailleurs et leur remettre les documents nécessaires.",
      "Tenir à jour le suivi des jours de chômage temporaire.",
    ],
    documents: [
      "Justification du motif (force majeure, économique, intempéries…).",
      "Communications/déclarations ONEM.",
      "Documents à remettre au travailleur pour ses allocations.",
    ],
    commonMistakes: [
      "Invoquer un motif qui ne correspond pas aux conditions légales.",
      "Omettre les communications obligatoires à l'ONEM.",
      "Ne pas fournir au travailleur les documents nécessaires à ses allocations.",
    ],
    sourceCodes: ["S12"],
  },
  {
    slug: "preparer-demande-secretariat-social",
    title: "Préparer sa demande au secrétariat social",
    summary:
      "Le secrétariat social agréé gère la paie et les déclarations sociales. Bien préparer les informations en amont accélère l'affiliation et fiabilise la première paie.",
    whatToKnow: [
      "Le secrétariat social établit les fiches de paie, la DmfA et souvent les Dimona pour vous.",
      "Une affiliation claire et des données complètes évitent erreurs et régularisations.",
      "Vous restez l'employeur responsable : les données que vous transmettez doivent être exactes.",
      "Plus la commission paritaire et le contrat sont précis, plus la paie sera fiable.",
    ],
    todo: [
      "Rassembler les données de l'entreprise (BCE, ONSS, assurance accidents).",
      "Préparer pour chaque travailleur : contrat, fonction, horaire, barème/CP.",
      "Clarifier les éléments variables (primes, frais, avantages) à intégrer en paie.",
      "Transmettre un dossier complet et désigner un interlocuteur unique.",
    ],
    documents: [
      "Données d'identification de l'entreprise (BCE, ONSS).",
      "Contrats de travail et descriptions de fonction.",
      "Commission paritaire et barèmes applicables.",
      "Liste des éléments variables de rémunération.",
    ],
    commonMistakes: [
      "Transmettre des données incomplètes (CP manquante, horaire imprécis).",
      "Oublier des éléments de rémunération variables.",
      "Considérer que le secrétariat social vérifie tout à votre place.",
    ],
    sourceCodes: ["S5", "S6"],
  },
];

/** Retourne l'article correspondant au slug, ou undefined. */
export function getArticle(slug: string): LibraryArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
