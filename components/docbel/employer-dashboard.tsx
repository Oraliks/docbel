import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  KeyRoundIcon,
  type LucideIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Tableau de bord de l'espace Employeur (parallèle à PartnerDashboard).
 * Rendu dans le shell Dashboard pro (cf. ProShell) quand un employeur
 * connecté visite /employeur.
 */

interface Member {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt: Date | null;
}

interface AccessEntry {
  label: string; // "@cpas.be" (domaine) ou "jean@gmail.com" (email)
  isActive: boolean;
}

interface EmployerDashboardProps {
  organizationName: string;
  currentUserId: string;
  members: Member[];
  accesses: AccessEntry[];
}

export function EmployerDashboard({
  organizationName,
  currentUserId,
  members,
  accesses,
}: EmployerDashboardProps) {
  const others = members.filter((m) => m.id !== currentUserId);
  const active = others.filter((m) => m.status === "active");
  const recent = others
    .filter((m) => m.lastLoginAt)
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
          Espace employeur · {active.length} membre{active.length > 1 ? "s" : ""}{" "}
          actif{active.length > 1 ? "s" : ""} · {accesses.length} accès autorisé
          {accesses.length > 1 ? "s" : ""}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Outils</h2>
        <Card className="p-0">
          <div className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileTextIcon className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-medium">Vos outils dédiés arrivent bientôt</p>
              <p className="text-sm text-muted-foreground">
                En attendant, parcourez le catalogue d&apos;outils disponibles
                (C4, attestations, calcul de préavis…).
              </p>
            </div>
            <Link
              href="/outils"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Catalogue d&apos;outils
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </Card>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={UsersIcon}
          label="Membres de l'équipe"
          value={others.length}
        />
        <StatCard
          icon={CheckCircle2Icon}
          label="Comptes actifs"
          value={active.length}
        />
        <StatCard
          icon={KeyRoundIcon}
          label="Accès autorisés"
          value={accesses.length}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="equipe">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-4 text-primary" />
              Votre équipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {others.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Vous êtes la seule personne de {organizationName} inscrite pour
                l&apos;instant.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {others.slice(0, 8).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {initials(m.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email}
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                  </li>
                ))}
                {others.length > 8 ? (
                  <li className="pt-1 text-center text-xs text-muted-foreground">
                    + {others.length - 8} autres
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
            {recent.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Aucune connexion récente dans votre équipe.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {recent.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.email}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                      {new Date(m.lastLoginAt!).toLocaleDateString("fr-BE")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card id="acces">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4 text-primary" />
            Accès autorisés pour {organizationName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun accès configuré. Contactez DocBel pour ajouter une adresse
              ou un domaine.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accesses.map((a) => (
                <Badge
                  key={a.label}
                  variant="secondary"
                  className={`font-mono ${a.isActive ? "" : "opacity-60"}`}
                >
                  {a.label}
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
