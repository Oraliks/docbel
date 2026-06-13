import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FolderOpen,
  CalendarDays,
  CalendarClock,
  TriangleAlert,
  FileCheck2,
  FileText,
  Check,
  Scale,
  ArrowRight,
  Info,
  Plus,
  Pencil,
  Trash2,
  Send,
  Activity,
  ShieldCheck,
  Users,
  ListChecks,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import {
  getEmployerDashboard,
  type ActivityIcon,
  type DashboardAlert,
} from "@/lib/employeur/dashboard/overview";
import { QuickCost } from "@/components/docbel/employeur/cost/quick-cost";
import { QuickActions } from "@/components/docbel/employeur/quick-actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tableau de bord | Espace Employeur",
  description: "Gérez vos obligations sociales en toute sérénité.",
};

export const dynamic = "force-dynamic";

const PANEL = "rounded-xl border border-border bg-card";

const KPI_TONE: Record<string, string> = {
  violet: "bg-primary/10 text-primary",
  sky: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  red: "bg-destructive/10 text-destructive",
};

const ACTIVITY_ICONS: Record<ActivityIcon, typeof FileText> = {
  plus: Plus,
  edit: Pencil,
  send: Send,
  trash: Trash2,
  activity: Activity,
};

function alertVisual(level: DashboardAlert["level"]) {
  if (level === "critical") return { Icon: TriangleAlert, color: "text-destructive" };
  if (level === "warning") return { Icon: CalendarClock, color: "text-amber-600 dark:text-amber-400" };
  return { Icon: Info, color: "text-blue-600 dark:text-blue-400" };
}

function PanelHead({ title, href, action }: { title: string; href?: string; action?: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {action && href ? (
        <Link href={href} className="flex items-center gap-1 text-xs text-primary no-underline hover:underline">
          {action} <ArrowRight className="size-3" />
        </Link>
      ) : null}
    </div>
  );
}

