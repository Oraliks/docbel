/**
 * Registre initial des sources officielles (S1..S13, cf. spec §10).
 * Semé en base (EmployerLegalSource) ; éditable ensuite côté admin.
 * `lastCheckedAt` volontairement absent → l'admin doit vérifier (état "à vérifier").
 */

export interface LegalSourceSeed {
  code: string;
  /**
   * Titre officiel de la source (FR autoritaire). Non traduit : c'est le nom
   * officiel de la publication (ONSS/SPF Emploi/…) et il doit rester en FR.
   */
  title: string;
  /** Institution éditrice (nom officiel — laissé en FR). */
  institution: string;
  url: string;
  contentSummary: string;
  /**
   * Clé i18n optionnelle pour `contentSummary` (description, traduisible).
   * FR `contentSummary` reste source/fallback. Namespace
   * `public.employeurLib.legalSources.<code>.contentSummary`.
   */
  contentSummaryKey?: string;
  reliability: "low" | "medium" | "high";
  appliesToModules: string[];
}

/** Préfixe namespace pour les clés legalSources. */
const LS = (code: string) => `public.employeurLib.legalSources.${code}` as const;

export const LEGAL_SOURCES: LegalSourceSeed[] = [
  {
    code: "S1",
    title: "ONSS — Identification employeur (WIDE)",
    institution: "ONSS",
    url: "https://www.onss.be/",
    contentSummary:
      "Identification de l'entreprise comme employeur et obtention de la qualité d'employeur via WIDE (premier engagement).",
    contentSummaryKey: LS("S1") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["assistant", "checklist"],
  },
  {
    code: "S2",
    title: "Sécurité sociale — Dimona",
    institution: "ONSS / Sécurité sociale",
    url: "https://www.socialsecurity.be/site_fr/employer/applics/dimona/index.htm",
    contentSummary:
      "Déclaration immédiate de l'emploi : entrée et sortie de service du travailleur, selon le type de travailleur.",
    contentSummaryKey: LS("S2") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["assistant", "checklist"],
  },
  {
    code: "S3",
    title: "Sécurité sociale — DmfA",
    institution: "ONSS / Sécurité sociale",
    url: "https://www.socialsecurity.be/site_fr/employer/applics/dmfa/index.htm",
    contentSummary:
      "Déclaration multifonctionnelle trimestrielle : rémunérations, temps de travail et cotisations.",
    contentSummaryKey: LS("S3") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["bibliotheque"],
  },
  {
    code: "S4",
    title: "Sécurité sociale — Employeurs et ONSS",
    institution: "ONSS / Sécurité sociale",
    url: "https://www.onss.be/",
    contentSummary:
      "Inscription employeur, déclarations, cotisations sociales et obligations générales.",
    contentSummaryKey: LS("S4") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["assistant", "checklist", "simulateur"],
  },
  {
    code: "S5",
    title: "Mandats / prestataires de services sociaux",
    institution: "Sécurité sociale",
    url: "https://www.socialsecurity.be/",
    contentSummary:
      "Mandats et prestataires de services sociaux (hors périmètre MVP — étape future).",
    contentSummaryKey: LS("S5") + ".contentSummary",
    reliability: "medium",
    appliesToModules: ["bibliotheque"],
  },
  {
    code: "S6",
    title: "SPF Emploi — Contrat de travail",
    institution: "SPF Emploi, Travail et Concertation sociale",
    url: "https://emploi.belgique.be/fr/themes/contrats-de-travail",
    contentSummary:
      "Types de contrats, écrit obligatoire ou recommandé (temps partiel, étudiant, flexi-job).",
    contentSummaryKey: LS("S6") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["assistant", "checklist", "bibliotheque"],
  },
  {
    code: "S7",
    title: "SPF Emploi — Règlement de travail",
    institution: "SPF Emploi, Travail et Concertation sociale",
    url: "https://emploi.belgique.be/fr/themes/reglementation-du-travail/reglement-de-travail",
    contentSummary: "Obligations internes, dépôt, horaires et mise à jour du règlement de travail.",
    contentSummaryKey: LS("S7") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["checklist", "bibliotheque"],
  },
  {
    code: "S8",
    title: "SPF Emploi — Salaires, CCT et commissions paritaires",
    institution: "SPF Emploi, Travail et Concertation sociale",
    url: "https://emploi.belgique.be/fr/themes/remuneration/salaires-minimums-par-sous-commission-paritaire",
    contentSummary:
      "Salaire minimum, commission paritaire, CCT et barèmes. Sans CP, le barème ne peut être vérifié précisément.",
    contentSummaryKey: LS("S8") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["assistant", "simulateur", "checklist"],
  },
  {
    code: "S9",
    title: "SPF Emploi — Étudiants",
    institution: "SPF Emploi, Travail et Concertation sociale",
    url: "https://emploi.belgique.be/fr/themes/contrats-de-travail/contrats-de-travail-particuliers/contrat-doccupation-detudiants",
    contentSummary:
      "Contrat d'occupation d'étudiant, mentions obligatoires, rémunération et sanctions si incomplet.",
    contentSummaryKey: LS("S9") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["assistant", "checklist"],
  },
  {
    code: "S10",
    title: "Sécurité sociale / SPF Emploi — Flexi-jobs",
    institution: "ONSS / SPF Emploi",
    url: "https://www.socialsecurity.be/site_fr/employer/infos/flexi-jobs.htm",
    contentSummary:
      "Conditions d'accès, contrat-cadre écrit, cotisation patronale spécifique et déclaration.",
    contentSummaryKey: LS("S10") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["assistant", "checklist"],
  },
  {
    code: "S11",
    title: "SPF Emploi — Durée du travail et repos",
    institution: "SPF Emploi, Travail et Concertation sociale",
    url: "https://emploi.belgique.be/fr/themes/reglementation-du-travail/duree-du-travail-et-temps-de-repos",
    contentSummary: "Horaires, durée journalière/hebdomadaire, repos et exceptions sectorielles.",
    contentSummaryKey: LS("S11") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["bibliotheque"],
  },
  {
    code: "S12",
    title: "ONEM — Chômage temporaire",
    institution: "ONEM",
    url: "https://www.onem.be/",
    contentSummary:
      "Définition, motifs (force majeure, intempéries, raisons économiques), procédure et documents.",
    contentSummaryKey: LS("S12") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["checklist", "bibliotheque"],
  },
  {
    code: "S13",
    title: "e-Box Enterprise / Sécurité sociale",
    institution: "Sécurité sociale",
    url: "https://www.socialsecurity.be/site_fr/general/helpcentre/ebox/index.htm",
    contentSummary: "Communications officielles et espace numérique de l'employeur.",
    contentSummaryKey: LS("S13") + ".contentSummary",
    reliability: "high",
    appliesToModules: ["checklist", "bibliotheque"],
  },
];
