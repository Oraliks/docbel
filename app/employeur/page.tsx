import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FolderOpen,
  ClipboardList,
  FileText,
  BookOpen,
  Calculator,
  Send,
  Search,
  CalendarDays,
  CalendarClock,
  TriangleAlert,
  FileCheck2,
  Check,
  Scale,
  ArrowRight,
  Info,
  Plus,
  Pencil,
  Trash2,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import {
  getEmployerDashboard,
  type ActivityIcon,
  type DashboardAlert,
} from "@/lib/employeur/dashboard/overview";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tableau de bord | Espace Employeur",
  description: "Gérez vos obligations sociales en toute sérénité.",
};

export const dynamic = "force-dynamic";

const eur = (n: number) =>
  `${n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// Toutes les tuiles mènent à une page RÉELLE (aucun lien mort). `badge` = clé de
// compteur réel résolue au rendu (cf. quickBadge).
const QUICK = [
  { id: "cout", label: "Simuler un coût", href: "/employeur/simulateur-cout", icon: Calculator },
  { id: "engagement", label: "Préparer un engagement", href: "/employeur/nouveau-dossier", icon: ClipboardList },
  { id: "document", label: "Préparer un document", href: "/employeur/documents", icon: FileText },
  { id: "fiche", label: "Vérifier une fiche", href: "/employeur/controle", icon: FileCheck2 },
  { id: "dossiers", label: "Voir mes dossiers", href: "/employeur/dossiers", icon: FolderOpen },
  { id: "biblio", label: "Bibliothèque", href: "/employeur/bibliotheque", icon: BookOpen },
];

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
  const { identity, kpis, deadlines, alerts, recentDossiers, recentActivity, cost, resume } = data;

  // Compteur réel affiché en pastille sur certaines actions rapides.
  const quickBadge = (id: string): number | null =>
    id === "dossiers" && kpis.activeDossiers > 0 ? kpis.activeDossiers : null;

  // Donut : brut = bleu, cotisations = violet (primary), autres = rose.
  const pct = (x: number) => (cost.total > 0 ? (x / cost.total) * 100 : 0);
  const pBrut = pct(cost.gross);
  const pCotis = pct(cost.contributions);
  const donut = `conic-gradient(#3b82f6 0 ${pBrut}%, var(--primary) ${pBrut}% ${pBrut + pCotis}%, #ec4899 ${pBrut + pCotis}% 100%)`;

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bonjour, {identity.firstName} 👋</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos obligations sociales en toute sérénité. Docbel est à vos côtés.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={FolderOpen} tone="violet" value={String(kpis.activeDossiers)} label="Dossiers actifs" href="/employeur/dossiers" sub="Voir mes dossiers" />
        <Kpi icon={CalendarClock} tone="sky" value={String(kpis.deadlinesThisWeek)} label="Échéances cette semaine" href="/employeur/dossiers" sub="Débuts de contrat à venir" />
        <Kpi icon={FileCheck2} tone="emerald" value={String(kpis.documentsReady)} label="Documents préparés" href="/employeur/documents" sub="Consulter / télécharger" />
        <Kpi icon={TriangleAlert} tone="red" value={String(kpis.alertsCount)} label="Alertes" href="/employeur/dossiers" sub="Actions à vérifier" />
      </div>

      {/* Row 1 — Actions rapides (bloc 2/3) + Simulateur (1/3) */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Actions rapides — bloc de largeur limitée (recherche + grille de tuiles) */}
        <section className={cn(PANEL, "p-5 xl:col-span-2")}>
          <h2 className="text-base font-semibold tracking-tight">Actions rapides</h2>

          <Link
            href="/employeur/dossiers"
            className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground no-underline transition-colors hover:border-primary/40"
          >
            <Search className="size-4" />
            <span className="flex-1">Rechercher un dossier…</span>
            <kbd className="hidden items-center rounded-md border border-border bg-muted px-2 py-1 text-[11px] sm:inline-flex">⌘K</kbd>
          </Link>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {QUICK.map((q) => {
              const Icon = q.icon;
              const badge = quickBadge(q.id);
              return (
                <Link
                  key={q.id}
                  href={q.href}
                  className="group relative flex flex-col items-center gap-2.5 rounded-xl border border-border bg-background p-4 text-center no-underline transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  {badge !== null ? (
                    <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-sm font-medium leading-tight">{q.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Cost simulator snapshot (vrai moteur / dernière simulation) */}
        <div className={PANEL}>
          <PanelHead title="Simulateur de coût" href="/employeur/simulateur-cout" action="Ouvrir" />
          <div className="space-y-4 p-5 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs text-muted-foreground">{cost.title}</p>
              {cost.isExample ? <Badge variant="secondary">Exemple</Badge> : <Badge variant="info">Dernière simulation</Badge>}
            </div>
            <div className="flex items-center gap-5">
              <div className="relative size-32 shrink-0 rounded-full" style={{ background: donut }}>
                <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-card text-center">
                  <span className="text-[10px] text-muted-foreground">Coût total estimé</span>
                  <span className="text-base font-bold">{eur(cost.total)}</span>
                  <span className="text-[10px] text-muted-foreground">/ mois</span>
                </div>
              </div>
              <ul className="flex-1 space-y-1.5 text-xs">
                <Legend color="#3b82f6" label="Salaire brut" value={eur(cost.gross)} />
                <Legend color="var(--primary)" label="Cotisations patronales" value={eur(cost.contributions)} />
                <Legend color="#ec4899" label="Autres coûts" value={eur(cost.other)} />
              </ul>
            </div>
            <Link
              href="/employeur/simulateur-cout"
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary/10 py-2 text-xs font-medium text-primary no-underline"
            >
              {cost.isExample ? "Lancer une simulation" : "Voir le détail du calcul"} <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Row 2 — Échéances · Reprendre · Alertes */}
      <div className="grid gap-4 xl:grid-cols-3">
        {/* Deadlines */}
        <div className={PANEL}>
          <PanelHead title="Échéances à venir" href="/employeur/dossiers" action={deadlines.length ? "Voir tout" : undefined} />
          <div className="space-y-2 p-5 pt-3">
            {deadlines.length === 0 ? (
              <EmptyState icon={CalendarDays}>
                Aucune échéance planifiée. Ajoutez une date de début dans vos dossiers pour la suivre ici.
              </EmptyState>
            ) : (
              deadlines.map((d) => (
                <Link
                  key={d.id}
                  href={`/employeur/dossiers/${d.scenarioId}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5 no-underline transition-colors hover:border-primary/40"
                >
                  <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-muted">
                    <span className="text-sm font-bold">{d.day}</span>
                    <span className="text-[9px] uppercase text-muted-foreground">{d.month}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{d.sub}</p>
                  </div>
                  <Badge variant={d.tone}>{d.tag}</Badge>
                </Link>
              ))
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
      </div>

      {/* Row 3 — Dossiers · Activité · Veille */}
      <div className="grid gap-4 xl:grid-cols-3">
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
                    <span className="hidden text-[11px] text-muted-foreground sm:block">{d.date}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

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
              <p className="mt-1 text-xs text-muted-foreground">
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

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}
