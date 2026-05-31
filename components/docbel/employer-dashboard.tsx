import {
  Building2Icon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  KeyRoundIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GLASS_CARD } from "@/lib/glass-classes";

/**
 * Tableau de bord de l'espace Employeur (analogue à PartnerDashboard mais
 * distinct : accent teal, vocabulaire « équipe » / « accès autorisés »).
 * Affiché sur /employeur quand un employeur connecté visite la page.
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

const EMP_ACCENT = "linear-gradient(135deg, #2BB6A3, #0E7C8C)";

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
    <section className="flex flex-col gap-6">
      <Card className={GLASS_CARD}>
        <CardContent className="flex flex-col gap-5 p-7 lg:flex-row lg:items-center lg:gap-8">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ backgroundImage: EMP_ACCENT }}
          >
            <Building2Icon className="size-6" />
          </span>
          <div className="flex flex-1 flex-col gap-2">
            <span
              className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em]"
              style={{ background: "var(--glass-ink)", color: "var(--glass-bg-a)" }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: "#2BB6A3" }}
              />
              Espace Employeur
            </span>
            <h1 className="glass-display text-[28px] font-semibold leading-[1.1] sm:text-[36px]">
              {organizationName}
            </h1>
            <p className="text-[13.5px] text-[color:var(--glass-ink-soft)]">
              {active.length} membre{active.length > 1 ? "s" : ""} actif
              {active.length > 1 ? "s" : ""} · {accesses.length} accès autorisé
              {accesses.length > 1 ? "s" : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={UsersIcon}
          label="Membres de l'équipe"
          value={others.length}
          gradient={EMP_ACCENT}
        />
        <StatCard
          icon={CheckCircle2Icon}
          label="Comptes actifs"
          value={active.length}
          gradient="linear-gradient(135deg, #80E0C0, #40C0A0)"
        />
        <StatCard
          icon={KeyRoundIcon}
          label="Accès autorisés"
          value={accesses.length}
          gradient="linear-gradient(135deg, #80B0FF, #5060FF)"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={GLASS_CARD}>
          <CardHeader className="px-7 pt-7 pb-3">
            <CardTitle className="glass-display flex items-center gap-2 text-[20px] font-semibold">
              <UsersIcon className="size-4" style={{ color: "#0E7C8C" }} />
              Votre équipe
            </CardTitle>
          </CardHeader>
          <CardContent className="px-7 pb-7">
            {others.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[color:var(--glass-ink-soft)]">
                Vous êtes la seule personne de {organizationName} inscrite pour
                l&apos;instant.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {others.slice(0, 8).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-2xl p-3"
                    style={{ background: "var(--glass-surface)" }}
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                      style={{ backgroundImage: EMP_ACCENT }}
                    >
                      {m.name
                        .split(" ")
                        .map((n) => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold">{m.name}</p>
                      <p className="truncate text-[12px] text-[color:var(--glass-ink-faint)]">
                        {m.email}
                      </p>
                    </div>
                    <StatusBadge status={m.status} />
                  </li>
                ))}
                {others.length > 8 ? (
                  <li className="pt-1 text-center text-[11.5px] text-[color:var(--glass-ink-faint)]">
                    + {others.length - 8} autres
                  </li>
                ) : null}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={GLASS_CARD}>
          <CardHeader className="px-7 pt-7 pb-3">
            <CardTitle className="glass-display flex items-center gap-2 text-[20px] font-semibold">
              <CalendarDaysIcon className="size-4" style={{ color: "#0E7C8C" }} />
              Dernières connexions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-7 pb-7">
            {recent.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-[color:var(--glass-ink-soft)]">
                Aucune connexion récente dans votre équipe.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recent.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-2xl p-3"
                    style={{ background: "var(--glass-surface)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold">{m.name}</p>
                      <p className="truncate text-[12px] text-[color:var(--glass-ink-faint)]">
                        {m.email}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-[color:var(--glass-ink-faint)]">
                      {new Date(m.lastLoginAt!).toLocaleDateString("fr-BE")}
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
            <KeyRoundIcon className="size-4" style={{ color: "#0E7C8C" }} />
            Accès autorisés pour {organizationName}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-7 pb-7">
          {accesses.length === 0 ? (
            <p className="py-2 text-[13px] text-[color:var(--glass-ink-soft)]">
              Aucun accès configuré. Contactez DocBel pour ajouter une adresse ou
              un domaine.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accesses.map((a) => (
                <Badge
                  key={a.label}
                  className={`font-mono rounded-full border-0 px-3 py-1 text-[11px] ${
                    a.isActive ? "" : "opacity-60"
                  }`}
                  style={{
                    background: a.isActive
                      ? "rgba(43, 182, 163, 0.18)"
                      : "var(--glass-surface)",
                    color: a.isActive ? "#0E7C8C" : "var(--glass-ink-soft)",
                  }}
                >
                  {a.label}
                </Badge>
              ))}
            </div>
          )}
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
        background: active ? "rgba(43, 182, 163, 0.18)" : "var(--glass-surface)",
        color: active ? "#0E7C8C" : "var(--glass-ink-soft)",
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
