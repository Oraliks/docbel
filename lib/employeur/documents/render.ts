/**
 * Module 5 — Rendu texte FR des documents préparatoires.
 *
 * Fonctions PURES (aucun React / DB / server-only) : utilisables côté client
 * (aperçu live, presse-papier, mailto:) ET côté API (PDF). Chaque corps de texte
 * se termine par la ligne d'avertissement préparatoire obligatoire (spec §5).
 */

import {
  DOCUMENT_CONFIGS,
  labelFieldValue,
  type DocumentType,
  type DocumentValues,
} from "./types";

/**
 * Avertissement préparatoire repris en pied de chaque corps texte. Aligné sur
 * `PDF_DISCLAIMER` (export-checklist-pdf) sans en créer de dépendance ici, pour
 * garder ce module pur et utilisable côté client.
 */
const PREPARATORY_DISCLAIMER_LINE =
  "Document préparatoire généré par Docbel. À valider avant usage officiel. Les règles sociales peuvent dépendre de la situation exacte, de la commission paritaire, des conventions collectives, des statuts applicables et des mises à jour légales.";

function val(values: DocumentValues, key: string): string {
  return (values[key] ?? "").trim();
}

/** Formate une date ISO (yyyy-mm-dd) en jj/mm/aaaa, sinon renvoie la valeur brute. */
function formatDate(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Construit un bloc « clé : valeur » à partir des champs renseignés du type. */
function fieldLines(type: DocumentType, values: DocumentValues): string[] {
  const config = DOCUMENT_CONFIGS[type];
  const lines: string[] = [];
  for (const field of config.fields) {
    const raw = val(values, field.key);
    if (!raw) continue;
    const display = field.type === "date" ? formatDate(raw) : labelFieldValue(field, raw);
    lines.push(`- ${field.label} : ${display}`);
  }
  return lines;
}

function withDisclaimer(body: string): string {
  return `${body.trimEnd()}\n\n---\n${PREPARATORY_DISCLAIMER_LINE}\n`;
}

function nameOf(values: DocumentValues, ...keys: string[]): string {
  const parts = keys.map((k) => val(values, k)).filter(Boolean);
  return parts.join(" ").trim();
}

export function documentTitle(type: DocumentType, values: DocumentValues): string {
  const base = DOCUMENT_CONFIGS[type].label;
  switch (type) {
    case "fiche_travailleur": {
      const who = nameOf(values, "firstName", "lastName");
      return who ? `Fiche travailleur — ${who}` : base;
    }
    case "demande_secretariat": {
      const who = val(values, "workerName");
      return who ? `Demande secrétariat social — ${who}` : base;
    }
    case "prepa_contrat_etudiant": {
      const who = val(values, "studentName");
      return who ? `Préparation contrat étudiant — ${who}` : base;
    }
    case "prepa_flexi": {
      const who = val(values, "workerName");
      return who ? `Préparation flexi-job — ${who}` : base;
    }
    case "verif_bareme": {
      const fn = val(values, "functionTitle");
      return fn ? `Vérification barème — ${fn}` : base;
    }
    default:
      return base;
  }
}

export function buildDocumentText(type: DocumentType, values: DocumentValues): string {
  switch (type) {
    case "fiche_travailleur":
      return buildFicheTravailleur(values);
    case "demande_secretariat":
      return buildDemandeSecretariat(values);
    case "prepa_contrat_etudiant":
      return buildPrepaContratEtudiant(values);
    case "prepa_flexi":
      return buildPrepaFlexi(values);
    case "verif_bareme":
      return buildVerifBareme(values);
    default:
      return withDisclaimer("");
  }
}

function buildFicheTravailleur(values: DocumentValues): string {
  const lines = fieldLines("fiche_travailleur", values);
  const body = [
    "FICHE TRAVAILLEUR",
    "(données à transmettre au secrétariat social)",
    "",
    lines.length ? lines.join("\n") : "(aucune donnée renseignée pour le moment)",
  ].join("\n");
  return withDisclaimer(body);
}

function buildDemandeSecretariat(values: DocumentValues): string {
  const employer = val(values, "employerName") || "[votre organisation]";
  const contact = val(values, "contactName");
  const worker = val(values, "workerName") || "[identité du travailleur]";
  const ref = val(values, "employerRef");
  const startDate = formatDate(val(values, "startDate"));
  const contractType = labelFieldValue(
    DOCUMENT_CONFIGS.demande_secretariat.fields.find((f) => f.key === "contractType")!,
    val(values, "contractType")
  );
  const schedule = labelFieldValue(
    DOCUMENT_CONFIGS.demande_secretariat.fields.find((f) => f.key === "schedule")!,
    val(values, "schedule")
  );
  const hours = val(values, "weeklyHours");
  const salary = val(values, "grossSalary");
  const benefits = val(values, "benefits");
  const attachments = val(values, "attachments");
  const questions = val(values, "questions");

  const details: string[] = [];
  if (startDate) details.push(`- Date d'entrée prévue : ${startDate}`);
  if (contractType) details.push(`- Type de contrat : ${contractType}`);
  if (schedule) details.push(`- Régime horaire : ${schedule}`);
  if (hours) details.push(`- Horaire : ${hours} h/semaine`);
  if (salary) details.push(`- Salaire brut mensuel : ${salary} €`);
  if (benefits) details.push(`- Avantages prévus : ${benefits}`);

  const body = [
    "Bonjour,",
    "",
    `${employer}${ref ? ` (réf. ${ref})` : ""} souhaite préparer l'engagement de ${worker} et vous transmet les éléments suivants pour la mise en route :`,
    "",
    details.length ? details.join("\n") : "- (détails à compléter)",
    "",
    attachments ? `Pièces jointes : ${attachments}` : "Pièces jointes : (à préciser)",
    "",
    "Points à vérifier de votre côté :",
    questions
      ? questions
          .split("\n")
          .map((q) => `- ${q.trim()}`)
          .filter((q) => q !== "-")
          .join("\n")
      : "- Barème / commission paritaire applicable\n- Réductions de cotisations éventuelles",
    "",
    "Pourriez-vous nous confirmer ces éléments et nous indiquer les démarches restant à votre charge (Dimona, etc.) ?",
    "",
    "Merci d'avance,",
    contact || "[votre nom]",
  ].join("\n");
  return withDisclaimer(body);
}

function buildPrepaContratEtudiant(values: DocumentValues): string {
  const lines = fieldLines("prepa_contrat_etudiant", values);
  const body = [
    "PRÉPARATION — CONTRAT D'OCCUPATION D'ÉTUDIANT",
    "Ceci n'est PAS un contrat. C'est une fiche de préparation listant les",
    "mentions obligatoires à prévoir dans le contrat écrit (à conclure au plus tard",
    "au moment de l'entrée en service).",
    "",
    "Éléments réunis :",
    lines.length ? lines.join("\n") : "- (à compléter)",
    "",
    "Mentions obligatoires à prévoir dans le contrat écrit :",
    "- Identité et domicile des deux parties",
    "- Date de début et de fin de l'occupation",
    "- Lieu d'exécution du travail",
    "- Description concise de la fonction",
    "- Durée du travail et horaire",
    "- Rémunération convenue et modalités de paiement",
    "- Commission paritaire applicable",
    "- Lieu de logement si l'employeur s'est engagé à loger l'étudiant",
    "- Renvoi au règlement de travail",
    "",
    "À ne pas oublier : Dimona « STU » avant le début, et vérifier le contingent",
    "annuel (475 heures à cotisations réduites) via student@work.",
  ].join("\n");
  return withDisclaimer(body);
}

function buildPrepaFlexi(values: DocumentValues): string {
  const lines = fieldLines("prepa_flexi", values);
  const body = [
    "PRÉPARATION — FLEXI-JOB",
    "Ceci n'est PAS un contrat. C'est une fiche de préparation du contrat-cadre",
    "et des informations à réunir avant la première occupation.",
    "",
    "Éléments réunis :",
    lines.length ? lines.join("\n") : "- (à compléter)",
    "",
    "À prévoir / vérifier :",
    "- Conditions d'éligibilité du travailleur (occupation 4/5 chez un autre",
    "  employeur au trimestre de référence, ou pensionné)",
    "- Secteur autorisé pour les flexi-jobs (selon la commission paritaire)",
    "- Contrat-cadre écrit conclu AVANT la première occupation",
    "- Contrat de travail flexi (oral ou écrit selon la durée)",
    "- Flexi-salaire ≥ minimum légal indexé, + flexi-pécule de vacances",
    "- Dimona spécifique flexi avant chaque occupation",
  ].join("\n");
  return withDisclaimer(body);
}

function buildVerifBareme(values: DocumentValues): string {
  const employer = val(values, "employerName") || "[votre organisation]";
  const fn = val(values, "functionTitle");
  const workerType = labelFieldValue(
    DOCUMENT_CONFIGS.verif_bareme.fields.find((f) => f.key === "workerType")!,
    val(values, "workerType")
  );
  const cp = val(values, "jointCommittee");
  const experience = val(values, "experience");
  const schedule = labelFieldValue(
    DOCUMENT_CONFIGS.verif_bareme.fields.find((f) => f.key === "schedule")!,
    val(values, "schedule")
  );
  const salary = val(values, "currentSalary");
  const question = val(values, "question");

  const details: string[] = [];
  if (fn) details.push(`- Fonction : ${fn}`);
  if (workerType) details.push(`- Type de travailleur : ${workerType}`);
  if (cp) details.push(`- Commission paritaire supposée : ${cp}`);
  if (experience) details.push(`- Ancienneté / expérience : ${experience}`);
  if (schedule) details.push(`- Régime horaire : ${schedule}`);
  if (salary) details.push(`- Salaire envisagé : ${salary} €`);

  const body = [
    "Bonjour,",
    "",
    `Pour ${employer}, pourriez-vous nous aider à vérifier le barème et la commission paritaire applicables au profil suivant ?`,
    "",
    details.length ? details.join("\n") : "- (détails à compléter)",
    "",
    question
      ? `Question : ${question}`
      : "Question : le barème minimum prévu par la commission paritaire est-il respecté pour cette fonction ?",
    "",
    "Merci d'avance pour votre confirmation.",
  ].join("\n");
  return withDisclaimer(body);
}
