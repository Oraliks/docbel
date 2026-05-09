import {
  Building2Icon,
  UsersIcon,
  CalendarDaysIcon,
  GlobeIcon,
  CheckCircle2Icon,
  ClockIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Colleague {
  id: string;
  name: string;
  email: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

interface DomainEntry {
  domain: string;
  isActive: boolean;
}

interface PartnerDashboardProps {
  organizationName: string;
  currentUserId: string;
  colleagues: Colleague[];
  domains: DomainEntry[];
}

export function PartnerDashboard({
  organizationName,
  currentUserId,
  colleagues,
  domains,
}: PartnerDashboardProps) {
  const otherColleagues = colleagues.filter((c) => c.id !== currentUserId);
  const activeColleagues = otherColleagues.filter((c) => c.status === "active");
  const recentlyActive = otherColleagues
    .filter((c) => c.lastLoginAt)
    .sort(
      (a, b) =>
        new Date(b.lastLoginAt!).getTime() -
        new Date(a.lastLoginAt!).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 py-2">
      <section className="rounded-3xl border bg-linear-to-br from-violet-50 via-white to-violet-100/30 p-6 dark:from-violet-500/10 dark:via-background dark:to-violet-500/5 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-300 via-violet-500 to-violet-900 text-white">
            <Building2Icon className="size-6" />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
              Espace Partenaire
            </span>
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
              {organizationName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeColleagues.length} collègue
              {activeColleagues.length > 1 ? "s" : ""} actif
              {activeColleagues.length > 1 ? "s" : ""} ·{" "}
              {domains.length} domaine{domains.length > 1 ? "s" : ""} autorisé
              {domains.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <UsersIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Collègues inscrits</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight">
                {otherColleagues.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <CheckCircle2Icon className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Comptes actifs</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight">
                {activeColleagues.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <GlobeIcon className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Domaines autorisés</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight">
                {domains.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersIcon className="size-4" />
              Vos collègues
            </CardTitle>
          </CardHeader>
          <CardContent>
            {otherColleagues.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Vous êtes la seule personne de {organizationName} inscrite pour
                l&apos;instant.
              </p>
            ) : (
              <ul className="space-y-2">
                {otherColleagues.slice(0, 8).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-md border bg-muted/20 p-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      {c.name
                        .split(" ")
                        .map((n) => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.email}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        c.status === "active"
                          ? "gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
                          : "gap-1"
                      }
                    >
                      {c.status === "active" ? (
                        <CheckCircle2Icon className="size-3" />
                      ) : (
                        <ClockIcon className="size-3" />
                      )}
                      {c.status}
                    </Badge>
                  </li>
                ))}
                {otherColleagues.length > 8 && (
                  <li className="pt-1 text-center text-xs text-muted-foreground">
                    + {otherColleagues.length - 8} autres
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDaysIcon className="size-4" />
              Dernières connexions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentlyActive.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aucune connexion récente parmi vos collègues.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentlyActive.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.email}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {new Date(c.lastLoginAt!).toLocaleDateString("fr-BE")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GlobeIcon className="size-4" />
              Domaines autorisés pour {organizationName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {domains.map((d) => (
                <Badge
                  key={d.domain}
                  variant="outline"
                  className={
                    d.isActive
                      ? "font-mono gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
                      : "font-mono"
                  }
                >
                  @{d.domain}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
