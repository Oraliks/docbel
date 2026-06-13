/**
 * Données de référence pour le générateur de contrats de travail belges.
 *
 * PORTÉE
 * -------
 * Ce module fournit UNIQUEMENT le contenu légal structuré (types, champs de
 * saisie, clauses-types, sources, disclaimer) servant à générer un MODÈLE de
 * contrat de travail. Il ne contient ni moteur de génération, ni I/O, ni
 * `server-only` : c'est un module pur réutilisable côté client + serveur.
 *
 * Le rendu (remplacement des placeholders {{field_id}}, mise en page, export)
 * et l'UI (sélection du type, cases à cocher des clauses optionnelles) sont
 * écrits ailleurs.
 *
 * TYPES COUVERTS
 * --------------
 *  - CDI            : contrat à durée indéterminée
 *  - CDD            : contrat à durée déterminée
 *  - remplacement   : contrat de remplacement
 *  - etudiant       : contrat d'occupation d'étudiant
 *
 * Le « temps plein / temps partiel » est traité comme une MODALITÉ (régime,
 * `WorkRegime`) applicable à chacun de ces types, et non comme un type distinct.
 *
 * BASE LÉGALE PRINCIPALE
 * ----------------------
 * Loi du 3 juillet 1978 relative aux contrats de travail.
 *  - CDD : art. 9 (écrit obligatoire au plus tard à l'entrée en service).
 *  - Remplacement : art. 11ter (écrit, motif, identité du remplacé) ; art.
 *    11quater (succession CDD + remplacement plafonnée à 2 ans depuis le
 *    08/05/2023).
 *  - Étudiant : Titre VII, art. 123-125 (écrit individuel, mentions
 *    obligatoires, durée max 12 mois).
 * Temps partiel : Loi-programme du 22/12/1989, art. 152 et s. (écrit
 * obligatoire mentionnant régime et horaire de travail, au plus tard au début
 * de l'exécution).
 *
 * SOURCES OFFICIELLES CONSULTÉES (vérifié le 2026-06-13)
 * -----------------------------------------------------
 *  - SPF Emploi — Types de contrat de travail :
 *    https://emploi.belgique.be/fr/themes/contrats-de-travail/conclusion-du-contrat-de-travail/types-de-contrat-de-travail
 *  - SPF Emploi — Contrat de travail à temps partiel :
 *    https://emploi.belgique.be/fr/themes/contrats-de-travail/contrats-de-travail-particuliers/contrat-de-travail-temps-partiel
 *  - SPF Emploi — Contrat d'occupation d'étudiants :
 *    https://emploi.belgique.be/fr/themes/contrats-de-travail/contrats-de-travail-particuliers/contrat-doccupation-detudiants
 *  - SPF Emploi — Succession de CDD / remplacement :
 *    https://emploi.belgique.be/fr/themes/contrats-de-travail/contrats-de-travail-particuliers/contrat-de-remplacement/succession-de-0
 *  - Loi du 3 juillet 1978 (texte coordonné, eJustice) :
 *    https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&table_name=loi&cn=1978070301
 *  - ONSS / Sécurité sociale — Dimona :
 *    https://www.socialsecurity.be/site_fr/employer/applics/dimona/index.htm
 *  - ONSS — Instructions administratives DmfA, Étudiants (contingent 650 h,
 *    Dimona STU) : https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/persons/specific/students.html
 *
 * INCERTITUDES / À FAIRE VALIDER PAR L'EXPERT (Oraliks)
 * ----------------------------------------------------
 *  1. Contingent étudiant : retenu à 650 h/an (mesure structurelle, instructions
 *     ONSS 2026/2). Était 475 h, porté temporairement à 600 h (2023-2024), puis
 *     475 h en 2025, puis 650 h structurel. À reconfirmer chaque année civile.
 *  2. PAS de clause de période d'essai : la période d'essai « générale » a été
 *     supprimée le 01/01/2014 (loi statut unique). Des régimes spécifiques
 *     subsistent (étudiants 3 premiers jours, intérim, art. 67/2). Volontairement
 *     non incluse ici — à valider si un cas particulier doit l'être.
 *  3. Clause de non-concurrence : volontairement EXCLUE (conditions de validité
 *     strictes, indemnité, seuils de rémunération). Ne pas générer sans conseil.
 *  4. Le salaire minimum et les barèmes dépendent de la commission paritaire :
 *     impossible à vérifier sans CP. À confirmer par secrétariat social.
 *  5. Durée du préavis étudiant : variable selon la durée du contrat (art. 130) ;
 *     non chiffrée dans la clause-type (renvoi générique) — à préciser.
 *  6. Mention « loi du 12 avril 1965 » : obligatoire dans le contrat étudiant.
 */

