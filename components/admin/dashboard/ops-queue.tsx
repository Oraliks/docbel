import Link from "next/link";
import {
  Calendar,
  CircleHelp,
  ClipboardCheck,
  Flag,
  Languages,
  Mail,
} from "lucide-react";
import { getOpsQueue } from "@/lib/admin/dashboard-stats";
import { cn } from "@/lib/utils";

interface QueueItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  /** Détail optionnel affiché sous le libellé (11px muted). */
  hint?: string;
}

function QueueTile({ item }: { item: QueueItem }) {
  const pending = item.count > 0;
  return (
    <Link href={item.href} className="group flex items-center gap-2.5">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
          pending
            ? "bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20 dark:text-amber-400"
            : "bg-muted text-muted-foreground",
        )}
      >
        <item.icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium leading-tight tabular-nums">
          {item.count}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {item.label}
          {item.hint ? ` · ${item.hint}` : ""}
        </span>
      </span>
    </Link>
  );
}

export async function OpsQueue() {
  const q = await getOpsQueue();
  const items: QueueItem[] = [
    { href: "/admin/signalements", icon: Flag, label: "Signalements", count: q.reports },
    { href: "/admin/chomage/ia/gaps", icon: CircleHelp, label: "Gaps IA", count: q.gaps },
    {
      href: "/admin/i18n",
      icon: Languages,
      label: "Traductions",
      count: q.translationsPending,
      hint: q.translationsFailed > 0 ? `${q.translationsFailed} en échec` : undefined,
    },
    { href: "/admin/messagerie", icon: Mail, label: "Inbox", count: q.inboxUnread },
    {
      href: "/admin/booking",
      icon: Calendar,
      label: "RDV du jour",
      count: q.bookingsToday,
      hint:
        q.bookingsPendingApproval > 0 ? `${q.bookingsPendingApproval} à approuver` : undefined,
    },
    { href: "/admin/baremes", icon: ClipboardCheck, label: "Barèmes", count: q.baremesPending },
  ];

  return (
    <section className="rounded-xl border bg-card px-4 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-xs font-semibold">File de travail</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {q.total} au total
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <QueueTile key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}
