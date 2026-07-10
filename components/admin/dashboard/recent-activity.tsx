import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getRecentActivity } from "@/lib/admin/dashboard-stats";

function relativeShort(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export async function RecentActivity() {
  const items = await getRecentActivity(6);
  return (
    <section className="rounded-xl border bg-card px-4 py-2">
      <div className="flex items-center justify-between py-1.5">
        <h2 className="text-xs font-semibold">Activité admin</h2>
        <Link
          href="/admin?view=activity"
          className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Tout <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-muted-foreground">Pas d&apos;activité</p>
      ) : (
        items.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-2 border-t py-1.5 text-[11.5px]"
          >
            <p className="min-w-0 flex-1 truncate">
              <span className="font-medium">{a.user}</span>{" "}
              <span className="text-muted-foreground">{a.action}</span>{" "}
              <span className="text-foreground/80">{a.resourceName}</span>
            </p>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {relativeShort(a.createdAt)}
            </span>
          </div>
        ))
      )}
    </section>
  );
}