export type ContractType = "cdi" | "cdd" | "remplacement" | "etudiant";
export type WorkRegime = "temps_plein" | "temps_partiel";

/** Champ de saisie nécessaire à la génération (regroupé par bloc). */
export interface ContractField {
  id: string; // ex "employer_name", "worker_niss"
  label: string;
  type: "text" | "textarea" | "date" | "number";
  group: "employeur" | "travailleur" | "contrat";
  required: boolean;
  appliesTo?: ContractType[]; // si absent = tous les types
  help?: string; // aide vulgarisée
}

/** Clause de contrat. `mandatory:false` = clause OPTIONNELLE (case à cocher dans l'UI). */
export interface ContractClause {
  id: string;
  heading: string; // intitulé de l'article, ex "Article 1 — Objet et fonction"
  body: string; // texte de la clause, avec placeholders {{field_id}} (ex {{employer_name}})
  appliesTo: ContractType[];
  onlyRegime?: WorkRegime; // clause spécifique à un régime (ex temps partiel)
  mandatory: boolean;
  legalRef?: string; // ex "Loi du 3 juillet 1978, art. ..."
}

export interface ContractTypeDef {
  type: ContractType;
  label: string; // "Contrat à durée indéterminée (CDI)"
  description: string; // 1-2 phrases vulgarisées
  legalRefs: string[];
  writtenRequired: boolean; // l'écrit est-il obligatoire pour ce type ?
  note?: string;
}

const ALL_TYPES: ContractType[] = ["cdi", "cdd", "remplacement", "etudiant"];

/* -------------------------------------------------------------------------- */
/* Types de contrat                                                            */
/* -------------------------------------------------------------------------- */

export const CONTRACT_TYPES: ContractTypeDef[] = [
  {
    type: "cdi",
    label: "Contrat à durée indéterminée (CDI)",
    description:
      "La forme par défaut : l'engagement n'a pas de terme fixé. C'est le contrat le plus courant.",
    legalRefs: ["Loi du 3 juillet 1978 relative aux contrats de travail"],
    writtenRequired: false,
    note: "L'écrit n'est pas strictement obligatoire pour un CDI à temps plein, mais il est vivement recommandé (preuve des conditions). Il devient obligatoire dès qu'une modalité l'exige (ex. temps partiel, clauses particulières).",
  },
  {
    type: "cdd",
    label: "Contrat à durée déterminée (CDD)",
    description:
      "L'engagement prend fin automatiquement à une date ou un terme convenu, sans préavis.",
    legalRefs: [
      "Loi du 3 juillet 1978, art. 9 (écrit obligatoire)",
      "Loi du 3 juillet 1978, art. 10 et 10bis (succession de CDD)",
      "Loi du 3 juillet 1978, art. 11quater (cumul CDD/remplacement plafonné à 2 ans)",
    ],
    writtenRequired: true,
    note: "L'écrit (un par travailleur) doit exister au plus tard au moment de l'entrée en service, sinon le contrat est réputé à durée indéterminée. La succession ininterrompue de CDD (et contrats de remplacement) ne peut, en règle, dépasser 2 ans (depuis le 08/05/2023).",
  },
  {
    type: "remplacement",
    label: "Contrat de remplacement",
    description:
      "Conclu pour remplacer un travailleur dont le contrat est suspendu (sauf manque de travail économique ou grève).",
    legalRefs: [
      "Loi du 3 juillet 1978, art. 11ter (écrit, motif, identité du remplacé)",
      "Loi du 3 juillet 1978, art. 11quater (cumul plafonné à 2 ans)",
    ],
    writtenRequired: true,
    note: "L'écrit doit mentionner le motif du remplacement et l'identité du travailleur remplacé, et exister au plus tard à l'entrée en service. La durée totale des contrats de remplacement (cumulés aux CDD successifs) ne peut en principe dépasser 2 ans.",
  },
  {
    type: "etudiant",
    label: "Contrat d'occupation d'étudiant",
    description:
      "Contrat spécifique pour l'occupation d'un étudiant ; écrit individuel obligatoire avec mentions précises.",
    legalRefs: [
      "Loi du 3 juillet 1978, Titre VII (art. 120 à 130bis)",
      "Loi du 3 juillet 1978, art. 123-124 (écrit et mentions obligatoires)",
    ],
    writtenRequired: true,
    note: "Écrit obligatoire, en deux exemplaires, au plus tard à l'entrée en service. Durée maximale d'un contrat : 12 mois. Si l'écrit ou une mention obligatoire fait défaut, l'étudiant peut rompre le contrat à tout moment sans préavis ni indemnité. Occupation à déclarer en Dimona (type STU lorsque la cotisation de solidarité s'applique). Contingent à cotisation de solidarité : 650 h/an (à reconfirmer chaque année — voir disclaimer).",
  },
];

