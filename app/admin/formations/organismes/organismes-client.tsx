"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Globe,
  GraduationCap,
  Info,
  Loader2,
  Mail,
  MapPin,
  PauseCircle,
  Phone,
  RotateCcw,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ORG_STATUSES,
  ORG_STATUS_LABELS,
  ORG_TYPE_LABELS,
  type FormationOrgStatus,
} from "@/lib/formations/constants";
import { formatEnterpriseNumber } from "@/lib/formations/enterprise-number";
import type {
  AdminOrgRow,
  AdminOrgStats,
} from "@/lib/formations/admin-org-queries";
import { formatDate } from "../_ui";

const BASE_PATH = "/admin/formations/organismes";

type ReviewAction = "approve" | "reject" | "suspend" | "reactivate";

interface ActionMeta {
  label: string;
  title: string;
  description: string;
  confirm: string;
  /** Note obligatoire (le serveur l'impose aussi en production). */
  noteRequired: boolean;
  notePlaceholder: string;
  variant: "default" | "outline" | "destructive";
  icon: ReactNode;
  success: (org: string) => string;
}

const ACTION_META: Record<ReviewAction, ActionMeta> = {
  approve: {
    label: "Valider",
    title: "Valider l'organisation",
    description:
      "L'organisation passe en « Validée » et pourra créer puis soumettre des formations. Les capacités sensibles (publication directe, formations privées ou internes) restent désactivées : elles s'accordent depuis l'écran Permissions.",
    confirm: "Valider l'organisation",
    noteRequired: false,
    notePlaceholder: "Note interne (facultative) — reprise dans l'email envoyé au contact.",
    variant: "default",
    icon: <CheckCircle2 className="size-4" />,
    success: (org) => `${org} est validée.`,
  },
  reject: {
    label: "Refuser",
    title: "Refuser la demande",
    description:
      "La demande est refusée. Le motif est transmis au contact par email : soyez explicite pour qu'il puisse corriger et revenir.",
    confirm: "Refuser la demande",
    noteRequired: true,
    notePlaceholder:
      "Motif du refus (obligatoire) — ex. : numéro BCE introuvable, activité hors périmètre formation…",
    variant: "destructive",
    icon: <XCircle className="size-4" />,
    success: (org) => `${org} a été refusée.`,
  },
  suspend: {
    label: "Suspendre",
    title: "Suspendre l'organisation",
    description:
      "L'organisation ne pourra plus publier de formations tant qu'elle n'est pas réactivée. Le motif est transmis au contact par email.",
    confirm: "Suspendre l'organisation",
    noteRequired: true,
    notePlaceholder:
      "Motif de la suspension (obligatoire) — ex. : signalements répétés, informations obsolètes…",
    variant: "destructive",
    icon: <PauseCircle className="size-4" />,
    success: (org) => `${org} est suspendue.`,
  },
  reactivate: {
    label: "Réactiver",
    title: "Réactiver l'organisation",
    description:
      "L'organisation redevient active et retrouve ses capacités de publication. Les permissions déjà accordées ne sont pas modifiées.",
    confirm: "Réactiver l'organisation",
    noteRequired: false,
    notePlaceholder: "Note interne (facultative) — reprise dans l'email envoyé au contact.",
    variant: "default",
    icon: <RotateCcw className="size-4" />,
    success: (org) => `${org} est réactivée.`,
  },
};

const ACTIONS_BY_STATUS: Record<FormationOrgStatus, ReviewAction[]> = {
  pending: ["approve", "reject"],
  active: ["suspend"],
  suspended: ["reactivate"],
  rejected: ["reactivate"],
};

type BadgeVariant = "secondary" | "destructive" | "success" | "warning" | "outline";

const STATUS_VARIANT: Record<FormationOrgStatus, BadgeVariant> = {
  pending: "warning",
  active: "success",
  suspended: "destructive",
  rejected: "outline",
};

const EMPTY_MESSAGE: Record<FormationOrgStatus | "all", string> = {
  all: "Aucune organisation de formation enregistrée pour le moment.",
  pending: "Aucune demande en attente. Tout est traité.",
  active: "Aucune organisation validée pour le moment.",
  suspended: "Aucune organisation suspendue. Tant mieux.",
  rejected: "Aucune demande refusée.",
};

interface Props {
  rows: AdminOrgRow[];
  stats: AdminOrgStats;
  activeStatus: FormationOrgStatus | null;
}

