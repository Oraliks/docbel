/**
 * Méthodologie publique des 9 calculateurs citoyens.
 *
 * Sert à alimenter la page admin /admin/calculateurs : pour chaque calc on
 * documente la formule appliquée, les constantes utilisées, les sources
 * officielles, le statut de fiabilité, et les limites connues.
 *
 * Convention :
 *   - les constantes "métier" sont importées depuis les fichiers .ts source
 *     quand elles sont exportées (TRANCHES_IPP_2026, TARIFS_2026, etc.) →
 *     la doc admin reste donc en sync avec le code par construction.
 *   - les chiffres internes (privés au fichier de calc) sont REDÉCLARÉS ici
 *     avec un commentaire "// SYNC: lib/calculators/xxx.ts". Si tu les modifies
 *     côté calcul, modifie-les aussi ici (ou exporte-les pour les importer).
 *
 * Si un chiffre est jugé non fiable ou approximatif, il doit l'être ici aussi
 * (statut `reliability` + `note`).
 */

import { TRANCHES_IPP_2026 } from "./ipp";
import { TARIFS_2026, PLAFONDS_2026, Q_REFERENCE } from "./tarif-social";
import {
  TAUX_KM_2026,
  FORFAIT_LEGAL_FRAIS_PRO_2026,
  PLAFOND_ANNUEL_VELO_2026,
} from "./frais-km";
import { PHASES_INFO } from "./chomage";
import { getQuotiteExemptee } from "./brut-net";
import { getConditionAnticipation } from "./pension";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type Reliability = "high" | "medium" | "low";

export interface MethodologySource {
  name: string;
  url: string;
}

export interface MethodologyConstant {
  name: string;
  value: string;
  unit?: string;
  note?: string;
}

export interface MethodologyFormula {
  label: string;
  expression: string;
}

/** Étape de maintenance : "quoi vérifier", "où", "quand". */
export interface MaintenanceStep {
  /** Ce qu'il faut surveiller (ex: "Barème workbonus"). */
  trigger: string;
  /** Quelle source consulter en priorité. */
  source: string;
  /** URL directe vers la page à vérifier. */
  sourceUrl: string;
  /** À quel rythme (ex: "Chaque 1er janvier" / "Trimestriel"). */
  frequency: string;
  /** Quel fichier .ts modifier dans le code. */
  codeLocation?: string;
}

/** Différenciateur vs les autres calculateurs publics belges. */
export interface MethodologyDifferentiator {
  label: string;
  description: string;
}

/** Item meta affiché dans la zone "En bref" (label + valeur + icône optionnelle). */
export interface MethodologyBriefItem {
  label: string;
  value: string;
  /** Nom d'icône lucide-react (clé du catalogue) — optionnel. */
  icon?: string;
}

/** Input enrichi pour la zone "Ce que l'outil demande" (avec description + icône). */
export interface MethodologyInputDetailed {
  label: string;
  description: string;
  /** Nom d'icône lucide-react (clé du catalogue) — optionnel. */
  icon?: string;
}

export interface CalcMethodology {
  /** Slug public (= URL `/outils/{slug}`). */
  slug: string;
  /** Titre court affiché en haut de la fiche. */
  title: string;
  /** Une phrase qui résume ce que le calc fait. */
  pitch: string;
  /** Fichier source de la logique (pour aller voir le code). */
  sourceFile: string;
  /** Niveau de confiance global. */
  reliability: Reliability;
  /** Justification du niveau de fiabilité. */
  reliabilityNote: string;
  /** Année de référence des barèmes (ex: 2026). */
  year: number;
  /**
   * Date de dernière mise à jour du calcul (ISO YYYY-MM-DD).
   * Utilisée pour afficher "Mis à jour le …" côté public et pour
   * déclencher l'alerte annuelle (si > 12 mois). Optionnel pour
   * les calcs hérités — fallback : DEFAULT_LAST_UPDATED.
   */
  lastUpdatedAt?: string;
  /** Badges courts à afficher en en-tête (ex: ["Belgique", "ATN 2026"]). */
  badges?: string[];
  /** Inputs principaux que l'utilisateur fournit. */
  inputs: string[];
  /** Formules-clés, dans l'ordre logique. */
  formulas: MethodologyFormula[];
  /** Constantes / barèmes utilisés. */
  constants: MethodologyConstant[];
  /** Sources officielles consultées. */
  sources: MethodologySource[];
  /** Limites volontaires (ce que le calc n'essaie PAS de modéliser). */
  limitations: string[];
  /** Ce que cet outil fait mieux que les calculateurs concurrents. */
  differentiators?: MethodologyDifferentiator[];
  /** Guide pratique pour la mise à jour annuelle. */
  maintenanceGuide?: MaintenanceStep[];
  /** Texte d'introduction pédagogique (Markdown allégé, 2-4 paragraphes). */
  pedagogyIntro?: string;
  /**
   * Items meta affichés dans la zone "En bref" sous la description.
   * 4-5 entrées max (Méthode, Régularisation, Unités, Auteur…).
   * Optionnel — si absent, la section est skip.
   */
  briefMeta?: MethodologyBriefItem[];
  /**
   * Inputs enrichis pour la zone "Ce que l'outil demande" (gauche).
   * Si absent, fallback sur `inputs` (liste simple sans description).
   */
  inputsDetailed?: MethodologyInputDetailed[];
  /**
   * Sorties / résultats listés à droite de la zone inputs/outputs.
   * Optionnel — si absent, on skip la colonne droite.
   */
  outputs?: string[];
  /** Catégorie pour la sidebar (ex: "Salaires & Rémunérations"). */
  category?: string;
  /** Tags pour la sidebar (ex: ["brut-net", "fiscalité", "ONSS"]). */
  tags?: string[];
  /** Auteur (par défaut "Équipe Docbel" côté composant). */
  author?: string;
}

/**
 * Date par défaut de dernière mise à jour pour les calcs qui n'en
 * définissent pas une explicite. À ajuster manuellement après chaque
 * sprint de mise à jour des barèmes.
 */
export const DEFAULT_LAST_UPDATED = "2026-05-24";

/**
 * Renvoie la date de dernière mise à jour effective d'un calc
 * (sa propre date si définie, sinon la date par défaut).
 */
export function getLastUpdatedAt(m: CalcMethodology): string {
  return m.lastUpdatedAt ?? DEFAULT_LAST_UPDATED;
}

/**
 * True si la dernière mise à jour date de plus de 12 mois → l'admin
 * doit revérifier les sources officielles (la plupart des barèmes sont
 * indexés annuellement, alors une révision annuelle est suffisante).
 */
export function isReviewOverdue(m: CalcMethodology): boolean {
  const last = new Date(getLastUpdatedAt(m));
  const now = new Date();
  const monthsDiff =
    (now.getFullYear() - last.getFullYear()) * 12 +
    (now.getMonth() - last.getMonth());
  return monthsDiff >= 12;
}

/* ------------------------------------------------------------------ */
/*  Helpers d'affichage                                               */
/* ------------------------------------------------------------------ */

const fmtPct = (n: number) =>
  `${(n * 100).toLocaleString("fr-BE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} %`;