/* -------------------------------------------------------------------------- */
/* Champs de saisie                                                            */
/* -------------------------------------------------------------------------- */

export const CONTRACT_FIELDS: ContractField[] = [
  /* --- Bloc EMPLOYEUR ---------------------------------------------------- */
  {
    id: "employer_name",
    label: "Dénomination de l'employeur",
    type: "text",
    group: "employeur",
    required: true,
    help: "Nom complet de l'entreprise ou de l'organisation tel qu'enregistré.",
  },
  {
    id: "employer_legal_form",
    label: "Forme juridique",
    type: "text",
    group: "employeur",
    required: false,
    help: "Ex. SRL, SA, ASBL, personne physique.",
  },
  {
    id: "employer_bce",
    label: "Numéro d'entreprise (BCE)",
    type: "text",
    group: "employeur",
    required: true,
    help: "Numéro à 10 chiffres de la Banque-Carrefour des Entreprises (ex. 0123.456.789).",
  },
  {
    id: "employer_vat",
    label: "Numéro de TVA",
    type: "text",
    group: "employeur",
    required: false,
    help: "Souvent identique au n° BCE précédé de « BE ». Facultatif si non assujetti.",
  },
  {
    id: "employer_address",
    label: "Siège social / adresse",
    type: "textarea",
    group: "employeur",
    required: true,
    help: "Adresse complète du siège social de l'employeur.",
  },
  {
    id: "employer_onss",
    label: "Numéro ONSS (si attribué)",
    type: "text",
    group: "employeur",
    required: false,
    help: "Numéro d'identification employeur auprès de l'ONSS, si vous l'avez déjà.",
  },
  {
    id: "employer_joint_committee",
    label: "Commission paritaire",
    type: "text",
    group: "employeur",
    required: false,
    help: "Ex. CP 200. Détermine les barèmes et CCT applicables. À faire confirmer par le secrétariat social.",
  },
  {
    id: "employer_signatory_name",
    label: "Nom du signataire (représentant)",
    type: "text",
    group: "employeur",
    required: true,
    help: "Personne physique qui signe au nom de l'employeur.",
  },
  {
    id: "employer_signatory_role",
    label: "Qualité du signataire",
    type: "text",
    group: "employeur",
    required: true,
    help: "Ex. gérant, administrateur délégué, responsable RH, mandataire.",
  },

  /* --- Bloc TRAVAILLEUR -------------------------------------------------- */
  {
    id: "worker_last_name",
    label: "Nom du travailleur",
    type: "text",
    group: "travailleur",
    required: true,
  },
  {
    id: "worker_first_name",
    label: "Prénom du travailleur",
    type: "text",
    group: "travailleur",
    required: true,
  },
  {
    id: "worker_birth_date",
    label: "Date de naissance",
    type: "date",
    group: "travailleur",
    required: true,
  },
  {
    id: "worker_address",
    label: "Adresse / domicile",
    type: "textarea",
    group: "travailleur",
    required: true,
  },
  {
    id: "worker_niss",
    label: "NISS (numéro de registre national)",
    type: "text",
    group: "travailleur",
    required: true,
    help: "11 chiffres. Nécessaire notamment pour la Dimona.",
  },
  {
    id: "worker_function",
    label: "Fonction",
    type: "text",
    group: "travailleur",
    required: true,
    help: "Intitulé de la fonction occupée par le travailleur.",
  },
  {
    id: "student_lodging",
    label: "Lieu de logement (si l'étudiant est logé)",
    type: "textarea",
    group: "travailleur",
    required: false,
    appliesTo: ["etudiant"],
    help: "À indiquer uniquement si l'employeur loge l'étudiant.",
  },

  /* --- Bloc CONTRAT ------------------------------------------------------ */
  {
    id: "start_date",
    label: "Date de début",
    type: "date",
    group: "contrat",
    required: true,
    help: "Premier jour d'exécution du contrat.",
  },
  {
    id: "end_date",
    label: "Date de fin / terme",
    type: "date",
    group: "contrat",
    required: true,
    appliesTo: ["cdd", "etudiant"],
    help: "Pour un CDD ou un contrat étudiant : date à laquelle le contrat prend fin (max 12 mois pour l'étudiant).",
  },
  {
    id: "replacement_reason",
    label: "Motif du remplacement",
    type: "textarea",
    group: "contrat",
    required: true,
    appliesTo: ["remplacement"],
    help: "Ex. maladie, congé de maternité, crédit-temps du travailleur remplacé.",
  },
  {
    id: "replaced_worker",
    label: "Identité du travailleur remplacé",
    type: "text",
    group: "contrat",
    required: true,
    appliesTo: ["remplacement"],
    help: "Nom du travailleur dont le contrat est suspendu.",
  },
  {
    id: "workplace",
    label: "Lieu de travail",
    type: "text",
    group: "contrat",
    required: true,
    help: "Lieu principal d'exécution du travail.",
  },
  {
    id: "work_regime",
    label: "Régime de travail",
    type: "text",
    group: "contrat",
    required: true,
    help: "Temps plein ou temps partiel. Au temps partiel, l'horaire doit être détaillé (obligatoire).",
  },
  {
    id: "weekly_hours",
    label: "Durée hebdomadaire de travail",
    type: "number",
    group: "contrat",
    required: true,
    help: "Ex. 38 (temps plein) ou 20 (temps partiel), en heures par semaine.",
  },
  {
    id: "work_schedule",
    label: "Horaire de travail",
    type: "textarea",
    group: "contrat",
    required: false,
    help: "Jours et heures de prestation, pauses. OBLIGATOIRE et détaillé au temps partiel (régime et horaire) et pour le contrat étudiant.",
  },
  {
    id: "gross_salary",
    label: "Rémunération brute",
    type: "number",
    group: "contrat",
    required: true,
    help: "Montant brut convenu. À vérifier face au barème de la commission paritaire.",
  },
  {
    id: "salary_period",
    label: "Périodicité de la rémunération",
    type: "text",
    group: "contrat",
    required: true,
    help: "Ex. par mois, par heure, par jour.",
  },
  {
    id: "benefits",
    label: "Avantages éventuels",
    type: "textarea",
    group: "contrat",
    required: false,
    help: "Ex. chèques-repas, écochèques, assurance groupe, voiture, frais.",
  },
  {
    id: "student_occupation_period",
    label: "Période d'occupation (étudiant)",
    type: "textarea",
    group: "contrat",
    required: true,
    appliesTo: ["etudiant"],
    help: "Période(s) précise(s) d'occupation. Aide aussi au suivi du contingent d'heures.",
  },
];