export function OrganismesClient({ rows, stats, activeStatus }: Props) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();

  const [decision, setDecision] = useState<{
    org: AdminOrgRow;
    action: ReviewAction;
  } | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState<AdminOrgRow | null>(null);

  const goToStatus = (next: FormationOrgStatus | null) => {
    startNavigation(() => {
      router.push(next ? `${BASE_PATH}?status=${next}` : BASE_PATH);
    });
  };

  const openDecision = (org: AdminOrgRow, action: ReviewAction) => {
    setDecision({ org, action });
    setNote("");
  };

  const closeDecision = () => {
    if (submitting) return;
    setDecision(null);
    setNote("");
  };

  const submitDecision = async () => {
    if (!decision) return;
    const meta = ACTION_META[decision.action];
    const trimmed = note.trim();
    if (meta.noteRequired && !trimmed) {
      toast.error("Une note est requise pour cette action.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/formations/orgs/${decision.org.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: decision.action,
            note: trimmed || undefined,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "L'action a échoué.");
      toast.success(meta.success(decision.org.name));
      setDecision(null);
      setNote("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Une erreur est survenue.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const decisionMeta = decision ? ACTION_META[decision.action] : null;
  const emptyMessage = EMPTY_MESSAGE[activeStatus ?? "all"];

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Organismes de formation
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Validez les demandes d&apos;inscription, suspendez ou réactivez les
            organisations qui publient des formations sur Docbel.
          </p>
        </div>
      </div>

      {/* Tuiles de stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="En attente"
          value={stats.pending}
          tone={stats.pending > 0 ? "warn" : "muted"}
          icon={<ShieldAlert className="size-4" />}
        />
        <StatTile
          label="Validées"
          value={stats.active}
          tone="success"
          icon={<BadgeCheck className="size-4" />}
        />
        <StatTile
          label="Suspendues"
          value={stats.suspended}
          tone={stats.suspended > 0 ? "error" : "default"}
          icon={<PauseCircle className="size-4" />}
        />
        <StatTile
          label="Refusées"
          value={stats.rejected}
          tone="default"
          icon={<XCircle className="size-4" />}
        />
      </div>

      {/* Filtre statut (porté par l'URL, appliqué côté serveur) */}
      <Card>
        <CardContent className="p-3">
          <div
            className={`flex flex-wrap gap-1.5 transition-opacity ${
              navigating ? "opacity-60" : ""
            }`}
          >
            <FilterPill
              label="Toutes"
              count={stats.total}
              active={activeStatus === null}
              onClick={() => goToStatus(null)}
            />
            {ORG_STATUSES.map((s) => (
              <FilterPill
                key={s}
                label={ORG_STATUS_LABELS[s]}
                count={stats[s]}
                active={activeStatus === s}
                onClick={() => goToStatus(s)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organisation</TableHead>
              <TableHead>BCE</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Formations</TableHead>
              <TableHead className="text-right">Membres</TableHead>
              <TableHead>Soumis le</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-16 text-center text-muted-foreground"
                >
                  <Building2 className="mx-auto mb-3 size-8 opacity-40" />
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {rows.map((org) => {
              const actions =
                ACTIONS_BY_STATUS[org.status as FormationOrgStatus] ?? [];
              return (
                <TableRow key={org.id} className="align-top">
                  {/* Organisation */}
                  <TableCell className="max-w-[280px] py-2.5">
                    <div className="font-medium leading-tight whitespace-normal">
                      {org.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {ORG_TYPE_LABELS[
                        org.type as keyof typeof ORG_TYPE_LABELS
                      ] ?? org.type}
                    </div>
                  </TableCell>

                  {/* BCE */}
                  <TableCell className="py-2.5">
                    <div className="font-mono text-xs tabular-nums">
                      {org.enterpriseNumber
                        ? formatEnterpriseNumber(org.enterpriseNumber)
                        : "—"}
                    </div>
                    <div className="mt-1">
                      {org.enterpriseVerified ? (
                        <Badge variant="success" className="text-[10px]">
                          <BadgeCheck />
                          Vérifié BCE
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Non vérifié
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Contact */}
                  <TableCell className="max-w-[220px] py-2.5">
                    <div className="text-sm leading-tight whitespace-normal">
                      {org.contactName ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {org.contactEmail ?? "Pas d'email de contact"}
                    </div>
                  </TableCell>

                  {/* Compteurs */}
                  <TableCell className="py-2.5 text-right tabular-nums text-sm">
                    {org.trainingsCount}
                  </TableCell>
                  <TableCell className="py-2.5 text-right tabular-nums text-sm">
                    {org.membersCount}
                  </TableCell>

                  {/* Soumission */}
                  <TableCell className="py-2.5 text-sm text-muted-foreground">
                    {formatDate(org.submittedAt)}
                  </TableCell>

                  {/* Statut */}
                  <TableCell className="py-2.5">
                    <OrgStatusBadge status={org.status} />
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {actions.map((action) => {
                        const meta = ACTION_META[action];
                        return (
                          <Button
                            key={action}
                            size="sm"
                            variant={
                              meta.variant === "destructive"
                                ? "outline"
                                : meta.variant
                            }
                            className={
                              meta.variant === "destructive"
                                ? "text-destructive"
                                : undefined
                            }
                            onClick={() => openDecision(org, action)}
                          >
                            {meta.icon}
                            {meta.label}
                          </Button>
                        );
                      })}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetails(org)}
                        aria-label={`Détails de ${org.name}`}
                      >
                        <Info className="size-4" />
                        Détails
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog de décision */}
      <Dialog
        open={decision !== null}
        onOpenChange={(open: boolean) => {
          if (!open) closeDecision();
        }}
      >
        <DialogContent>
          {decision && decisionMeta && (
            <>
              <DialogHeader>
                <DialogTitle>{decisionMeta.title}</DialogTitle>
                <DialogDescription>
                  {decision.org.name} — {decisionMeta.description}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="review-note">
                  {decisionMeta.noteRequired
                    ? "Note (obligatoire)"
                    : "Note (facultative)"}
                </Label>
                <Textarea
                  id="review-note"
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={decisionMeta.notePlaceholder}
                />
                <p className="text-[11px] text-muted-foreground">
                  {decision.org.contactEmail
                    ? `Un email sera envoyé à ${decision.org.contactEmail}.`
                    : "Aucun email de contact : la décision ne sera pas notifiée."}
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={closeDecision}
                  disabled={submitting}
                >
                  Annuler
                </Button>
                <Button
                  variant={decisionMeta.variant}
                  onClick={() => void submitDecision()}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    decisionMeta.icon
                  )}
                  {decisionMeta.confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog détails */}
      <Dialog
        open={details !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setDetails(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {details && <OrgDetails org={details} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Sous-composants --------------------------------------------------------

function OrgStatusBadge({ status }: { status: string }) {
  const known = status as FormationOrgStatus;
  const variant: BadgeVariant = STATUS_VARIANT[known] ?? "outline";
  const label = ORG_STATUS_LABELS[known] ?? status;
  return (
    <Badge variant={variant} className="text-[11px]">
      {label}
    </Badge>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: number;
  tone?: "default" | "muted" | "success" | "warn" | "error";
  icon?: ReactNode;
}) {
  const toneClass: Record<NonNullable<typeof tone>, string> = {
    default: "border-border",
    muted: "border-border bg-muted/30",
    success: "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/10",
    warn: "border-amber-300 bg-amber-50/40 dark:bg-amber-950/10",
    error: "border-red-300 bg-red-50/40 dark:bg-red-950/10",
  };
  return (
    <div className={`rounded-lg border p-3 ${toneClass[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {value.toLocaleString("fr-BE")}
        </div>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function OrgDetails({ org }: { org: AdminOrgRow }) {
  const address = [org.street, [org.postalCode, org.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <DialogHeader>
        <DialogTitle>{org.name}</DialogTitle>
        <DialogDescription>
          {ORG_TYPE_LABELS[org.type as keyof typeof ORG_TYPE_LABELS] ?? org.type}{" "}
          · Demande du {formatDate(org.submittedAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-1.5">
        <OrgStatusBadge status={org.status} />
        {org.enterpriseVerified ? (
          <Badge variant="success" className="text-[10px]">
            <BadgeCheck />
            Vérifié BCE
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Non vérifié
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px]">
          <GraduationCap />
          {org.trainingsCount} formation(s)
        </Badge>
        <Badge variant="secondary" className="text-[10px]">
          <Users />
          {org.membersCount} membre(s)
        </Badge>
      </div>

      {org.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {org.description}
        </p>
      )}

      <dl className="grid gap-2 sm:grid-cols-2 text-sm">
        <DetailItem
          icon={<BadgeCheck className="size-3.5" />}
          label="Dénomination légale (BCE)"
          value={org.legalName}
        />
        <DetailItem
          icon={<Building2 className="size-3.5" />}
          label="Numéro d'entreprise"
          value={
            org.enterpriseNumber
              ? formatEnterpriseNumber(org.enterpriseNumber)
              : null
          }
        />
        <DetailItem
          icon={<MapPin className="size-3.5" />}
          label="Adresse"
          value={address || null}
        />
        <DetailItem
          icon={<Globe className="size-3.5" />}
          label="Site web"
          value={org.website}
        />
        <DetailItem
          icon={<Mail className="size-3.5" />}
          label="Email de contact"
          value={org.contactEmail}
        />
        <DetailItem
          icon={<Phone className="size-3.5" />}
          label="Téléphone"
          value={org.contactPhone}
        />
        <DetailItem
          icon={<Users className="size-3.5" />}
          label="Personne de contact"
          value={
            org.contactName
              ? [org.contactName, org.contactRole].filter(Boolean).join(" — ")
              : null
          }
        />
        <DetailItem
          icon={<Info className="size-3.5" />}
          label="Dernière décision"
          value={org.reviewedAt ? formatDate(org.reviewedAt) : null}
        />
      </dl>

      {org.reviewNote && (
        <p className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          <span className="font-medium">Note de révision : </span>
          {org.reviewNote}
        </p>
      )}
      {org.rejectedReason && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
          <span className="font-medium">Motif du refus : </span>
          {org.rejectedReason}
        </p>
      )}
    </>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 break-words">{value ?? "—"}</dd>
    </div>
  );
}
