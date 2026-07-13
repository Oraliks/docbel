import Link from "next/link"
import { CalendarClock, FileText, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserActivity } from "@/lib/admin/user-360"

const RUN_STATUS_LABELS: Record<string, string> = {
  in_progress: "En cours",
  completed: "Terminé",
  abandoned: "Abandonné",
}

function runStatusClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
    case "abandoned":
      return "bg-slate-500/10 text-slate-600 dark:text-slate-300"
    default:
      return "bg-amber-500/10 text-amber-600 dark:text-amber-300"
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/// Onglet Activité : dossiers, brouillons PDF, rendez-vous. Listes bornées (10
/// dernières) + total, sans pagination interne.
export function UserActivityTab({ activity }: { activity: UserActivity }) {
  const { runs, drafts, bookings, totals } = activity

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Dossiers"
        icon={<FolderOpen className="size-4" />}
        total={totals.runs}
        shown={runs.length}
        empty="Aucun dossier."
      >
        {runs.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.bundleName}</p>
              <p className="text-xs text-muted-foreground">
                Démarré {formatDateTime(r.startedAt)}
                {r.completedAt ? ` · terminé ${formatDateTime(r.completedAt)}` : ""}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium",
                runStatusClass(r.status),
              )}
            >
              {RUN_STATUS_LABELS[r.status] ?? r.status}
            </span>
          </div>
        ))}
      </Section>

      <Section
        title="Brouillons PDF"
        icon={<FileText className="size-4" />}
        total={totals.drafts}
        shown={drafts.length}
        empty="Aucun brouillon."
      >
        {drafts.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              {d.formSlug ? (
                <Link
                  href={`/admin/pdf`}
                  className="truncate font-medium hover:underline"
                >
                  {d.formTitle}
                </Link>
              ) : (
                <p className="truncate font-medium">{d.formTitle}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Modifié {formatDateTime(d.updatedAt)}
              </p>
            </div>
          </div>
        ))}
      </Section>

      <Section
        title="Rendez-vous"
        icon={<CalendarClock className="size-4" />}
        total={totals.bookings}
        shown={bookings.length}
        empty="Aucun rendez-vous."
      >
        {bookings.map((b) => (
          <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{b.tenantName}</p>
              <p className="text-xs text-muted-foreground">
                {b.date} · {b.startTime}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{b.status}</span>
          </div>
        ))}
      </Section>
    </div>
  )
}

function Section({
  title,
  icon,
  total,
  shown,
  empty,
  children,
}: {
  title: string
  icon: React.ReactNode
  total: number
  shown: number
  empty: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
          <span className="text-xs font-normal text-muted-foreground">({total})</span>
        </h2>
        {total > shown && (
          <span className="text-xs text-muted-foreground">
            {shown} plus récents affichés
          </span>
        )}
      </div>
      {total === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="divide-y">{children}</div>
      )}
    </section>
  )
}
