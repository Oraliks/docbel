import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarClock,
  CheckCircle2Icon,
  ClockIcon,
  GlobeIcon,
  type LucideIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

const PARTNER_TOOLS: {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
}[] = [
  {
    title: "Rendez-vous → Outlook (.ics)",
    desc: "Collez une liste de rendez-vous et téléchargez un fichier .ics importable dans Outlook, Google Agenda ou Apple Calendrier.",
    href: "/rendez-vous",
    icon: CalendarClock,
  },
  {
    title: "Lookup ONEM",
    desc: "Décodez les codes officiels ONEM (S01, S04, S38, Dispo, BCSS…). Recherche multilingue dans 11 000+ entrées.",
    href: "/outils/lookup-onem",
    icon: SearchIcon,
  },
];

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
        new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {organizationName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Espace partenaire · {activeColleagues.length} collègue
          {activeColleagues.length > 1 ? "s" : ""} actif
          {activeColleagues.length > 1 ? "s" : ""} · {domains.length} domaine
          {domains.length > 1 ? "s" : ""} autorisé
          {domains.length > 1 ? "s" : ""}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Outils</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PARTNER_TOOLS.map((tool) => (
            <Card
              key={tool.href}
              className="p-0 transition-colors hover:bg-muted/40"
            >
              <Link
                href={tool.href}
                className="group flex h-full items-start gap-3 p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <tool.icon className="size-5" />
                </span>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tool.title}</span>
                    <ArrowRightIcon className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-sm text-muted-foreground">{tool.desc}</p>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={UsersIcon}
          label="Collègues inscrits"
          value={otherColleagues.length}
        />
        <StatCard
          icon={CheckCircle2Icon}
          label="Comptes actifs"
          value={activeColleagues.length}
        />
        <StatCard
          icon={GlobeIcon}
          label="Domaines autorisés"
          value={domains.length}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="membres">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-4 text-primary" />
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
              <ul className="flex flex-col gap-1.5">
                {otherColleagues.slice(0, 8).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.email}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
                {otherColleagues.length > 8 ? (
                  <li className="pt-1 text-center text-xs text-muted-foreground">
                    + {otherColleagues.length - 8} autres
                  </li>
                ) : null}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="size-4 text-primary" />
              Dernières connexions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentlyActive.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aucune connexion récente parmi vos collègues.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {recentlyActive.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.email}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                      {new Date(c.lastLoginAt!).toLocaleDateString("fr-BE")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card id="domaines">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GlobeIcon className="size-4 text-primary" />
            Domaines autorisés pour {organizationName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun domaine configuré. Contactez DocBel pour en ajouter.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {domains.map((d) => (
                <Badge
                  key={d.domain}
                  variant="secondary"
                  className={`font-mono ${d.isActive ? "" : "opacity-60"}`}
                >
                  @{d.domain}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold leading-none tabular-nums">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <Badge
      variant="secondary"
      className={`gap-1 text-[10px] font-semibold uppercase ${
        active ? "text-emerald-600" : "text-muted-foreground"
      }`}
    >
      {active ? (
        <CheckCircle2Icon className="size-3" />
      ) : (
        <ClockIcon className="size-3" />
      )}
      {status}
    </Badge>
  );
}
