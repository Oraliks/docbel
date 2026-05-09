import Link from "next/link";
import {
  ArrowLeftIcon,
  Building2Icon,
  GlobeIcon,
  UsersIcon,
  CheckCircle2Icon,
  ClockIcon,
  PauseCircleIcon,
  MailCheckIcon,
  TrendingUpIcon,
  LogInIcon,
  FlaskConicalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPartnerStats } from "@/lib/partner-stats";

export const dynamic = "force-dynamic";

const MONTH_LABELS_FR = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-").map((p) => parseInt(p, 10));
  return `${MONTH_LABELS_FR[month - 1]} ${String(year).slice(2)}`;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  accentClass?: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  accentClass = "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${accentClass}`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight">{value}</p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function PartnerStatsPage() {
  const stats = await getPartnerStats();
  const maxMonth = Math.max(...stats.signupsByMonth.map((m) => m.count), 1);
  const verifiedRate =
    stats.totalUsers > 0
      ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button render={<Link href="/admin/partenaires" />} variant="ghost" size="sm">
          <ArrowLeftIcon className="size-4" />
          Retour
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Statistiques partenaires
          </h1>
          <p className="text-muted-foreground">
            Vue d&apos;ensemble des organisations, domaines et utilisateurs
            inscrits.
          </p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Organisations"
          value={stats.totalOrganizations}
          icon={Building2Icon}
        />
        <StatCard
          title="Domaines (actifs)"
          value={stats.activeDomains}
          icon={GlobeIcon}
          description={`${stats.totalDomains} au total · ${stats.testDomains} de test`}
          accentClass="bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
        />
        <StatCard
          title="Utilisateurs"
          value={stats.totalUsers}
          icon={UsersIcon}
          description={`${stats.activeUsers} actifs · ${stats.pendingUsers} en attente`}
          accentClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
        />
        <StatCard
          title="Email vérifié"
          value={verifiedRate}
          icon={MailCheckIcon}
          description={`${stats.verifiedUsers} / ${stats.totalUsers} utilisateurs (${verifiedRate}%)`}
          accentClass="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Comptes actifs"
          value={stats.activeUsers}
          icon={CheckCircle2Icon}
          accentClass="bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
        />
        <StatCard
          title="Comptes en attente"
          value={stats.pendingUsers}
          icon={ClockIcon}
          accentClass="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
        />
        <StatCard
          title="Comptes désactivés"
          value={stats.disabledUsers}
          icon={PauseCircleIcon}
          accentClass="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
        />
        <StatCard
          title="Domaines de test"
          value={stats.testDomains}
          icon={FlaskConicalIcon}
          accentClass="bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <TrendingUpIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">
                Inscriptions (7 derniers jours)
              </p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight">
                {stats.recentSignups}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <LogInIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">
                Connexions (7 derniers jours)
              </p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight">
                {stats.recentLogins}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inscriptions par mois</CardTitle>
            <CardDescription>6 derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {stats.signupsByMonth.map((m) => (
                <div
                  key={m.month}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div className="flex h-32 w-full items-end">
                    <div
                      className="w-full rounded-t-md bg-violet-500 transition-all hover:bg-violet-600 dark:bg-violet-400 dark:hover:bg-violet-300"
                      style={{
                        height: `${(m.count / maxMonth) * 100}%`,
                        minHeight: m.count > 0 ? "4px" : "0",
                      }}
                      title={`${m.count} inscription${m.count > 1 ? "s" : ""}`}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold">{m.count}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatMonthLabel(m.month)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Top organisations (par utilisateurs)
            </CardTitle>
            <CardDescription>5 plus actives</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topOrganizations.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aucun utilisateur inscrit pour le moment.
              </p>
            ) : (
              <ol className="space-y-2">
                {stats.topOrganizations.map((o, idx) => (
                  <li
                    key={o.organizationName}
                    className="flex items-center gap-3 rounded-md border bg-muted/20 p-2.5"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      {idx + 1}
                    </span>
                    <span className="flex-1 truncate font-medium">
                      {o.organizationName}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {o.userCount} user{o.userCount > 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
