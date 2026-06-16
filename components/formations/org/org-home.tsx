"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCapIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TRAINING_STATUS_LABELS,
  VISIBILITY_LABELS,
  type TrainingStatus,
  type TrainingVisibility,
} from "@/lib/formations/constants";
import { formatPrice } from "@/components/formations/format";
import type { OrgTrainingListItem, OrgStats } from "@/lib/formations/org-queries";

interface Props {
  items: OrgTrainingListItem[];
  stats: OrgStats;
  basePath: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  published: "default",
  pending_review: "secondary",
  changes_requested: "destructive",
  approved: "secondary",
  draft: "outline",
  suspended: "destructive",
  rejected: "destructive",
  archived: "outline",
};

export function OrgFormationsHome({ items, stats, basePath }: Props) {
  const [filter, setFilter] = useState<string>("all");

  const statuses = useMemo(() => {
    const present = Array.from(new Set(items.map((i) => i.status)));
    return ["all", ...present];
  }, [items]);

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <GraduationCapIcon className="size-6 text-primary" />
            Mes formations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Créez, soumettez et gérez vos formations. Docbel les valide avant publication.
          </p>
        </div>
        <Button render={<Link href={`${basePath}/nouvelle`} />}>
          <PlusIcon /> Créer une formation
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Formations" value={stats.total} />
        <StatCard label="Publiées" value={stats.published} />
        <StatCard label="En validation" value={stats.pendingReview} />
        <StatCard label="Inscriptions en attente" value={stats.pendingEnrollments} />
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <GraduationCapIcon className="size-8 text-muted-foreground" />
            <p className="font-medium">Aucune formation créée pour le moment.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Créez votre première formation et soumettez-la à validation Docbel.
            </p>
            <Button render={<Link href={`${basePath}/nouvelle`} />} className="mt-1">
              <PlusIcon /> Créer une formation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {s === "all" ? "Toutes" : TRAINING_STATUS_LABELS[s as TrainingStatus] ?? s}
                {s !== "all" ? ` (${items.filter((i) => i.status === s).length})` : ""}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <Link key={t.id} href={`${basePath}/${t.id}`} className="block no-underline">
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader className="gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{t.title}</CardTitle>
                      <Badge variant={STATUS_VARIANT[t.status] ?? "outline"}>
                        {TRAINING_STATUS_LABELS[t.status as TrainingStatus] ?? t.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">
                      {VISIBILITY_LABELS[t.visibility as TrainingVisibility] ?? t.visibility}
                    </Badge>
                    {t.categoryName ? <span>{t.categoryName}</span> : null}
                    <span>· {formatPrice(t.priceType, t.priceAmount, t.currency)}</span>
                    <span>· {t.sessionsCount} session{t.sessionsCount > 1 ? "s" : ""}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
