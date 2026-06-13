/**
 * Module 6 — Contrôle simple de documents sociaux (moteur PUR).
 *
 * L'employeur encode manuellement des données « façon fiche de paie » ; ce
 * moteur signale des INCOHÉRENCES POTENTIELLES. Ce n'est PAS une certification
 * de conformité (cf. LegalDisclaimerBox context="controle").
 *
 * 100 % pur : aucune dépendance React / DB / server-only. Importable côté
 * client (le formulaire calcule en direct) ET côté serveur (route PDF recalcule
 * sans faire confiance au client).
 *
 * Réutilise le calculateur brut→net existant (`lib/calculators/brut-net`) pour
 * estimer le net attendu et le comparer au net encodé — AUCUNE duplication de
 * la logique nette.
 */
import { calcBrutNet } from "@/lib/calculators/brut-net";

/** Niveau d'un constat. info < attention < critique. */
export type FindingLevel = "info" | "attention" | "critique";

export interface Finding {
  level: FindingLevel;
  /** Code stable (sert de clé React + identifie le constat dans les tests). */
  code: string;
  message: string;
  /** Source officielle Docbel (S1..S13) si pertinente. */
  sourceCode?: string;
  recommendation: string;
}

export type Verdict = "ok" | "points_to_check" | "insufficient";

export interface PayslipControlInput {
  /** Salaire brut mensuel encodé (€). */
  grossMonthlySalary?: number | null;
  /** Net effectivement reçu / figurant sur la fiche (€). */
  netReceived?: number | null;
  /** Total des cotisations/retenues affichées (€). */
  contributionsShown?: number | null;
  /** Période (texte libre, ex. "Mai 2026"). */
  period?: string | null;
  regime?: "temps_plein" | "temps_partiel" | null;
  jointCommitteeNumber?: string | null;
  weeklyHours?: number | null;
  fullTimeReferenceHours?: number | null;
  /** Type de travailleur (employe, ouvrier, etudiant, flexi_job, …). */
  workerType?: string | null;
  /** Avantages déclarés (codes BENEFIT_TYPES). */
  benefits?: string[] | null;
  /** Montant de prime encodé (€). */
  prime?: number | null;
  /** Montant de pécule de vacances encodé (€). */
  pecule?: number | null;
  /** Remarque libre de l'utilisateur. */
  remarque?: string | null;
}

export interface PayslipControlResult {
  verdict: Verdict;
  findings: Finding[];
}

/** Écart relatif au-delà duquel on signale le net comme suspect. */
const NET_TOLERANCE = 0.15;