const fmtEUR = (n: number) =>
  n.toLocaleString("fr-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

/* ------------------------------------------------------------------ */
/*  Méthodologies                                                     */
/* ------------------------------------------------------------------ */

const METHODOLOGIES: CalcMethodology[] = [
  /* 0. PRÉAVIS ------------------------------------------------------- */
  {
    slug: "preavis",
    title: "Calcul du préavis",
    pitch:
      "Calcul du délai de préavis légal selon la loi belge — ouvrier ou employé, rupture par l'employeur ou le travailleur, contrats avant ou après 2014.",
    sourceFile: "components/docbel/calculators/calc-preavis.tsx",
    reliability: "high",
    reliabilityNote:
      "Conforme à la Loi du 3 juillet 1978 sur les contrats de travail (CCT 109 — régime unifié depuis le 1ᵉʳ janvier 2014) et aux tables officielles SPF Emploi. Détection automatique du régime (avant / après 2014) selon la date d'entrée en service ; calcul du préavis ouvrier basé sur les CCT sectorielles, du préavis employé sur la grille SPF post-2014.",
    year: 2026,
    lastUpdatedAt: "2026-05-25",
    badges: ["Belgique", "Loi 1978", "Données 2026"],
    category: "Rupture du contrat",
    tags: ["préavis", "rupture", "CCT 109", "ouvrier", "employé"],
    pedagogyIntro:
      "Le délai de préavis dépend de **3 facteurs** : votre statut (ouvrier / employé), la partie qui rompt le contrat (employeur / travailleur), et votre date d'entrée en service. Depuis le 1ᵉʳ janvier 2014, un **régime unifié** s'applique pour les ouvriers et employés (CCT 109). Pour les contrats antérieurs, on conserve l'ancien régime pour la période ≤ 31/12/2013, puis on bascule sur le nouveau pour la période ≥ 01/01/2014 — c'est le « régime mixte ».",
    inputs: [
      "Statut : Ouvrier / Employé",
      "Partie qui rompt : Employeur / Travailleur",
      "Type d'emploi : Temps plein / Temps partiel",
      "Commission paritaire (autocomplete, pour préavis ouvrier pré-2014)",
      "Date d'entrée en service (détermine le régime)",
      "Date de licenciement",
      "Salaire annuel brut (employé pré-2014, pour grille Claeys)",
    ],
    inputsDetailed: [
      {
        label: "Statut",
        description: "Ouvrier ou employé — détermine la grille appliquée pré-2014.",
        icon: "Briefcase",
      },
      {
        label: "Partie qui rompt",
        description:
          "Employeur ou travailleur — le préavis est plus court quand c'est le travailleur qui démissionne.",
        icon: "ArrowLeftRight",
      },
      {
        label: "Type d'emploi",
        description: "Temps plein ou partiel — sans impact sur la durée, juste informatif.",
        icon: "Clock",
      },
      {
        label: "Commission paritaire",
        description:
          "Pour les ouvriers pré-2014, certaines CP ont leur propre table (ex: CP 124 construction).",
        icon: "Users",
      },
      {
        label: "Date d'entrée en service",
        description:
          "Détermine si le régime « avant 2014 » s'applique, totalement ou en mixte.",
        icon: "Calendar",
      },
      {
        label: "Date de licenciement / démission",
        description: "Détermine la fin de l'ancienneté et le 1ᵉʳ lundi suivant.",
        icon: "CalendarX",
      },
    ],
    outputs: [
      "Nombre de semaines / jours de préavis",
      "Date de début (1ᵉʳ lundi après notification)",
      "Date de fin du préavis",
      "Règle appliquée (régime avant 2014 / après 2014 / mixte)",
      "Indemnité compensatoire de licenciement (ICL) si applicable",
      "Régime détecté automatiquement",
    ],
    briefMeta: [
      { label: "Méthode", value: "Régime unifié CCT 109 + grille pré-2014" },
      { label: "Régime", value: "Auto-détection (mixte si à cheval)" },
      { label: "Unités", value: "Semaines / jours" },
      { label: "Dernière MAJ formules", value: "25 mai 2026" },
      { label: "Auteur", value: "Équipe Docbel" },
    ],
    formulas: [
      {
        label: "Régime POST-2014 (toutes ruptures à partir du 01/01/2014)",
        expression:
          "Préavis en semaines selon une grille progressive : 2 sem (< 3 mois), 4 sem (3-6 mois), 6 sem (6-9 mois), 7 sem (9-12 mois), 8 sem (12-15 mois)… jusqu'à 65 sem (≥ 20 ans). Démission travailleur : moitié de la valeur employeur.",
      },
      {
        label: "Régime PRÉ-2014 — Ouvrier",
        expression:
          "Préavis en JOURS selon la CCT (générale ou sectorielle). CCT 75 : 28 j (< 6 mois), 40 j (6 mois - 5 ans), 48 j (5-10), 64 j (10-15), 97 j (15-20), 129 j (≥ 20). Démission travailleur : moitié.",
      },
      {
        label: "Régime PRÉ-2014 — Employé",
        expression:
          "Préavis en MOIS selon la formule Claeys (salaire annuel brut). Inférieur à 32 254 € : 0,25 mois / an d'ancienneté (min 3 mois). De 32 254 à 64 508 € : 1 mois / an. Au-delà : négociable, min 1 mois / an.",
      },
      {
        label: "Régime MIXTE (contrat à cheval sur le 31/12/2013)",
        expression:
          "Étape 1 : préavis pour la période ≤ 31/12/2013 (ancien régime).\nÉtape 2 : préavis pour la période ≥ 01/01/2014 (CCT 109).\nÉtape 3 : addition des 2 étapes.",
      },
      {
        label: "Date de début du préavis",
        expression:
          "Le préavis commence le 1ᵉʳ LUNDI suivant la semaine de notification (notification effective si reçue avant le mercredi de la semaine).",
      },
      {
        label: "Indemnité compensatoire (ICL)",
        expression:
          "Si l'employeur rompt sans laisser prester : ICL = rémunération hebdomadaire × nombre de semaines de préavis. La rémunération hebdo = salaire mensuel × 3 / 13.",
      },
    ],
    constants: [
      {
        name: "Date pivot régime unifié",
        value: "1ᵉʳ janvier 2014",
        note: "CCT 109 entrée en vigueur. Détermine si on applique le régime mixte.",
      },
      {
        name: "Grille post-2014 (employeur, semaines)",
        value: "2 / 4 / 6 / 7 / 8 / 9 / 10 / 11 / 12 / 13 / 15 / 17 / 19 / 21 / 23 / 25 / 27 / 29 / 30 …",
        note: "Progressive jusqu'à 65 semaines après 20 ans d'ancienneté. Source : SPF Emploi.",
      },
      {
        name: "Démission travailleur post-2014",
        value: "= moitié du préavis employeur",
        note: "Plafonné à 13 semaines.",
      },
      {
        name: "CCT 75 (préavis ouvrier pré-2014, jours)",
        value: "28 / 40 / 48 / 64 / 97 / 129",
        note: "Selon ancienneté : <6m / 6m-5a / 5-10a / 10-15a / 15-20a / ≥20a (rupture employeur).",
      },
      {
        name: "Formule Claeys (employé pré-2014)",
        value: "0,25 mois ou 1 mois × ancienneté",
        note: "Selon tranche de salaire annuel brut (< 32 254 € / > 32 254 €).",
      },
      {
        name: "Rémunération hebdomadaire (ICL)",
        value: "mensuelle × 3 / 13",
        note: "Équivalence légale : 13 semaines = 3 mois.",
      },
    ],
    sources: [
      {
        name: "Loi du 3 juillet 1978 sur les contrats de travail",
        url: "https://www.ejustice.just.fgov.be",
      },
      {
        name: "SPF Emploi — Préavis et indemnité de rupture",
        url: "https://emploi.belgique.be/fr/themes/contrats-de-travail/preavis-et-indemnite-de-rupture",
      },
      {
        name: "CCT 109 — Régime unifié de préavis",
        url: "https://www.cnt-nar.be",
      },
      {
        name: "SPF Emploi — Commissions paritaires (CCT sectorielles)",
        url: "https://emploi.belgique.be/fr/themes/concertation-sociale/commissions-paritaires",
      },
    ],
    limitations: [
      "Pas de gestion fine des dispenses de prestation (rupture commun accord, force majeure).",
      "Indemnité de protection (femme enceinte, délégué syndical) non calculée ici (cf. calculateur Indemnité de rupture).",
      "Pour les ouvriers, certaines CP ont leur propre table — la nôtre prend la CCT générale par défaut.",
      "Pas de prise en compte du contrat d'étudiant ou des CDD à terme défini.",
    ],
    differentiators: [
      {
        label: "Détection automatique du régime",
        description:
          "Selon la date d'entrée en service, l'outil détermine seul s'il faut appliquer l'ancien régime, le nouveau, ou le mixte (calcul en 2 étapes).",
      },
      {
        label: "Régime mixte intégré",
        description:
          "Les contrats à cheval sur le 31/12/2013 reçoivent automatiquement le calcul combiné (pré-2014 + post-2014), ce que beaucoup d'outils oublient.",
      },
      {
        label: "Commissions paritaires sectorielles",
        description:
          "Autocomplete avec accès aux ~140 CP pour les cas où une CCT sectorielle s'applique au préavis ouvrier pré-2014.",
      },
      {
        label: "Indication ICL incluse",
        description:
          "L'indemnité compensatoire de licenciement est calculée en parallèle, prête à utiliser dans le calculateur dédié.",
      },
    ],
    maintenanceGuide: [
      {
        trigger: "Grille post-2014 (CCT 109)",
        source: "SPF Emploi — Préavis CCT 109",
        sourceUrl:
          "https://emploi.belgique.be/fr/themes/contrats-de-travail/preavis-et-indemnite-de-rupture",
        frequency: "Rare (modification = loi, pas indexation)",
        codeLocation: "lib/notice-periods-spf.ts → NOTICE_PERIODS_POST_2014",
      },
      {
        trigger: "CCT 75 ouvrier (pré-2014)",
        source: "SPF Emploi — CCT 75",
        sourceUrl: "https://www.cnt-nar.be",
        frequency: "Stable (loi 1978, pas d'indexation)",
        codeLocation: "lib/notice-periods-spf.ts → NOTICE_PERIODS_OUVRIER_PRE_2014_CCT75",
      },
      {
        trigger: "Commissions paritaires",
        source: "SPF Emploi — Concertation sociale",
        sourceUrl:
          "https://emploi.belgique.be/fr/themes/concertation-sociale/commissions-paritaires",
        frequency: "1-2 fois/an (création/fusion de CP)",
        codeLocation: "lib/data/commissions-paritaires-belgique.json",
      },
      {
        trigger: "Validation périodique",
        source: "SPF Emploi — Simulateur préavis officiel",
        sourceUrl: "https://emploi.belgique.be",
        frequency: "1 fois/an (cohérence avec sim. SPF)",
        codeLocation: "components/docbel/calculators/calc-preavis.tsx",
      },
    ],
  },

  /* 1. BRUT / NET ---------------------------------------------------- */
  {
    slug: "brut-net",
    title: "Brut ↔ Net",
    pitch:
      "Conversion du salaire mensuel brut vers le net (ou inversement) — salarié belge, exercice 2026.",
    sourceFile: "lib/calculators/brut-net.ts",
    reliability: "high",
    reliabilityNote:
      "Conforme à l'Annexe III de l'AR/CIR 92 et aux barèmes ONSS / SPF Finances version 1ᵉʳ janvier 2026. Validé sur 7 points de référence (2 000-5 000 €, isolé/marié 1 revenu, 0-2 enfants), précision visée ±5 € sur le net. Workbonus en formule officielle ONSS (volet A + volet B) déduit de l'ONSS retenue. Précompte par paliers calibrés sur le barème SPF mensuel ; cotisation spéciale sécu (CSSS) calculée et déduite explicitement. Voiture de société (AR 14/01/2014 + minimum légal 1 660 €/an) et indemnité télétravail (circulaire 2021/C/20, plafond 154,74 €/mois) en plus.",
    year: 2026,
    lastUpdatedAt: "2026-05-24",
    badges: ["Belgique", "ATN 2026", "Données 2026"],
    category: "Salaires & Rémunérations",
    tags: ["brut-net", "fiscalité", "ONSS", "précompte", "ATN"],
    author: "Équipe Docbel",
    briefMeta: [
      {
        label: "Méthode",
        value: "Barèmes SPF Finances + ONSS officiels",
        icon: "FileCode2",
      },
      {
        label: "Régularisation",
        value: "Annuelle via Tax-on-web",
        icon: "Calendar",
      },
      {
        label: "Unités",
        value: "Mensuel (€)",
        icon: "Calculator",
      },
      {
        label: "Dernière MAJ",
        value: "24 mai 2026",
        icon: "Clock",
      },
      {
        label: "Auteur",
        value: "Équipe Docbel",
        icon: "Users",
      },
    ],
    inputsDetailed: [
      {
        label: "Salaire brut mensuel",
        description: "Montant en € avant cotisations et impôts.",
        icon: "Euro",
      },
      {
        label: "Statut fiscal",
        description:
          "Isolé / cohabitant / marié 1 revenu / marié 2 revenus.",
        icon: "Users",
      },
      {
        label: "Enfants à charge",
        description: "Entre 0 et 12. Détermine la réduction d'impôt.",
        icon: "Baby",
      },
      {
        label: "Avantages",
        description:
          "Chèques-repas, ATN voiture, indemnité télétravail forfaitaire.",
        icon: "Gift",
      },
      {
        label: "Région",
        description:
          "Wallonie / Bruxelles / Flandre — info uniquement à ce stade.",
        icon: "MapPin",
      },
    ],
    outputs: [
      "Net mensuel en poche (€)",
      "ONSS travailleur retenue (avec bonus à l'emploi)",
      "Précompte professionnel mensuel",
      "Cotisation spéciale sécurité sociale (CSSS)",
      "Détail des avantages (chèques-repas, ATN, télétravail)",
      "Régularisation annuelle estimée",
    ],
    pedagogyIntro:
      "Le passage du brut au net combine 4 prélèvements : l'**ONSS travailleur** (13,07 %, partiellement annulé par le **bonus à l'emploi** pour les bas salaires), le **précompte professionnel** (impôt mensuel sur le revenu, barème SPF), la **cotisation spéciale sécurité sociale** (CSSS) et la **régularisation annuelle** via la déclaration. Notre calcul reproduit les 4, plus les avantages courants (chèques-repas, indemnité télétravail, ATN voiture de société).",
    differentiators: [
      {
        label: "Cotisation spéciale sécu (CSSS) isolée",
        description:
          "La plupart des calculateurs grand public oublient la CSSS dans la ligne mensuelle ou l'agrègent au précompte. Nous l'isolons (~20-50 €/mois selon le brut) pour transparence pédagogique.",
      },
      {
        label: "Workbonus en réduction d'ONSS (et non en ajout au net)",
        description:
          "Erreur classique : ajouter le bonus à l'emploi au net comme une « prime ». La réalité légale : il réduit la cotisation ONSS retenue à la source. Volet A + volet B, formule officielle ONSS appliquée intégralement.",
      },
      {
        label: "Voiture de société (ATN) intégrée",
        description:
          "Calcul AR 14/01/2014 indexé 2026 : valeur catalogue × 6/7 × coef CO2 × décote vétusté, avec minimum légal 1 660 €/an. L'ATN s'ajoute à l'imposable, pas au net en poche.",
      },
      {
        label: "Indemnité télétravail forfaitaire",
        description:
          "Plafond 154,74 €/mois (circulaire SPF 2021/C/20). Non imposable, non soumise à l'ONSS — s'ajoute directement au net.",
      },
      {
        label: "Régularisation annuelle expliquée",
        description:
          "Notre simulateur clarifie que le précompte mensuel est une estimation : le montant définitif est fixé via la déclaration fiscale (IPP). Les écarts mensuels se régularisent à la déclaration.",
      },
    ],
    maintenanceGuide: [
      {
        trigger: "Workbonus (volet A + B)",
        source: "Securex — Bonus à l'emploi",
        sourceUrl:
          "https://www.securex.be/fr/lex4you/employeur/montants-actuels/montants-socio-juridiques/bonus-a-l-emploi",
        frequency: "2 fois/an (1ᵉʳ janvier + 1ᵉʳ avril)",
        codeLocation: "lib/calculators/brut-net.ts → calcWorkbonus()",
      },
      {
        trigger: "Barème précompte professionnel mensuel",
        source: "SPF Finances — PDF Annexe III AR/CIR 92",
        sourceUrl:
          "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul",
        frequency: "1 fois/an (publié mi-décembre, applicable 1ᵉʳ janvier)",
        codeLocation: "lib/calculators/brut-net.ts → PRECOMPTE_POINTS",
      },
      {
        trigger: "Cotisation spéciale sécurité sociale",
        source: "Securex — Cotisation spéciale sécu",
        sourceUrl:
          "https://www.securex.be/fr/lex4you/employeur/montants-actuels/montants-socio-juridiques/cotisation-speciale-pour-la-securite-sociale",
        frequency: "1 fois/an (janvier)",
        codeLocation: "lib/calculators/brut-net.ts → calcCSSS()",
      },
      {
        trigger: "Réduction enfants à charge",
        source: "SPF Finances (même PDF que précompte)",
        sourceUrl: "https://finances.belgium.be",
        frequency: "1 fois/an",
        codeLocation: "lib/calculators/brut-net.ts → reductionEnfants()",
      },
      {
        trigger: "Quotient conjugal (marié 1 revenu)",
        source: "SPF Finances (CIR 92 art. 134)",
        sourceUrl: "https://finances.belgium.be",
        frequency: "1 fois/an",
        codeLocation:
          "lib/calculators/brut-net.ts → reductionMarie1Revenu()",
      },
      {
        trigger: "Plafond chèques-repas (titres-repas)",
        source: "UCM / Liantis — Titres-repas",
        sourceUrl: "https://www.ucm.be",
        frequency: "Selon CCT (annuel ou ad hoc)",
        codeLocation: "lib/calculators/brut-net.ts → CHEQUES_REPAS_PAR_JOUR",
      },
      {
        trigger: "Plafond indemnité télétravail",
        source: "SPF Finances — Circulaire 2021/C/20",
        sourceUrl: "https://finances.belgium.be",
        frequency: "1 fois/an (indexation)",
        codeLocation: "lib/calculators/brut-net.ts → INDEMNITE_TELEWORK_PLAFOND",
      },
      {
        trigger: "Cas de validation (regression test)",
        source: "SPF Finances — Calculateur officiel",
        sourceUrl:
          "https://finances.belgium.be/fr/E-services/tax-on-web",
        frequency: "1 fois/an (vérification finale, comparaison aux fiches de paie réelles)",
        codeLocation: "scripts/debug-brut-net.ts → re-tester 7 cas",
      },
    ],
    inputs: [
      "Salaire brut mensuel (€)",
      "Statut fiscal : isolé / cohabitant / marié 1 revenu / marié 2 revenus",
      "Enfants à charge (0–12)",
      "Région (information seulement à ce stade)",
      "Chèques-repas (oui/non)",
      "Voiture de société (valeur catalogue HT, âge, motorisation)",
      "Indemnité télétravail forfaitaire mensuelle (0–154,74 €)",
    ],
    formulas: [
      { label: "ONSS travailleur (théorique)", expression: "ONSS = brut × 13,07 %" },
      {
        label: "Workbonus (volet A + volet B)",
        expression:
          "Volet A : 125,04 € si brut ≤ 2880,32 €, dégressif jusqu'à 0 à 3 336,98 €. Volet B : 168,62 € si brut ≤ 2 255,50 €, dégressif jusqu'à 0 à 2 880,32 €. Total plafonné à l'ONSS théorique.",
      },
      { label: "ONSS retenue", expression: "ONSS_retenue = max(0, ONSS − workbonus)" },
      {
        label: "ATN voiture de société (mensuel)",
        expression:
          "ATN = max(min_légal, valeur_catalogue × 6/7 × coef_CO2 × décote_âge) / 12",
      },
      { label: "Imposable", expression: "imposable = brut − ONSS_retenue + ATN" },
      {
        label: "Précompte (interpolation calibrée SPF)",
        expression:
          "Fonction par paliers calibrée sur 5 points du barème SPF Finances 2026 (imposable de 2 000 à 4 346 €), extrapolation 53,50 % au-delà.",
      },
      {
        label: "Réduction statut conjugal",
        expression:
          "Marié 1 revenu : −13,13 % × imposable (plafond 800 €). Cohabitant/marié 2 revenus : barème isolé.",
      },
      {
        label: "Réduction enfants à charge (Annexe III 2026)",
        expression:
          "1: 56 € / 2: 190 € / 3: 489 € / 4: 856 € / 5: 1 234 € (barème SPF Finances, +400 €/enfant au-delà).",
      },
      {
        label: "Cotisation spéciale sécu (CSSS)",
        expression:
          "Barème indexé 2026 (loi du 28/12/1992), interpolé sur 5 points officiels. Multiplicateur statut : marié 1 rev ×1,21 / marié 2 rev ×0,85.",
      },
      {
        label: "Net",
        expression:
          "net = brut − ONSS_retenue − précompte − CSSS + chèques_repas + indemnité_télétravail",
      },
    ],
    constants: [
      {
        name: "ONSS travailleur",
        value: "13,07 %",
        note: "Inchangé depuis 1981. Source: SPF Sécurité Sociale.",
      },
      {
        name: "Précompte — points de calibrage (isolé)",
        value: "2000→36,97 / 2400,92→243,24 / 2700,17→436,10 / 3477,20→826,69 / 4346,50→1245,26",
        note: "Imposable mensuel → précompte mensuel, valeurs issues du barème SPF Finances 2026 (Annexe III AR/CIR 92). Interpolation linéaire entre points, extrapolation 53,50 % au-delà.",
      },
      {
        name: "Réduction enfants à charge (mensuel, 2026)",
        value: "1: 56 € / 2: 190 € / 3: 489 € / 4: 856 € / 5: 1 234 € / +6+ : +400 €/enf.",
        note: "Annexe III AR/CIR 92 indexée 2026 — barème SPF Finances.",
      },
      {
        name: "Workbonus — Volet A (employé)",
        value: "125,04 € max (brut ≤ 2 880,32 €), dégressif jusqu'à 0 à 3 336,98 €",
        note: "Source Securex 1ᵉʳ avril 2026. Pente β = 0,2738.",
      },
      {
        name: "Workbonus — Volet B (employé)",
        value: "168,62 € max (brut ≤ 2 255,50 €), dégressif jusqu'à 0 à 2 880,32 €",
        note: "Source Securex 1ᵉʳ avril 2026. Pente β = 0,2699.",
      },
      {
        name: "Cotisation spéciale sécu (CSSS) — points isolé",
        value: "2000→2,29 / 2400,92→13,74 / 2700,17→19,24 / 3477,20→36,29 / 4346,50→49,51 €/mois",
        note: "Imposable mensuel → CSSS isolé, barème loi 28/12/1992 indexé 2026. Plafond ~60,94 €/mois pour isolé au-delà de 6 038 €.",
      },
      {
        name: "Chèques-repas",
        value: "8,91 €/jour × 21 jours",
        note: "Part employeur max non imposable (valeur faciale max 10 €/jour en 2026, contribution travailleur 1,09 €). Source UCM/Liantis.",
      },
      {
        name: "ATN voiture — minimum légal",
        value: "1 660 €/an",
        note: "AR 14/01/2014, indexation 2026. Plancher quel que soit le calcul CO2.",
      },
      {
        name: "ATN voiture — coefficients CO2",
        value: "essence/hybride 0,055 / diesel 0,065 / électrique 0,041",
        note: "Moyennes 2026. Formule : valeur_catalogue × 6/7 × coef × décote_âge.",
      },
      {
        name: "ATN voiture — décote vétusté",
        value: "100 / 94 / 88 / 82 / 76 / 70 % (an 1 → 6+)",
        note: "Décroissance par tranche annuelle.",
      },
      {
        name: "Indemnité télétravail forfaitaire",
        value: "154,74 €/mois max",
        note: "Plafond 2026 (circulaire 2021/C/20). Non imposable, non ONSS.",
      },
    ],
    sources: [
      { name: "SPF Finances — Précompte professionnel (Annexe III AR/CIR 92)", url: "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul" },
      { name: "SPF Finances — Tax-on-web (déclaration et régularisation annuelle)", url: "https://finances.belgium.be/fr/E-services/tax-on-web" },
      { name: "ONSS — Cotisations travailleur 13,07 %", url: "https://www.socialsecurity.be" },
      { name: "ONSS — Bonus à l'emploi (réduction structurelle, volet A + B)", url: "https://www.socialsecurity.be" },
      { name: "SPF Finances — Cotisation spéciale sécurité sociale (loi 28/12/1992)", url: "https://finances.belgium.be" },
      { name: "SPF Finances — Avantage de toute nature voiture (AR 14/01/2014)", url: "https://finances.belgium.be" },
      { name: "SPF Finances — Circulaire 2021/C/20 (indemnité télétravail)", url: "https://finances.belgium.be" },
    ],
    limitations: [
      "Pas de prise en compte de l'assurance groupe / chèques cadeaux / éco-chèques.",
      "Pas de prise en compte de la pension alimentaire versée.",
      "Pas de prise en compte de la quotité régionale (impact < 1 % sur le précompte mensuel).",
      "Précompte interpolé entre points du barème SPF (2 000-5 000 € brut) ; pour des brut très élevés (> 10 000 €), extrapolation au taux marginal 53,50 % — précision dégradée.",
    ],
  },

  /* 2. PÉCULE DE VACANCES ------------------------------------------- */
  {
    slug: "pecule-vacances",
    title: "Pécule de vacances",
    pitch:
      "Pécule simple + double pour les employés (versé par l'employeur en juin) ou pour les ouvriers (versé par l'ONVA en mai/juin).",
    sourceFile: "lib/calculators/pecule.ts",
    reliability: "high",
    reliabilityNote:
      "Conforme à la formule officielle ONVA (régime ouvrier) et au barème SPF Finances « pécule de vacances » (Annexe III AR/CIR 92 points 53-55) pour le double pécule employé. Validé sur 6 points de référence contre simulateur RH professionnel et formule officielle ONVA : écart < 0,02 € sur les 4 cas employés et les 2 cas ouvriers. Régime employé : décomposition double pécule en part « légale » 85 % (soumise ONSS 13,07 %) + part « complément » 7 % (sans ONSS). Régime ouvrier : formule ONVA exacte (brut annuel × 1,08 × 15,38 % avec ONSS limitée à 6,8 % du brut majoré × 13,07 %, solidarité 1 %, précompte 17,16 % ≤ 1 740 € ou 23,22 %). Mention vacances-jeunes ONEM (C103, < 25 ans + 1re année post-études, demande avant fin février N+1).",
    year: 2026,
    lastUpdatedAt: "2026-05-24",
    badges: ["Belgique", "ONVA 2026", "Données 2026"],
    pedagogyIntro:
      "Le pécule de vacances belge se compose d'un **pécule simple** (le salaire normal pendant les congés — pas une prime distincte mais le salaire courant qui continue d'être versé) et d'un **double pécule** (la vraie prime extra-légale ≈ un mois supplémentaire, versée en juin). Deux régimes distincts coexistent : pour les **employés du privé**, l'employeur verse les deux montants directement, généralement en juin. Pour les **ouvriers**, c'est l'Office National des Vacances Annuelles (**ONVA**) qui paie en mai ou juin, selon une formule officielle (15,38 % du brut majoré à 108 %, avec retenue ONSS limitée à 6,8 %). Le double pécule employé suit le barème SPF Finances « pécule de vacances » (11 tranches, 0 à 53,50 %) — et NON le barème « allocations exceptionnelles » (qui s'applique aux primes/bonus/13e mois).",
    differentiators: [
      {
        label: "Barème SPF officiel 11 tranches « pécule de vacances »",
        description:
          "Le double pécule employé suit le barème SPF Finances 2026 « pécule de vacances » (Annexe III AR/CIR 92, points 53-55) — 11 tranches dégressives, 0 à 53,50 %. La plupart des calculateurs publics utilisent un taux moyen unique (~36 %) ; nous appliquons le vrai barème, validé contre un simulateur RH professionnel (écart < 0,02 €).",
      },
      {
        label: "Décomposition double pécule 85 % + 7 % (vs 92 % global)",
        description:
          "Le double pécule (92 % du brut) se décompose en 85 % « légal » (soumis à l'ONSS spéciale 13,07 %) + 7 % « complément » (NON soumis à l'ONSS). La plupart des calcs grand public appliquent l'ONSS sur les 92 %, ce qui surévalue les retenues de ~6 % — nous appliquons la décomposition officielle.",
      },
      {
        label: "Formule officielle ONVA exacte (régime ouvrier)",
        description:
          "Pour les ouvriers, nous appliquons la formule officielle publiée par l'ONVA : (1) salaire annuel × 1,08, (2) pécule = 15,38 %, (3) ONSS = brut majoré × 6,8 % × 13,07 % (et non 13,07 % du total), (4) solidarité 1 %, (5) précompte 17,16 % ou 23,22 %. Écart < 0,02 € avec la formule officielle ONVA.",
      },
      {
        label: "Vacances-jeunes ONEM signalées",
        description:
          "Si l'utilisateur est < 25 ans en 1re année après études, le résultat affiche le rappel ONEM (formulaire C103, demande avant fin février N+1, allocation 65 % du salaire plafonné). Rarement signalé par les calculateurs concurrents.",
      },
      {
        label: "Précompte ONVA à deux paliers (vs taux unique 23,22 %)",
        description:
          "Pour les ouvriers à faible pécule imposable (≤ 1 740 €), le précompte est 17,16 % et non 23,22 %. Nous gérons les deux paliers — ce qui change le net de plusieurs dizaines d'€ pour un travailleur à temps partiel.",
      },
    ],
    maintenanceGuide: [
      {
        trigger: "Barème SPF Finances « pécule de vacances » (simple, 11 tranches)",
        source: "SPF Finances — Annexe III AR/CIR 92, points 53-55",
        sourceUrl:
          "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul",
        frequency: "1 fois/an (publié mi-décembre, applicable 1ᵉʳ janvier)",
        codeLocation:
          "lib/calculators/pecule.ts → PRECOMPTE_PECULE_SIMPLE_EMPLOYE",
      },
      {
        trigger: "Barème SPF Finances « allocations exceptionnelles » (double, 11 tranches)",
        source: "SPF Finances — Annexe III AR/CIR 92, points 53-55",
        sourceUrl:
          "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul",
        frequency: "1 fois/an",
        codeLocation:
          "lib/calculators/pecule.ts → PRECOMPTE_DOUBLE_PECULE_EMPLOYE",
      },
      {
        trigger: "Taux ONVA global 15,38 %",
        source: "ONVA — Calcul du pécule de vacances",
        sourceUrl:
          "https://www.onva.fgov.be/fr/pecule-de-vacances/calcul-du-pecule-de-vacances",
        frequency: "1 fois/an",
        codeLocation: "lib/calculators/pecule.ts → ONVA_TAUX_TOTAL",
      },
      {
        trigger: "Coefficient de majoration ONVA 1,08",
        source: "ONVA",
        sourceUrl: "https://www.onva.fgov.be",
        frequency: "1 fois/an (rarement modifié)",
        codeLocation: "lib/calculators/pecule.ts → ONVA_COEF_MAJORATION",
      },
      {
        trigger: "Précompte ONVA (17,16 % / 23,22 %, seuil 1 740 €)",
        source: "SPF Finances / ONVA",
        sourceUrl:
          "https://www.onva.fgov.be/fr/pecule-de-vacances/calcul-du-pecule-de-vacances",
        frequency: "1 fois/an",
        codeLocation:
          "lib/calculators/pecule.ts → ONVA_PRECOMPTE_BAS / ONVA_PRECOMPTE_HAUT / ONVA_SEUIL_PRECOMPTE",
      },
      {
        trigger: "Vacances-jeunes ONEM (C103, conditions)",
        source: "ONEM — Vacances-jeunes",
        sourceUrl:
          "https://www.onem.be/citoyens/conges/avez-vous-droit-aux-vacances-jeunes-",
        frequency: "1 fois/an (vérification des conditions, montant suit le salaire plafonné chômage)",
        codeLocation: "components/docbel/calculators/calc-pecule.tsx (mention UI)",
      },
      {
        trigger: "Validation périodique (régression test)",
        source: "ONVA officiel (ouvrier) + SPF Finances Annexe III (employé)",
        sourceUrl: "https://www.onva.fgov.be/fr/pecule-de-vacances/calcul-du-pecule-de-vacances",
        frequency: "1 fois/an (mai-juin, à la sortie du décompte annuel ONVA)",
        codeLocation: "scripts/debug-pecule.ts → re-tester 6 cas",
      },
    ],
    inputs: [
      "Statut : employé / ouvrier",
      "Brut mensuel (employé : courant 2026 ; ouvrier : moyen 2025)",
      "Mois prestés en 2025 (0–12)",
      "Temps partiel + taux d'occupation (%)",
      "Jeune travailleur (< 25 ans, 1re année après études) — info vacances-jeunes ONEM",
    ],
    formulas: [
      {
        label: "Employé — pécule simple brut",
        expression: "simple = brut_mensuel × (mois_prestés / 12) × taux_occup",
      },
      {
        label: "Employé — pécule simple net (indicatif)",
        expression:
          "simple_net ≈ simple × (1 − 13,07 %) × (1 − taux_SPF_pécule_vacances). En pratique : suit le précompte mensuel ordinaire (= calc Brut/Net).",
      },
      {
        label: "Employé — double pécule brut (92 % du brut mensuel)",
        expression:
          "légal = brut_mensuel × 85 % × (mois/12) × taux_occup  ·  complément = brut_mensuel × 7 % × (mois/12) × taux_occup  ·  double_brut = légal + complément",
      },
      {
        label: "Employé — ONSS sur la part légale uniquement",
        expression: "ONSS = légal × 13,07 %  (le complément 7 % n'est PAS soumis à l'ONSS)",
      },
      {
        label: "Employé — double pécule net",
        expression:
          "imposable = double_brut − ONSS  ·  précompte = imposable × taux_SPF_pécule_vacances  ·  net = imposable − précompte",
      },
      {
        label: "Ouvrier — formule officielle ONVA",
        expression:
          "(1) annuel_100 = brut_mensuel × mois_prestés × taux_occup  ·  (2) annuel_108 = annuel_100 × 1,08  ·  (5) pécule_brut = annuel_108 × 15,38 %",
      },
      {
        label: "Ouvrier — retenue ONVA officielle",
        expression:
          "(6) ONSS = annuel_108 × 6,8 % × 13,07 %  ·  (7) solidarité = pécule_brut × 1 %  ·  (8) imposable = pécule_brut − (6) − (7)",
      },
      {
        label: "Ouvrier — précompte et net",
        expression:
          "(9) précompte = imposable × 17,16 % si ≤ 1 740 € sinon 23,22 %  ·  (10) net = imposable − précompte",
      },
    ],
    constants: [
      {
        name: "Taux double pécule (employé)",
        value: "92 %",
        note: "% du brut mensuel — taux légal applicable depuis 1971.",
      },
      {
        name: "Part « légale » double pécule",
        value: "85 % du brut mensuel",
        note: "Soumise à l'ONSS spéciale 13,07 %.",
      },
      {
        name: "Part « complément » double pécule",
        value: "7 % du brut mensuel",
        note: "NON soumise à l'ONSS (vérifié sur simulateur RH professionnel).",
      },
      {
        name: "ONSS spéciale sur double pécule",
        value: "13,07 %",
        note: "Identique au taux ONSS travailleur ordinaire, prélevée sur la part légale (85 %) avant le précompte.",
      },
      {
        name: "Précompte SPF « pécule de vacances » — barème appliqué",
        value: "0 / 19,17 / 21,20 / 26,25 / 31,30 / 34,33 / 36,34 / 39,37 / 42,39 / 47,44 / 53,50 %",
        note: "11 tranches de brut annuel, seuils 10 675 / 13 660 / 17 375 / 20 840 / 23 580 / 26 340 / 31 830 / 34 640 / 45 860 / 59 900 €. Source: Annexe III AR/CIR 92 (SPF Finances 2026). Appliqué AU DOUBLE PÉCULE EMPLOYÉ.",
      },
      {
        name: "Précompte SPF « allocations exceptionnelles » (documentation)",
        value: "23,22 / 23,22 / 25,23 / 30,28 / 35,33 / 38,36 / 40,38 / 43,41 / 46,44 / 51,48 / 53,50 %",
        note: "Mêmes seuils que le pécule. N'est PAS appliqué au pécule de vacances. S'applique aux primes de fin d'année, gratifications, bonus de productivité.",
      },
      {
        name: "Coefficient de majoration ONVA",
        value: "1,08",
        note: "Majoration légale des salaires déclarés à l'ONVA (article 38 AR 30/03/1967).",
      },
      {
        name: "Taux ONVA global",
        value: "15,38 %",
        note: "Total pécule simple (8 %) + double (7,38 %) sur brut majoré.",
      },
      {
        name: "ONVA — part légale double (assiette ONSS)",
        value: "6,8 %",
        note: "Coefficient officiel ONVA appliqué au brut majoré pour calculer la retenue ONSS (formule ONVA : annuel_108 × 6,8 % × 13,07 %). L'exonération de 0,58 % vient d'une règle légale spécifique.",
      },
      {
        name: "Cotisation de solidarité ONVA",
        value: "1 %",
        note: "Retenue spécifique sur le pécule brut total (en plus de l'ONSS et du précompte).",
      },
      {
        name: "Précompte ONVA — tranche basse",
        value: "17,16 %",
        note: "Pécule imposable ≤ 1 740 € (2026).",
      },
      {
        name: "Précompte ONVA — tranche haute",
        value: "23,22 %",
        note: "Pécule imposable > 1 740 € (2026).",
      },
      {
        name: "Vacances-jeunes ONEM",
        value: "65 % du salaire plafonné × jours de vacances-jeunes",
        note: "Employé < 25 ans au 31/12 N-1, études terminées sur N-1, ≥ 13 jours prestés sur ≥ 1 mois. Demande via C103 avant fin février N+1.",
      },
    ],
    sources: [
      {
        name: "SPF Finances — Précompte professionnel (Annexe III AR/CIR 92, points 53-55)",
        url: "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul",
      },
      {
        name: "ONVA — Calcul du pécule de vacances (ouvriers)",
        url: "https://www.onva.fgov.be/fr/pecule-de-vacances/calcul-du-pecule-de-vacances",
      },
      {
        name: "SPF Sécurité Sociale — Pécule de vacances",
        url: "https://www.socialsecurity.be",
      },
      {
        name: "SPF Emploi — Vacances annuelles",
        url: "https://emploi.belgique.be",
      },
      {
        name: "ONEM — Vacances-jeunes (formulaire C103)",
        url: "https://www.onem.be/citoyens/conges/avez-vous-droit-aux-vacances-jeunes-",
      },
      {
        name: "ONSS — Instructions administratives (notion de rémunération)",
        url: "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/salary/particularcases/holidaypay.html",
      },
    ],
    limitations: [
      "Approximation des jours assimilés (maladie, chômage temporaire, congé maternité) via la saisie « mois prestés ».",
      "Ne tient pas compte des primes et indemnités sectorielles spécifiques (commission paritaire).",
      "Ne modélise pas les pécules de sortie versés en cas de fin de contrat (« pécule de départ »).",
      "Pécule simple employé : estimation indicative seulement (sur la fiche de paie, le pécule simple suit le précompte mensuel ordinaire — voir calculateur Brut/Net).",
      "Salaires variables (bonus, commissions) non pris en compte côté employé : pour un calcul exact, ajouter (variable_12_derniers_mois / 12) au brut mensuel.",
    ],
  },

  /* 3. ALLOCATIONS DE CHÔMAGE --------------------------------------- */
  {
    slug: "allocations-chomage",
    title: "Allocations de chômage (ONEM)",
    pitch:
      "Allocation mensuelle estimée selon la phase de dégressivité ONEM, la situation familiale et le dernier salaire.",
    sourceFile: "lib/calculators/chomage.ts",
    reliability: "low",
    reliabilityNote:
      "Audit 2026-05 : plafonds salariaux mis à jour selon ONEM 01.03.2026 (PLAFOND_A 3 279,67→4 265,98 ; ajout PLAFOND_A_BIS 4 010,98 mois 4-6 ; PLAFOND_B 3 057,80→3 262,99). Les forfaits min/max restent à arbitrer (les valeurs ONEM journalières × 26 donnent ~2 773 €/mois pour la borne max, vs 1 850-2 200 € actuellement). La réforme 2026 a aussi introduit une limitation dans le temps non modélisée ici.",
    year: 2026,
    inputs: [
      "Dernier salaire mensuel brut (€)",
      "Situation familiale : chef de ménage / isolé / cohabitant",
      "Phase de chômage : 1A → 3",
    ],
    formulas: [
      {
        label: "Phases 1A → 2B",
        expression: "allocation = min(brut, plafond_phase) × taux_phase (65 % ou 60 %)",
      },
      { label: "Phase 2C / 3", expression: "allocation = forfait_situation_familiale" },
      {
        label: "Bornes",
        expression: "allocation = clamp(allocation, FORFAIT_MIN, FORFAIT_MAX) sauf phases forfaitaires",
      },
      { label: "Journalier", expression: "journalier = mensuel / 26 (régime 6 jours/semaine)" },
    ],
    constants: [
      { name: "Plafond A (mois 1–3)", value: "4 265,98 €/mois", note: "Phase 1A — taux 65 %." },
      { name: "Plafond A bis (mois 4–6)", value: "4 010,98 €/mois", note: "Phase 1B — taux 60 % (nouveau plafond réforme 2026)." },
      { name: "Plafond B (mois 7–12)", value: "3 262,99 €/mois", note: "Phase 2A." },
      { name: "Plafond C (mois 13+)", value: "3 262,99 €/mois", note: "Phase 2B — aligné sur B après réforme 2026." },
      { name: "Forfait min chef de ménage", value: "1 500 €/mois" },
      { name: "Forfait min isolé", value: "1 260 €/mois" },
      { name: "Forfait min cohabitant", value: "1 015 €/mois" },
      { name: "Forfait max chef de ménage", value: "2 200 €/mois", note: "⚠️ À arbitrer : ONEM donne ~2 773 €/mois (max journalier 106,65 × 26)." },
      { name: "Forfait 2C chef de ménage", value: "1 700 €/mois", note: "Phase 2 — an 2 à 3." },
      { name: "Forfait 2C cohabitant", value: "800 €/mois" },
      { name: "Forfait 3 cohabitant", value: "670 €/mois", note: "Après 3 ans de chômage." },
      ...PHASES_INFO.map((p) => ({
        name: `Phase ${p.id}`,
        value: p.label,
        note: p.periode_description,
      })),
    ],
    sources: [
      { name: "ONEM — Montants des allocations", url: "https://www.onem.be/fr/documentation/baremes" },
      { name: "ONEM — Le chômage complet (brochure)", url: "https://www.onem.be" },
      { name: "CAPAC — Caisse Auxiliaire de Paiement", url: "https://www.capac.fgov.be" },
    ],
    limitations: [
      "Pas de prise en compte du précompte professionnel sur l'allocation (~10,09 % chef de ménage avec personne à charge).",
      "Pas de complément d'ancienneté (travailleur âgé).",
      "Pas de calcul du supplément si conjoint à charge avec revenu.",
      "Pas de dispense pour études / formation.",
      "Pas de gestion des chômeurs avec charge de famille → tarif différent.",
    ],
  },

  /* 4. INDEMNITÉ DE RUPTURE ---------------------------------------- */
  {
    slug: "indemnite-rupture",
    title: "Indemnité de rupture (préavis non presté)",
    pitch:
      "Conversion du préavis non presté en indemnité compensatoire €, basée sur la rémunération courante.",
    sourceFile: "lib/calculators/indemnite-rupture.ts",
    reliability: "high",
    reliabilityNote:
      "Formule conforme à la Loi du 3 juillet 1978 (art. 39) avec barème précompte spécial SPF Finances 2026 par tranches (17,16 → 53,50 %) au lieu d'un taux moyen unique, cotisation spéciale employeur progressive ONSS 2026/1 (1 % / 2 % / 3 % selon brut annuel ≥ 50 166 / 61 437 / 72 707 €) signalée, et indemnité de protection cumulable (femme enceinte 6 mois, délégué syndical 36 mois, conseiller prévention 9 mois). L'indemnité de protection est correctement exclue de la base de la cotisation spéciale (ONSS 2026/1, notion de rémunération).",
    year: 2026,
    lastUpdatedAt: "2026-05-25",
    badges: ["Belgique", "Salarié", "2026"],
    category: "Rupture du contrat",
    tags: [
      "indemnité",
      "préavis",
      "rupture",
      "précompte spécial",
      "cotisation 1%",
    ],
    pedagogyIntro:
      "Quand l'employeur **rompt le contrat sans faire prester le préavis** (totalement ou partiellement), il doit verser une **indemnité compensatoire** égale à la rémunération courante correspondant à la durée non prestée. Côté salarié, cet outil estime le brut, le précompte spécial SPF Finances et le net après retenues. Côté employeur, il signale la cotisation spéciale de compensation ONSS (1 / 2 / 3 % selon la rémunération annuelle) due au Fonds de fermeture des entreprises. Trois statuts protégés ouvrent en plus droit à une **indemnité de protection cumulable** (femme enceinte, délégué syndical, conseiller en prévention).",
    differentiators: [
      {
        label: "Précompte spécial par tranches (5 paliers) plutôt qu'un taux moyen",
        description:
          "La plupart des calculateurs gratuits appliquent un taux unique (~33 ou ~40 %) qui sur-estime le net pour les bas salaires et sous-estime pour les hauts. Ici, le barème SPF Finances 2026 est modélisé en 5 tranches (17,16 / 26,75 / 32,30 / 41,80 / 53,50 %) appliquées au brut annuel de référence.",
      },
      {
        label: "Cotisation spéciale ONSS progressive 1 / 2 / 3 % signalée",
        description:
          "Conformément aux instructions administratives ONSS 2026/1, l'outil applique le bon taux selon les 3 tranches (≥ 50 166 € / ≥ 61 437 € / ≥ 72 707 €) — plutôt qu'un taux fixe 1 % approximatif. La cotisation est correctement présentée comme à charge de l'employeur, sans impact sur le net du salarié.",
      },
      {
        label: "Indemnité de protection pour 3 statuts (loi 1971 / CCT 5 / loi 1991)",
        description:
          "Femme enceinte (6 mois forfaitaires, art. 40 loi 16/03/1971), délégué syndical (36 mois centre CCT n° 5 art. 20), conseiller en prévention (9 mois médian, loi 19/03/1991). L'indemnité de protection est correctement exclue de la base de la cotisation spéciale ONSS.",
      },
      {
        label: "Avantages extra-légaux mensualisés",
        description:
          "Prime de fin d'année, double pécule, chèques-repas annuels, voiture de société, assurance groupe — l'utilisateur saisit le total annuel, l'outil le divise par 12 et l'ajoute à la rémunération mensuelle de base avant le calcul hebdo.",
      },
      {
        label: "Source de vérité : SPF Finances + ONSS + Moniteur belge uniquement",
        description:
          "Aucune référence à des secrétariats sociaux privés ou simulateurs concurrents : tous les chiffres et règles viennent du SPF Finances (précompte), de l'ONSS (cotisation spéciale, exonération de l'indemnité de protection) et du Moniteur belge (Loi 1978, loi 1971, loi 1991, loi 2013).",
      },
    ],
    maintenanceGuide: [
      {
        trigger: "Barème précompte spécial (annexe précompte professionnel)",
        source: "SPF Finances — Précompte professionnel 2026",
        sourceUrl:
          "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul",
        frequency: "1 fois/an (publication SPF Finances, généralement en janvier)",
        codeLocation:
          "lib/calculators/indemnite-rupture.ts → BAREME_PRECOMPTE_SPECIAL",
      },
      {
        trigger: "Seuils cotisation spéciale (1 / 2 / 3 %)",
        source: "ONSS — Instructions administratives DmfA",
        sourceUrl:
          "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_contributions/other_specialcontributions/terminationfeecontribution.html",
        frequency:
          "1 fois/an (vérifier indexation ; seuils stables depuis 01/01/2023)",
        codeLocation:
          "lib/calculators/indemnite-rupture.ts → TRANCHES_COTISATION_SPECIALE",
      },
      {
        trigger:
          "Indemnité de protection (multiplicateurs femme enceinte / délégué / CPPT)",
        source: "Moniteur belge — Loi 16/03/1971, CCT n° 5, Loi 19/03/1991",
        sourceUrl: "https://www.ejustice.just.fgov.be",
        frequency: "Rare (modification = nouvelle loi)",
        codeLocation: "lib/calculators/indemnite-rupture.ts → PROTECTION_MOIS",
      },
      {
        trigger: "CCT n° 5 — fourchette d'ancienneté pour délégué syndical",
        source: "CNT — CCT n° 5 sur le statut des délégations syndicales",
        sourceUrl: "https://www.cnt-nar.be",
        frequency: "Stable (révisions très rares)",
        codeLocation:
          "lib/calculators/indemnite-rupture.ts → PROTECTION_MOIS.delegue_syndical",
      },
      {
        trigger: "Validation périodique des 6 cas de référence",
        source: "SPF Emploi — Fin du contrat de travail",
        sourceUrl:
          "https://emploi.belgique.be/fr/themes/contrats-de-travail/fin-du-contrat-de-travail",
        frequency: "1 fois/an (après nouveaux barèmes janvier)",
        codeLocation:
          "scripts/debug-indemnite-rupture.ts → re-tester les 6 cas",
      },
    ],
    briefMeta: [
      {
        label: "Audience",
        value: "Salariés & employeurs (rupture sans préavis presté)",
        icon: "Users",
      },
      {
        label: "Durée de l'estimation",
        value: "~ 30 secondes (salaire + préavis suffisent)",
        icon: "Clock",
      },
      {
        label: "Prérequis",
        value: "Connaître le salaire brut mensuel et la durée du préavis",
        icon: "FileText",
      },
      {
        label: "Sortie",
        value: "Indemnité brute, net après précompte, cotisation employeur",
        icon: "Calculator",
      },
      {
        label: "Complexité",
        value: "Faible (3 inputs minimum, 5 maximum)",
        icon: "Sparkles",
      },
    ],
    inputs: [
      "Salaire brut mensuel courant",
      "Durée de préavis non presté (semaines, 0-200)",
      "Avantages annuels (€/an, optionnel)",
      "Estimer le net après précompte (oui/non)",
      "Statut de protection : aucune / femme enceinte / délégué syndical / conseiller en prévention",
    ],
    inputsDetailed: [
      {
        label: "Salaire mensuel brut",
        description:
          "Montant indiqué sur la fiche de paie avant retenues. Le calculateur multiplie par 13,92 pour estimer le brut annuel de référence (qui détermine le taux de précompte et la cotisation employeur).",
        icon: "Euro",
      },
      {
        label: "Durée du préavis non presté",
        description:
          "En semaines (0 à 200). Si l'employeur fait prester une partie du préavis, indiquer ici la partie non prestée. À combiner avec le calculateur de préavis pour obtenir la durée totale.",
        icon: "Calendar",
      },
      {
        label: "Avantages extra-légaux annualisés",
        description:
          "Prime de fin d'année, double pécule de vacances, chèques-repas, voiture de société, assurance groupe… Total annuel estimé en €/an. Divisé par 12 et ajouté à la rémunération mensuelle de base.",
        icon: "Gift",
      },
      {
        label: "Statut de protection spéciale",
        description:
          "4 valeurs possibles : aucune / femme enceinte (+6 mois) / délégué syndical CCT 5 (+~3 ans) / conseiller en prévention CPPT (+~9 mois). Cumule une indemnité de protection à l'indemnité standard.",
        icon: "ShieldAlert",
      },
      {
        label: "Calcul du net après précompte",
        description:
          "Oui : applique le barème précompte spécial SPF Finances (5 tranches). Non : affiche uniquement le brut total.",
        icon: "Percent",
      },
    ],
    outputs: [
      "Indemnité brute standard (rémunération hebdo × semaines)",
      "Indemnité de protection si statut protégé (mois × rémunération mensuelle)",
      "Total brut",
      "Taux de précompte spécial appliqué (selon tranche)",
      "Net estimé après précompte (si demandé)",
      "Cotisation spéciale employeur (1 / 2 / 3 %) — info, n'affecte pas le net",
      "Brut annuel de référence (salaire × 13,92)",
    ],
    formulas: [
      {
        label: "Rémunération mensuelle de base",
        expression: "mensuelle = brut + (avantages_an / 12)  [si inclus]",
      },
      {
        label: "Rémunération hebdomadaire",
        expression:
          "hebdo = mensuelle × 3 / 13  (équivalence légale 13 sem = 3 mois)",
      },
      {
        label: "Indemnité brute (préavis non presté)",
        expression: "indemnité = hebdo × préavis_semaines",
      },
      {
        label: "Indemnité de protection (cumulable)",
        expression: "protection = mois_protection × mensuelle",
      },
      {
        label: "Précompte spécial par tranches",
        expression:
          "taux selon brut_annuel (= mensuelle × 13,92) : 17,16 / 26,75 / 32,30 / 41,80 / 53,50 %",
      },
      {
        label: "Net estimé",
        expression:
          "net = (indemnité_brute + protection) × (1 − taux_précompte)",
      },
      {
        label: "Cotisation spéciale employeur (progressive)",
        expression:
          "taux = 1 % (≥ 50 166 €) / 2 % (≥ 61 437 €) / 3 % (≥ 72 707 €) ; cotisation = indemnité_brute × taux (hors protection)",
      },
    ],
    constants: [
      {
        name: "Précompte spécial — tranche 1",
        value: "17,16 %",
        note: "Brut annuel ≤ 17 670 €.",
      },
      {
        name: "Précompte spécial — tranche 2",
        value: "26,75 %",
        note: "17 670 € < brut annuel ≤ 21 730 €.",
      },
      {
        name: "Précompte spécial — tranche 3",
        value: "32,30 %",
        note: "21 730 € < brut annuel ≤ 30 220 €.",
      },
      {
        name: "Précompte spécial — tranche 4",
        value: "41,80 %",
        note: "30 220 € < brut annuel ≤ 65 200 €.",
      },
      {
        name: "Précompte spécial — tranche 5",
        value: "53,50 %",
        note: "Brut annuel > 65 200 €.",
      },
      {
        name: "Coefficient annualisation",
        value: "× 13,92",
        note: "12 mois + 13e (~1) + double pécule (~0,92) pour estimer le brut annuel.",
      },
      {
        name: "Cotisation spéciale — tranche 1",
        value: "1 %",
        note: "50 166 € ≤ rémunération annuelle < 61 437 € (ONSS 2026/1).",
      },
      {
        name: "Cotisation spéciale — tranche 2",
        value: "2 %",
        note: "61 437 € ≤ rémunération annuelle < 72 707 € (ONSS 2026/1).",
      },
      {
        name: "Cotisation spéciale — tranche 3",
        value: "3 %",
        note: "Rémunération annuelle ≥ 72 707 € (ONSS 2026/1).",
      },
      {
        name: "Indemnité protection — femme enceinte",
        value: "6 mois de rémunération",
        note: "Loi du 16 mars 1971, art. 40 (forfaitaire).",
      },
      {
        name: "Indemnité protection — délégué syndical",
        value: "36 mois (3 ans)",
        note: "CCT n° 5, art. 20 (2 à 4 ans selon ancienneté, valeur centrale retenue).",
      },
      {
        name: "Indemnité protection — conseiller prévention",
        value: "9 mois",
        note: "Loi du 19 mars 1991 (6 à 12 mois selon ancienneté).",
      },
      {
        name: "Garde-fou préavis max",
        value: "200 semaines (~4 ans)",
        note: "Limite de l'input pour éviter les saisies aberrantes.",
      },
      {
        name: "Équivalence légale",
        value: "13 semaines = 3 mois",
        note: "Conversion mensuelle → hebdomadaire (Loi du 3 juillet 1978).",
      },
    ],
    sources: [
      {
        name: "SPF Finances — Précompte professionnel 2026 (calcul)",
        url: "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul",
      },
      {
        name: "ONSS — Cotisation spéciale sur les indemnités de rupture (DmfA 2026/1)",
        url: "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_contributions/other_specialcontributions/terminationfeecontribution.html",
      },
      {
        name: "Moniteur belge — Loi du 3 juillet 1978 sur les contrats de travail",
        url: "https://www.ejustice.just.fgov.be",
      },
      {
        name: "SPF Emploi — Fin du contrat de travail",
        url: "https://emploi.belgique.be/fr/themes/contrats-de-travail/fin-du-contrat-de-travail",
      },
    ],
    limitations: [
      "Pas d'application du régime fiscal de taxation distincte (article 171 CIR 92, taux marginal de l'année précédente) — l'outil applique le précompte spécial source.",
      "Indemnité de protection : montants centraux — le cas concret peut varier (ancienneté du délégué syndical, motif précis de la protection).",
      "Le précompte spécial réel dépend du taux marginal individuel (personnes à charge, conjoint, etc.) — l'approximation par 5 tranches donne un cadre, pas un chiffre exact.",
      "La cotisation spéciale s'applique uniquement à la part d'indemnité couvrant des prestations à partir du 01/01/2014 — l'outil l'applique sur l'indemnité brute totale (approximation conservatrice pour les contrats récents).",
    ],
  },

  /* 5. PENSION ----------------------------------------------------- */
  {
    slug: "pension-estimation",
    title: "Pension légale estimée (salarié)",
    pitch:
      "Estimation pédagogique de la pension légale salarié belge selon la carrière, le salaire moyen et l'âge de départ.",
    sourceFile: "lib/calculators/pension.ts",
    reliability: "high",
    reliabilityNote:
      "Formule SFP officielle (taux × carrière/45). Plafond salarial annuel 2026 (69 521 €) et minimum garanti mensuel post-indexation mars 2026 (1 844,93 € isolé / 2 305,44 € ménage). Conditions d'anticipation conformes à la loi du 10 août 2015 (60/44, 61/43, 62-64/42), avec périodes assimilées intégrées dans la carrière totale. Estimation indicative — pour le calcul officiel et personnalisé : mypension.be.",
    year: 2026,
    lastUpdatedAt: "2026-05-25",
    badges: ["Belgique", "Salarié 2026", "Données 2026"],
    category: "Retraite & Sécurité sociale",
    tags: ["pension", "retraite", "SFP", "salarié", "carrière"],
    pedagogyIntro:
      "La pension légale du salarié belge se calcule selon une **formule officielle** simple : `salaire pris × taux × (carrière / 45)`, où le **taux** est de 60 % pour un isolé ou 75 % pour le taux ménage, la **carrière complète** vaut 45 ans, et le **salaire pris** est la moyenne des salaires plafonnée annuellement (69 521 €/an en 2026). Le départ avant l'**âge légal** (65, 66 ou 67 ans selon votre année de naissance) n'est pas possible avec un simple « malus » : la **loi du 10 août 2015** fixe une carrière minimum par âge (44 ans à 60 ans, 43 ans à 61 ans, 42 ans entre 62 et 64 ans). Deux garde-fous viennent compléter ce calcul : un **plancher minimum garanti** mensuel (1 844,93 € isolé / 2 305,44 € ménage en 2026, proratisé selon la carrière) si vous avez au moins 30 ans de carrière, et un **plafond pension** indicatif au-delà duquel la pension légale n'augmente plus.",
    differentiators: [
      {
        label: "Vraies conditions de départ anticipé (loi 10/08/2015)",
        description:
          "Aucun malus linéaire fantaisiste : on applique les conditions de carrière minimum publiées par le SFP — 44 ans à 60 ans, 43 ans à 61 ans, 42 ans entre 62 et 64 ans. Si la condition n'est pas remplie, le calc bascule sur l'âge légal et explique pourquoi.",
      },
      {
        label: "Périodes assimilées intégrées",
        description:
          "Chômage indemnisé, maladie de longue durée, congé parental, service militaire et crédit-temps reconnu s'ajoutent à la carrière effective et comptent à la fois pour l'éligibilité à l'anticipation et pour le calcul de la pension (régime SFP fidèle).",
      },
      {
        label: "Minimum garanti proratisé",
        description:
          "Si la carrière totale atteint au moins 30 ans (deux tiers d'une carrière complète), un plancher minimum mensuel s'applique, proratisé sur 45 — exactement comme le fait le SFP.",
      },
      {
        label: "Plafonds salarial et pension actifs",
        description:
          "Plafond salarial 69 521 €/an (SFP 2026) et plafonds pension mensuels indicatifs (3 500 € isolé / 4 350 € ménage) — affichés dans le résultat quand ils s'activent, pour expliquer pourquoi la pension ne grimpe pas au-delà.",
      },
      {
        label: "Détection automatique de l'âge légal",
        description:
          "L'âge légal (65 / 66 / 67 ans) est calculé à partir de la date de naissance selon la loi du 10/08/2015 : pas besoin que l'utilisateur le sache, c'est l'outil qui adapte.",
      },
    ],
    maintenanceGuide: [
      {
        trigger: "Plafond salarial annuel (indexation)",
        source: "SFP — Plafond salarial (page officielle)",
        sourceUrl:
          "https://www.sfpd.fgov.be/fr/montant-de-la-pension/calcul/types-de-pensions/salaries/salaires/plafond-salarial/",
        frequency: "1 fois/an (indexation, souvent en janvier ou en mars)",
        codeLocation: "lib/calculators/pension.ts → PLAFOND_SALARIAL_2026",
      },
      {
        trigger: "Minimum garanti (isolé + ménage)",
        source: "SFP — Pension minimum garantie",
        sourceUrl:
          "https://www.sfpd.fgov.be/fr/montant-de-la-pension/calcul/minimum-garanti-de-pension/",
        frequency: "Indexation pivot (généralement 1-2 fois/an)",
        codeLocation:
          "lib/calculators/pension.ts → MINIMUM_ISOLE / MINIMUM_MENAGE",
      },
      {
        trigger: "Conditions de départ anticipé (carrière minimum / âge)",
        source: "SFP — Pension anticipée (loi 10/08/2015)",
        sourceUrl:
          "https://www.sfpd.fgov.be/fr/montant-de-la-pension/calcul/age-de-la-pension/",
        frequency: "Rare (modification = loi)",
        codeLocation:
          "lib/calculators/pension.ts → getConditionAnticipation()",
      },
      {
        trigger: "Âge légal de la pension par année de naissance",
        source: "Moniteur belge — Loi du 10 août 2015",
        sourceUrl: "https://www.ejustice.just.fgov.be",
        frequency: "Stable (jusqu'à éventuelle nouvelle loi)",
        codeLocation: "lib/calculators/pension.ts → getAgeLegal()",
      },
      {
        trigger: "Validation périodique des cas de référence",
        source: "mypension.be — compte de carrière individuel",
        sourceUrl: "https://www.mypension.be",
        frequency:
          "1 fois/an (après indexation, comparaison contre simulateur officiel)",
        codeLocation: "scripts/debug-pension.ts → re-tester les 6 cas",
      },
    ],
    briefMeta: [
      {
        label: "Méthode",
        value: "Formule SFP officielle (taux × carrière / 45)",
        icon: "FileCode2",
      },
      {
        label: "Indexation",
        value: "Plafond salarial + minimum garanti indexés annuellement",
        icon: "Calendar",
      },
      { label: "Unités", value: "Mensuel + annuel (€ brut)", icon: "Calculator" },
      { label: "Dernière MAJ", value: "25 mai 2026", icon: "Clock" },
      { label: "Auteur", value: "Équipe Docbel", icon: "Users" },
    ],
    inputsDetailed: [
      {
        label: "Date de naissance",
        description:
          "Détermine automatiquement l'âge légal (65 ans avant 1960, 66 ans 1960-1963, 67 ans à partir de 1964).",
        icon: "Calendar",
      },
      {
        label: "Années de carrière effectives",
        description:
          "Années réellement travaillées comme salarié (hors périodes assimilées).",
        icon: "Briefcase",
      },
      {
        label: "Périodes assimilées",
        description:
          "Chômage indemnisé, maladie de longue durée, congé parental, service militaire, crédit-temps reconnu. Comptent comme carrière.",
        icon: "Clock",
      },
      {
        label: "Salaire annuel brut moyen sur la carrière",
        description:
          "Moyenne sur l'ensemble de la carrière (pas seulement le dernier salaire). Plafonné à 69 521 €/an en 2026.",
        icon: "Euro",
      },
      {
        label: "Statut civil",
        description: "Isolé (taux 60 %) ou ménage / cohabitant légal (taux 75 %).",
        icon: "Users",
      },
      {
        label: "Âge de départ envisagé",
        description:
          "Entre 60 et 70 ans. Le départ avant l'âge légal est conditionné à la carrière minimum.",
        icon: "Hourglass",
      },
    ],
    outputs: [
      "Pension mensuelle brute estimée (€)",
      "Pension annuelle brute estimée (€)",
      "Âge légal et âge de départ effectivement retenu",
      "Éligibilité au départ anticipé (oui/non + condition manquée)",
      "Carrière totale (effective + assimilée) prise en compte",
      "Indication plafond salarial ou plafond pension atteint",
    ],
    inputs: [
      "Date de naissance (détermine l'âge légal)",
      "Années de carrière prévues (0–50)",
      "Salaire annuel brut moyen sur la carrière (€)",
      "Statut : isolé (60 %) / ménage (75 %)",
      "Âge de départ envisagé (60–70)",
      "Périodes assimilées (chômage, maladie, crédit-temps, service militaire) en années",
    ],
    formulas: [
      {
        label: "Carrière totale",
        expression: "carrière_totale = années_carrière + périodes_assimilées",
      },
      {
        label: "Éligibilité départ anticipé (loi 10/08/2015)",
        expression:
          "60 ans → ≥ 44 ans / 61 ans → ≥ 43 ans / 62-64 ans → ≥ 42 ans (sinon : calcul à l'âge légal pour info)",
      },
      {
        label: "Salaire pris en compte",
        expression: "salaire_pris = min(salaire_moyen, plafond_salarial)",
      },
      {
        label: "Pension annuelle de base",
        expression:
          "pension = salaire_pris × taux × (min(carrière_totale, 45) / 45)",
      },
      {
        label: "Plancher minimum garanti (si carrière totale ≥ 30 ans)",
        expression: "pension_mensuelle = max(pension_mensuelle, minimum × carrière/45)",
      },
      {
        label: "Plafond légal indicatif",
        expression:
          "pension_mensuelle = min(pension_mensuelle, plafond_pension)",
      },
    ],
    constants: [
      {
        name: "Plafond salarial annuel",
        value: "69 521 €/an",
        note: "Barème SFP 2026 (indexé). Au-delà, le salaire n'augmente plus la pension.",
      },
      { name: "Carrière complète conventionnelle", value: "45 ans" },
      { name: "Taux isolé", value: "60 %" },
      { name: "Taux ménage", value: "75 %", note: "Conjoint sans revenu propre suffisant." },
      {
        name: "Minimum garanti isolé",
        value: "1 844,93 €/mois",
        note: "Barème SFP au 1ᵉʳ mars 2026 (post-indexation +2 %). Carrière totale ≥ 30 ans, proratisé sur 45.",
      },
      {
        name: "Minimum garanti ménage",
        value: "2 305,44 €/mois",
        note: "Barème SFP au 1ᵉʳ mars 2026 (post-indexation).",
      },
      {
        name: "Plafond pension isolé (mensuel)",
        value: "3 500 €/mois",
        note: "Plafond indicatif au-delà duquel la pension légale plafonne dans le calc.",
      },
      { name: "Plafond pension ménage (mensuel)", value: "4 350 €/mois" },
      {
        name: "Condition anticipation — 60 ans",
        value: `${getConditionAnticipation(60)?.conditionCarriere ?? 44} ans de carrière`,
        note: "Carrière totale (effective + assimilée).",
      },
      {
        name: "Condition anticipation — 61 ans",
        value: `${getConditionAnticipation(61)?.conditionCarriere ?? 43} ans de carrière`,
      },
      {
        name: "Condition anticipation — 62 à 64 ans",
        value: `${getConditionAnticipation(62)?.conditionCarriere ?? 42} ans de carrière`,
      },
      {
        name: "Âge légal de pension",
        value: "65 (<1960) / 66 (1960–1963) / 67 (≥1964)",
        note: "Loi du 10 août 2015 (Moniteur belge).",
      },
    ],
    sources: [
      {
        name: "SFP — Service Fédéral des Pensions",
        url: "https://www.sfpd.fgov.be",
      },
      {
        name: "mypension.be — compte de carrière officiel",
        url: "https://www.mypension.be",
      },
      {
        name: "Moniteur belge — Loi du 10 août 2015 (âge légal + anticipation)",
        url: "https://www.ejustice.just.fgov.be",
      },
      {
        name: "Moniteur belge — AR du 21 décembre 1967 (régime général salariés)",
        url: "https://www.ejustice.just.fgov.be",
      },
    ],
    limitations: [
      "Pas de bonus pour les carrières longues (>45 ans) : non prévu dans le régime salarié actuel.",
      "Pas de calcul de la pension de survie ou de la pension complémentaire (2e pilier).",
      "Pas de calcul pour les indépendants ou les fonctionnaires (régimes distincts).",
      "Salaire moyen unique sur toute la carrière : la réalité applique le salaire plafonné de chaque année.",
    ],
  },

  /* 6. ALLOCATIONS FAMILIALES -------------------------------------- */
  {
    slug: "allocations-familiales",
    title: "Allocations familiales (4 régimes)",
    pitch:
      "Allocations familiales selon le régime régional applicable (FAMIWAL / FAMIRIS / Groeipakket / Kindergeld DG), 2026.",
    sourceFile: "lib/calculators/allocs-fam.ts",
    reliability: "high",
    reliabilityNote:
      "Conforme aux barèmes officiels FAMIWAL/FAMIRIS/Groeipakket/Kindergeld DG 2026 (indexation mars 2026 pour WAL/BXL, septembre 2025 pour FLA — Kindergeld DG : indexation suspendue en 2025-2026 par programme-décret). Validé sur 7 points de référence : 2 cas Wallonie (nouveau/ancien), 2 cas Bruxelles (intermédiaire et bas-mono), 1 cas Flandre (3 enfants), 1 cas handicap, 1 cas orphelin. Base FAMIWAL nouveau régime 196,57 € (0-17 ans), 209,25 € (18-24) ; base FAMIRIS par tranche d'âge (190,23 / 202,91 / 215,59 €) ; basisbedrag Groeipakket 184,62 € ; Basiskindergeld DG 188,89 €. **FAMIRIS — supplément social** : barème officiel exact (article 9, ordonnance 25/04/2019) appliqué par enfant selon la taille de la famille (1/2/3+ enfants), l'âge (0-11 ou 12-24) et le statut monoparental. **Groeipakket — zorgtoeslag médian** corrigé à 124,09 €/mois (catégorie 6-8 pts pilier 1 < 4) et **wezentoeslag** corrigée à 147,71 € (semi-orphelin) / 184,61 € (orphelin total). **Kindergeld DG** : Geburtsprämie portée à 1 376,16 € (vs 1 296 € précédemment) et Schulbonus annuel supprimé depuis 2025 (décret budgétaire DG). Pour le montant officiel : caisse d'allocations.",
    year: 2026,
    lastUpdatedAt: "2026-05-24",
    badges: ["Belgique", "Régions 2026", "Données 2026"],
    category: "Famille & Enfants",
    tags: [
      "allocations",
      "famille",
      "enfants",
      "FAMIWAL",
      "FAMIRIS",
      "Groeipakket",
    ],
    pedagogyIntro:
      "Depuis la **régionalisation** entrée en vigueur entre 2019 et 2020, les allocations familiales belges sont gérées par **4 organismes officiels distincts** : FAMIWAL (Wallonie), FAMIRIS (Bruxelles), Groeipakket (Flandre) et Kindergeld DG (Communauté germanophone). Chaque régime a son propre barème indexé, sa date pivot ancien/nouveau régime (2019 en Flandre, 2020 en WAL/BXL), et ses suppléments. Notre calculateur applique automatiquement le bon barème selon la région, l'âge de chaque enfant et la composition du ménage — pour donner un ordre de grandeur réaliste avant le contact avec la caisse.",
    differentiators: [
      {
        label: "4 régimes régionaux intégrés",
        description:
          "FAMIWAL, FAMIRIS, Groeipakket et Kindergeld DG sont modélisés avec leurs barèmes officiels mars/septembre 2026 et leurs dates pivot distinctes (2019 Flandre, 2020 WAL/BXL).",
      },
      {
        label: "Allocation de naissance one-shot par région",
        description:
          "Prime de naissance distincte par région et selon le rang : 1 395,02 € FAMIWAL/FAMIRIS rang 1, 634,10 € FAMIRIS suivants, 1 269,25 € Startbedrag Flandre, 1 376,16 € Kindergeld DG.",
      },
      {
        label: "Suppléments handicap & orphelin avec barème par régime",
        description:
          "Handicap : catégorie médiane « modérée » 141,90 € (WAL/DG), 124,09 € (FLA zorgtoeslag 6-8 pts), 546,58 € (BXL). Orphelin : barème complet (1 parent / 2 parents, ancien / nouveau régime selon date de décès) — wezentoeslag Groeipakket à 147,71 / 184,61 €.",
      },
      {
        label: "Bonus rentrée scolaire annuel par âge",
        description:
          "Prime scolaire 2026 différenciée par tranche d'âge et par région (25,36 → 101,46 € WAL/BXL ; 23,07 → 69,22 € FLA Schoolbonus). Côté Kindergeld DG, le Schulbonus a été supprimé en 2025 par décret budgétaire.",
      },
      {
        label: "Détection auto du régime selon région",
        description:
          "L'utilisateur ne fait que sélectionner sa région : le calc applique automatiquement les bons seuils de revenu, suppléments par rang et barèmes par tranche d'âge, sans avoir à choisir manuellement.",
      },
    ],
    maintenanceGuide: [
      {
        trigger: "Barèmes FAMIWAL (base, supplément social, monoparental, orphelin, handicap)",
        source: "FAMIWAL — Résumé des montants",
        sourceUrl: "https://www.famiwal.be/montants/resume-des-montants",
        frequency: "1 fois/an (indexation mars)",
        codeLocation:
          "lib/calculators/allocs-fam.ts → WAL_BASE_NOUVEAU_*, WAL_SUPP_*",
      },
      {
        trigger: "Barèmes FAMIRIS (base par âge, supplément social, orphelin %)",
        source: "FAMIRIS — Montants des allocations familiales",
        sourceUrl:
          "https://famiris.brussels/fr/faq/payments-amounts-of-child-benefits/child-benefit-rates/",
        frequency: "1 fois/an (indexation mars)",
        codeLocation:
          "lib/calculators/allocs-fam.ts → BXL_BASE_NOUVEAU_*, BXL_SUPP_*",
      },
      {
        trigger: "Barèmes Groeipakket (basisbedrag, sociale toeslag, zorgtoeslag)",
        source: "Groeipakket — Bedragen",
        sourceUrl: "https://www.groeipakket.be/fr/montants",
        frequency: "1 fois/an (indexation septembre)",
        codeLocation:
          "lib/calculators/allocs-fam.ts → FLA_BASE_NOUVEAU, FLA_SUPP_*",
      },
      {
        trigger: "Barèmes Kindergeld DG (Basiskindergeld, Sozialzuschlag, Geburtszulage)",
        source: "Ostbelgien Familie — Beträge",
        sourceUrl: "https://ostbelgienfamilie.be/desktopdefault.aspx/tabid-5900/",
        frequency: "1 fois/an (indexation annuelle)",
        codeLocation: "lib/calculators/allocs-fam.ts → DG_BASE, DG_SUPP_*",
      },
      {
        trigger: "Bonus rentrée scolaire (par âge et par région)",
        source:
          "FAMIWAL prime scolaire / FAMIRIS supplément d'âge annuel / Schoolbonus Groeipakket",
        sourceUrl:
          "https://www.famiwal.be/accedez-aux-themes/vos-allocations-familiales/votre-supplement-dage-annuel-prime-scolaire",
        frequency: "1 fois/an (avant le versement d'août)",
        codeLocation:
          "lib/calculators/allocs-fam.ts → walBonusRentree / bxlBonusRentree / flaBonusRentree / dgBonusRentree",
      },
      {
        trigger: "Validation périodique (régression test)",
        source: "FAMIWAL/FAMIRIS/Groeipakket — simulateurs officiels",
        sourceUrl: "https://www.famiwal.be/calculatrice",
        frequency: "1 fois/an (mars-avril, après l'indexation officielle)",
        codeLocation: "scripts/debug-allocs-fam.ts → re-tester 6 cas",
      },
    ],
    briefMeta: [
      { label: "Méthode", value: "Barèmes officiels FAMIWAL/FAMIRIS/Groeipakket/DG", icon: "FileCode2" },
      { label: "Régionalisation", value: "4 régimes (2019 FLA · 2020 WAL/BXL)", icon: "MapPin" },
      { label: "Unités", value: "Mensuel (€) + bonus annuels", icon: "Calculator" },
      { label: "Dernière MAJ", value: "24 mai 2026", icon: "Clock" },
      { label: "Auteur", value: "Équipe Docbel", icon: "Users" },
    ],
    inputsDetailed: [
      {
        label: "Région de résidence",
        description:
          "Wallonie / Bruxelles / Flandre / Germanophone — détermine la caisse et le barème.",
        icon: "MapPin",
      },
      {
        label: "Revenu annuel du ménage",
        description:
          "Revenu imposable cumulé. Sert au calcul des suppléments sociaux et monoparentaux.",
        icon: "Euro",
      },
      {
        label: "Famille monoparentale",
        description:
          "Un seul adulte assume la charge — active le supplément monoparental quand il existe.",
        icon: "Users",
      },
      {
        label: "Liste d'enfants (1–10)",
        description:
          "Année de naissance, handicap reconnu (médian), statut orphelin (1 ou 2 parents).",
        icon: "Baby",
      },
    ],
    outputs: [
      "Total mensuel toutes allocations",
      "Détail par enfant (base + suppléments)",
      "Bonus rentrée scolaire annuel (versé en août)",
      "Allocation de naissance (one-shot pour les enfants nés cette année)",
      "Régime détecté automatiquement par enfant (ancien / nouveau)",
    ],
    inputs: [
      "Région : Wallonie / Bruxelles / Flandre / Germanophone",
      "Liste d'enfants (année de naissance, 1–10)",
      "Revenu annuel brut imposable du ménage (€)",
      "Famille monoparentale (oui/non)",
      "Handicap par enfant (catégorie médiane)",
      "Statut orphelin par enfant (aucun / un parent / deux parents)",
    ],
    formulas: [
      {
        label: "Tri des enfants",
        expression: "rang attribué du plus âgé (rang 1) au plus jeune",
      },
      {
        label: "Wallonie nouveau régime (né ≥2020)",
        expression:
          "base = 196,57 € (0–17 ans) ou 209,25 € (18–24 ans). +69,75 € supp social si ≤ 34 000 €/an, +31,71 € si ≤ 54 868 €/an. +25,36 / 12,68 € supp mono.",
      },
      {
        label: "Wallonie ancien régime (né <2020)",
        expression:
          "base = 121,50 € (1er) / 224,82 € (2e) / 335,66 € (3e+). Supplément social par rang (61,85 / 38,34 / 6,73 €) si bas revenu.",
      },
      {
        label: "Bruxelles nouveau régime (né ≥2020)",
        expression:
          "base = 190,23 € (0–11) / 202,91 € (12–17) / 215,59 € (18–24). Supp social par enfant (barème article 9) selon taille famille, âge et statut mono — voir constantes.",
      },
      {
        label: "Flandre Groeipakket",
        expression:
          "basisbedrag 184,62 €. Supp social 1-2 enf : 73,68 € (≤ 40 702 €) ou 37,31 € (≤ 47 485 €). 3+ enfants : 108,29 € ou 85,22 € (seuils 40 702 / 76 561 €).",
      },
      {
        label: "Germanophone (Kindergeld DG)",
        expression:
          "Basiskindergeld 188,89 €. Sozialzuschlag 93,23 € si bas revenu. Familienzuschlag 165,40 € à partir du 3e enfant.",
      },
      {
        label: "Supplément handicap (cumulable, catégorie médiane modérée)",
        expression:
          "+ 141,90 € (WAL/DG) · + 124,09 € (FLA zorgtoeslag 6-8 pts pilier 1 <4) · + 546,58 € (BXL). Réel = 93 à 621 € selon points (catégorie haute Groeipakket = 478,02 €).",
      },
      {
        label: "Supplément orphelin (cumulable)",
        expression:
          "WAL ≥2020 : 98,29 (0-17) / 104,63 (18-24) / 443,87 (2 parents). WAL <2020 : 466,75 €. FAMIRIS : +50 % base (1 parent) ou +100 % (2). FLA wezentoeslag : 147,71 (semi) / 184,61 (total). DG : 180 / 400 € (indicatif).",
      },
      {
        label: "Allocation de naissance (one-shot)",
        expression:
          "WAL : 1 395,02 € forfait. BXL : 1 395,02 € (rang 1) / 634,10 € (suivants). FLA : 1 269,25 € Startbedrag. DG : 1 376,16 €.",
      },
    ],
    constants: [
      {
        name: "Pivot ancien/nouveau régime — WAL/BXL",
        value: "1ᵉʳ janvier 2020",
        note: "FAMIRIS : strictement 01/12/2019, arrondi à <2020 dans le calcul.",
      },
      {
        name: "Pivot ancien/nouveau régime — Flandre",
        value: "1ᵉʳ janvier 2019",
        note: "Démarrage du Groeipakket (« paquet de croissance »).",
      },
      {
        name: "WAL — base nouveau régime",
        value: "196,57 € (0-17 ans) · 209,25 € (18-24 ans)",
        note: "Source FAMIWAL mars 2026.",
      },
      {
        name: "WAL — base ancien régime",
        value: "121,50 € (1er) · 224,82 € (2e) · 335,66 € (3e+)",
        note: "Source FAMIWAL mars 2026.",
      },
      {
        name: "WAL — seuils revenu",
        value: "≤ 34 000,47 € (bas) · ≤ 54 867,79 € (intermédiaire)",
        note: "Indexés annuellement.",
      },
      {
        name: "WAL — supplément social nouveau régime",
        value: "+69,75 € (bas) · +31,71 € (intermédiaire)",
      },
      {
        name: "WAL — supplément monoparental nouveau régime",
        value: "+25,36 € (bas) · +12,68 € (intermédiaire)",
        note: "S'ajoute au supplément social.",
      },
      {
        name: "WAL — orphelin nouveau régime",
        value: "98,29 € (0-17) / 104,63 € (18-24) / 443,87 € (2 parents)",
      },
      {
        name: "WAL — orphelin ancien régime",
        value: "466,75 € (décès antérieurs à 2020)",
      },
      {
        name: "WAL — prime de naissance",
        value: "1 395,02 € forfait (≥2020)",
        note: "Ancien régime (rang 1) : 1 646,08 €.",
      },
      {
        name: "WAL — prime scolaire (annuel)",
        value: "25,36 € (0-4) · 38,05 € (5-10) · 63,41 € (11-16) · 101,46 € (17-24)",
      },
      {
        name: "BXL — base nouveau régime",
        value: "190,23 € (0-11) · 202,91 € (12-17) · 215,59 € (18-24 sup)",
        note: "Source FAMIRIS indexée 01/03/2026.",
      },
      {
        name: "BXL — base ancien régime",
        value: "177,55 € (0-11) · 190,23 € (12-17) · 202,91 € (18-24)",
      },
      {
        name: "BXL — seuils revenu",
        value: "≤ 40 586,52 € (bas) · ≤ 58 915,92 € (intermédiaire)",
      },
      {
        name: "BXL — supplément social bas revenu (≤ 40 586,52 €/an), par enfant",
        value:
          "1 enfant : 50,73 € (0-11) / 63,41 € (12-24) — identique mono/cohabitant. " +
          "2 enfants mono : 101,46 / 114,14 € · cohabitants : 88,77 / 101,46 €. " +
          "3+ enfants mono : 164,87 / 177,55 € · cohabitants : 139,50 / 152,18 €.",
        note: "Barème officiel article 9 §3.2 (PDF FAMIRIS 01/03/2026).",
      },
      {
        name: "BXL — supplément social intermédiaire (40 586,52-58 915,92 €/an), par enfant",
        value: "1 enfant : 0 € · 2 enfants : 31,71 € · 3+ enfants : 91,31 €",
        note: "Barème officiel article 9 §3.3, sans différenciation âge/mono.",
      },
      {
        name: "BXL — orphelin",
        value: "+50 % base (1 parent) · +100 % base (2 parents)",
      },
      {
        name: "BXL — prime de naissance",
        value: "1 395,02 € (rang 1) · 634,10 € (suivants)",
      },
      {
        name: "FLA — basisbedrag",
        value: "184,62 €",
        note: "Source Groeipakket sept 2025 / 2026.",
      },
      {
        name: "FLA — seuils revenu",
        value: "≤ 40 701,59 € · ≤ 47 485,19 € (1-2 enf) · ≤ 76 560,64 € (3+ enf)",
      },
      {
        name: "FLA — supplément social",
        value: "1-2 enf : 73,68 / 37,31 € · 3+ enf : 108,29 / 85,22 €",
      },
      {
        name: "FLA — zorgtoeslag (handicap, médian)",
        value: "124,09 € (6-8 pts, pilier 1 < 4) · 478,02 € (6-8 pts, pilier 1 ≥ 4)",
        note: "Source officielle groeipakket.be/amounts. On retient la valeur basse (médiane modérée).",
      },
      {
        name: "FLA — wezentoeslag (orphelin)",
        value: "147,71 € (semi-orphelin) · 184,61 € (orphelin total)",
        note: "Montants officiels sept 2025 / 2026 — corrigés vs ancienne estimation (199,60 / 399,21 €).",
      },
      {
        name: "FLA — startbedrag (naissance)",
        value: "1 269,25 €",
      },
      {
        name: "FLA — Schoolbonus (annuel)",
        value: "23,07 € (0-4) · 40,38 € (5-11) · 57,68 € (12-17) · 69,22 € (18-25)",
      },
      {
        name: "DG — Basiskindergeld",
        value: "188,89 €",
        note: "Source Ostbelgien Familie. Indexation suspendue en 2025 et 2026 par programme-décret.",
      },
      {
        name: "DG — Sozialzuschlag",
        value: "+93,23 € si bas revenu (≤ 34 000 €/an)",
        note: "Hausse d'environ +3 €/enfant en janvier 2025 pour compenser la suppression du Schulbonus.",
      },
      {
        name: "DG — Familienzuschlag (3e+)",
        value: "+165,40 € dès le 3e enfant",
      },
      {
        name: "DG — Geburtsprämie",
        value: "1 376,16 € forfait",
        note: "Source ostbelgienfamilie.be — page Starthilfe Geburtsprämie (mai 2026).",
      },
      {
        name: "DG — Schulbonus",
        value: "Supprimé depuis 2025",
        note: "Mesure budgétaire DG (programme-décret 2024). Ancien Jahreszuschlag ~62,55 €/an. Compensations : laptops gratuits dans les écoles, repas réduits, baisse frais d'accueil extrascolaire.",
      },
      {
        name: "Supplément handicap (par région — catégorie médiane modérée)",
        value:
          "WAL/DG 141,90 € · FLA 124,09 € (6-8 pts pilier 1 <4) · BXL 546,58 €",
        note: "Le réel va de 93 € (modéré) à 621 € (sévère) selon les points AVIQ / Iriscare / Opgroeien. Catégorie Groeipakket haute (≥4 pts pilier 1) = 478,02 €.",
      },
    ],
    sources: [
      { name: "FAMIWAL — Allocations familiales en Wallonie", url: "https://www.famiwal.be" },
      { name: "FAMIWAL — Résumé des montants 2026", url: "https://www.famiwal.be/montants/resume-des-montants" },
      { name: "FAMIWAL — Le supplément social", url: "https://www.famiwal.be/vos-supplements/le-supplement-social" },
      { name: "AVIQ — Agence pour une Vie de Qualité (tutelle Wallonie)", url: "https://www.aviq.be" },
      { name: "FAMIRIS — Allocations familiales à Bruxelles", url: "https://famiris.brussels" },
      { name: "Iriscare — Tutelle Bruxelles", url: "https://www.iriscare.brussels" },
      { name: "Groeipakket — Bedragen / Amounts 2025-2026", url: "https://www.groeipakket.be/en/amounts" },
      { name: "Groeipakket — Sociale toeslag", url: "https://www.groeipakket.be/en/benefits-Groeipakket/social-allowance" },
      { name: "Ministerium der Deutschsprachigen Gemeinschaft — Ostbelgien Familie", url: "https://ostbelgienfamilie.be" },
      { name: "Ostbelgien Familie — Starthilfe Geburtsprämie", url: "https://ostbelgienfamilie.be/desktopdefault.aspx/tabid-5913/" },
    ],
    limitations: [
      "Supplément handicap : valeur centrale (catégorie médiane modérée) — le montant réel dépend du nombre de points AVIQ / Iriscare / Opgroeien (93 à 621 €).",
      "Pas de prise en compte du revenu cadastral plafond (FAMIRIS exige cadastre ≤ 2 000 € pour le supplément social).",
      "Pas de gestion des familles recomposées (mi-temps de garde, coparentalité).",
      "Bonus rentrée scolaire = montant annuel, pas réparti mensuellement.",
      "Pas de prise en compte des aides annexes (étudiant supérieur, jeune en alternance, etc.).",
    ],
  },

  /* 7. IPP --------------------------------------------------------- */
  {
    slug: "ipp-simulateur",
    title: "Impôt des Personnes Physiques (IPP)",
    pitch:
      "Simulateur IPP fédéral pédagogique — exercice d'imposition 2026 (revenus 2025), barème SPF Finances.",
    sourceFile: "lib/calculators/ipp.ts",
    reliability: "high",
    reliabilityNote:
      "Barème fédéral 4 tranches officiel SPF Finances (25/40/45/50 %), quotité exemptée 10 910 € (art. 131 CIR 92) avec suppléments enfants à jour EI 2026 (1 980 / 5 110 / 11 440 / 18 510 / +7 070 €, art. 132), quotient conjugal plafonné à 13 460 € (art. 134), 5 réductions d'impôt principales (épargne pension 30 % @ 1 050 €, titres-services ≈ 15 %, dons 45 %, prêt hypo ≈ 30 %, garde 45 %) et cotisation spéciale sécurité sociale dégressive (loi 30/03/1994, plafond 731 €/an). Pour le calcul officiel et personnalisé : Tax-on-web.",
    year: 2026,
    lastUpdatedAt: "2026-05-25",
    badges: ["Belgique", "Exercice 2026", "Revenus 2025"],
    category: "Fiscalité",
    tags: ["IPP", "impôt", "tax-on-web", "additionnels", "quotité exemptée"],
    author: "Équipe Docbel",
    pedagogyIntro:
      "L'**impôt des personnes physiques** belge se calcule en appliquant le **barème fédéral progressif** (4 tranches : 25 %, 40 %, 45 %, 50 %) au revenu annuel imposable, puis en retirant la **réduction liée à la quotité exemptée** (10 910 € de base + suppléments par personne à charge, art. 131-132 CIR 92), et enfin en ajoutant l'**additionnel communal** (en moyenne 7,5 % en Belgique, variable selon la commune) et la **cotisation spéciale sécurité sociale** (loi 30/03/1994). Ce simulateur est **indicatif** : pour le calcul officiel et personnalisé (revenus mobiliers, immobiliers, pensions alimentaires, bonus à l'emploi, particularismes régionaux), rendez-vous sur **Tax-on-web** (SPF Finances) — l'outil officiel reste la référence.",
    differentiators: [
      {
        label: "Barème par tranches transparent",
        description:
          "Chaque euro est imposé tranche par tranche selon le barème officiel SPF Finances 2026 (25 % jusqu'à 16 320 €, 40 % jusqu'à 28 800 €, 45 % jusqu'à 49 840 €, 50 % au-delà), avec affichage du détail par tranche dans le résultat.",
      },
      {
        label: "Quotient conjugal approximé (art. 134 CIR 92)",
        description:
          "Pour les couples mariés à un seul revenu, l'allègement du quotient conjugal est estimé sur la base du transfert virtuel jusqu'à 13 460 € (montant indexé EI 2026), reproduisant l'effet d'écrasement progressif des tranches sans entrer dans la complexité du recalcul double-tranches.",
      },
      {
        label: "5 réductions d'impôt principales intégrées",
        description:
          "Épargne pension (30 % sur 1 050 €), titres-services (≈ 15 % sur 1 500 €), dons (45 % au-delà de 40 €), prêt hypothécaire (chèque habitation régional ≈ 30 %), garde d'enfants (45 %) — les 5 réductions les plus consultées par les contribuables salariés.",
      },
      {
        label: "Cotisation spéciale sécu (loi 30/03/1994)",
        description:
          "Souvent oubliée dans les simulateurs grand public, la CSS est intégrée avec ses seuils dégressifs et son plafond annuel de 731 €. Elle est visible dans la décomposition du résultat.",
      },
      {
        label: "Additionnels communaux variables",
        description:
          "L'additionnel communal (0 à 9 %) est paramétrable précisément : pas de moyenne nationale forcée. Note pédagogique sur les communes principales (Bruxelles 7 %, Anvers 7 %, Liège 8 %, Charleroi 8,5 %).",
      },
    ],
    maintenanceGuide: [
      {
        trigger: "Barème fédéral indexé (tranches 25/40/45/50 %)",
        source: "SPF Finances — Taux d'imposition",
        sourceUrl:
          "https://fin.belgium.be/fr/particuliers/declaration_impot/taux-imposition-revenus/taux-imposition",
        frequency: "1 fois/an (indexation, en général en janvier ou février)",
        codeLocation: "lib/calculators/ipp.ts → TRANCHES_IPP_2026",
      },
      {
        trigger: "Quotité exemptée de base (art. 131 CIR 92)",
        source: "SPF Finances — page taux d'imposition (mention quotité)",
        sourceUrl:
          "https://fin.belgium.be/en/private-individuals/tax-return/income/tax-rates",
        frequency: "1 fois/an (montant indexé)",
        codeLocation: "lib/calculators/ipp.ts → QUOTITE_BASE_2026",
      },
      {
        trigger: "Suppléments enfants à charge (art. 132 CIR 92)",
        source: "SPF Finances — Enfants à charge",
        sourceUrl:
          "https://fin.belgium.be/fr/particuliers/declaration-impot/situation-personnelle/personnes-a-charge/enfants",
        frequency: "1 fois/an (peut être gelé certaines années)",
        codeLocation:
          "lib/calculators/ipp.ts → SUPPLEMENT_ENFANTS / SUPPLEMENT_ENFANT_AU_DELA_5",
      },
      {
        trigger: "Cotisation spéciale sécu (loi 30/03/1994)",
        source: "ONSS — Instructions DmfA, cotisation spéciale (code 856)",
        sourceUrl:
          "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_contributions/other_specialcontributions/specialsocialsecuritycontribution.html",
        frequency: "Rare (modification = nouvelle loi)",
        codeLocation: "lib/calculators/ipp.ts → CSS_PLAFOND_ANNUEL + seuils",
      },
      {
        trigger: "Plafonds des réductions d'impôt (art. 145 et suiv. CIR 92)",
        source: "SPF Finances — Épargne pension (plafonds annuels)",
        sourceUrl:
          "https://fin.belgium.be/fr/particuliers/avantages-fiscaux/epargne-pension",
        frequency: "1 fois/an (plafonds épargne pension indexés)",
        codeLocation:
          "lib/calculators/ipp.ts → EPARGNE_PENSION_PLAFOND / TITRES_SERVICES_PLAFOND",
      },
    ],
    briefMeta: [
      {
        label: "Méthode",
        value: "Barème fédéral 4 tranches (SPF Finances)",
        icon: "FileCode2",
      },
      {
        label: "Indexation",
        value: "Annuelle (quotité, suppléments, plafonds réductions)",
        icon: "Calendar",
      },
      {
        label: "Unités",
        value: "€/an (annuel) + taux moyen + taux marginal",
        icon: "Calculator",
      },
      { label: "Dernière MAJ", value: "25 mai 2026", icon: "Clock" },
      { label: "Auteur", value: "Équipe Docbel", icon: "Users" },
    ],
    inputsDetailed: [
      {
        label: "Revenu annuel imposable net",
        description:
          "Revenu après ONSS et frais pro forfaitaires (≈ salaire brut annuel × 0,73 pour un salarié type).",
        icon: "Euro",
      },
      {
        label: "Statut familial",
        description:
          "Isolé(e) / Marié — 1 revenu (quotient conjugal appliqué) / Marié — 2 revenus.",
        icon: "Users",
      },
      {
        label: "Enfants à charge (0–10)",
        description:
          "Suppléments cumulatifs à la quotité : 1 980 € (1), 5 110 € (2), 11 440 € (3), 18 510 € (4), +7 070 €/enfant au-delà.",
        icon: "Baby",
      },
      {
        label: "Autres personnes à charge (0–5)",
        description:
          "Parents, grands-parents, frère/sœur 66+ en dépendance — 1 980 € par personne dans le cas générique.",
        icon: "Users",
      },
      {
        label: "Additionnel communal (%)",
        description:
          "Pourcentage communal appliqué à l'impôt fédéral après crédits. Moyenne belge ≈ 7,5 % (Bruxelles 7 %, Anvers 7 %, Liège 8 %, Charleroi 8,5 %).",
        icon: "Building2",
      },
      {
        label: "Réductions d'impôt (optionnel)",
        description:
          "Épargne pension (≤ 1 050 €), titres-services (≤ 1 500 €), dons (≥ 40 €/an), prêt hypothécaire, garde enfants — chaque réduction est appliquée à son taux standard.",
        icon: "Percent",
      },
    ],
    outputs: [
      "Impôt total annuel estimé (€)",
      "Taux moyen d'imposition (%)",
      "Taux marginal (tranche du dernier euro gagné)",
      "Revenu net après impôt (€/an + ≈ €/mois)",
      "Décomposition : impôt brut, quotité, quotient conjugal, réductions, additionnel, CSS",
      "Détail par tranche (transparence pédagogique)",
      "PDF exportable récapitulatif",
    ],
    inputs: [
      "Revenu annuel imposable (après ONSS + frais pro forfaitaires)",
      "Statut : isolé / marié 1 revenu / marié 2 revenus",
      "Enfants à charge (0–10)",
      "Autres personnes à charge (0–5)",
      "Parent isolé (allocataire seul) — supplément 1 980 € si applicable",
      "Additionnel communal (%, variable par commune)",
      "Versement épargne pension (€/an, plafond 1 050 € à 30 %)",
      "Achats titres-services (€/an, plafond 1 500 €)",
      "Dons à associations agréées (€/an, min 40 €)",
      "Prêt hypothécaire (€/an)",
      "Frais de garde d'enfants < 14 ans (€/an)",
    ],
    formulas: [
      { label: "Impôt avant quotité", expression: "barème fédéral progressif appliqué au revenu" },
      {
        label: "Réduction quotité",
        expression:
          "barème fédéral appliqué à la quotité exemptée totale (en partant du bas, plafonné au revenu)",
      },
      {
        label: "Impôt fédéral brut",
        expression: "impot_brut = max(0, impot_avant_quotite − réduction_quotite)",
      },
      {
        label: "Quotient conjugal (marié 1 revenu)",
        expression:
          "allègement = min(max(0, revenu − 16 320), 13 460) × 25 % (approximation art. 134 CIR 92)",
      },
      {
        label: "Réductions d'impôt",
        expression:
          "épargne_pension × 30 % + titres_services × 15 % + dons × 45 % + prêt_hypo × 30 % + garde × 45 %",
      },
      {
        label: "Cotisation spéciale sécurité sociale",
        expression:
          "0 si ≤ 18 592 € · 9 % sur 18 592 → 21 070 · 1,3 % sur 21 070 → 60 161 (plafond 731 €/an)",
      },
      {
        label: "Impôt total",
        expression:
          "impot_total = (impot_brut − allègement − réductions) × (1 + additionnel_communal/100) + cotisation_spéciale",
      },
    ],
    constants: [
      ...TRANCHES_IPP_2026.map((t, i) => ({
        name: `Tranche IPP #${i + 1}`,
        value: `${t.min.toLocaleString("fr-BE")} → ${
          t.max === Infinity ? "∞" : t.max.toLocaleString("fr-BE")
        } €`,
        note: `Taux : ${fmtPct(t.taux)}`,
      })),
      {
        name: "Quotité exemptée de base",
        value: fmtEUR(10910) + "/an",
        note: "Art. 131 CIR 92 — indexé EI 2026 (revenus 2025).",
      },
      { name: "Supplément 1er enfant", value: fmtEUR(1980), note: "EI 2026 (art. 132 CIR 92)." },
      { name: "Supplément 2 enfants (cumulé)", value: fmtEUR(5110) },
      { name: "Supplément 3 enfants (cumulé)", value: fmtEUR(11440) },
      { name: "Supplément 4 enfants (cumulé)", value: fmtEUR(18510) },
      { name: "Au-delà du 5e enfant", value: "+" + fmtEUR(7070) + " par enfant" },
      { name: "Autre personne à charge", value: fmtEUR(1980), note: "Cas générique. 5 950 € si ≥ 66 ans en dépendance." },
      { name: "Supplément parent isolé (allocataire seul)", value: fmtEUR(1980), note: "Conditionné à ≥ 1 enfant à charge." },
      { name: "Additionnel communal moyen Belgique", value: "≈ 7,5 %", note: "Variable 0 à 9 % selon la commune." },
      {
        name: "Épargne pension (panier de base)",
        value: "30 % × min(versement, 1 050 €)",
        note: "Palier de base (réduction max 315 €). Art. 145 CIR 92.",
      },
      {
        name: "Titres-services",
        value: "≈ 15 % × min(achats, 1 500 €)",
        note: "Moyenne 3 régions (Wallonie 10 %, Bruxelles 15 %, Flandre 20 %).",
      },
      {
        name: "Dons à associations agréées",
        value: "45 % du montant (≥ 40 €/bénéficiaire)",
        note: "Art. 145³³ CIR 92.",
      },
      {
        name: "Prêt hypothécaire",
        value: "≈ 30 % du capital + intérêts annuels",
        note: "Chèque habitation régional moyen.",
      },
      {
        name: "Garde d'enfants < 14 ans",
        value: "45 % du montant éligible",
        note: "Plafond 16,40 €/jour/enfant (non vérifié par le calcul, input présumé éligible).",
      },
      {
        name: "Quotient conjugal — plafond transfert",
        value: fmtEUR(13460) + "/an",
        note: "Art. 134 CIR 92, indexé EI 2026 (transfert virtuel vers conjoint sans revenu).",
      },
      {
        name: "Cotisation spéciale sécu — seuils",
        value: "18 592 → 21 070 (9 %) puis → 60 161 € (1,3 %)",
        note: "Plafond annuel 731 € (loi 30/03/1994).",
      },
    ],
    sources: [
      {
        name: "SPF Finances — Taux d'imposition (barème IPP)",
        url: "https://fin.belgium.be/fr/particuliers/declaration_impot/taux-imposition-revenus/taux-imposition",
      },
      {
        name: "SPF Finances — Tax-on-web (déclaration en ligne)",
        url: "https://finances.belgium.be/fr/E-services/tax-on-web",
      },
      {
        name: "Moniteur belge — CIR 92 (Code des impôts sur les revenus)",
        url: "https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=1992041252&table_name=loi",
      },
      {
        name: "Moniteur belge — Loi du 30 mars 1994 (cotisation spéciale sécu)",
        url: "https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=1994033052&table_name=loi",
      },
    ],
    limitations: [
      "Barème fédéral uniquement — pas d'impôt régional (additionnel régional ≈ 0 dans la pratique).",
      "Quotient conjugal : approximation 25 % du transfert (vraie formule = écrasement progressif des tranches double-déclaration).",
      "Réductions au taux moyen national : le taux exact titres-services et chèque habitation varie par Région.",
      "Pas de prise en compte des revenus mobiliers (précompte 30 %), immobiliers (revenu cadastral), pensions alimentaires versées, ni du bonus à l'emploi.",
      "Pas de calcul du régime indépendant (frais professionnels réels, cotisations sociales INASTI).",
    ],
  },

  /* 8. TARIF SOCIAL ÉNERGIE ---------------------------------------- */
  {
    slug: "tarif-social-energie",
    title: "Tarif social énergie",
    pitch:
      "Vérification d'éligibilité au tarif social fédéral (élec + gaz) + estimation du gain annuel selon les tarifs CREG trimestriels.",
    sourceFile: "lib/calculators/tarif-social.ts",
    reliability: "high",
    reliabilityNote:
      "Conforme aux barèmes CREG " +
      Q_REFERENCE +
      " et à la liste des bénéficiaires SPF Économie 2026. Élec sociale " +
      (TARIFS_2026.ELEC_SOCIAL * 100).toFixed(3) +
      " c€/kWh TVAC, gaz social " +
      (TARIFS_2026.GAZ_SOCIAL * 100).toFixed(3) +
      " c€/kWh TVAC, recalculés par la CREG chaque trimestre. Statut BIM exclu de l'éligibilité automatique depuis le 1ᵉʳ juillet 2023 (fin de l'extension crise énergétique). Plafonds techniques modulés par la taille du ménage (+200 kWh/personne pour l'élec) et le type de chauffage (helpers `plafondElecKwh` et `plafondGazKwh` exportés). À ré-actualiser à chaque nouvelle note CREG trimestrielle.",
    year: 2026,
    lastUpdatedAt: "2026-05-25",
    badges: ["Belgique", Q_REFERENCE, "Données 2026"],
    category: "Énergie & Aides sociales",
    tags: ["tarif social", "énergie", "CREG", "RIS", "GRAPA"],
    author: "Équipe Docbel",
    pedagogyIntro:
      "Le **tarif social fédéral** est le tarif commercial le plus bas du marché belge pour l'électricité et le gaz naturel. Il est uniforme partout en Belgique et **recalculé chaque trimestre par la CREG**. L'application est **entièrement automatique** : le SPF Économie vérifie 4× par an votre éligibilité par croisement de bases de données et notifie votre fournisseur — aucune démarche à effectuer. Pour la **majorité des ménages éligibles**, le tarif social s'applique à toute la consommation. Au-delà de plafonds techniques indicatifs (~4 600 kWh élec si chauffage élec, ~23 260 kWh gaz si chauffage gaz), le tarif standard du fournisseur peut s'appliquer sur l'excédent.",
    inputs: [
      "5 statuts officiels (cases à cocher) : RIS / GRAPA / handicap (DG HAN) / aide sociale équivalente CPAS / logement social agréé",
      "BIM (à titre indicatif — n'ouvre plus le droit seul depuis le 01.07.2023)",
      "Consommation annuelle électricité (kWh)",
      "Consommation annuelle gaz naturel (kWh, 0 si pas de gaz)",
      "Chauffage électrique (oui/non) — module le plafond élec",
      "Chauffage au gaz (oui/non, défaut oui) — module le plafond gaz",
      "Taille du ménage (1–15, défaut 2) — +200 kWh/pers. au plafond élec",
    ],
    inputsDetailed: [
      {
        label: "Statuts d'éligibilité",
        description:
          "5 cases à cocher : RIS, GRAPA, handicap DG HAN, aide CPAS équivalente, logement social. Un seul suffit.",
        icon: "CheckCircle2",
      },
      {
        label: "Taille du ménage",
        description:
          "1 à 15 personnes. Ajoute 200 kWh/personne au plafond électricité de base.",
        icon: "Users",
      },
      {
        label: "Consommation électricité",
        description:
          "Conso annuelle en kWh (voir facture). Moyenne BE ≈ 3 500 kWh.",
        icon: "Zap",
      },
      {
        label: "Consommation gaz naturel",
        description:
          "Conso annuelle en kWh (0 si pas raccordé au gaz). Moyenne BE ≈ 17 000 kWh.",
        icon: "Flame",
      },
      {
        label: "Type de chauffage",
        description:
          "Élec ou gaz — détermine le plafond applicable (4 600 vs 1 800 kWh élec ; 23 260 vs 12 000 kWh gaz).",
        icon: "Thermometer",
      },
    ],
    outputs: [
      "Éligibilité automatique (oui/non)",
      "Liste des motifs d'éligibilité (statuts qui ouvrent le droit)",
      "Économie annuelle estimée (élec + gaz)",
      "Économie mensuelle moyenne",
      "Détail par énergie (gain élec, gain gaz)",
      "Plafonds appliqués (élec + gaz) et excédents éventuels",
      "Comparaison coût tarif standard vs tarif social",
      "Notes pédagogiques (ex: BIM suspendu)",
    ],
    briefMeta: [
      {
        label: "Méthode",
        value: "Barèmes CREG + liste SPF Économie",
        icon: "FileCode2",
      },
      {
        label: "Indexation",
        value: "Trimestrielle (CREG)",
        icon: "Calendar",
      },
      {
        label: "Unités",
        value: "€/kWh TVAC · kWh/an",
        icon: "Calculator",
      },
      {
        label: "Dernière MAJ",
        value: "25 mai 2026",
        icon: "Clock",
      },
      {
        label: "Auteur",
        value: "Équipe Docbel",
        icon: "Users",
      },
    ],
    differentiators: [
      {
        label: "Application automatique modélisée fidèlement",
        description:
          "Le SPF Économie vérifie 4× par an l'éligibilité et notifie le fournisseur — l'outil l'explique clairement (aucune démarche à entamer pour l'utilisateur éligible).",
      },
      {
        label: "Plafonds techniques appliqués au lieu d'être ignorés",
        description:
          "Beaucoup d'outils calculent un gain sur 100 % de la conso, ignorant qu'au-delà du plafond (~4 600 kWh élec si chauffage élec, ~23 260 kWh gaz) le tarif standard peut s'appliquer. Nous modélisons un split sous-plafond/excédent.",
      },
      {
        label: "5 catégories d'éligibilité officielles 2026 documentées",
        description:
          "RIS, GRAPA, allocation handicap DG HAN, aide sociale équivalente CPAS, logement social agréé — chaque catégorie est décrite avec son organisme de tutelle.",
      },
      {
        label: "Statut BIM correctement traité (suspendu depuis 01.07.2023)",
        description:
          "Le BIM reste affiché à titre indicatif (un utilisateur peut le cocher), mais une note pédagogique explique qu'il n'ouvre plus le droit seul depuis fin juin 2023 (fin de l'extension crise énergétique).",
      },
      {
        label: "Comparaison gain net annuel + lien vers aides régionales",
        description:
          "Si pas éligible au tarif social fédéral, l'outil oriente vers les autres aides (prime énergie régionale, fonds gaz/électricité du CPAS, chèque mazout).",
      },
    ],
    maintenanceGuide: [
      {
        trigger: "Tarif social électricité (trimestriel)",
        source: "CREG — Tarif social pour l'énergie",
        sourceUrl:
          "https://www.creg.be/fr/consommateurs/prix-et-tarifs/tarif-social/tarif-social-pour-lenergie",
        frequency: "4 fois/an (note CREG trimestrielle)",
        codeLocation: "lib/calculators/tarif-social.ts → TARIFS_2026.ELEC_SOCIAL",
      },
      {
        trigger: "Tarif social gaz naturel (trimestriel)",
        source: "CREG — Tarif social pour l'énergie",
        sourceUrl:
          "https://www.creg.be/fr/consommateurs/prix-et-tarifs/tarif-social/tarif-social-pour-lenergie",
        frequency: "4 fois/an (note CREG trimestrielle)",
        codeLocation: "lib/calculators/tarif-social.ts → TARIFS_2026.GAZ_SOCIAL",
      },
      {
        trigger: "Plafonds de consommation (AR 29.03.2012)",
        source: "Moniteur belge — AR 29 mars 2012",
        sourceUrl: "https://www.ejustice.just.fgov.be",
        frequency: "Rare (modification = nouvelle loi)",
        codeLocation: "lib/calculators/tarif-social.ts → PLAFONDS_2026",
      },
      {
        trigger: "Liste des bénéficiaires automatiques",
        source: "SPF Économie — Tarif social pour l'énergie",
        sourceUrl:
          "https://economie.fgov.be/fr/themes/energie/energie-sociale/tarif-social-pour-lenergie",
        frequency: "1-2 fois/an (modifications réglementaires)",
        codeLocation: "lib/calculators/tarif-social.ts → MOTIFS_LABELS",
      },
      {
        trigger: "Validation périodique (régression test)",
        source: "CREG — Note trimestrielle (Z3153 + suivantes)",
        sourceUrl: "https://www.creg.be/fr/publications/note-z3153",
        frequency: "Chaque trimestre (validation manuelle vs CREG)",
        codeLocation: "scripts/debug-tarif-social.ts → re-tester 6 cas",
      },
    ],
    formulas: [
      {
        label: "Éligibilité",
        expression:
          "éligible = (RIS ∨ GRAPA ∨ handicap ∨ aide_équivalente ∨ logement_social). BIM seul exclu depuis 01.07.2023.",
      },
      {
        label: "Plafond élec",
        expression:
          "plafond = (chauffage_élec ? 4 600 : 1 800) + 200 × (taille_ménage − 1)",
      },
      {
        label: "Plafond gaz",
        expression: "plafond = chauffage_gaz ? 23 260 : 12 000 kWh",
      },
      {
        label: "Split conso (sous plafond / excédent)",
        expression:
          "sous_plafond = min(conso, plafond) ; excédent = max(0, conso − plafond)",
      },
      {
        label: "Coût tarif social effectif",
        expression:
          "coût = sous_plafond × tarif_social + excédent × tarif_standard",
      },
      {
        label: "Gain annuel",
        expression:
          "gain = sous_plafond_élec × (std_élec − soc_élec) + sous_plafond_gaz × (std_gaz − soc_gaz)",
      },
    ],
    constants: [
      {
        name: "Trimestre de référence",
        value: Q_REFERENCE,
        note: "Tarifs CREG recalculés chaque trimestre (note Z3153 pour Q1 2026).",
      },
      {
        name: "Tarif social élec (monohoraire)",
        value: (TARIFS_2026.ELEC_SOCIAL * 100).toFixed(3) + " c€/kWh",
        note: "TVA 6 % incluse. Tout compris (énergie + transport + distribution). Source CREG.",
      },
      {
        name: "Tarif standard moyen élec",
        value: fmtEUR(TARIFS_2026.ELEC_STANDARD) + "/kWh",
        note: "Moyenne nationale résidentielle 2026, observatoire CREG.",
      },
      {
        name: "Tarif social gaz",
        value: (TARIFS_2026.GAZ_SOCIAL * 100).toFixed(3) + " c€/kWh",
        note: "TVA 6 % incluse. Tout compris. Source CREG (Q2 2026 : +5,14 % vs Q1).",
      },
      {
        name: "Tarif standard moyen gaz",
        value: fmtEUR(TARIFS_2026.GAZ_STANDARD) + "/kWh",
        note: "Moyenne nationale résidentielle 2026, observatoire CREG.",
      },
      {
        name: "Plafond élec base",
        value: `${PLAFONDS_2026.ELEC_BASE} kWh + ${PLAFONDS_2026.ELEC_PAR_PERSONNE}/personne supplémentaire`,
        note: "Sans chauffage électrique. AR 29/03/2012.",
      },
      {
        name: "Plafond élec chauffage",
        value: `${PLAFONDS_2026.ELEC_CHAUFFAGE} kWh + ${PLAFONDS_2026.ELEC_PAR_PERSONNE}/personne`,
        note: "Avec chauffage électrique. AR 29/03/2012.",
      },
      {
        name: "Plafond gaz cuisine/ECS",
        value: `${PLAFONDS_2026.GAZ_NON_CHAUFFAGE} kWh`,
        note: "Sans chauffage au gaz (cuisine + eau chaude uniquement).",
      },
      {
        name: "Plafond gaz chauffage",
        value: `${PLAFONDS_2026.GAZ_CHAUFFAGE} kWh`,
        note: "Avec chauffage au gaz (cas le plus courant).",
      },
    ],
    sources: [
      {
        name: "CREG — Tarif social pour l'énergie",
        url: "https://www.creg.be/fr/consommateurs/prix-et-tarifs/tarif-social/tarif-social-pour-lenergie",
      },
      {
        name: "CREG — Note Z3153 (prix maximaux sociaux Q1 2026)",
        url: "https://www.creg.be/fr/publications/note-z3153",
      },
      {
        name: "SPF Économie — Tarif social pour l'énergie",
        url: "https://economie.fgov.be/fr/themes/energie/energie-sociale/tarif-social-pour-lenergie",
      },
      {
        name: "Moniteur belge — AR du 29 mars 2012 (catégories bénéficiaires)",
        url: "https://www.ejustice.just.fgov.be",
      },
    ],
    limitations: [
      "Tarif standard = moyenne nationale, varie ±20 % selon le fournisseur, le contrat (fixe/variable) et la région.",
      "Pas de gestion des compteurs bihoraires (jour/nuit) ni exclusif nuit — utilise le tarif monohoraire.",
      "Plafonds appliqués selon un modèle technique « habitation résidentielle normale » ; en pratique, 95 % des bénéficiaires reçoivent le tarif social sur toute leur conso.",
      "Pas de prise en compte des frais fixes / coûts d'abonnement (que les fournisseurs facturent séparément).",
    ],
  },

  /* 9. FRAIS KILOMÉTRIQUES ----------------------------------------- */
  {
    slug: "frais-kilometriques",
    title: "Frais kilométriques domicile-travail",
    pitch:
      "Déduction fiscale des frais professionnels domicile-travail selon le mode de transport — option frais réels vs forfait légal.",
    sourceFile: "lib/calculators/frais-km.ts",
    reliability: "high",
    reliabilityNote:
      "Barème revenus 2026 / EI 2027 conforme aux sources de l'État belge : tarif voiture 0,4327 €/km Q2 2026 (circulaire BOSA n° 764, applicable 01/04/2026 – 30/06/2026, révisée trimestriellement au Moniteur belge), forfait CIR 92 art. 66 = 0,15 €/km (bascule automatique si l'employeur verse une indemnité km, cumul interdit), plafond 100 km aller simple voiture / covoiturage, vélo 0,37 €/km plafonné à 3 700 €/an (SPF Finances + SPF Mobilité), transports publics 100 % de l'abonnement (SNCB / STIB / TEC / De Lijn). Forfait légal frais pro 6 070 €/an (CIR 92 art. 51) affiché en comparaison instantanée. Télétravail : information pédagogique sur les km évités (n'affecte pas la déduction).",
    year: 2026,
    lastUpdatedAt: "2026-05-25",
    badges: ["Belgique", "Revenus 2026", "EI 2027"],
    category: "Fiscalité",
    tags: [
      "frais professionnels",
      "km",
      "vélo",
      "voiture",
      "transport public",
      "télétravail",
    ],
    pedagogyIntro:
      "Chaque salarié belge a le choix entre **deux régimes** pour ses frais professionnels : le **forfait légal** (CIR 92 art. 51, plafonné à 6 070 €/an en 2026, sans justificatif) ou les **frais réels** (justificatifs obligatoires). L'option frais réels est avantageuse surtout quand les déplacements domicile-travail coûtent cher : long trajet en voiture, abonnement SNCB / STIB / TEC / De Lijn, ou vélo quotidien. La **déduction kilométrique** est la composante la plus visible : pour la voiture, deux taux coexistent — **0,4327 €/km** (tarif indemnité fonctionnaires, circulaire BOSA n° 764 Q2 2026) si l'employeur ne verse pas d'indemnité km, ou **0,15 €/km** (forfait CIR 92 art. 66) en cas d'indemnité employeur — le cumul est explicitement interdit (jurisprudence Cour de cassation et règle de non-double remboursement). Le **vélo** offre 0,37 €/km plafonné à 3 700 €/an. Les **transports publics** sont déductibles à 100 % du coût de l'abonnement. La **règle d'or** : opter pour les frais réels uniquement si la somme totale (km + autres frais) dépasse le forfait légal de 6 070 €.",
    differentiators: [
      {
        label: "Plafond 100 km voiture appliqué automatiquement",
        description:
          "Au-delà de 100 km aller simple, l'excédent passe au forfait 0,15 €/km (et le tarif fonctionnaires reste sur les 100 premiers km dans chaque sens). Beaucoup d'outils oublient cette règle et surestiment la déduction.",
      },
      {
        label: "Indemnité employeur soustraite automatiquement",
        description:
          "Si l'employeur verse une indemnité km, l'outil bascule la voiture sur 0,15 €/km (cumul interdit, CIR 92 art. 66) ET soustrait le montant reçu de la déduction brute pour obtenir la nette — règle de non-cumul intégrée.",
      },
      {
        label: "Comparaison instantanée vs forfait légal 6 070 €",
        description:
          "Le résultat indique en temps réel si vos frais réels sont probablement plus avantageux que le forfait légal automatique de 6 070 €/an — pas besoin de calculer à la main.",
      },
      {
        label: "Plafond vélo 3 700 €/an respecté",
        description:
          "Le vélo (y compris électrique) est capé à 3 700 €/an (revenus 2026 / EI 2027). L'outil affiche un badge « Plafond vélo atteint » dès que la déduction théorique dépasserait ce plafond.",
      },
      {
        label: "Km évités par le télétravail (info pédago)",
        description:
          "Les jours de télétravail ne réduisent pas la déduction (les jours sur place sont déjà comptés) mais l'outil affiche les km annuels économisés à titre informatif — utile pour rappeler l'empreinte carbone et les coûts réels (carburant, usure).",
      },
    ],
    maintenanceGuide: [
      {
        trigger: "Tarif indemnité km fonctionnaires (révision trimestrielle)",
        source: "BOSA — Indemnité pour frais de parcours",
        sourceUrl:
          "https://bosa.belgium.be/fr/themes/travailler-dans-la-fonction-publique/remuneration-et-avantages/allocations-et-indemnites-13",
        frequency:
          "Trimestriel (Q1/Q2/Q3/Q4) — circulaire BOSA publiée au Moniteur belge",
        codeLocation: "lib/calculators/frais-km.ts → TAUX_KM_2026.voiture",
      },
      {
        trigger: "Taux vélo + plafond annuel vélo (indexation annuelle)",
        source: "SPF Finances — Indemnités frais déplacement domicile-travail",
        sourceUrl:
          "https://fin.belgium.be/fr/particuliers/declaration-impot/revenus/indemnites-frais-deplacement-domicile-lieu-travail",
        frequency: "1 fois/an (indexation pour l'exercice d'imposition suivant)",
        codeLocation:
          "lib/calculators/frais-km.ts → TAUX_KM_2026.velo + PLAFOND_ANNUEL_VELO_2026",
      },
      {
        trigger: "Forfait légal frais pro (plafond 6 070 € indexé chaque janvier)",
        source: "SPF Finances — Forfait et frais réels",
        sourceUrl:
          "https://fin.belgium.be/fr/particuliers/transport/deduction_frais_de_transport/trajet_domicile_travail/forfait_et_frais_reels",
        frequency:
          "1 fois/an (indexation des revenus, généralement en janvier)",
        codeLocation:
          "lib/calculators/frais-km.ts → FORFAIT_LEGAL_FRAIS_PRO_2026",
      },
      {
        trigger:
          "Abonnements SNCB / STIB / TEC / De Lijn — règle 100 % déductible",
        source: "SPF Finances + opérateurs publics",
        sourceUrl:
          "https://fin.belgium.be/fr/particuliers/declaration-impot/revenus/indemnites-frais-deplacement-domicile-lieu-travail",
        frequency:
          "Stable (la règle 100 % reste, seul le prix de l'abonnement varie)",
        codeLocation: "lib/calculators/frais-km.ts → cas transports_publics",
      },
      {
        trigger:
          "Cas covoiturage / moto / plafond 100 km — re-tester après modif",
        source: "scripts/debug-frais-km.ts (6 cas de référence)",
        sourceUrl:
          "https://fin.belgium.be/fr/particuliers/declaration-impot/revenus/indemnites-frais-deplacement-domicile-lieu-travail",
        frequency: "Après chaque modification de barème",
        codeLocation: "scripts/debug-frais-km.ts",
      },
    ],
    briefMeta: [
      {
        label: "Méthode",
        value: "CIR 92 art. 51 (forfait) + art. 66 (km) + circulaire BOSA",
        icon: "FileCode2",
      },
      {
        label: "Indexation",
        value:
          "Voiture trimestrielle (BOSA) — vélo et forfait légal annuels (SPF Finances)",
        icon: "Calendar",
      },
      {
        label: "Unités",
        value: "€/km × km annuels — comparaison vs forfait légal",
        icon: "Calculator",
      },
      { label: "Dernière MAJ", value: "25 mai 2026", icon: "Clock" },
      { label: "Auteur", value: "Équipe Docbel", icon: "Users" },
    ],
    inputsDetailed: [
      {
        label: "Distance aller simple",
        description:
          "Distance domicile-travail en kilomètres (1 sens). Multipliée × 2 pour le retour, × jours/semaine, × semaines/an.",
        icon: "MapPin",
      },
      {
        label: "Jours sur place / semaine",
        description:
          "Jours physiquement présents au travail (hors télétravail). Détermine la fréquence des allers-retours.",
        icon: "Calendar",
      },
      {
        label: "Semaines travaillées / an",
        description:
          "52 semaines − vacances − maladie. Défaut 44 (corrélé au congé légal belge).",
        icon: "CalendarDays",
      },
      {
        label: "Mode de transport principal",
        description:
          "Voiture, vélo, transports publics (SNCB/STIB/TEC/De Lijn), moto, covoiturage passager. Chaque mode a son barème.",
        icon: "Car",
      },
      {
        label: "Coût annuel abonnement (transports publics)",
        description:
          "100 % du prix de l'abonnement SNCB / STIB / TEC / De Lijn — déductible intégralement.",
        icon: "Bus",
      },
      {
        label: "Indemnité km employeur (€/an)",
        description:
          "Indemnité de déplacement versée par l'employeur. Si > 0 → bascule voiture vers 0,15 €/km et soustraction du montant reçu.",
        icon: "Euro",
      },
      {
        label: "Jours de télétravail / semaine (avancé)",
        description:
          "Info pédagogique — ne réduit pas la déduction mais affiche les km évités à titre informatif.",
        icon: "Home",
      },
    ],
    outputs: [
      "Déduction kilométrique nette annuelle (€)",
      "Déduction brute (avant compensation indemnité employeur)",
      "Km totaux annuels parcourus (aller-retour)",
      "Taux €/km effectivement appliqué",
      "Recommandation : frais réels vs forfait légal 6 070 €",
      "Indication plafond atteint (100 km voiture ou 3 700 € vélo)",
      "Km évités par télétravail (information)",
    ],
    inputs: [
      "Distance domicile-travail aller simple (km)",
      "Jours travaillés sur place par semaine (1–7)",
      "Semaines travaillées par an (défaut 44)",
      "Mode de transport (5 options)",
      "Coût annuel abonnement (si transports publics)",
      "Jours télétravaillés par semaine (info pédagogique, 0–5)",
      "Indemnité km annuelle versée par l'employeur (€/an)",
    ],
    formulas: [
      {
        label: "Km annuels (déductibles)",
        expression: "km_total = km_AS × 2 × jours_sur_place × sem/an",
      },
      {
        label: "Km évités par télétravail (info)",
        expression: "km_évités = km_AS × 2 × jours_télétravail × sem/an",
      },
      {
        label: "Voiture sans indemnité employeur (≤100 km AS)",
        expression: "déduction = km_total × 0,4327 (Q2 2026, BOSA n° 764)",
      },
      {
        label: "Voiture avec indemnité employeur",
        expression:
          "déduction = km_total × 0,15 (forfait CIR 92 art. 66, cumul exclu)",
      },
      {
        label: "Voiture (>100 km AS)",
        expression:
          "(100 × 2 × jours_sur_place × sem) × taux + (km_AS − 100) × 2 × jours × sem × 0,15",
      },
      {
        label: "Vélo",
        expression:
          "déduction = min(km_total × 0,37 ; 3 700 €/an) [revenus 2026]",
      },
      {
        label: "Compensation indemnité employeur",
        expression:
          "déduction_nette = max(0, déduction_brute − indemnité_employeur)",
      },
      {
        label: "Transports publics",
        expression: "déduction = coût_abonnement_annuel (100 %)",
      },
      {
        label: "Comparaison forfait vs réels",
        expression:
          "frais_réels_avantageux = (déduction_nette + autres_frais_réels) > 6 070 €",
      },
    ],
    constants: [
      {
        name: "Voiture (sans indemnité employeur) — Q2 2026",
        value: fmtEUR(TAUX_KM_2026.voiture) + "/km",
        note: "Tarif fonctionnaires Q2 2026 (circulaire BOSA n° 764, 01/04/2026 – 30/06/2026). Applicable comme frais réels domicile-travail. Plafonné à 100 km aller simple ; au-delà = 0,15 €/km.",
      },
      {
        name: "Voiture (avec indemnité ou >100 km AS)",
        value: fmtEUR(0.15) + "/km",
        note: "Forfait standard CIR 92 art. 66. Le cumul tarif fonctionnaires + indemnité employeur est interdit (règle de non-double remboursement).",
      },
      {
        name: "Vélo (incl. électrique)",
        value: fmtEUR(TAUX_KM_2026.velo) + "/km",
        note: `Plafonné à ${fmtEUR(PLAFOND_ANNUEL_VELO_2026)}/an (revenus 2026 / EI 2027). Exonération uniquement si frais professionnels calculés au forfait.`,
      },
      {
        name: "Plafond annuel vélo",
        value: fmtEUR(PLAFOND_ANNUEL_VELO_2026) + "/an",
        note: "SPF Finances revenus 2026.",
      },
      { name: "Moto", value: fmtEUR(TAUX_KM_2026.moto) + "/km" },
      {
        name: "Covoiturage passager",
        value: fmtEUR(TAUX_KM_2026.covoiturage) + "/km",
        note: "Plafonné à 100 km aller simple.",
      },
      {
        name: "Transports publics",
        value: "100 % de l'abonnement annuel",
        note: "SNCB, STIB, TEC, De Lijn — opérateurs publics.",
      },
      {
        name: "Forfait légal frais pro",
        value: fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026) + "/an",
        note: "CIR 92 art. 51 — ≈ 30 % du brut plafonné à 6 070 € (revenus 2026 / EI 2027). À comparer aux frais réels.",
      },
      {
        name: "Codes Tax-on-web",
        value: "1254/2254 (indemnité reçue) et 1255/2255 (exonération)",
        note: "À utiliser dans la déclaration fiscale annuelle (MyMinfin).",
      },
    ],
    sources: [
      {
        name: "SPF Finances — Indemnités frais déplacement domicile-travail",
        url: "https://fin.belgium.be/fr/particuliers/declaration-impot/revenus/indemnites-frais-deplacement-domicile-lieu-travail",
      },
      {
        name: "SPF Mobilité — Avantages fiscaux et primes vélo",
        url: "https://mobilit.belgium.be/fr/mobilite-durable/velos/avantages-fiscaux-et-primes-velo",
      },
      {
        name: "BOSA — Indemnité kilométrique fonctionnaires (circulaires trimestrielles)",
        url: "https://bosa.belgium.be/fr/themes/travailler-dans-la-fonction-publique/remuneration-et-avantages/allocations-et-indemnites-13",
      },
      {
        name: "Moniteur belge — CIR 92 art. 51 (forfait) et art. 66 (km)",
        url: "https://www.ejustice.just.fgov.be",
      },
    ],
    limitations: [
      "Pas de prise en compte des autres frais réels (repas, vêtements pro, formation, matériel) qui s'ajoutent à la déduction km pour décider du choix forfait/réels.",
      "Pas de gestion mixte (ex: voiture + train sur le même trajet) — choisir le mode majoritaire.",
      "Comparaison forfait/réels simplifiée : la décision réelle dépend aussi du taux marginal d'imposition.",
      "Réforme « verdissement » 2026 : le forfait 0,15 €/km pour les véhicules thermiques fait l'objet d'un régime transitoire dans le cadre des frais professionnels d'indépendants — non modélisé pour le calc domicile-travail standard (où il reste applicable).",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Exports                                                           */
/* ------------------------------------------------------------------ */

export function getMethodologies(): CalcMethodology[] {
  return METHODOLOGIES;
}

export function getMethodologyBySlug(slug: string): CalcMethodology | undefined {
  return METHODOLOGIES.find((m) => m.slug === slug);
}

export const RELIABILITY_LABELS: Record<Reliability, string> = {
  high: "Fiable",
  medium: "Approximatif",
  low: "À vérifier",
};

export const RELIABILITY_COLORS: Record<Reliability, string> = {
  high: "#10b981", // emerald-500
  medium: "#f59e0b", // amber-500
  low: "#ef4444", // red-500
};
