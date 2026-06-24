/**
 * Agrégateur de données pour le tableau de bord employeur (`/employeur`).
 *
 * Tout ce qui est affiché ici est dérivé des **outils déjà disponibles** (pas de
 * nouveau modèle) :
 *  - WorkerScenario (+ EmployerChecklist/ChecklistItem) → dossiers, échéances,
 *    alertes, reprise d'engagement ;
 *  - CostSimulation → snapshot du simulateur de coût (dernière simulation) ;
 *  - DocumentDraft → compteur de documents préparés ;
 *  - Activity (resource "employer") → activité récente.
 *
 * Aucune donnée factice : les widgets sans donnée renvoient des listes vides /
 * des compteurs à 0, et la page affiche alors un état vide explicite.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import type { StoredAlert } from "../service";
import {
  estimateEmployerCost,
  type EmployerCostResult,
} from "../cost/engine";
import {
  labelScenarioStatus,
  labelWorkerType,
  keyScenarioStatus,
  keyWorkerType,
} from "../constants";
import { getUpcomingSocialDeadlines } from "../calendar/social-deadlines";

export type BadgeTone =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "info"
  | "warning"
  | "outline";

/** Jeton d'icône (résolu en composant lucide côté page). */
export type ActivityIcon = "plus" | "edit" | "send" | "trash" | "activity";

export interface DashboardIdentity {
  /** Prénom pour le bonjour ("Bonjour, Sophie"). */
  firstName: string;
  fullName: string;
  organisationName: string | null;
  vatNumber: string | null;
  initials: string;
}

export interface DashboardKpis {
  /** Scénarios non archivés. */
  activeDossiers: number;
  /** Échéances (débuts de contrat planifiés) dans les 7 prochains jours. */
  deadlinesThisWeek: number;
  /** Documents préparés (DocumentDraft). */
  documentsReady: number;
  /** Alertes moteur + scénarios à valider. */
  alertsCount: number;
}

export interface DashboardDeadline {
  id: string;
  scenarioId: string;
  day: string;
  /** Code mois (jan/feb/.../dec) — utilisable avec la clé i18n `dashboard.monthShort.<code>`. */
  monthCode?: string;
  month: string;
  title: string;
  sub: string;
  /** Clé i18n optionnelle pour `sub` (avec param `role`). */
  subKey?: string;
  /** Paramètres pour résoudre `subKey`. */
  subParams?: { role: string };
  /** Clé i18n optionnelle pour le `role` lui-même. */
  roleKey?: string;
  tag: string;
  /** Clé i18n optionnelle pour le tag (overdue/today/inDays). */
  tagKey?: string;
  /** Paramètres pour résoudre `tagKey`. */
  tagParams?: { days: number };
  tone: BadgeTone;
  /** Jours avant échéance (négatif = dépassé). */
  daysUntil: number;
}

export interface DashboardAlert {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  /** Clé i18n optionnelle pour `title` (utilisée pour les alertes générées). */
  titleKey?: string;
  sub: string;
  /** Clé i18n optionnelle pour `sub`. */
  subKey?: string;
  /** Paramètres ICU pour `subKey`/`titleKey`. */
  subParams?: { title: string };
  href: string;
}

/** Échéance sociale/fiscale récurrente (calendrier social), formatée pour l'UI. */
export interface DashboardSocialDeadline {
  id: string;
  day: string;
  monthCode?: string;
  month: string;
  title: string;
  /** Clé i18n optionnelle du titre. */
  titleKey?: string;
  /** Paramètres ICU pour `titleKey`. */
  titleParams?: { quarter: number; year: number };
  /** Libellé court pour les blocs étroits, ex. « TVA · T2 2026 ». */
  shortTitle: string;
  /** Clé i18n optionnelle pour le format court. */
  shortTitleKey?: string;
  /** Paramètres ICU pour `shortTitleKey`. */
  shortTitleParams?: { category: string; quarter: number; year: number };
  category: string;
  /** Clé i18n optionnelle pour la catégorie. */
  categoryKey?: string;
  note?: string;
  /** Clé i18n optionnelle de la note. */
  noteKey?: string;
  sourceUrl?: string;
  daysUntil: number;
}

