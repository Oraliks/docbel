"use client";

import {
  AtSignIcon,
  CheckCircle2Icon,
  FlaskConicalIcon,
  GlobeIcon,
  HistoryIcon,
  MailCheckIcon,
  MailIcon,
  MailWarningIcon,
  PauseIcon,
  PencilIcon,
  PowerIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UsersIcon,
  XCircleIcon,
  ZapIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
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
  onSetUserFlag: (
    user: PartnerUser,
    flag: "isOrgManager" | "canViewRdvHistory",
    value: boolean,
  ) => void;
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
  onSetUserFlag,
}: PartnerOverviewDetailsProps) {
  const t = useTranslations("admin.partenaires");
  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <GlobeIcon className="size-3.5" />
          {t("authorizedAccessHeading", { count: org.domains.length })}
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colDomainEmail")}</TableHead>
              <TableHead>{t("colSegment")}</TableHead>
              <TableHead>{t("colNotes")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="text-right">{t("colActions")}</TableHead>
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
                        {t("statusActive")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <XCircleIcon className="size-3" />
                        {t("statusDisabled")}
                      </Badge>
                    )}
                    {d.isTest && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                      >
                        <FlaskConicalIcon className="size-3" />
                        {t("badgeTest")}
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
                      title={t("actionEdit")}
                    >
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleActive(d)}
                      disabled={isPending}
                      title={d.isActive ? t("actionDisable") : t("actionActivate")}
                    >
                      <PowerIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleTest(d)}
                      disabled={isPending}
                      title={
                        d.isTest ? t("actionUnmarkTest") : t("actionMarkTest")
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
                      title={t("actionDelete")}
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
          {t("registeredUsersHeading", { count: org.users.length })}
        </h3>
        {org.users.length === 0 ? (
          <p className="rounded-md border border-dashed bg-background p-4 text-center text-xs text-muted-foreground">
            {t("noUsersForOrg")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead>{t("colEmail")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead>{t("colRegisteredOn")}</TableHead>
                <TableHead>{t("colLastLogin")}</TableHead>
                <TableHead className="text-right">{t("colActions")}</TableHead>
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
                            {t("badgeVerified")}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                          >
                            <MailWarningIcon className="size-3" />
                            {t("badgePending")}
                          </Badge>
                        )}
                        {u.isOrgManager ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
                          >
                            <ShieldCheckIcon className="size-3" />
                            {t("badgeOrgManager")}
                          </Badge>
                        ) : u.canViewRdvHistory ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
                          >
                            <HistoryIcon className="size-3" />
                            {t("badgeHistoryAccess")}
                          </Badge>
                        ) : null}
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
                            title={t("actionResendConfirmation")}
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
                            title={t("actionActivateAccount")}
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
                            title={t("actionDisableAccount")}
                            className="text-amber-600 hover:text-amber-700"
                          >
                            <PauseIcon className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onSetUserFlag(u, "isOrgManager", !u.isOrgManager)
                          }
                          disabled={isPending}
                          title={
                            u.isOrgManager
                              ? t("actionOrgManagerRemove")
                              : t("actionOrgManagerGrant")
                          }
                          className={
                            u.isOrgManager
                              ? "text-violet-600 hover:text-violet-700"
                              : "text-muted-foreground"
                          }
                        >
                          <ShieldCheckIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onSetUserFlag(
                              u,
                              "canViewRdvHistory",
                              !u.canViewRdvHistory,
                            )
                          }
                          disabled={isPending}
                          title={
                            u.canViewRdvHistory
                              ? t("actionRdvHistoryRemove")
                              : t("actionRdvHistoryGrant")
                          }
                          className={
                            u.canViewRdvHistory
                              ? "text-sky-600 hover:text-sky-700"
                              : "text-muted-foreground"
                          }
                        >
                          <HistoryIcon className="size-4" />
                        </Button>
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