function EmptyState({ icon: Icon, children }: { icon: typeof FileText; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-background/50 px-4 py-8 text-center">
      <Icon className="size-6 text-muted-foreground/60" />
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}

export default async function EmployeurDashboard() {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const data = await getEmployerDashboard(user.id);
  const { identity, kpis, socialDeadlines, alerts, recentDossiers, recentActivity, cost, resume } = data;

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      {/* ============================== HERO ============================== */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/12 via-card to-pink-500/8 p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">Bonjour, {identity.firstName} 👋</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Bienvenue dans votre{" "}
            <span className="bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
              Espace Employeur
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Gérez vos obligations sociales en Belgique simplement, avec des outils fiables, à jour et pensés pour vous.
          </p>
        </div>

        {/* Illustration glass décorative (cachée < lg) */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-6 hidden w-80 items-center lg:flex">
          <div className="relative size-full">
            <div className="absolute right-40 top-1/2 flex size-24 -translate-y-[70%] rotate-[-8deg] items-center justify-center rounded-2xl border border-primary/20 bg-primary/15 shadow-lg backdrop-blur-sm">
              <Users className="size-10 text-primary" />
            </div>
            <div className="absolute right-12 top-1/2 flex size-28 -translate-y-1/2 rotate-[7deg] items-center justify-center rounded-2xl border border-primary/20 bg-card/70 shadow-xl backdrop-blur-sm">
              <ListChecks className="size-12 text-primary" />
            </div>
            <div className="absolute right-44 top-1/2 flex size-16 translate-y-[60%] rotate-[10deg] items-center justify-center rounded-2xl border border-pink-500/20 bg-pink-500/15 shadow-lg backdrop-blur-sm">
              <Check className="size-8 text-pink-500" />
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={FolderOpen} tone="violet" value={String(kpis.activeDossiers)} label="Dossiers actifs" href="/employeur/dossiers" sub="Voir mes dossiers" />
        <Kpi icon={CalendarClock} tone="sky" value={String(kpis.deadlinesThisWeek)} label="Échéances cette semaine" href="/employeur/dossiers" sub="Débuts de contrat à venir" />
        <Kpi icon={FileCheck2} tone="emerald" value={String(kpis.documentsReady)} label="Documents préparés" href="/employeur/documents" sub="Consulter / télécharger" />
        <Kpi icon={TriangleAlert} tone="red" value={String(kpis.alertsCount)} label="Alertes" href="/employeur/dossiers" sub="Actions à vérifier" />
      </div>

      {/* Row 1 — Calendrier social · Simulateur (rapide) · Actions rapides */}
      <div className="grid items-start gap-4 xl:grid-cols-3">
        {/* Calendrier social — échéances récurrentes (ONSS / précompte / TVA) */}
        <div className={PANEL}>
          <div className="flex items-center justify-between px-4 pt-4">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CalendarDays className="size-4" />
              </span>
              <h2 className="text-sm font-semibold">Calendrier social</h2>
            </div>
            <Link href="/employeur/calendrier" className="flex items-center gap-1 text-xs text-primary no-underline hover:underline">
              Voir tout <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="space-y-1.5 p-4 pt-3">
            {socialDeadlines.map((d) => (
              <div key={d.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-background p-2">
                <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md bg-muted leading-none">
                  <span className="text-sm font-bold">{d.day}</span>
                  <span className="text-[9px] uppercase text-muted-foreground">{d.month}</span>
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{d.shortTitle}</p>
                <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              </div>
            ))}
            <p className="pt-1 text-[10px] leading-snug text-muted-foreground">
              Dates indicatives (régime trimestriel) — sources sur le calendrier.
            </p>
          </div>
        </div>

        {/* Simulateur de coût — bloc interactif (simulation rapide) */}
        <div className={PANEL}>
          <QuickCost
            title={cost.title}
            isExample={cost.isExample}
            initialGross={cost.gross}
            initialRegime={cost.regimeInit}
            initialWorkerType={cost.workerTypeInit}
          />
        </div>

        {/* Actions rapides — recherche fonctionnelle + grille de tuiles */}
        <div className={PANEL}>
          <QuickActions dossiersBadge={kpis.activeDossiers} />
        </div>
      </div>

      {/* Row 2 — Alertes · Dossiers récents · Reprendre un engagement */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Alerts */}
        <div className={PANEL}>
          <PanelHead title="Alertes & actions requises" href="/employeur/dossiers" action={alerts.length ? "Voir tout" : undefined} />
          <div className="space-y-2 p-5 pt-3">
            {alerts.length === 0 ? (
              <EmptyState icon={ShieldCheck}>
                Aucune alerte. Vos dossiers ne signalent aucune action requise.
              </EmptyState>
            ) : (
              alerts.slice(0, 4).map((a) => {
                const { Icon, color } = alertVisual(a.level);
                return (
                  <Link
                    key={a.id}
                    href={a.href}
                    className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 no-underline transition-colors hover:border-primary/40"
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", color)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
                    </div>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Recent dossiers */}
        <div className={PANEL}>
          <PanelHead title="Mes dossiers récents" href="/employeur/dossiers" action={recentDossiers.length ? "Voir tous" : undefined} />
          <div className="px-5 pt-2 pb-3">
            {recentDossiers.length === 0 ? (
              <div className="py-3">
                <EmptyState icon={FolderOpen}>Aucun dossier pour le moment.</EmptyState>
                <Link
                  href="/employeur/nouveau-dossier"
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground no-underline"
                >
                  Créer mon premier dossier <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentDossiers.map((d) => (
                  <Link
                    key={d.id}
                    href={`/employeur/dossiers/${d.id}`}
                    className="flex items-center gap-3 py-2.5 no-underline"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs text-foreground">
                      {d.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.role}</p>
                    </div>
                    <Badge variant={d.tone}>{d.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resume / start engagement */}
        <div className={PANEL}>
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 className="text-sm font-semibold">{resume ? "Reprendre un engagement" : "Démarrer un engagement"}</h2>
            {resume ? (
              <span className="text-xs text-muted-foreground">
                {resume.doneItems}/{resume.totalItems} étapes
              </span>
            ) : null}
          </div>
          <div className="space-y-4 p-5 pt-3">
            {resume ? (
              <>
                <div>
                  <p className="truncate text-sm font-medium">{resume.title}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${resume.pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{resume.pct}% de la checklist complétée</p>
                </div>
                {resume.nextItem ? (
                  <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Prochaine étape</p>
                      <p className="text-sm">{resume.nextItem}</p>
                    </div>
                  </div>
                ) : null}
                <Link
                  href={`/employeur/dossiers/${resume.scenarioId}`}
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground no-underline"
                >
                  Continuer <ArrowRight className="size-3.5" />
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  L&apos;assistant « Puis-je engager ? » vous guide pas à pas et génère la checklist de votre engagement.
                </p>
                <Link
                  href="/employeur/nouveau-dossier"
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground no-underline"
                >
                  Démarrer <ArrowRight className="size-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 3 — Activité · Veille */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Activity */}
        <div className={PANEL}>
          <PanelHead title="Activité récente" />
          <div className="px-5 pt-2 pb-3">
            {recentActivity.length === 0 ? (
              <div className="py-3">
                <EmptyState icon={Activity}>
                  Aucune activité récente. Vos actions (dossiers, documents, simulations) apparaîtront ici.
                </EmptyState>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentActivity.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.icon];
                  return (
                    <div key={a.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          {a.text} {a.detail ? <span className="text-muted-foreground">— {a.detail}</span> : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{a.when}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Veille (informatif, vers bibliothèque) */}
        <div className={PANEL}>
          <PanelHead title="Veille & conformité" href="/employeur/bibliotheque" action="Bibliothèque" />
          <div className="flex items-start gap-4 p-5 pt-3">
            <div className="min-w-0 flex-1">
              <Badge variant="secondary">Sources officielles</Badge>
              <p className="mt-2 font-medium">Démarches expliquées, à jour et sourcées</p>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Dimona, DmfA, commissions paritaires, salaire minimum, contrats étudiant et flexi-job — chaque
                fiche renvoie aux textes officiels (ONSS, SPF Emploi…).
              </p>
              <Link
                href="/employeur/bibliotheque"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary no-underline hover:underline"
              >
                Parcourir la bibliothèque <ArrowRight className="size-3" />
              </Link>
            </div>
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Scale className="size-6" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  tone,
  value,
  label,
  sub,
  href,
}: {
  icon: typeof FolderOpen;
  tone: "violet" | "sky" | "emerald" | "red";
  value: string;
  label: string;
  sub: string;
  href: string;
}) {
  return (
    <Link href={href} className={cn(PANEL, "flex items-center justify-between p-5 no-underline transition-colors hover:border-primary/40")}>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-primary">{sub}</p>
      </div>
      <span className={cn("flex size-12 items-center justify-center rounded-xl", KPI_TONE[tone])}>
        <Icon className="size-6" />
      </span>
    </Link>
  );
}