/* -------------------------------------------------------------------------- */
/* Clauses                                                                     */
/* -------------------------------------------------------------------------- */

export const CONTRACT_CLAUSES: ContractClause[] = [
  /* --- Identité des parties (obligatoire, tous types) -------------------- */
  {
    id: "parties",
    heading: "Entre les soussignés",
    body:
      "L'employeur {{employer_name}} ({{employer_legal_form}}), inscrit à la Banque-Carrefour des Entreprises sous le numéro {{employer_bce}}, dont le siège social est établi à {{employer_address}}, représenté par {{employer_signatory_name}} en qualité de {{employer_signatory_role}} (ci-après « l'employeur »),\n" +
      "et\n" +
      "{{worker_first_name}} {{worker_last_name}}, né(e) le {{worker_birth_date}}, domicilié(e) à {{worker_address}}, NISS {{worker_niss}} (ci-après « le travailleur »),\n" +
      "ont convenu ce qui suit.",
    appliesTo: ALL_TYPES,
    mandatory: true,
    legalRef: "Loi du 3 juillet 1978 ; art. 124 pour le contrat d'étudiant",
  },

  /* --- Objet et fonction (obligatoire, tous types) ----------------------- */
  {
    id: "objet_fonction",
    heading: "Article 1 — Objet et fonction",
    body:
      "Le travailleur est engagé en qualité de {{worker_function}}. Il s'engage à exécuter consciencieusement le travail convenu, aux temps, lieu et conditions définis par le présent contrat.",
    appliesTo: ALL_TYPES,
    mandatory: true,
    legalRef: "Loi du 3 juillet 1978",
  },

  /* --- Durée du contrat, par type --------------------------------------- */
  {
    id: "duree_cdi",
    heading: "Article 2 — Durée du contrat",
    body:
      "Le présent contrat est conclu pour une durée indéterminée et prend cours le {{start_date}}.",
    appliesTo: ["cdi"],
    mandatory: true,
    legalRef: "Loi du 3 juillet 1978",
  },
  {
    id: "duree_cdd",
    heading: "Article 2 — Durée du contrat",
    body:
      "Le présent contrat est conclu pour une durée déterminée. Il prend cours le {{start_date}} et prend fin de plein droit le {{end_date}}, sans préavis ni indemnité, sauf rupture anticipée dans les conditions légales.",
    appliesTo: ["cdd"],
    mandatory: true,
    legalRef: "Loi du 3 juillet 1978, art. 9 et 10",
  },
  {
    id: "duree_remplacement",
    heading: "Article 2 — Objet et durée du remplacement",
    body:
      "Le présent contrat est conclu en vue de remplacer {{replaced_worker}}, dont le contrat est suspendu pour le motif suivant : {{replacement_reason}}. Il prend cours le {{start_date}} et prend fin au terme de la cause de suspension du contrat du travailleur remplacé, dans les conditions et limites prévues par la loi.",
    appliesTo: ["remplacement"],
    mandatory: true,
    legalRef: "Loi du 3 juillet 1978, art. 11ter",
  },
  {
    id: "duree_etudiant",
    heading: "Article 2 — Durée du contrat d'occupation",
    body:
      "Le présent contrat d'occupation d'étudiant prend cours le {{start_date}} et prend fin le {{end_date}}. Période(s) d'occupation : {{student_occupation_period}}. La durée du contrat ne peut excéder douze mois.",
    appliesTo: ["etudiant"],
    mandatory: true,
    legalRef: "Loi du 3 juillet 1978, Titre VII (art. 123-124)",
  },

  /* --- Lieu de travail (obligatoire, tous types) ------------------------- */
  {
    id: "lieu_travail",
    heading: "Article 3 — Lieu de travail",
    body:
      "Le travail s'exécute principalement à l'adresse suivante : {{workplace}}.",
    appliesTo: ALL_TYPES,
    mandatory: true,
    legalRef: "Loi du 3 juillet 1978 ; art. 124 pour le contrat d'étudiant",
  },

  /* --- Durée du travail / régime / horaire ------------------------------ */
  {
    id: "duree_travail_temps_plein",
    heading: "Article 4 — Régime et durée du travail",
    body:
      "Le travailleur est occupé à temps plein, à raison de {{weekly_hours}} heures par semaine. L'horaire de travail est celui fixé par le règlement de travail de l'employeur.",
    appliesTo: ALL_TYPES,
    onlyRegime: "temps_plein",
    mandatory: true,
    legalRef: "Loi du 3 juillet 1978 ; règlement de travail",
  },
  {
    id: "duree_travail_temps_partiel",
    heading: "Article 4 — Régime et horaire de travail à temps partiel",
    body:
      "Le travailleur est occupé à temps partiel, à raison de {{weekly_hours}} heures par semaine. Le régime de travail à temps partiel et l'horaire de travail convenus sont les suivants : {{work_schedule}}. Cet horaire précise, pour chaque jour, le nombre d'heures à prester ainsi que les heures de début et de fin et les intervalles de repos.",
    appliesTo: ALL_TYPES,
    onlyRegime: "temps_partiel",
    mandatory: true,
    legalRef:
      "Loi-programme du 22 décembre 1989, art. 152 et s. (mention obligatoire du régime et de l'horaire à temps partiel)",
  },
  {
    id: "horaire_etudiant",
    heading: "Article 4bis — Horaire (étudiant)",
    body:
      "L'horaire de travail de l'étudiant, comprenant les jours, les heures de prestation et les temps de pause, est le suivant : {{work_schedule}}.",
    appliesTo: ["etudiant"],
    mandatory: true,
    legalRef: "Loi du 3 juillet 1978, art. 124",
  },

  /* --- Rémunération (obligatoire, tous types) ---------------------------- */
  {
    id: "remuneration",
    heading: "Article 5 — Rémunération",
    body:
      "La rémunération brute est fixée à {{gross_salary}} EUR ({{salary_period}}). Elle est payée selon les modalités en vigueur chez l'employeur et conformément aux barèmes de la commission paritaire applicable. La rémunération est soumise à la loi du 12 avril 1965 concernant la protection de la rémunération des travailleurs.",
    appliesTo: ALL_TYPES,
    mandatory: true,
    legalRef:
      "Loi du 3 juillet 1978 ; Loi du 12 avril 1965 (mention requise pour l'étudiant, art. 124)",
  },

  /* --- Commission paritaire (recommandé/obligatoire étudiant) ------------ */
  {
    id: "commission_paritaire",
    heading: "Article 6 — Commission paritaire",
    body:
      "La commission paritaire compétente est : {{employer_joint_committee}}. Elle détermine notamment les barèmes minimaux et les conventions collectives applicables.",
    appliesTo: ALL_TYPES,
    mandatory: true,
    legalRef:
      "Loi du 3 juillet 1978, art. 124 (mention obligatoire pour l'étudiant)",
  },

  /* --- Préavis / fin de contrat (générique, tous types) ------------------ */
  {
    id: "preavis",
    heading: "Article 7 — Fin du contrat et préavis",
    body:
      "Chaque partie peut mettre fin au contrat dans les conditions et selon les délais de préavis prévus par la loi du 3 juillet 1978 et, le cas échéant, les conventions collectives applicables.",
    appliesTo: ["cdi", "cdd", "remplacement", "etudiant"],
    mandatory: true,
    legalRef:
      "Loi du 3 juillet 1978 (préavis ; art. 130 pour le contrat d'étudiant)",
  },

  /* --- Mention spécifique étudiant : Dimona / contingent ----------------- */
  {
    id: "etudiant_securite_sociale",
    heading: "Article 8 — Sécurité sociale (étudiant)",
    body:
      "L'occupation de l'étudiant fait l'objet d'une déclaration immédiate de l'emploi (Dimona). Tant que le contingent annuel d'heures à cotisation de solidarité n'est pas dépassé, seule cette cotisation de solidarité est due ; au-delà, les cotisations ordinaires de sécurité sociale s'appliquent.",
    appliesTo: ["etudiant"],
    mandatory: true,
    legalRef:
      "Arrêté royal du 23 décembre 2021 et instructions ONSS (Dimona STU, contingent annuel)",
  },

  /* --- Règlement de travail (obligatoire, salariés) ---------------------- */
  {
    id: "reglement_travail",
    heading: "Article 9 — Règlement de travail",
    body:
      "Le travailleur déclare avoir reçu un exemplaire du règlement de travail de l'employeur et en accepter les dispositions, qui font partie intégrante du présent contrat.",
    appliesTo: ALL_TYPES,
    mandatory: true,
    legalRef:
      "Loi du 8 avril 1965 instituant les règlements de travail",
  },

  /* --- CLAUSES OPTIONNELLES (mandatory:false) ---------------------------- */
  {
    id: "opt_avantages",
    heading: "Article — Avantages",
    body:
      "Le travailleur bénéficie des avantages suivants : {{benefits}}. Ces avantages sont accordés aux conditions précisées par l'employeur et peuvent être encadrés par des règlements ou conventions spécifiques.",
    appliesTo: ALL_TYPES,
    mandatory: false,
    legalRef: "Liberté contractuelle (à encadrer selon l'avantage)",
  },
  {
    id: "opt_teletravail",
    heading: "Article — Télétravail",
    body:
      "Les parties peuvent convenir de prestations en télétravail. Les modalités (lieu, jours, mise à disposition du matériel, intervention dans les frais, joignabilité) sont précisées dans un avenant ou une convention de télétravail conforme à la réglementation et aux conventions collectives applicables.",
    appliesTo: ["cdi", "cdd", "remplacement"],
    mandatory: false,
    legalRef:
      "CCT n° 85 (télétravail structurel) / cadre du télétravail occasionnel",
  },
  {
    id: "opt_confidentialite",
    heading: "Article — Confidentialité",
    body:
      "Le travailleur s'engage, pendant et après l'exécution du contrat, à ne pas divulguer les informations confidentielles, secrets d'affaires et de fabrication dont il a connaissance dans le cadre de sa fonction, conformément à l'article 17 de la loi du 3 juillet 1978.",
    appliesTo: ["cdi", "cdd", "remplacement"],
    mandatory: false,
    legalRef: "Loi du 3 juillet 1978, art. 17, 3°",
  },
  {
    id: "opt_frais",
    heading: "Article — Remboursement de frais",
    body:
      "Les frais exposés par le travailleur dans l'exécution de son contrat et qui incombent à l'employeur lui sont remboursés selon les modalités convenues et les règles en vigueur.",
    appliesTo: ALL_TYPES,
    mandatory: false,
    legalRef: "Loi du 3 juillet 1978, art. 20, 4°",
  },
];

