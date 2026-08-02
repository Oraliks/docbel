// Liste des tâches planifiées, DÉRIVÉE de `vercel.json`.
//
// Elle était recopiée à la main dans `/admin/monitoring` : six entrées pour les
// treize crons réellement déclarés. Sept tâches — dont la purge RGPD des
// dossiers et les cinq crons de la plateforme de rendez-vous — tournaient donc
// sans apparaître nulle part, et l'écran de monitoring affirmait le contraire.
//
// Vercel n'expose pas d'API d'état d'exécution : ce qu'on montre reste le
// PLANNING, pas le dernier résultat. Mais le planning, lui, ne peut plus mentir.

import vercelConfig from "@/vercel.json";

export interface CronPlanifie {
  path: string;
  /// Expression cron, telle que Vercel la reçoit.
  schedule: string;
  /// Libellé lisible. Repli sur le chemin quand la tâche n'a pas encore été
  /// nommée : un cron sans libellé s'affiche quand même, ce qui est le but.
  label: string;
}

/// Libellés connus. Une entrée manquante n'est pas une erreur — c'est la
/// prochaine tâche ajoutée à `vercel.json`, qui apparaîtra sous son chemin en
/// attendant qu'on la nomme.
const LIBELLES: Readonly<Record<string, string>> = {
  "/api/cron/health-snapshot": "Instantané de santé",
  "/api/documents/cron/purge": "Purge dossiers (RGPD)",
  "/api/admin/pdf/cron/purge-drafts": "Purge brouillons PDF",
  "/api/inbox/sync": "Synchro inbox IMAP",
  "/api/chomage-ia/ingestion/cron": "Veille / ingestion IA",
  "/api/chomage-ia/sources/cron-obsolescence": "Obsolescence sources IA",
  "/api/cron/kbo-refresh": "Rafraîchissement KBO",
  "/api/cron/booking-auto-approve": "RDV — validation automatique",
  "/api/cron/booking-reminders": "RDV — rappels",
  "/api/cron/booking-purge": "RDV — purge",
  "/api/cron/booking-no-show-followup": "RDV — suivi des absences",
  "/api/cron/booking-waitlist": "RDV — liste d'attente",
  "/api/cron/bundle-runs-purge": "Purge démarches abandonnées (RGPD)",
};

/// Fonction PURE, pour que la dérivation soit testable sans lire le disque.
export function listerCrons(
  config: { crons?: readonly { path: string; schedule: string }[] },
  libelles: Readonly<Record<string, string>> = LIBELLES,
): CronPlanifie[] {
  return (config.crons ?? []).map((c) => ({
    path: c.path,
    schedule: c.schedule,
    label: libelles[c.path] ?? c.path,
  }));
}

/// Les crons du déploiement courant.
export const CRONS_PLANIFIES: CronPlanifie[] = listerCrons(vercelConfig);
