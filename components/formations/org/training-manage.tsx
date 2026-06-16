"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TRAINING_STATUS_LABELS,
  VISIBILITY_LABELS,
  SESSION_STATUS_LABELS,
  SESSION_MODES,
  SESSION_MODE_LABELS,
  type TrainingStatus,
  type TrainingVisibility,
  type TrainingSessionStatus,
} from "@/lib/formations/constants";
import { formatDateTime } from "@/components/formations/format";

export interface ManageSession {
  id: string;
  title: string | null;
  status: string;
  mode: string;
  startsAt: string | null;
  endsAt: string | null;
  city: string | null;
  region: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  waitlistEnabled: boolean;
  registrationDeadline: string | null;
  requiresManualApproval: boolean;
  enrollmentsCount: number;
}

export interface OrgManageView {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  adminReviewNote: string | null;
  rejectedReason: string | null;
  priceType: string;
  priceAmount: number | null;
  currency: string;
  sessions: ManageSession[];
}

export interface ManageCaps {
  create: boolean;
  submit: boolean;
  manageSessions: boolean;
  manageEnrollments: boolean;
}

const selectCls = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TrainingManage({ training, basePath, caps }: { training: OrgManageView; basePath: string; caps: ManageCaps }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  async function action(act: "submit" | "withdraw" | "archive") {
    setBusy(true);
    try {
      const res = await fetch(`/api/formations/trainings/${training.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Action impossible.");
        return;
      }
      toast.success(act === "submit" ? "Formation soumise." : act === "withdraw" ? "Formation retirée en brouillon." : "Formation archivée.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancelSession(id: string) {
    const res = await fetch(`/api/formations/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (res.ok) { toast.success("Session annulée."); router.refresh(); }
    else toast.error("Annulation impossible.");
  }

  async function deleteSession(id: string) {
    const res = await fetch(`/api/formations/sessions/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { toast.success("Session supprimée."); router.refresh(); }
    else toast.error(data.error ?? "Suppression impossible.");
  }

  const canSubmit = caps.submit && (training.status === "draft" || training.status === "changes_requested");
  const canWithdraw = training.status === "pending_review";

  return (
    <div className="w-full max-w-4xl space-y-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" onClick={() => router.push(basePath)}>
        <ArrowLeftIcon /> Mes formations
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{training.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>{TRAINING_STATUS_LABELS[training.status as TrainingStatus] ?? training.status}</Badge>
            <Badge variant="outline">{VISIBILITY_LABELS[training.visibility as TrainingVisibility] ?? training.visibility}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {caps.create && (
            <Button variant="outline" render={<Link href={`${basePath}/${training.id}/modifier`} />}>
              <PencilIcon /> Modifier
            </Button>
          )}
          {caps.manageEnrollments && (
            <Button variant="outline" render={<Link href={`${basePath}/${training.id}/inscriptions`} />}>
              <UsersIcon /> Inscriptions
            </Button>
          )}
          {canSubmit && (
            <Button onClick={() => action("submit")} disabled={busy}>
              <SendIcon /> Soumettre
            </Button>
          )}
          {canWithdraw && (
            <Button variant="outline" onClick={() => action("withdraw")} disabled={busy}>
              Retirer
            </Button>
          )}
        </div>
      </div>

      {(training.status === "changes_requested" && training.adminReviewNote) && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 text-sm">
            <p className="font-medium">Correction demandée par Docbel :</p>
            <p className="text-muted-foreground">{training.adminReviewNote}</p>
          </CardContent>
        </Card>
      )}
      {(training.status === "rejected" && training.rejectedReason) && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 text-sm">
            <p className="font-medium">Formation refusée :</p>
            <p className="text-muted-foreground">{training.rejectedReason}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Sessions</CardTitle>
          {caps.manageSessions && !adding && (
            <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditing(null); }}>
              <PlusIcon /> Ajouter
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {adding && (
            <SessionForm trainingId={training.id} onDone={() => { setAdding(false); router.refresh(); }} onCancel={() => setAdding(false)} />
          )}
          {training.sessions.length === 0 && !adding ? (
            <p className="text-sm text-muted-foreground">Aucune session. Ajoutez-en une pour ouvrir les inscriptions.</p>
          ) : (
            training.sessions.map((s) =>
              editing === s.id ? (
                <SessionForm key={s.id} trainingId={training.id} session={s} onDone={() => { setEditing(null); router.refresh(); }} onCancel={() => setEditing(null)} />
              ) : (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="text-sm">
                    <p className="font-medium">{s.startsAt ? formatDateTime(s.startsAt) : "Dates à définir"}</p>
                    <p className="text-xs text-muted-foreground">
                      {SESSION_MODE_LABELS[s.mode as keyof typeof SESSION_MODE_LABELS] ?? s.mode}
                      {s.city ? ` · ${s.city}` : ""}
                      {s.capacity != null ? ` · ${s.enrollmentsCount}/${s.capacity} inscrits` : ` · ${s.enrollmentsCount} inscrits`}
                      {" · "}
                      {SESSION_STATUS_LABELS[s.status as TrainingSessionStatus] ?? s.status}
                    </p>
                  </div>
                  {caps.manageSessions && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(s.id); setAdding(false); }}><PencilIcon className="size-4" /></Button>
                      {s.status !== "cancelled" && (
                        <Button size="icon" variant="ghost" onClick={() => cancelSession(s.id)} title="Annuler"><XIcon className="size-4" /></Button>
                      )}
                      {s.enrollmentsCount === 0 && (
                        <Button size="icon" variant="ghost" onClick={() => deleteSession(s.id)} title="Supprimer"><Trash2Icon className="size-4" /></Button>
                      )}
                    </div>
                  )}
                </div>
              ),
            )
          )}
        </CardContent>
      </Card>
    </div>
  );

  function SessionForm({ trainingId, session, onDone, onCancel }: { trainingId: string; session?: ManageSession; onDone: () => void; onCancel: () => void }) {
    const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
    const [mode, setMode] = useState(session?.mode ?? "online");
    const [startsAt, setStartsAt] = useState(toLocal(session?.startsAt ?? null));
    const [endsAt, setEndsAt] = useState(toLocal(session?.endsAt ?? null));
    const [city, setCity] = useState(session?.city ?? "");
    const [onlineUrl, setOnlineUrl] = useState(session?.onlineUrl ?? "");
    const [capacity, setCapacity] = useState(session?.capacity != null ? String(session.capacity) : "");
    const [deadline, setDeadline] = useState(toLocal(session?.registrationDeadline ?? null));
    const [waitlist, setWaitlist] = useState(session?.waitlistEnabled ?? false);
    const [manual, setManual] = useState(session?.requiresManualApproval ?? true);
    const [saving, setSaving] = useState(false);

    async function save() {
      setSaving(true);
      const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
      const payload = {
        mode, startsAt: toIso(startsAt), endsAt: toIso(endsAt), city: city || undefined,
        onlineUrl: onlineUrl || undefined, capacity: capacity ? Number(capacity) : null,
        registrationDeadline: toIso(deadline), waitlistEnabled: waitlist, requiresManualApproval: manual,
        status: "open",
      };
      const url = session ? `/api/formations/sessions/${session.id}` : `/api/formations/trainings/${trainingId}/sessions`;
      const res = await fetch(url, { method: session ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      setSaving(false);
      if (res.ok) { toast.success(session ? "Session mise à jour." : "Session ajoutée."); onDone(); }
      else toast.error(data.error ?? "Enregistrement impossible.");
    }

    return (
      <div className="space-y-3 rounded-lg border border-dashed p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">Mode</Label>
            <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              {SESSION_MODES.map((m) => <option key={m} value={m}>{SESSION_MODE_LABELS[m]}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Capacité</Label>
            <Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div className="space-y-1"><Label className="text-xs">Début</Label>
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-1"><Label className="text-xs">Fin</Label>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
          {mode !== "online" && (
            <div className="space-y-1"><Label className="text-xs">Ville</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
          )}
          {mode !== "onsite" && (
            <div className="space-y-1"><Label className="text-xs">Lien visio</Label><Input value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="https://…" /></div>
          )}
          <div className="space-y-1"><Label className="text-xs">Date limite</Label><Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={waitlist} onChange={(e) => setWaitlist(e.target.checked)} /> Liste d&apos;attente</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Validation manuelle</label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
        </div>
      </div>
    );
  }
}
