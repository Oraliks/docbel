"use client";

import {
  AtSignIcon,
  CheckCircle2Icon,
  FlaskConicalIcon,
  GlobeIcon,
  MailCheckIcon,
  MailIcon,
  MailWarningIcon,
  PauseIcon,
  PencilIcon,
  PowerIcon,
  Trash2Icon,
  UsersIcon,
  XCircleIcon,
  ZapIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PARTNER_TYPE_LABELS,
  SEGMENT_LABELS,
  type OrganizationGroup,
  type PartnerDomain,
  type PartnerUser,
} from "./types";

interface PartnerOverviewDetailsProps {
  org: OrganizationGroup;
  isPending: boolean;
  onEditDomain: (domain: PartnerDomain) => void;
  onToggleActive: (domain: PartnerDomain) => void;
  onToggleTest: (domain: PartnerDomain) => void;
  onDeleteDomain: (domain: PartnerDomain) => void;
  onResendUserConfirmation: (user: PartnerUser) => void;
  onActivateUser: (user: PartnerUser) => void;
  onSetUserStatus: (user: PartnerUser, status: string) => void;
}

/**
 * Panneau de détails expansibles d'une organisation partenaire.
 *
 * Affiché sous une `PartnerOverviewCard` quand expanded. Contient :
 *   - Table des domaines (avec actions inline : edit, toggle actif/test, delete)
 *   - Table des utilisateurs (avec actions : resend confirmation, activate,
 *     disable)
 *
 * Toutes les actions sont passées en props depuis le shell qui gère les
 * appels API et la mise à jour de l'état. Les confirmations destructives
 * (delete) sont gérées par le shell aussi (via AlertDialog).
 *
 * Le rendu est volontairement compact (tables denses, badges arrondis,
 * boutons icon-only) pour s'aligner sur la densité des cards parents.
 */
export function PartnerOverviewDetails({
  org,
  isPending,
  onEditDomain,
  onToggleActive,
  onToggleTest,
  onDeleteDomain,
  onResendUserConfirmation,
  onActivateUser,
  onSetUserStatus,
}: PartnerOverviewDetailsProps) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <GlobeIcon className="size-3.5" />
          Accès autorisés ({org.domains.length})
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domaine / Email</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {org.domains.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    {d.kind === "email" ? (
                      <AtSignIcon className="size-3 text-muted-foreground" />
                    ) : (
                      <GlobeIcon className="size-3 text-muted-foreground" />
                    )}
                    {d.kind === "email"
                      ? (d.email ?? "—")
                      : d.domain
                        ? `@${d.domain}`
                        : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 text-[11px]">
                      {SEGMENT_LABELS[d.segment] ?? d.segment}
                    </Badge>
                    {d.segment === "partenaire" && d.partnerType ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-violet-200 bg-violet-50 text-[11px] text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
                      >
                        {PARTNER_TYPE_LABELS[d.partnerType] ?? d.partnerType}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {d.notes || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {d.isActive ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
                      >
                        <CheckCircle2Icon className="size-3" />
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <XCircleIcon className="size-3" />
                        Désactivé
                      </Badge>
                    )}
                    {d.isTest && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                      >
                        <FlaskConicalIcon className="size-3" />
                        Test
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditDomain(d)}
                      disabled={isPending}
                      title="Modifier"
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleActive(d)}
                      disabled={isPending}
                      title={d.isActive ? "Désactiver" : "Activer"}
                    >
                      <PowerIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleTest(d)}
                      disabled={isPending}
                      title={
                        d.isTest ? "Retirer le marquage test" : "Marquer comme test"
                      }
                    >
                      <FlaskConicalIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteDomain(d)}
                      disabled={isPending}
                      className="text-destructive hover:text-destructive"
                      title="Supprimer"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <UsersIcon className="size-3.5" />
          Utilisateurs inscrits ({org.users.length})
        </h3>
        {org.users.length === 0 ? (
          <p className="rounded-md border border-dashed bg-background p-4 text-center text-xs text-muted-foreground">
            Aucun utilisateur inscrit pour cette organisation.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Inscrit le</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {org.users.map((u) => {
                const isPendingUser =
                  u.status === "pending" || !u.emailVerified;
                const isDisabled =
                  u.status === "disabled" || u.status === "locked";
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={
                            u.status === "active"
                              ? "gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300"
                              : "gap-1"
                          }
                        >
                          {u.status}
                        </Badge>
                        {u.emailVerified ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                          >
                            <MailCheckIcon className="size-3" />
                            Vérifié
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                          >
                            <MailWarningIcon className="size-3" />
                            En attente
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("fr-BE")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString("fr-BE")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {isPendingUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onResendUserConfirmation(u)}
                            disabled={isPending}
                            title="Renvoyer l'email de confirmation"
                          >
                            <MailIcon className="size-4" />
                          </Button>
                        )}
                        {(isPendingUser || isDisabled) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onActivateUser(u)}
                            disabled={isPending}
                            title="Activer le compte"
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            <ZapIcon className="size-4" />
                          </Button>
                        )}
                        {u.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSetUserStatus(u, "disabled")}
                            disabled={isPending}
                            title="Désactiver le compte"
                            className="text-amber-600 hover:text-amber-700"
                          >
                            <PauseIcon className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
