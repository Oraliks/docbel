import {
  Building2Icon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  GlobeIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GLASS_CARD } from "@/lib/glass-classes";

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
  const activeColleagues = otherColleagues.filter(
    (c) => c.status === "active",
  );
  const recentlyActive = otherColleagues
    .filter((c) => c.lastLoginAt)
    .sort(
      (a, b) =>
        new Date(b.lastLoginAt!).getTime() -
        new Date(a.lastLoginAt!).getTime(),
    )
    .slice(0, 5);

  return (
    <section className="flex flex-col gap-6">
      <Card className={GLASS_CARD}>
        <CardContent className="flex flex-col gap-5 p-7 lg:flex-row lg:items-center lg:gap-8">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--glass-accent-deep), var(--glass-accent-a))",
            }}
          >
            <Building2Icon className="size-6" />
          </span>
          <div className="flex flex-1 flex-col gap-2">
            <span
              className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em]"
              style={{
                background: "var(--glass-ink)",
                color: "var(--glass-bg-a)",
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: "var(--glass-accent-c)" }}
              />
              Espace Partenaire
            </span>
            <h1 className="glass-display text-[28px] font-semibold leading-[1.1] sm:text-[36px]">
              {organizationName}
            </h1>
            <p className="text-[13.5px] text-[color:var(--glass-ink-soft)]">
              {activeColleagues.length} collègue
              {activeColleagues.length > 1 ? "s" : ""} actif
              {activeColleagues.length > 1 ? "s" : ""} · {domains.length} domaine
              {domains.length > 1 ? "s" : ""} autorisé
              {domains.length > 1 ? "s" : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={UsersIcon}
          label="Collègues inscrits"
          value={otherColleagues.length}
          gradient="linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))"
        />
        <StatCard
          icon={CheckCircle2Icon}
          label="Comptes actifs"
          value={activeColleagues.length}
          gradient="linear-gradient(135deg, #80E0C0, #40C0A0)"
        />
        <StatCard
          icon={GlobeIcon}
          label="Domaines autorisés"
          value={domains.length}
          gradient="linear-gradient(135deg, #80B0FF, #5060FF)"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={GLASS_CARD}>
          <CardHeader className="px-7 pt-7 pb-3">
            <CardTitle className="glass-display flex items-center gap-2 text-[20px] font-semibold">
              <UsersIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
              Vos collègues
            </CardTitle>
          </CardHeader>
          <CardContent className="px-7 pb-7">
            {otherColleagues.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[color:var(--glass-ink-soft)]">
                Vous êtes la seule personne de {organizationName} inscrite pour
                l&apos;instant.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {otherColleagues.slice(0, 8).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-2xl p-3"
                    style={{ background: "var(--glass-surface)" }}
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                      style={{
                        backgroundImage:
                          "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
                      }}
                    >
                      {c.name
                        .split(" ")
                        .map((n) => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold">
                        {c.name}
                      </p>
                      <p className="truncate text-[12px] text-[color:var(--glass-ink-faint)]">
                        {c.email}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
                {otherColleagues.length > 8 ? (
                  <li className="pt-1 text-center text-[11.5px] text-[color:var(--glass-ink-faint)]">
                    + {otherColleagues.length - 8} autres
                  </li>
                ) : null}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader className="px-7 pt-7 pb-3">
            <CardTitle className="glass-display flex items-center gap-2 text-[20px] font-semibold">
              <CalendarDaysIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
              Dernières connexions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-7 pb-7">
            {recentlyActive.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[color:var(--glass-ink-soft)]">
                Aucune connexion récente parmi vos collègues.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentlyActive.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-2xl p-3"
                    style={{ background: "var(--glass-surface)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold">
                        {c.name}
                      </p>
                      <p className="truncate text-[12px] text-[color:var(--glass-ink-faint)]">
                        {c.email}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-[color:var(--glass-ink-faint)]">
                      {new Date(c.lastLoginAt!).toLocaleDateString("fr-BE")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={GLASS_CARD}>
        <CardHeader className="px-7 pt-7 pb-3">
          <CardTitle className="glass-display flex items-center gap-2 text-[20px] font-semibold">
            <GlobeIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            Domaines autorisés pour {organizationName}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-7 pb-7">
          <div className="flex flex-wrap gap-2">
            {domains.map((d) => (
              <Badge
                key={d.domain}
                className={`font-mono rounded-full border-0 px-3 py-1 text-[11px] ${
                  d.isActive ? "" : "opacity-60"
                }`}
                style={{
                  background: d.isActive
                    ? "rgba(80, 200, 140, 0.18)"
                    : "var(--glass-surface)",
                  color: d.isActive ? "#1d6b3e" : "var(--glass-ink-soft)",
                }}
              >
                @{d.domain}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  gradient: string;
}) {
  return (
    <Card className={GLASS_CARD}>
      <CardContent className="flex items-start gap-3 p-5">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{ backgroundImage: gradient }}
        >
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
            {label}
          </p>
          <p className="glass-display mt-0.5 text-[28px] font-semibold leading-none">
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
      className="gap-1 rounded-full border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase"
      style={{
        background: active ? "rgba(80, 200, 140, 0.18)" : "var(--glass-surface)",
        color: active ? "#1d6b3e" : "var(--glass-ink-soft)",
      }}
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