function isPositiveNumber(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Estime le net attendu à partir du brut encodé via le calculateur existant.
 * Hypothèses neutres (isolé, 0 enfant, Wallonie, pas de chèques-repas) : le but
 * est un ordre de grandeur pour repérer un écart FLAGRANT, pas un calcul exact.
 * Renvoie null si le brut est hors plage du calculateur.
 */
function estimateNet(gross: number): number | null {
  const res = calcBrutNet({
    brut: gross,
    statut: "isole",
    enfants: 0,
    region: "wallonie",
    chequesRepas: false,
  });
  if ("error" in res) return null;
  return res.net;
}

/**
 * Analyse les données encodées et renvoie un verdict + la liste des constats.
 *
 * Verdict :
 *  - "insufficient" : brut absent OU quasi aucune donnée exploitable ;
 *  - "points_to_check" : au moins un constat attention/critique ;
 *  - "ok" : aucune incohérence évidente.
 */
export function analysePayslip(input: PayslipControlInput): PayslipControlResult {
  const findings: Finding[] = [];

  const gross = isPositiveNumber(input.grossMonthlySalary) ? input.grossMonthlySalary : null;
  const net = isPositiveNumber(input.netReceived) ? input.netReceived : null;
  const weekly = isPositiveNumber(input.weeklyHours) ? input.weeklyHours : null;
  const reference = isPositiveNumber(input.fullTimeReferenceHours)
    ? input.fullTimeReferenceHours
    : null;
  const cp = typeof input.jointCommitteeNumber === "string" ? input.jointCommitteeNumber.trim() : "";
  const regime = input.regime ?? null;
  const workerType = input.workerType ?? null;
  const benefits = (input.benefits ?? []).filter((b) => typeof b === "string" && b.length > 0);

  // --- Données globalement exploitables ? ----------------------------------
  // On considère qu'il y a « assez » de données s'il y a au moins le brut +
  // un autre signal (net, CP, régime, horaire, type de travailleur).
  const otherSignals =
    (net !== null ? 1 : 0) +
    (cp ? 1 : 0) +
    (regime !== null ? 1 : 0) +
    (weekly !== null ? 1 : 0) +
    (workerType ? 1 : 0);

  // --- Constat : brut absent (CRITIQUE → insuffisant) ----------------------
  if (gross === null) {
    findings.push({
      level: "critique",
      code: "brut_absent",
      message:
        "Le salaire brut mensuel n'est pas renseigné : aucune vérification de cohérence chiffrée n'est possible.",
      recommendation:
        "Indiquez le salaire brut figurant sur la fiche de paie pour permettre un contrôle d'ordre de grandeur.",
    });
  }

  // --- Constat : commission paritaire absente (ATTENTION, S8) --------------
  if (!cp) {
    findings.push({
      level: "attention",
      code: "cp_absente",
      message:
        "Aucune commission paritaire renseignée : impossible de comparer le salaire au barème sectoriel minimum.",
      sourceCode: "S8",
      recommendation:
        "Renseignez la commission paritaire (CP) applicable pour vérifier le barème minimum du secteur.",
    });
    // S8 — coût employeur non fiabilisable sans CP (INFO).
    findings.push({
      level: "info",
      code: "cout_employeur_non_fiable",
      message:
        "Sans commission paritaire, le coût employeur global (charges patronales, primes sectorielles) ne peut pas être fiabilisé.",
      sourceCode: "S8",
      recommendation:
        "Pour une estimation de coût fiable, précisez la CP : elle conditionne les charges et avantages sectoriels.",
    });
  }

  // --- Constat : régime absent (ATTENTION) ---------------------------------
  if (regime === null) {
    findings.push({
      level: "attention",
      code: "regime_absent",
      message:
        "Le régime de travail (temps plein / temps partiel) n'est pas précisé : certaines vérifications restent partielles.",
      recommendation:
        "Précisez si le travailleur est à temps plein ou à temps partiel.",
    });
  }

  // --- Constat : incohérence temps plein / horaire (ATTENTION) -------------
  if (regime === "temps_plein" && weekly !== null && reference !== null && weekly < reference * 0.9) {
    findings.push({
      level: "attention",
      code: "incoherence_temps_plein",
      message: `Régime « temps plein » déclaré mais l'horaire encodé (${weekly} h/sem) est nettement inférieur à la référence temps plein (${reference} h/sem).`,
      recommendation:
        "Vérifiez le régime : un horaire sous la référence temps plein correspond généralement à un temps partiel.",
    });
  }

  // --- Constat : temps partiel sans horaire (ATTENTION, S6) ----------------
  if (regime === "temps_partiel" && weekly === null) {
    findings.push({
      level: "attention",
      code: "temps_partiel_sans_horaire",
      message:
        "Régime « temps partiel » mais aucun horaire hebdomadaire encodé : l'horaire est une mention obligatoire du contrat à temps partiel.",
      sourceCode: "S6",
      recommendation:
        "Indiquez le nombre d'heures par semaine : le contrat à temps partiel doit mentionner l'horaire précis.",
    });
  }

  // --- Constat : net très différent de l'estimation (ATTENTION) ------------
  if (gross !== null && net !== null) {
    const expected = estimateNet(gross);
    if (expected !== null && expected > 0) {
      const gap = Math.abs(net - expected) / expected;
      if (gap > NET_TOLERANCE) {
        findings.push({
          level: "attention",
          code: "net_incoherent",
          message: `Le net reçu encodé (${net.toFixed(2)} €) s'écarte fortement de l'estimation Docbel (~${expected.toFixed(0)} € pour un brut de ${gross.toFixed(0)} €).`,
          recommendation:
            "Vérifiez les retenues (ONSS, précompte) ou la présence d'éléments non encodés (prime, pécule, avantages, temps partiel). L'estimation est indicative.",
        });
      }
    }
  }

  // --- Constat : étudiant sans données de contrat (ATTENTION, S9) ----------
  if (workerType === "etudiant" && !cp && weekly === null) {
    findings.push({
      level: "attention",
      code: "etudiant_sans_contrat",
      message:
        "Travailleur étudiant sans données de contrat (ni CP ni horaire) : le contingent et les cotisations de solidarité ne peuvent pas être vérifiés.",
      sourceCode: "S9",
      recommendation:
        "Précisez l'horaire et la CP de l'étudiant pour vérifier le contingent annuel et la cotisation de solidarité.",
    });
  }

  // --- Constat : flexi sans mention de contrat-cadre (ATTENTION, S10) ------
  if (workerType === "flexi_job") {
    const remarque = (input.remarque ?? "").toLowerCase();
    const mentionsCadre = remarque.includes("contrat-cadre") || remarque.includes("contrat cadre");
    if (!mentionsCadre) {
      findings.push({
        level: "attention",
        code: "flexi_sans_contrat_cadre",
        message:
          "Travailleur flexi-job sans mention de contrat-cadre : un contrat-cadre écrit préalable est requis pour le régime flexi.",
        sourceCode: "S10",
        recommendation:
          "Confirmez l'existence d'un contrat-cadre flexi-job signé avant le début des prestations (mentionnez-le dans la remarque).",
      });
    }
  }

  // --- Constat : avantage déclaré mais non chiffré (INFO) ------------------
  const hasAmounts = isPositiveNumber(input.prime) || isPositiveNumber(input.pecule);
  if (benefits.length > 0 && !hasAmounts) {
    findings.push({
      level: "info",
      code: "avantage_non_pris_en_compte",
      message:
        "Des avantages sont déclarés mais aucun montant (prime, pécule) n'a été encodé : ils ne sont pas pris en compte dans l'estimation du net.",
      recommendation:
        "Encodez les montants des avantages/primes pour affiner la comparaison du net.",
    });
  }

  // --- Verdict -------------------------------------------------------------
  let verdict: Verdict;
  if (gross === null || otherSignals === 0) {
    verdict = "insufficient";
  } else if (findings.some((f) => f.level === "attention" || f.level === "critique")) {
    verdict = "points_to_check";
  } else {
    verdict = "ok";
    findings.push({
      level: "info",
      code: "aucune_incoherence",
      message: "Aucune incohérence évidente détectée.",
      recommendation:
        "Ce contrôle reste indicatif : seul un secrétariat social agréé certifie la conformité d'une fiche de paie.",
    });
  }

  return { verdict, findings };
}