export interface DashboardDossier {
  id: string;
  name: string;
  role: string;
  /** Clé i18n optionnelle du rôle (workerType). */
  roleKey?: string;
  status: string;
  /** Clé i18n optionnelle du statut (scenarioStatus). */
  statusKey?: string;
  tone: BadgeTone;
  date: string;
}

export interface DashboardActivity {
  id: string;
  icon: ActivityIcon;
  text: string;
  /** Clé i18n optionnelle du texte (action). */
  textKey?: string;
  detail: string | null;
  when: string;
  /** Clé i18n optionnelle pour la chaîne `when` (relativeWhen). */
  whenKey?: string;
  /** Paramètres ICU pour `whenKey`. */
  whenParams?: { time: string; date?: string };
}

export interface DashboardCost {
  title: string;
  /** Clé i18n optionnelle pour `title` (utilisée pour l'exemple par défaut). */
  titleKey?: string;
  gross: number;
  contributions: number;
  other: number;
  total: number;
  regimeLabel: string;
  /** Clé i18n optionnelle pour `regimeLabel`. */
  regimeLabelKey?: string;
  workerTypeLabel: string;
  /** Clé i18n optionnelle pour `workerTypeLabel`. */
  workerTypeLabelKey?: string;
  /** Valeurs initiales (codes) pour pré-remplir le mini-simulateur interactif. */
  regimeInit: "temps_plein" | "temps_partiel";
  workerTypeInit: string;
  /** true si aucune simulation sauvegardée → exemple par défaut. */
  isExample: boolean;
}

export interface DashboardResume {
  scenarioId: string;
  title: string;
  totalItems: number;
  doneItems: number;
  pct: number;
  nextItem: string | null;
}

export interface EmployerDashboardData {
  identity: DashboardIdentity;
  kpis: DashboardKpis;
  deadlines: DashboardDeadline[];
  socialDeadlines: DashboardSocialDeadline[];
  alerts: DashboardAlert[];
  recentDossiers: DashboardDossier[];
  recentActivity: DashboardActivity[];
  cost: DashboardCost;
  resume: DashboardResume | null;
  /** Le compte a-t-il au moins un scénario ? (sinon : état "premier pas"). */
  hasScenarios: boolean;
}

const MONTHS_FR = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEP", "OCT", "NOV", "DÉC"];

/** Code de mois (jan..dec) — utilisable pour résoudre `dashboard.monthShort.<code>`. */
const MONTH_CODES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "secondary",
  ready: "success",
  exported: "info",
  archived: "outline",
};

const SEVERITY_LEVEL: Record<string, DashboardAlert["level"]> = {
  info: "info",
  warning: "warning",
  critical: "critical",
};

const REGIME_LABEL: Record<string, string> = {
  temps_plein: "Temps plein",
  temps_partiel: "Temps partiel",
};

const REGIME_LABEL_KEY: Record<string, string> = {
  temps_plein: "public.employeurLib.dashboard.regimeLabel.temps_plein",
  temps_partiel: "public.employeurLib.dashboard.regimeLabel.temps_partiel",
};

