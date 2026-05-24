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
import { TARIFS_2026, PLAFONDS_2026 } from "./tarif-social";
import { TAUX_KM_2026, FORFAIT_LEGAL_FRAIS_PRO_2026 } from "./frais-km";
import { PHASES_INFO } from "./chomage";

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
    reliability: "medium",
    reliabilityNote:
      "Reproduit la logique macro du précompte professionnel mensuel (barème ordinaire SPF Finances). Audit 2026-05 : bonus à l'emploi (264→229,32), seuils (1900/3300→2154/3271) et chèques-repas (6,91→8,91) mis à jour. La quotité exemptée mensualisée reste approximée (la formule SPF officielle module par paliers).",
    year: 2026,
    inputs: [
      "Salaire brut mensuel (€)",
      "Statut fiscal : isolé / cohabitant / marié 1 revenu / marié 2 revenus",
      "Enfants à charge (0–12)",
      "Région (information seulement à ce stade)",
      "Chèques-repas (oui/non)",
    ],
    formulas: [
      { label: "ONSS travailleur", expression: "ONSS = brut × 13,07 %" },
      { label: "Imposable", expression: "imposable = brut − ONSS" },
      {
        label: "Précompte par tranches",
        expression:
          "Σ (largeur_tranche × taux), tranches mensuelles 0 → ∞ (0 % / 26,75 % / 42,80 % / 48,15 % / 53,50 %)",
      },
      {
        label: "Réduction quotité + enfants",
        expression: "précompte_final = max(0, précompte − quotité − réduc_enfants)",
      },
      {
        label: "Net",
        expression: "net = imposable − précompte_final + bonus_emploi + chèques_repas",
      },
    ],
    constants: [
      {
        name: "ONSS travailleur",
        value: "13,07 %",
        note: "Inchangé depuis 1981. Source: SPF Sécurité Sociale.",
      },
      {
        name: "Tranches précompte mensuel",
        value: "1360 / 2400 / 4100 / 7070 €",
        note: "Bornes mensuelles. Taux 0 / 26,75 / 42,80 / 48,15 / 53,50 %.",
      },
      {
        name: "Quotité exemptée mensuelle (isolé)",
        value: "245 €/mois",
        note: "Approximation : 10 570 €/an / 12, modulée par statut civil.",
      },
      {
        name: "Quotité exemptée mensuelle (marié 1 revenu)",
        value: "380 €/mois",
        note: "Inclut la quotité du conjoint sans revenu.",
      },
      {
        name: "Réduction enfants à charge (mensuel)",
        value: "1: 45 € / 2: 120 € / 3: 320 € / 4: 580 € / +5: +250 €/enfant",
        note: "Barème SPF approché — l'écart avec les fiches officielles est minime à faible revenu, plus marqué au-dessus du 4e enfant.",
      },
      {
        name: "Bonus à l'emploi (workbonus)",
        value: "229,32 €/mois max",
        note: "Dégressif linéairement entre 2 154 et 3 271 € de brut (volet A 2026). Source Securex. La formule officielle est par paliers — ici linéarisée.",
      },
      {
        name: "Chèques-repas",
        value: "8,91 €/jour × 21 jours",
        note: "Part employeur max non imposable (valeur faciale max 10 €/jour en 2026, contribution travailleur 1,09 €). Source UCM/Liantis.",
      },
    ],
    sources: [
      { name: "SPF Finances — Précompte professionnel", url: "https://finances.belgium.be" },
      { name: "Code des impôts sur les revenus (CIR 92), art. 131", url: "https://eservices.minfin.fgov.be" },
      { name: "ONSS — taux des cotisations", url: "https://www.socialsecurity.be" },
    ],
    limitations: [
      "Pas de prise en compte de la voiture de société (avantage de toute nature ATN).",
      "Pas de prise en compte de l'assurance groupe / chèques cadeaux / éco-chèques.",
      "Pas de prise en compte de la pension alimentaire versée.",
      "Pas de prise en compte de la quotité régionale (impact <1 % sur le précompte mensuel).",
      "Bonus à l'emploi linéarisé : la formule officielle est par paliers.",
    ],
  },

  /* 2. PÉCULE DE VACANCES ------------------------------------------- */
  {
    slug: "pecule-vacances",
    title: "Pécule de vacances",
    pitch:
      "Pécule simple + double pour les employés (versé par l'employeur en juin) ou pour les ouvriers (versé par l'ONVA en mai/juin).",
    sourceFile: "lib/calculators/pecule.ts",
    reliability: "medium",
    reliabilityNote:
      "Formules conformes aux textes officiels. Audit 2026-05 : ONVA_PART_SIMPLE corrigée (8 % / 7,38 % → ratio 0,52 simple / 0,48 double). Les coefficients de retenue (net estimé) restent moyennés — le net dépend du taux marginal individuel.",
    year: 2026,
    inputs: [
      "Statut : employé / ouvrier",
      "Brut mensuel (employé) ou moyen N-1 (ouvrier)",
      "Mois prestés l'année précédente (0–12)",
      "Temps partiel + taux d'occupation",
    ],
    formulas: [
      {
        label: "Employé — pécule simple",
        expression: "simple = brut × (mois_prestés / 12) × taux_occup",
      },
      {
        label: "Employé — double pécule",
        expression: "double = brut × 0,92 × (mois_prestés / 12) × taux_occup",
      },
      {
        label: "Employé — net estimé du double",
        expression: "net_double ≈ double × 0,567 (ONSS spé 13,07 % + précompte spécial)",
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
        name: "Coefficient net double pécule (employé)",
        value: "0,567",
        note: "Moyen : ONSS spé 13,07 % + précompte spécial dégressif (~25 à 50 %).",
      },
      {
        name: "Coefficient majoration ONVA",
        value: "1,08",
        note: "Majoration légale des salaires déclarés à l'ONVA.",
      },
      {
        name: "Taux global ONVA",
        value: "15,38 %",
        note: "Total pécule simple (6,80 %) + double (8,58 %) sur brut majoré.",
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
    ],
    sources: [
      { name: "ONVA — Office National des Vacances Annuelles", url: "https://www.onva-rjv.fgov.be" },
      { name: "SPF Sécurité Sociale — Pécule de vacances", url: "https://www.socialsecurity.be" },
      { name: "SPF Emploi — Vacances annuelles", url: "https://emploi.belgique.be" },
    ],
    limitations: [
      "Ne tient pas compte des jours assimilés (maladie, chômage, congé maternité).",
      "Ne tient pas compte des primes et indemnités sectorielles.",
      "Net employé estimé : le précompte spécial dépend de la tranche marginale annuelle.",
      "Pas de cas spécifique pour les jeunes (pécule de vacances jeunes / supplément).",
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
      "Formule conforme à la loi du 3 juillet 1978 (art. 39). Le seul élément approximatif est l'estimation du précompte spécial (33,28 %) qui dépend du taux marginal individuel.",
    year: 2026,
    inputs: [
      "Salaire brut mensuel courant",
      "Durée de préavis non presté (semaines)",
      "Avantages annuels (€/an, optionnel)",
      "Estimer le net après précompte (oui/non)",
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
        label: "Indemnité brute",
        expression: "indemnité = hebdo × préavis_semaines",
      },
      {
        label: "Net estimé",
        expression: "net ≈ brut × (1 − 0,3328)",
      },
    ],
    constants: [
      {
        name: "Précompte spécial moyen",
        value: "33,28 %",
        note: "Taux moyen souvent observé. Réel = taux marginal du contribuable.",
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
      { name: "SPF Emploi — Rupture du contrat", url: "https://emploi.belgique.be" },
      { name: "SPF Finances — Précompte sur indemnités", url: "https://finances.belgium.be" },
    ],
    limitations: [
      "Pas de prise en compte de l'indemnité de protection (délégué syndical, femme enceinte, etc.).",
      "Pas d'application du plafond fiscal d'imposition étalée (article 171 CIR 92).",
      "Le précompte spécial peut atteindre ~48 % pour les hauts revenus.",
    ],
  },

  /* 5. PENSION ----------------------------------------------------- */
  {
    slug: "pension-estimation",
    title: "Pension légale estimée (salarié)",
    pitch:
      "Estimation pédagogique de la pension légale salarié belge selon la carrière, le salaire moyen et l'âge de départ.",
    sourceFile: "lib/calculators/pension.ts",
    reliability: "low",
    reliabilityNote:
      "Audit 2026-05 : PLAFOND_SALARIAL_2026 corrigé (78 690→69 521). Les minimums garantis 1 700 / 2 100 € restent corrects (sources convergentes 1 686-1 757 / 2 108). Le malus 5 %/an reste une approximation : le régime officiel n'a pas de malus linéaire, mais des conditions de carrière (42 ans à 63 ans, 43 à 62, 44 à 61). Pour le chiffre officiel : mypension.be.",
    year: 2026,
    inputs: [
      "Date de naissance (détermine l'âge légal)",
      "Années de carrière prévues (0–50)",
      "Salaire annuel brut moyen sur la carrière (€)",
      "Statut : isolé (60 %) / ménage (75 %)",
      "Âge de départ envisagé (60–70)",
    ],
    formulas: [
      {
        label: "Salaire pris",
        expression: "salaire_pris = min(salaire_moyen, plafond_salarial)",
      },
      {
        label: "Pension annuelle de base",
        expression: "pension = salaire_pris × taux × (carrière / 45)",
      },
      {
        label: "Plancher minimum garanti (si carrière ≥ 30 ans)",
        expression: "pension = max(pension, minimum × carrière/45)",
      },
      {
        label: "Plafond légal",
        expression: "pension = min(pension, plafond_pension)",
      },
      {
        label: "Malus départ anticipé",
        expression: "pension = pension × (1 − 5 % × années_anticipées)",
      },
    ],
    constants: [
      { name: "Plafond salarial annuel", value: "78 690 €/an", note: "Plafond 2026 pour le calcul." },
      { name: "Carrière complète", value: "45 ans" },
      { name: "Taux isolé", value: "60 %" },
      { name: "Taux ménage", value: "75 %" },
      { name: "Minimum garanti isolé", value: "1 700 €/mois", note: "Carrière ≥ 30 ans, proratisé." },
      { name: "Minimum garanti ménage", value: "2 100 €/mois" },
      { name: "Plafond pension isolé", value: "3 500 €/mois", note: "Plafond indicatif." },
      { name: "Plafond pension ménage", value: "4 350 €/mois" },
      { name: "Malus départ anticipé", value: "5 % par année anticipée", note: "Approximation pédagogique." },
      {
        name: "Âge légal de pension",
        value: "65 (<1960) / 66 (1960–1963) / 67 (≥1964)",
        note: "Loi du 10 août 2015.",
      },
    ],
    sources: [
      { name: "SFP — Service Fédéral des Pensions", url: "https://www.sfpd.fgov.be" },
      { name: "mypension.be — calcul officiel", url: "https://www.mypension.be" },
      { name: "Loi du 10 août 2015 (âge légal)", url: "https://www.ejustice.just.fgov.be" },
    ],
    limitations: [
      "Ne tient pas compte des périodes assimilées (chômage, maladie, service militaire, crédit-temps).",
      "Pas de bonus pour les carrières longues (>45 ans).",
      "Pas de calcul de la pension de survie ou de la pension complémentaire (2e pilier).",
      "Conditions d'accès à la pension anticipée non vérifiées (carrière minimum requise).",
      "Pas de calcul pour les indépendants ou les fonctionnaires (régimes distincts).",
    ],
  },

  /* 6. ALLOCATIONS FAMILIALES -------------------------------------- */
  {
    slug: "allocations-familiales",
    title: "Allocations familiales (4 régimes)",
    pitch:
      "Allocations familiales selon le régime régional applicable (FAMIWAL / FAMIRIS / Groeipakket / Kindergeld DG), 2026.",
    sourceFile: "lib/calculators/allocs-fam.ts",
    reliability: "medium",
    reliabilityNote:
      "Audit 2026-05 : pivot ancien/nouveau régime corrigé (Wallonie 2020→2019, identique Flandre). Wallonie base 175→181,61 + suppléments mis à jour (47/73→22,88 / 56→33,69). Bruxelles base passée à 181,61 € uniforme (le barème 159/169/179 par âge était erroné). Flandre 184→184,62. Reste à enrichir : supplément 3e enfant Bruxelles, suppléments handicap/orphelin, gestion famille recomposée.",
    year: 2026,
    inputs: [
      "Région : Wallonie / Bruxelles / Flandre / Germanophone",
      "Liste d'enfants (année de naissance, 1–10)",
      "Revenu annuel brut imposable du ménage (€)",
      "Famille monoparentale (oui/non)",
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
        expression: "base = 181,61 € (forfait unique depuis harmonisation)",
      },
      {
        label: "Flandre Groeipakket (né ≥2019)",
        expression: "base = 184,62 € forfait identique tous enfants",
      },
      {
        label: "Germanophone",
        expression: "base = 165 € (0–17) ou 185 € (18–24)",
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
      { name: "Bonus rentrée scolaire (annuel)", value: "22 / 47 / 65 / 87 € selon âge", note: "Versé en août." },
    ],
    sources: [
      { name: "FAMIWAL (Wallonie)", url: "https://www.famiwal.be" },
      { name: "FAMIRIS (Bruxelles)", url: "https://www.famiris.brussels" },
      { name: "Groeipakket (Flandre)", url: "https://www.groeipakket.be" },
      { name: "Kindergeld DG (Ostbelgien)", url: "https://www.ostbelgienlive.be" },
    ],
    limitations: [
      "Pas de supplément handicap.",
      "Pas de supplément orphelin / placement.",
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
    reliability: "medium",
    reliabilityNote:
      "Audit 2026-05 : quotité exemptée corrigée (10 570→10 910 €). Le barème fédéral 4 tranches est correct ; les bornes (16 320 / 28 800 / 49 840) restent à 2025 — l'écart avec 2026 indexé (15 820 / 27 920 / 48 320 selon Billy) est de l'ordre de 3 %. Pas de gestion des crédits d'impôt (épargne pension, titres-services, etc.) ce qui surestime l'impôt réel.",
    year: 2026,
    inputs: [
      "Revenu annuel imposable (après ONSS + frais pro forfaitaires)",
      "Statut : isolé / marié 1 revenu / marié 2 revenus",
      "Enfants à charge (0–10)",
      "Autres personnes à charge (0–5)",
      "Additionnel communal (%)",
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
        label: "Impôt total",
        expression: "impot_total = impot_brut × (1 + additionnel_communal / 100)",
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
    ],
    sources: [
      { name: "SPF Finances — Calcul de l'impôt", url: "https://finances.belgium.be" },
      { name: "CIR 92 — Code des impôts sur les revenus", url: "https://eservices.minfin.fgov.be" },
      { name: "Tax-on-web (déclaration en ligne)", url: "https://finances.belgium.be/fr/E-services/tax-on-web" },
    ],
    limitations: [
      "Pas de crédits d'impôt (épargne pension, titres-services, dons, prêts hypothécaires).",
      "Pas de quotient conjugal (mariés 1 revenu : application partielle uniquement).",
      "Pas de calcul de l'impôt régional (additionnel régional ≈ 0 dans la pratique).",
      "Pas de cotisation spéciale sécurité sociale.",
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
    reliability: "medium",
    reliabilityNote:
      "Audit 2026-05 : ELEC_SOCIAL corrigé (0,22→0,248 €/kWh Q2 2026 — source CREG note Z3153) ; ELEC_STANDARD ajusté à la moyenne nationale 2026 (0,385→0,35). Les tarifs sociaux sont recalculés CHAQUE TRIMESTRE par la CREG — à ré-actualiser à chaque nouvelle note tarifaire. Les plafonds de consommation sont documentés mais pas appliqués dans le calcul (simplification volontaire).",
    year: 2026,
    inputs: [
      "6 statuts (cases à cocher) : BIM / RIS / GRAPA / handicap / aide sociale équivalente / logement social",
      "Consommation annuelle électricité (kWh)",
      "Consommation annuelle gaz naturel (kWh, 0 si pas de gaz)",
      "Chauffage électrique (oui/non)",
    ],
    formulas: [
      {
        label: "Éligibilité",
        expression: "éligible = au moins un statut coché",
      },
      {
        label: "Gain élec",
        expression: "gain_elec = conso_elec × (tarif_standard_elec − tarif_social_elec)",
      },
      {
        label: "Gain gaz",
        expression: "gain_gaz = conso_gaz × (tarif_standard_gaz − tarif_social_gaz)",
      },
      {
        label: "Gain total",
        expression: "gain_annuel = gain_elec + gain_gaz ; gain_mensuel = gain_annuel / 12",
      },
    ],
    constants: [
      { name: "Tarif social élec", value: fmtEUR(TARIFS_2026.ELEC_SOCIAL) + "/kWh", note: "Tout inclus TVAC." },
      { name: "Tarif standard moyen élec", value: fmtEUR(TARIFS_2026.ELEC_STANDARD) + "/kWh" },
      { name: "Tarif social gaz", value: fmtEUR(TARIFS_2026.GAZ_SOCIAL) + "/kWh" },
      { name: "Tarif standard moyen gaz", value: fmtEUR(TARIFS_2026.GAZ_STANDARD) + "/kWh" },
      { name: "Plafond élec base", value: `${PLAFONDS_2026.ELEC_BASE} kWh + 200/personne` },
      { name: "Plafond élec chauffage", value: `${PLAFONDS_2026.ELEC_CHAUFFAGE} kWh + 200/personne` },
      { name: "Plafond gaz cuisine/ecs", value: `${PLAFONDS_2026.GAZ_NON_CHAUFFAGE} kWh` },
      { name: "Plafond gaz chauffage", value: `${PLAFONDS_2026.GAZ_CHAUFFAGE} kWh` },
    ],
    sources: [
      { name: "SPF Économie — Tarif social", url: "https://economie.fgov.be" },
      { name: "CREG — Tarifs sociaux trimestriels", url: "https://www.creg.be" },
      { name: "AR du 29 mars 2012 (catégories bénéficiaires)", url: "https://www.ejustice.just.fgov.be" },
    ],
    limitations: [
      "Plafonds de consommation pas appliqués (au-delà : tarif standard pour l'excédent).",
      "Pas de gestion taille du ménage pour le plafond élec (+200 kWh/personne).",
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
    reliability: "medium",
    reliabilityNote:
      "Audit 2026-05 : forfait légal corrigé (5 720→6 070 € revenus 2026), vélo 0,36→0,37 €/km avec plafond annuel 3 700 € ajouté. ⚠️ Pour la VOITURE, le code utilise 0,4322 €/km (tarif indemnité km fonctionnaires) — c'est légalement applicable comme déduction frais réels domicile-travail SI l'employeur ne verse pas d'indemnité km, sinon c'est 0,15 €/km (forfait CIR 92 art. 66). Choix conservateur opposé : remplacer par 0,15 €/km partout.",
    year: 2026,
    inputs: [
      "Distance domicile-travail aller simple (km)",
      "Jours travaillés par semaine (1–7)",
      "Semaines travaillées par an (défaut 44)",
      "Mode de transport (5 options)",
      "Coût annuel abonnement (si transports publics)",
    ],
    formulas: [
      {
        label: "Km annuels",
        expression: "km_total = km_AS × 2 × jours/sem × sem/an",
      },
      {
        label: "Voiture (≤100 km AS)",
        expression: "déduction = km_total × 0,4322",
      },
      {
        label: "Voiture (>100 km AS)",
        expression: "déduction = (100 × 2 × jours) × 0,4322 + (km − 100) × 2 × jours × 0,15",
      },
      {
        label: "Vélo",
        expression: "déduction = km_total × 0,36",
      },
      {
        label: "Transports publics",
        expression: "déduction = coût_abonnement_annuel (100 %)",
      },
    ],
    constants: [
      { name: "Voiture", value: fmtEUR(TAUX_KM_2026.voiture) + "/km", note: "Tarif fonctionnaires applicable comme frais réels domicile-travail si l'employeur ne donne pas d'indemnité km. Sinon : forfait 0,15 €/km (CIR 92 art. 66). Plafonné à 100 km aller simple." },
      { name: "Voiture (>100 km)", value: fmtEUR(0.15) + "/km", note: "Forfait standard CIR 92." },
      { name: "Vélo (incl. électrique)", value: fmtEUR(TAUX_KM_2026.velo) + "/km", note: "Plafonné à 3 700 €/an (revenus 2026)." },
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
      "Pas de prise en compte des autres frais réels (repas, vêtements pro, formation, télétravail).",
      "Pas de gestion de l'indemnité kilométrique reçue de l'employeur (à déduire des frais).",
      "Pas de cas spécifique télétravail (jours à distance).",
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
