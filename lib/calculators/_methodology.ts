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
      "Formules conformes aux textes officiels avec barème dégressif du précompte spécial sur double pécule employé (17,16 / 30,28 / 53,50 % selon brut annuel) — fin du taux moyen unique. Pécule simple net estimé via le taux moyen privé (~60 %) ; mention `peculeJeunesEligible` exposée pour l'UI (renvoi ONEM avant fin février N+1).",
    year: 2026,
    inputs: [
      "Statut : employé / ouvrier",
      "Brut mensuel (employé) ou moyen N-1 (ouvrier)",
      "Mois prestés l'année précédente (0–12)",
      "Temps partiel + taux d'occupation",
      "Jeune travailleur (< 25 ans, 1re année après études) — info pécule jeunes ONEM",
    ],
    formulas: [
      {
        label: "Employé — pécule simple",
        expression: "simple = brut × (mois_prestés / 12) × taux_occup",
      },
      {
        label: "Employé — pécule simple net estimé",
        expression: "simple_net ≈ simple × 0,60 (imposé comme salaire ordinaire)",
      },
      {
        label: "Employé — double pécule brut",
        expression: "double = brut × 0,92 × (mois_prestés / 12) × taux_occup",
      },
      {
        label: "Employé — précompte spécial dégressif",
        expression:
          "taux = 17,16 % (brut annuel ≤ 17 670) / 30,28 % (≤ 65 200) / 53,50 % (au-delà)",
      },
      {
        label: "Employé — double pécule net",
        expression: "double_net = double × (1 − 13,07 %) × (1 − taux_précompte_spécial)",
      },
      {
        label: "Ouvrier — pécule total ONVA",
        expression:
          "pécule = (brut_mensuel × 13,92 × mois/12) × 1,08 × 15,38 % × taux_occup",
      },
      { label: "Ouvrier — net estimé", expression: "net ≈ brut × 0,7678 (retenue 23,22 %)" },
    ],
    constants: [
      { name: "Taux double pécule (employé)", value: "92 %", note: "% du brut mensuel." },
      {
        name: "ONSS spéciale sur double pécule",
        value: "13,07 %",
        note: "Prélevée avant le précompte spécial.",
      },
      {
        name: "Précompte spécial double pécule — tranche 1",
        value: "17,16 %",
        note: "Brut annuel ≤ 17 670 €.",
      },
      {
        name: "Précompte spécial double pécule — tranche 2",
        value: "30,28 %",
        note: "Brut annuel entre 17 670 € et 65 200 €.",
      },
      {
        name: "Précompte spécial double pécule — tranche 3",
        value: "53,50 %",
        note: "Brut annuel > 65 200 €.",
      },
      {
        name: "Net moyen salaire ordinaire (pécule simple employé)",
        value: "60 %",
        note: "Ratio indicatif privé pour le pécule simple, imposé comme un mois de salaire normal.",
      },
      {
        name: "Coefficient majoration ONVA",
        value: "1,08",
        note: "Majoration légale des salaires déclarés à l'ONVA.",
      },
      {
        name: "Taux global ONVA",
        value: "15,38 %",
        note: "Total pécule simple (8 %) + double (7,38 %) sur brut majoré.",
      },
      {
        name: "Retenue ONVA",
        value: "23,22 %",
        note: "Net ouvrier ≈ 76,78 % du brut ONVA.",
      },
      {
        name: "Annualisation ouvrier",
        value: "× 13,92",
        note: "12 mois + prime fin d'année + bonus moyens.",
      },
      {
        name: "Pécule jeunes ONEM",
        value: "À demander avant fin février N+1",
        note: "Employé < 25 ans, 1re année après études si pécule employeur incomplet.",
      },
    ],
    sources: [
      { name: "ONVA — Office National des Vacances Annuelles", url: "https://www.onva-rjv.fgov.be" },
      { name: "SPF Sécurité Sociale — Pécule de vacances", url: "https://www.socialsecurity.be" },
      { name: "SPF Emploi — Vacances annuelles", url: "https://emploi.belgique.be" },
      { name: "ONEM — Pécule de vacances jeunes", url: "https://www.onem.be" },
    ],
    limitations: [
      "Ne tient pas compte des jours assimilés (maladie, chômage, congé maternité).",
      "Ne tient pas compte des primes et indemnités sectorielles.",
      "Net du pécule simple employé : 60 % moyen — le taux marginal réel peut varier.",
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
      "Formule conforme à la loi du 3 juillet 1978 (art. 39) avec barème précompte spécial par tranches (17,16 → 53,50 %) au lieu d'un taux moyen unique, cotisation spéciale employeur 1 % (seuil 44 509 €/an) signalée, et indemnité de protection cumulable (femme enceinte 6 mois, délégué syndical 36 mois, travailleur protégé 9 mois).",
    year: 2026,
    inputs: [
      "Salaire brut mensuel courant",
      "Durée de préavis non presté (semaines)",
      "Avantages annuels (€/an, optionnel)",
      "Estimer le net après précompte (oui/non)",
      "Statut de protection : aucune / femme enceinte / délégué syndical / travailleur protégé",
    ],
    formulas: [
      {
        label: "Rémunération mensuelle de base",
        expression: "mensuelle = brut + (avantages_an / 12)  [si inclus]",
      },
      {
        label: "Rémunération hebdomadaire",
        expression: "hebdo = mensuelle × 3 / 13  (équivalence légale 13 sem = 3 mois)",
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
        expression: "net = (indemnité_brute + protection) × (1 − taux_précompte)",
      },
      {
        label: "Cotisation spéciale employeur",
        expression:
          "si brut_annuel ≥ 44 509 € : cotisation = total_brut × 1 % (côté employeur, n'affecte pas le net)",
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
        name: "Seuil cotisation spéciale employeur",
        value: "44 509 €/an",
        note: "Loi du 26 décembre 2013. Au-delà : 1 % sur l'indemnité brute (côté employeur).",
      },
      {
        name: "Indemnité protection — femme enceinte",
        value: "6 mois de rémunération",
        note: "Loi du 16 mars 1971, art. 40.",
      },
      {
        name: "Indemnité protection — délégué syndical",
        value: "36 mois (3 ans)",
        note: "CCT n° 5, art. 20 (2 à 4 ans selon ancienneté, valeur centrale retenue).",
      },
      {
        name: "Indemnité protection — travailleur protégé",
        value: "9 mois",
        note: "CPPT, conseillers en prévention, etc. (6 à 12 mois selon cas).",
      },
      {
        name: "Garde-fou préavis max",
        value: "200 semaines (~4 ans)",
        note: "Limite de l'input pour éviter les saisies aberrantes.",
      },
      {
        name: "Équivalence légale",
        value: "13 semaines = 3 mois",
        note: "Conversion mensuelle → hebdomadaire (loi du 3 juillet 1978).",
      },
    ],
    sources: [
      { name: "Loi du 3 juillet 1978 sur les contrats de travail", url: "https://www.ejustice.just.fgov.be" },
      { name: "Loi du 26 décembre 2013 (cotisation spéciale)", url: "https://www.ejustice.just.fgov.be" },
      { name: "CCT n° 5 (délégué syndical)", url: "https://www.cnt-nar.be" },
      { name: "SPF Emploi — Rupture du contrat", url: "https://emploi.belgique.be" },
      { name: "SPF Finances — Précompte sur indemnités", url: "https://finances.belgium.be" },
    ],
    limitations: [
      "Pas d'application du plafond fiscal d'imposition étalée (article 171 CIR 92).",
      "Indemnité de protection : montants centraux — le cas concret peut varier (ancienneté délégué syndical, motif de protection).",
      "Le précompte spécial réel dépend du taux marginal individuel — l'approximation par tranches donne un cadre, pas un chiffre exact.",
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
      "Régime salarié belge modélisé fidèlement : pas de malus linéaire (supprimé) mais vraies conditions d'éligibilité au départ anticipé (`getConditionAnticipation` : 60/44, 61/43, 62-64/42), avec gestion des périodes assimilées (chômage, maladie, crédit-temps reconnu) intégrées dans la carrière totale. Pour le chiffre exact : mypension.be (compte de carrière individuel).",
    year: 2026,
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
        label: "Éligibilité départ anticipé",
        expression:
          "60 ans → ≥ 44 ans / 61 ans → ≥ 43 ans / 62-64 ans → ≥ 42 ans (sinon : âge légal)",
      },
      {
        label: "Salaire pris",
        expression: "salaire_pris = min(salaire_moyen, plafond_salarial)",
      },
      {
        label: "Pension annuelle de base",
        expression:
          "pension = salaire_pris × taux × (min(carrière_totale, 45) / 45)",
      },
      {
        label: "Plancher minimum garanti (si carrière totale ≥ 30 ans)",
        expression: "pension = max(pension, minimum × carrière/45)",
      },
      {
        label: "Plafond légal",
        expression: "pension = min(pension, plafond_pension)",
      },
    ],
    constants: [
      { name: "Plafond salarial annuel", value: "69 521 €/an", note: "Barème SFPD 2026 (corrigé après audit)." },
      { name: "Carrière complète", value: "45 ans" },
      { name: "Taux isolé", value: "60 %" },
      { name: "Taux ménage", value: "75 %" },
      { name: "Minimum garanti isolé", value: "1 700 €/mois", note: "Carrière totale ≥ 30 ans, proratisé sur 45." },
      { name: "Minimum garanti ménage", value: "2 100 €/mois" },
      { name: "Plafond pension isolé", value: "3 500 €/mois", note: "Plafond indicatif." },
      { name: "Plafond pension ménage", value: "4 350 €/mois" },
      {
        name: "Condition anticipation — 60 ans",
        value: `${getConditionAnticipation(60)?.conditionCarriere ?? 44} ans de carrière`,
        note: "Carrière totale = effective + assimilée.",
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
        note: "Loi du 10 août 2015.",
      },
    ],
    sources: [
      { name: "SFP — Service Fédéral des Pensions", url: "https://www.sfpd.fgov.be" },
      { name: "mypension.be — calcul officiel", url: "https://www.mypension.be" },
      { name: "Loi du 10 août 2015 (âge légal + anticipation)", url: "https://www.ejustice.just.fgov.be" },
      { name: "AR 21/12/1967 (régime général salarié)", url: "https://www.ejustice.just.fgov.be" },
    ],
    limitations: [
      "Pas de bonus pour les carrières longues (>45 ans).",
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
      "Quatre régimes régionaux modélisés avec leurs barèmes 2026, suppléments handicap (médian 85/90 €), suppléments orphelin (175 → 450 € selon partiel/complet), supplément 3e enfant Bruxelles (+50 € à partir du rang 3) et allocation de naissance one-shot par région. Pour le montant officiel : caisse d'allocations.",
    year: 2026,
    inputs: [
      "Région : Wallonie / Bruxelles / Flandre / Germanophone",
      "Liste d'enfants (année de naissance, 1–10)",
      "Revenu annuel brut imposable du ménage (€)",
      "Famille monoparentale (oui/non)",
      "Handicap par enfant (catégorie médiane 4-6 points)",
      "Statut orphelin par enfant (aucun / un parent / deux parents)",
    ],
    formulas: [
      {
        label: "Tri des enfants",
        expression: "rang attribué du plus âgé (rang 1) au plus jeune",
      },
      {
        label: "Wallonie nouveau régime (né ≥2019)",
        expression: "base = 181,61 € (0–17 ans) ou 202 € (18–24 ans)",
      },
      {
        label: "Wallonie ancien régime (né <2019)",
        expression: "base = 119 / 219 / 327 € selon rang 1 / 2 / 3+",
      },
      {
        label: "Bruxelles nouveau régime (né ≥2019)",
        expression:
          "base = 181,61 € + 50 € si rang ≥ 3 (supplément 3e enfant FAMIRIS)",
      },
      {
        label: "Flandre Groeipakket (né ≥2019)",
        expression: "base = 184,62 € forfait identique tous enfants",
      },
      {
        label: "Germanophone",
        expression: "base = 165 € (0–17) ou 185 € (18–24)",
      },
      {
        label: "Supplément handicap (cumulable)",
        expression: "+ 85 € (WAL/FLA/DG) ou + 90 € (BXL) si enfant reconnu",
      },
      {
        label: "Supplément orphelin (cumulable)",
        expression:
          "un parent : 175/175/200/180 €  ·  deux parents : 400/400/450/400 € (WAL/BXL/FLA/DG)",
      },
      {
        label: "Allocation de naissance (one-shot)",
        expression:
          "WAL 1 415/1 057 (rang 1 / suivants)  ·  BXL 1 395/634  ·  FLA & DG 1 296 forfait",
      },
    ],
    constants: [
      { name: "Seuil bas revenu général", value: "< 36 000 €/an" },
      { name: "Seuil Flandre intermédiaire", value: "32 000 – 62 000 €/an" },
      { name: "Pivot nouveau régime (toutes régions)", value: "Né à partir de 2019" },
      { name: "Supplément monoparental Wallonie", value: "+22,88 €/enfant" },
      { name: "Supplément social Wallonie", value: "+33,69 €/enfant si bas revenu" },
      { name: "Supplément Flandre bas revenu", value: "+93 €/enfant si <32 000 €" },
      { name: "Supplément Flandre intermédiaire", value: "+21 €/enfant si 32–62 k€" },
      { name: "Supplément Bruxelles bas revenu", value: "+55 €/enfant (priorité sur supplément monoparental)" },
      { name: "Supplément 3e enfant Bruxelles", value: "+50 €/mois si rang ≥ 3" },
      {
        name: "Supplément handicap (par région)",
        value: "WAL 85 € / BXL 90 € / FLA 85 € / DG 85 €",
        note: "Catégorie médiane (4-6 points). Le réel va de 30 € (légère) à ~700 € (sévère).",
      },
      {
        name: "Supplément orphelin un parent",
        value: "WAL 175 / BXL 175 / FLA 200 / DG 180 €",
      },
      {
        name: "Supplément orphelin deux parents",
        value: "WAL 400 / BXL 400 / FLA 450 / DG 400 €",
      },
      {
        name: "Allocation de naissance",
        value: "WAL 1 415/1 057 · BXL 1 395/634 · FLA 1 296 · DG 1 296",
        note: "One-shot. WAL et BXL distinguent rang 1 / suivants ; FLA et DG forfait unique (Startbedrag).",
      },
      { name: "Bonus rentrée scolaire (annuel)", value: "22 / 47 / 65 / 87 € selon âge", note: "Versé en août." },
    ],
    sources: [
      { name: "FAMIWAL (Wallonie)", url: "https://www.famiwal.be" },
      { name: "FAMIRIS (Bruxelles)", url: "https://www.famiris.brussels" },
      { name: "Groeipakket (Flandre)", url: "https://www.groeipakket.be" },
      { name: "Kindergeld DG (Ostbelgien)", url: "https://www.ostbelgienlive.be" },
    ],
    limitations: [
      "Supplément handicap : valeur centrale — le montant réel dépend du nombre de points AViQ / Iriscare / Kind & Gezin (30 à 700 €).",
      "Pas de supplément social par âge (chômeur longue durée, invalide).",
      "Pas de prise en compte du Start- ou Schoolbonus Flandre.",
      "Pas de gestion des familles recomposées (mi-temps de garde).",
      "Bonus rentrée scolaire = montant annuel, pas réparti mensuellement.",
    ],
  },

  /* 7. IPP --------------------------------------------------------- */
  {
    slug: "ipp-simulateur",
    title: "Impôt des Personnes Physiques (IPP)",
    pitch:
      "Simulateur IPP fédéral simplifié — exercice d'imposition 2026 (revenus 2025).",
    sourceFile: "lib/calculators/ipp.ts",
    reliability: "high",
    reliabilityNote:
      "Barème fédéral 4 tranches indexé 2026 avec quotité exemptée 10 910 €, 5 réductions d'impôt (épargne pension, titres-services, dons, prêt hypo, garde enfants), quotient conjugal (allègement estimé pour marié 1 revenu) et cotisation spéciale sécurité sociale dégressive. Pour le calcul officiel et personnalisé : Tax-on-web.",
    year: 2026,
    inputs: [
      "Revenu annuel imposable (après ONSS + frais pro forfaitaires)",
      "Statut : isolé / marié 1 revenu / marié 2 revenus",
      "Enfants à charge (0–10)",
      "Autres personnes à charge (0–5)",
      "Additionnel communal (%)",
      "Versement épargne pension (€/an, plafond 1 130 €)",
      "Achats titres-services (€/an, plafond 1 500 €)",
      "Dons à associations agréées (€/an, min 40 €)",
      "Prêt hypothécaire (€/an)",
      "Frais de garde d'enfants < 14 ans (€/an)",
    ],
    formulas: [
      { label: "Impôt avant quotité", expression: "barème fédéral appliqué au revenu" },
      {
        label: "Réduction quotité",
        expression:
          "barème fédéral appliqué à la quotité exemptée totale (en partant du bas du barème, plafonné au revenu)",
      },
      {
        label: "Impôt fédéral brut",
        expression: "impot_brut = max(0, impot_avant_quotite − réduction_quotite)",
      },
      {
        label: "Quotient conjugal (marié 1 revenu)",
        expression:
          "allègement = min(max(0, revenu − 16 320), 13 530) × 25 % (approximation art. 134 CIR 92)",
      },
      {
        label: "Réductions d'impôt",
        expression:
          "épargne_pension × 30 % + titres_services × 15 % + dons × 45 % + prêt_hypo × 30 % + garde × 45 %",
      },
      {
        label: "Cotisation spéciale sécurité sociale",
        expression:
          "0 ≤ 18 592 €  ·  9 % sur 18 592 → 21 070  ·  1,3 % sur 21 070 → 60 161 (plafond 731 €/an)",
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
      { name: "Quotité exemptée de base", value: fmtEUR(10910) + "/an", note: "Art. 131 CIR 92 — indexé EI 2026." },
      { name: "Supplément 1er enfant", value: fmtEUR(1920) },
      { name: "Supplément 2 enfants (cumulé)", value: fmtEUR(4950) },
      { name: "Supplément 3 enfants (cumulé)", value: fmtEUR(11080) },
      { name: "Supplément 4 enfants (cumulé)", value: fmtEUR(17920) },
      { name: "Au-delà du 5e enfant", value: "+" + fmtEUR(6840) + " par enfant" },
      { name: "Autre personne à charge", value: "+" + fmtEUR(1920) },
      { name: "Additionnel communal moyen Belgique", value: "≈ 7,5 %", note: "Variable 0–9 %." },
      {
        name: "Épargne pension",
        value: "30 % × min(versement, 1 130 €)",
        note: "Palier de base (panier 1). Art. 145 CIR 92.",
      },
      {
        name: "Titres-services",
        value: "≈ 15 % × min(achats, 1 500 €)",
        note: "Moyenne 3 régions (le taux exact varie par Région).",
      },
      {
        name: "Dons",
        value: "45 % du montant (≥ 40 €/bénéficiaire)",
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
        value: fmtEUR(13530) + "/an",
        note: "Art. 134 CIR 92 (transfert virtuel vers conjoint sans revenu).",
      },
      {
        name: "Cotisation spéciale sécu — seuils",
        value: "18 592 → 21 070 (9 %) puis → 60 161 € (1,3 %)",
        note: "Plafond annuel 731 € (loi 30/03/1994).",
      },
    ],
    sources: [
      { name: "SPF Finances — Calcul de l'impôt", url: "https://finances.belgium.be" },
      { name: "CIR 92 — Code des impôts sur les revenus", url: "https://eservices.minfin.fgov.be" },
      { name: "Loi 30/03/1994 (cotisation spéciale sécu)", url: "https://www.ejustice.just.fgov.be" },
      { name: "Tax-on-web (déclaration en ligne)", url: "https://finances.belgium.be/fr/E-services/tax-on-web" },
    ],
    limitations: [
      "Bornes des tranches à 2025 — l'écart avec 2026 indexé est de l'ordre de 3 %.",
      "Quotient conjugal : approximation 25 % du transfert (vraie formule = écrasement progressif des tranches).",
      "Pas de calcul de l'impôt régional (additionnel régional ≈ 0 dans la pratique).",
      "Pas de revenu professionnel des indépendants (régime forfait/réel pro).",
    ],
  },

  /* 8. TARIF SOCIAL ÉNERGIE ---------------------------------------- */
  {
    slug: "tarif-social-energie",
    title: "Tarif social énergie",
    pitch:
      "Vérification d'éligibilité au tarif social fédéral (élec + gaz) + estimation du gain annuel.",
    sourceFile: "lib/calculators/tarif-social.ts",
    reliability: "high",
    reliabilityNote:
      "Tarifs " +
      Q_REFERENCE +
      " (CREG note Z3153) avec application exacte des plafonds de consommation : split tarif social ≤ plafond + tarif standard sur l'excédent. Plafonds modulés par la taille du ménage (+200 kWh/personne pour l'élec) et le type de chauffage gaz (helpers `plafondElecKwh` et `plafondGazKwh` exportés). À ré-actualiser à chaque nouvelle note CREG trimestrielle.",
    year: 2026,
    inputs: [
      "6 statuts (cases à cocher) : BIM / RIS / GRAPA / handicap / aide sociale équivalente / logement social",
      "Consommation annuelle électricité (kWh)",
      "Consommation annuelle gaz naturel (kWh, 0 si pas de gaz)",
      "Chauffage électrique (oui/non)",
      "Chauffage au gaz (oui/non, défaut oui)",
      "Taille du ménage (1–15, défaut 2)",
    ],
    formulas: [
      {
        label: "Éligibilité",
        expression: "éligible = au moins un statut coché",
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
        note: "Tarifs recalculés chaque trimestre par la CREG (note Z3153).",
      },
      { name: "Tarif social élec", value: fmtEUR(TARIFS_2026.ELEC_SOCIAL) + "/kWh", note: "Tout inclus TVAC." },
      { name: "Tarif standard moyen élec", value: fmtEUR(TARIFS_2026.ELEC_STANDARD) + "/kWh" },
      { name: "Tarif social gaz", value: fmtEUR(TARIFS_2026.GAZ_SOCIAL) + "/kWh" },
      { name: "Tarif standard moyen gaz", value: fmtEUR(TARIFS_2026.GAZ_STANDARD) + "/kWh" },
      { name: "Plafond élec base", value: `${PLAFONDS_2026.ELEC_BASE} kWh + ${PLAFONDS_2026.ELEC_PAR_PERSONNE}/personne` },
      { name: "Plafond élec chauffage", value: `${PLAFONDS_2026.ELEC_CHAUFFAGE} kWh + ${PLAFONDS_2026.ELEC_PAR_PERSONNE}/personne` },
      { name: "Plafond gaz cuisine/ecs", value: `${PLAFONDS_2026.GAZ_NON_CHAUFFAGE} kWh` },
      { name: "Plafond gaz chauffage", value: `${PLAFONDS_2026.GAZ_CHAUFFAGE} kWh` },
    ],
    sources: [
      { name: "SPF Économie — Tarif social", url: "https://economie.fgov.be" },
      { name: "CREG — Tarifs sociaux trimestriels (note Z3153)", url: "https://www.creg.be" },
      { name: "AR du 29 mars 2012 (catégories bénéficiaires)", url: "https://www.ejustice.just.fgov.be" },
    ],
    limitations: [
      "Tarif standard = moyenne simple, varie ±20 % selon fournisseur.",
      "Pas de gestion des contrats à tarif fixe vs variable.",
      "Pas de prise en compte des heures creuses/pleines.",
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
      "Barème 2026 (revenus 2026 / EI 2027) avec gestion de l'indemnité km employeur : bascule automatique 0,4322 → 0,15 €/km pour la voiture (cumul exclu, CIR 92 art. 66) et soustraction du montant reçu de la déduction brute. Télétravail : information pédagogique sur les km évités (n'affecte pas la déduction). Plafond vélo 3 700 €/an appliqué.",
    year: 2026,
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
        expression: "déduction = km_total × 0,4322",
      },
      {
        label: "Voiture avec indemnité employeur",
        expression:
          "déduction = km_total × 0,15 (forfait CIR 92 art. 66, cumul exclu)",
      },
      {
        label: "Voiture (>100 km AS)",
        expression: "(100 × 2 × jours) × taux + (km − 100) × 2 × jours × 0,15",
      },
      {
        label: "Vélo",
        expression:
          "déduction = min(km_total × 0,37 ; 3 700 €/an)",
      },
      {
        label: "Compensation indemnité employeur",
        expression: "déduction_nette = max(0, déduction_brute − indemnité_employeur)",
      },
      {
        label: "Transports publics",
        expression: "déduction = coût_abonnement_annuel (100 %)",
      },
    ],
    constants: [
      { name: "Voiture (sans indemnité employeur)", value: fmtEUR(TAUX_KM_2026.voiture) + "/km", note: "Tarif fonctionnaires applicable comme frais réels domicile-travail. Plafonné à 100 km aller simple." },
      { name: "Voiture (avec indemnité ou >100 km)", value: fmtEUR(0.15) + "/km", note: "Forfait standard CIR 92 art. 66. Le cumul tarif fonctionnaires + indemnité employeur est interdit." },
      { name: "Vélo (incl. électrique)", value: fmtEUR(TAUX_KM_2026.velo) + "/km", note: `Plafonné à ${fmtEUR(PLAFOND_ANNUEL_VELO_2026)}/an (revenus 2026 / EI 2027).` },
      { name: "Plafond annuel vélo", value: fmtEUR(PLAFOND_ANNUEL_VELO_2026) + "/an" },
      { name: "Moto", value: fmtEUR(TAUX_KM_2026.moto) + "/km" },
      { name: "Covoiturage passager", value: fmtEUR(TAUX_KM_2026.covoiturage) + "/km", note: "Plafonné à 100 km AS." },
      { name: "Transports publics", value: "100 % de l'abonnement annuel" },
      {
        name: "Forfait légal frais pro",
        value: fmtEUR(FORFAIT_LEGAL_FRAIS_PRO_2026) + "/an",
        note: "≈ 30 % du brut, à comparer aux frais réels.",
      },
      {
        name: "Seuil recommandation frais réels",
        value: fmtEUR(3000) + "/an",
        note: "Raccourci pédagogique : au-delà, vaut le coup d'opter pour les frais réels.",
      },
    ],
    sources: [
      { name: "SPF Finances — Frais professionnels", url: "https://finances.belgium.be" },
      { name: "CIR 92 art. 51 (forfait) et art. 66 (km)", url: "https://eservices.minfin.fgov.be" },
      { name: "Circulaire SPF Finances barème km", url: "https://finances.belgium.be" },
    ],
    limitations: [
      "Pas de prise en compte des autres frais réels (repas, vêtements pro, formation).",
      "Pas de gestion mixte (ex: voiture + train).",
      "Comparaison forfait/réel simpliste : la décision dépend aussi du taux marginal.",
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