function initialsFrom(name: string, org: string | null): string {
  const base = (name || org || "").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

function deadlineTag(days: number): {
  tag: string;
  tagKey: string;
  tagParams?: { days: number };
  tone: BadgeTone;
} {
  if (days < 0) {
    return {
      tag: "Dépassé",
      tagKey: "public.employeurLib.dashboard.deadline.overdue",
      tone: "destructive",
    };
  }
  if (days === 0) {
    return {
      tag: "Aujourd'hui",
      tagKey: "public.employeurLib.dashboard.deadline.today",
      tone: "destructive",
    };
  }
  if (days <= 2) {
    return {
      tag: `Dans ${days} j`,
      tagKey: "public.employeurLib.dashboard.deadline.inDays",
      tagParams: { days },
      tone: "warning",
    };
  }
  if (days <= 7) {
    return {
      tag: `Dans ${days} j`,
      tagKey: "public.employeurLib.dashboard.deadline.inDays",
      tagParams: { days },
      tone: "info",
    };
  }
  return {
    tag: `Dans ${days} j`,
    tagKey: "public.employeurLib.dashboard.deadline.inDays",
    tagParams: { days },
    tone: "secondary",
  };
}

const ACTION_LABEL: Record<string, string> = {
  created: "Élément créé",
  created_bulk: "Éléments créés",
  updated: "Élément mis à jour",
  deleted: "Élément supprimé",
  exported: "Document exporté",
  published: "Document envoyé",
  synced: "Synchronisation",
  received: "Reçu",
};

const ACTION_LABEL_KEY: Record<string, string> = {
  created: "public.employeurLib.dashboard.actionLabel.created",
  created_bulk: "public.employeurLib.dashboard.actionLabel.created_bulk",
  updated: "public.employeurLib.dashboard.actionLabel.updated",
  deleted: "public.employeurLib.dashboard.actionLabel.deleted",
  exported: "public.employeurLib.dashboard.actionLabel.exported",
  published: "public.employeurLib.dashboard.actionLabel.published",
  synced: "public.employeurLib.dashboard.actionLabel.synced",
  received: "public.employeurLib.dashboard.actionLabel.received",
};

const ACTION_ICON: Record<string, ActivityIcon> = {
  created: "plus",
  created_bulk: "plus",
  updated: "edit",
  deleted: "trash",
  exported: "send",
  published: "send",
};

function relativeWhen(now: Date, d: Date): {
  text: string;
  key: string;
  params: { time: string; date?: string };
} {
  const diff = daysBetween(d, now);
  const time = d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) {
    return {
      text: `Aujourd'hui à ${time}`,
      key: "public.employeurLib.dashboard.relativeWhen.today",
      params: { time },
    };
  }
  if (diff === 1) {
    return {
      text: `Hier à ${time}`,
      key: "public.employeurLib.dashboard.relativeWhen.yesterday",
      params: { time },
    };
  }
  const date = d.toLocaleDateString("fr-BE");
  return {
    text: `${date} à ${time}`,
    key: "public.employeurLib.dashboard.relativeWhen.onDate",
    params: { time, date },
  };
}