/* -------------------------------------------------------------------------- */
/* Sources & disclaimer                                                        */
/* -------------------------------------------------------------------------- */

export const CONTRACT_SOURCES: { label: string; url: string }[] = [
  {
    label: "SPF Emploi — Contrats de travail (portail)",
    url: "https://emploi.belgique.be/fr/themes/contrats-de-travail",
  },
  {
    label: "SPF Emploi — Types de contrat de travail",
    url: "https://emploi.belgique.be/fr/themes/contrats-de-travail/conclusion-du-contrat-de-travail/types-de-contrat-de-travail",
  },
  {
    label: "SPF Emploi — Contrat de travail à temps partiel",
    url: "https://emploi.belgique.be/fr/themes/contrats-de-travail/contrats-de-travail-particuliers/contrat-de-travail-temps-partiel",
  },
  {
    label: "SPF Emploi — Contrat d'occupation d'étudiants",
    url: "https://emploi.belgique.be/fr/themes/contrats-de-travail/contrats-de-travail-particuliers/contrat-doccupation-detudiants",
  },
  {
    label: "SPF Emploi — Succession de CDD et de contrats de remplacement",
    url: "https://emploi.belgique.be/fr/themes/contrats-de-travail/contrats-de-travail-particuliers/contrat-de-remplacement/succession-de-0",
  },
  {
    label: "Loi du 3 juillet 1978 relative aux contrats de travail (texte coordonné)",
    url: "https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&table_name=loi&cn=1978070301",
  },
  {
    label: "ONSS / Sécurité sociale — Dimona",
    url: "https://www.socialsecurity.be/site_fr/employer/applics/dimona/index.htm",
  },
  {
    label: "ONSS — Instructions administratives DmfA : étudiants (contingent, Dimona STU)",
    url: "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/persons/specific/students.html",
  },
];

/** Disclaimer fort à afficher dans l'UI et en pied du contrat généré. */
export const CONTRACT_DISCLAIMER =
  "Ce document est un MODÈLE / PROJET de contrat NON CONTRACTUEL, généré à titre d'aide à la préparation. Il ne constitue pas un conseil juridique. Avant toute utilisation, faites-le valider et adapter par un secrétariat social agréé ou un conseil juridique : les mentions obligatoires doivent être ajustées à votre situation, à la fonction et à la commission paritaire applicable (barèmes, CCT, durée du travail, préavis). Les montants, contingents (ex. contingent étudiant) et règles évoluent : vérifiez leur actualité. L'éditeur décline toute responsabilité quant à l'usage de ce modèle.";
