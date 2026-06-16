"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, CheckIcon, MailIcon, PhoneIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ENROLLMENT_STATUS_LABELS,
  SESSION_MODE_LABELS,
  type TrainingEnrollmentStatus,
} from "@/lib/formations/constants";
import { formatDateTime } from "@/components/formations/format";
import type { OrgEnrollmentSession, OrgEnrollmentRow } from "@/lib/formations/org-queries";

interface Props {
  trainingTitle: string;
  trainingId: string;
  sessions: OrgEnrollmentSession[];
  basePath: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  accepted: "default",
  present: "default",
  completed: "default",
  requested: "secondary",
  pending_review: "secondary",
  waitlisted: "outline",
  refused: "destructive",
  absent: "destructive",
  cancelled_user: "outline",
  cancelled_org: "outline",
};

const ACTIONS: Record<string, { action: string; label: string }[]> = {
  requested: [
    { action: "accept", label: "Accepter" },
    { action: "refuse", label: "Refuser" },
    { action: "waitlist", label: "Liste d'attente" },
  ],
  pending_review: [
    { action: "accept", label: "Accepter" },
    { action: "refuse", label: "Refuser" },
    { action: "waitlist", label: "Liste d'attente" },
  ],
  waitlisted: [
    { action: "accept", label: "Accepter" },
    { action: "refuse", label: "Refuser" },
  ],
  accepted: [
    { action: "present", label: "Présent" },
    { action: "absent", label: "Absent" },
    { action: "cancel", label: "Annuler" },
  ],
  present: [{ action: "completed", label: "Terminé" }],
};

export function EnrollmentsManager({ trainingTitle, sessions, basePath, trainingId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/formations/enrollments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error ?? "Action impossible."); return; }
      toast.success("Inscription mise à jour.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const totalEnrollments = sessions.reduce((n, s) => n + s.enrollments.length, 0);

  return (
    <div className="w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" render={<Link href={`${basePath}/${trainingId}`} />}>
        <ArrowLeftIcon /> Retour à la formation
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {trainingTitle} · {totalEnrollments} inscription{totalEnrollments > 1 ? "s" : ""}
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Aucune session.</CardContent></Card>
      ) : (
        sessions.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {s.label ? formatDateTime(s.label) : "Session sans date"}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {SESSION_MODE_LABELS[s.mode as keyof typeof SESSION_MODE_LABELS] ?? s.mode}
                  {s.city ? ` · ${s.city}` : ""}
                  {s.capacity != null ? ` · ${s.enrollments.length}/${s.capacity}` : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {s.enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune inscription pour cette session.</p>
              ) : (
                s.enrollments.map((e) => (
                  <EnrollmentRow key={e.id} e={e} busy={busy === e.id} onAct={(a) => act(e.id, a)} />
                ))
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function EnrollmentRow({ e, busy, onAct }: { e: OrgEnrollmentRow; busy: boolean; onAct: (a: string) => void }) {
  const actions = ACTIONS[e.status] ?? [];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 text-sm">
        <p className="font-medium">{e.citizenName ?? "—"}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
          {e.citizenEmail && (
            <span className="inline-flex items-center gap-1"><MailIcon className="size-3" />{e.citizenEmail}</span>
          )}
          {e.citizenPhone && (
            <span className="inline-flex items-center gap-1"><PhoneIcon className="size-3" />{e.citizenPhone}</span>
          )}
        </p>
        {e.message && <p className="mt-1 text-xs italic text-muted-foreground">« {e.message} »</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[e.status] ?? "outline"}>
          {ENROLLMENT_STATUS_LABELS[e.status as TrainingEnrollmentStatus] ?? e.status}
        </Badge>
        {actions.map((a) => (
          <Button key={a.action} size="sm" variant={a.action === "refuse" || a.action === "cancel" || a.action === "absent" ? "outline" : "default"}
            disabled={busy} onClick={() => onAct(a.action)}>
            {a.action === "accept" || a.action === "present" || a.action === "completed" ? <CheckIcon /> : a.action === "refuse" ? <XIcon /> : null}
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