/** Données complètes du tableau de bord pour un employeur (un seul aller-retour logique). */
export async function getEmployerDashboard(userId: string): Promise<EmployerDashboardData> {
  const now = new Date();

  const [user, profile, scenarios, documentsReady, lastSim, activities] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, vatNumber: true },
    }),
    prisma.employerProfile.findFirst({
      where: { userId },
      select: { organisationName: true },
    }),
    prisma.workerScenario.findMany({
      where: { employerProfile: { userId } },
      orderBy: { updatedAt: "desc" },
      include: {
        checklists: {
          orderBy: { generatedAt: "desc" },
          take: 1,
          include: { items: { orderBy: { order: "asc" } } },
        },
      },
    }),
    prisma.documentDraft.count({ where: { userId } }),
    prisma.costSimulation.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activity.findMany({
      where: { user: userId, resource: "employer" },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const fullName = user?.name?.trim() || profile?.organisationName || "Employeur";
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const identity: DashboardIdentity = {
    firstName,
    fullName,
    organisationName: profile?.organisationName ?? null,
    vatNumber: user?.vatNumber ?? null,
    initials: initialsFrom(user?.name ?? "", profile?.organisationName ?? null),
  };

  // --- Échéances : débuts de contrat planifiés à venir (donnée réelle) -------
  const deadlines: DashboardDeadline[] = scenarios
    .filter((s) => s.plannedStartDate && s.status !== "archived")
    .map((s) => {
      const due = s.plannedStartDate as Date;
      const days = daysBetween(now, due);
      const { tag, tagKey, tagParams, tone } = deadlineTag(days);
      const role = labelWorkerType(s.workerType);
      return {
        id: s.id,
        scenarioId: s.id,
        day: String(due.getDate()).padStart(2, "0"),
        monthCode: MONTH_CODES[due.getMonth()],
        month: MONTHS_FR[due.getMonth()],
        title: s.title,
        sub: `${role} — début de contrat prévu`,
        subKey: "public.employeurLib.dashboard.deadlineSubContract",
        subParams: { role },
        roleKey: keyWorkerType(s.workerType),
        tag,
        tagKey,
        tagParams,
        tone,
        daysUntil: days,
      };
    })
    .filter((d) => d.daysUntil >= -7)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  // --- Calendrier social : échéances récurrentes belges (ONSS/précompte/TVA) --
  const socialDeadlines: DashboardSocialDeadline[] = getUpcomingSocialDeadlines(now, 4).map((s) => {
    const due = new Date(`${s.date}T12:00:00`);
    const period = s.title.match(/T[1-4]\s?\d{4}/)?.[0] ?? "";
    return {
      id: s.id,
      day: String(due.getDate()).padStart(2, "0"),
      monthCode: MONTH_CODES[due.getMonth()],
      month: MONTHS_FR[due.getMonth()],
      title: s.title,
      titleKey: s.titleKey,
      titleParams: s.titleParams,
      shortTitle: period ? `${s.category} · ${period}` : s.category,
      shortTitleKey: s.titleParams ? "public.employeurLib.calendar.shortFormat" : undefined,
      shortTitleParams: s.titleParams
        ? { category: s.category, quarter: s.titleParams.quarter, year: s.titleParams.year }
        : undefined,
      category: s.category,
      categoryKey: s.categoryKey,
      note: s.note,
      noteKey: s.noteKey,
      sourceUrl: s.sourceUrl,
      daysUntil: daysBetween(now, due),
    };
  });

  // --- Alertes : snapshot moteur + scénarios à valider -----------------------
  const alerts: DashboardAlert[] = [];
  for (const s of scenarios) {
    if (s.status === "archived") continue;
    const stored = (s.alerts ?? []) as unknown as StoredAlert[];
    if (Array.isArray(stored)) {
      for (const [i, a] of stored.entries()) {
        if (!a?.message) continue;
        alerts.push({
          id: `${s.id}-${i}`,
          level: SEVERITY_LEVEL[a.severity] ?? "info",
          title: a.message,
          sub: s.title,
          href: `/employeur/dossiers/${s.id}`,
        });
      }
    }
    if (s.reliabilityScore === "needs_human_validation") {
      alerts.push({
        id: `${s.id}-reliability`,
        level: "warning",
        title: "Dossier à faire valider",
        titleKey: "public.employeurLib.dashboard.alertNeedsValidationTitle",
        sub: `${s.title} — fiabilité à confirmer`,
        subKey: "public.employeurLib.dashboard.alertNeedsValidationSub",
        subParams: { title: s.title },
        href: `/employeur/dossiers/${s.id}`,
      });
    }
  }
  // Critiques d'abord.
  const levelRank: Record<DashboardAlert["level"], number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => levelRank[a.level] - levelRank[b.level]);

  // --- Dossiers récents ------------------------------------------------------
  const recentDossiers: DashboardDossier[] = scenarios.slice(0, 5).map((s) => ({
    id: s.id,
    name: s.title,
    role: labelWorkerType(s.workerType),
    roleKey: keyWorkerType(s.workerType),
    status: labelScenarioStatus(s.status),
    statusKey: keyScenarioStatus(s.status),
    tone: STATUS_TONE[s.status] ?? "secondary",
    date: new Date(s.updatedAt).toLocaleDateString("fr-BE"),
  }));

  // --- Activité récente ------------------------------------------------------
  const recentActivity: DashboardActivity[] = activities.map((a) => {
    const when = relativeWhen(now, new Date(a.createdAt));
    return {
      id: a.id,
      icon: ACTION_ICON[a.action] ?? "activity",
      text: ACTION_LABEL[a.action] ?? "Activité",
      textKey: ACTION_LABEL_KEY[a.action] ?? "public.employeurLib.dashboard.actionLabel.activity",
      detail: a.resourceName || a.details || null,
      when: when.text,
      whenKey: when.key,
      whenParams: when.params,
    };
  });

  // --- Snapshot simulateur de coût -------------------------------------------
  let cost: DashboardCost;
  if (lastSim) {
    const gross = lastSim.grossMonthlySalary;
    const contributions = lastSim.estimatedEmployerContributions;
    const total = lastSim.estimatedMonthlyEmployerCost;
    const inp = (lastSim.inputs ?? {}) as { regime?: string; workerType?: string };
    const regimeCode = inp.regime === "temps_partiel" ? "temps_partiel" : "temps_plein";
    cost = {
      title: lastSim.title,
      gross,
      contributions,
      other: Math.max(0, Math.round((total - gross - contributions) * 100) / 100),
      total,
      regimeLabel: REGIME_LABEL[inp.regime ?? ""] ?? "Temps plein",
      regimeLabelKey: REGIME_LABEL_KEY[regimeCode],
      workerTypeLabel: labelWorkerType(inp.workerType) || "Employé",
      workerTypeLabelKey: keyWorkerType(inp.workerType ?? "employe"),
      regimeInit: regimeCode,
      workerTypeInit: inp.workerType ?? "employe",
      isExample: false,
    };
  } else {
    const example: EmployerCostResult = estimateEmployerCost({
      grossMonthlySalary: 3000,
      regime: "temps_plein",
      workerType: "employe",
      contractType: "cdi",
      jointCommitteeNumber: "200",
    });
    const gross = 3000;
    const contributions = example.estimatedEmployerContributions;
    const total = example.estimatedMonthlyEmployerCost;
    cost = {
      title: "Exemple — employé temps plein",
      titleKey: "public.employeurLib.dashboard.exampleTitle",
      gross,
      contributions,
      other: Math.max(0, Math.round((total - gross - contributions) * 100) / 100),
      total,
      regimeLabel: "Temps plein",
      regimeLabelKey: REGIME_LABEL_KEY["temps_plein"],
      workerTypeLabel: "Employé",
      workerTypeLabelKey: keyWorkerType("employe"),
      regimeInit: "temps_plein",
      workerTypeInit: "employe",
      isExample: true,
    };
  }

  // --- Reprise d'engagement : dernier brouillon + avancement checklist -------
  let resume: DashboardResume | null = null;
  const draft = scenarios.find((s) => s.status === "draft");
  if (draft) {
    const items = draft.checklists[0]?.items ?? [];
    const total = items.length;
    const done = items.filter((it) => it.status === "done" || it.status === "not_applicable").length;
    const next = items.find((it) => it.status === "todo" || it.status === "in_progress");
    resume = {
      scenarioId: draft.id,
      title: draft.title,
      totalItems: total,
      doneItems: done,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      nextItem: next?.title ?? null,
    };
  }

  const deadlinesThisWeek = deadlines.filter((d) => d.daysUntil >= 0 && d.daysUntil <= 7).length;

  const kpis: DashboardKpis = {
    activeDossiers: scenarios.filter((s) => s.status !== "archived").length,
    deadlinesThisWeek,
    documentsReady,
    alertsCount: alerts.length,
  };

  return {
    identity,
    kpis,
    deadlines,
    socialDeadlines,
    alerts,
    recentDossiers,
    recentActivity,
    cost,
    resume,
    hasScenarios: scenarios.length > 0,
  };
}
