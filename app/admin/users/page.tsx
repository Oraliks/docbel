import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { SAFE_USER_SELECT, serializeUser } from "@/lib/users"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Edit2, Plus } from "lucide-react"

// Maps DB value → clé i18n (sous admin.users). Le libellé FR vit dans messages.
const ROLE_LABEL_KEYS: Record<string, string> = {
  user: "roleUser",
  partner: "rolePartner",
  employer: "roleEmployer",
  moderator: "roleModerator",
  admin: "roleAdmin",
}

const SEGMENT_LABEL_KEYS: Record<string, string> = {
  partenaire: "segmentPartenaire",
  employeur: "segmentEmployeur",
}

const PARTNER_TYPE_LABEL_KEYS: Record<string, string> = {
  onem: "partnerTypeOnem",
  organisme_paiement: "partnerTypeOrganismePaiement",
  service_public: "partnerTypeServicePublic",
  prive_asbl: "partnerTypePriveAsbl",
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getRoleBadgeColor(role: string) {
  switch (role) {
    case "admin":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
    case "moderator":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
    case "partner":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
    case "employer":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
    case "pending":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200"
    case "locked":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200"
    case "disabled":
      return "bg-muted text-muted-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function getStatusLabel(
  status: string,
  t: (key: string) => string,
) {
  switch (status) {
    case "active":
      return t("statusActive")
    case "pending":
      return t("statusPending")
    case "locked":
      return t("statusLocked")
    case "disabled":
      return t("statusDisabled")
    default:
      return status
  }
}

// Server Component : la liste (lecture seule, navigation par <Link>) est rendue
// côté serveur. `take: 1000` (convention AGENTS) + SAFE_USER_SELECT partagé avec
// /api/users. L'attente est couverte par app/admin/loading.tsx (skeleton table).
export default async function UsersPage() {
  const t = await getTranslations("admin.users")
  const rows = await prisma.user.findMany({
    select: SAFE_USER_SELECT,
    orderBy: { createdAt: "desc" },
    take: 1000,
  })
  const users = rows.map(serializeUser)

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button render={<Link href="/admin/users/new" />} className="gap-2">
          <Plus className="size-4" />
          {t("newUser")}
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {users.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>{t("emptyState")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">{t("colName")}</TableHead>
                <TableHead className="font-semibold">{t("colEmail")}</TableHead>
                <TableHead className="font-semibold">{t("colRole")}</TableHead>
                <TableHead className="font-semibold">{t("colSegment")}</TableHead>
                <TableHead className="font-semibold">{t("colStatus")}</TableHead>
                <TableHead className="font-semibold">{t("colLastLogin")}</TableHead>
                <TableHead className="font-semibold">{t("colCreatedAt")}</TableHead>
                <TableHead className="font-semibold text-right">{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        user.role,
                      )}`}
                    >
                      {ROLE_LABEL_KEYS[user.role]
                        ? t(ROLE_LABEL_KEYS[user.role])
                        : user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    {user.segment ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {SEGMENT_LABEL_KEYS[user.segment]
                            ? t(SEGMENT_LABEL_KEYS[user.segment])
                            : user.segment}
                        </span>
                        {user.partnerType && (
                          <span className="text-xs text-muted-foreground">
                            {PARTNER_TYPE_LABEL_KEYS[user.partnerType]
                              ? t(PARTNER_TYPE_LABEL_KEYS[user.partnerType])
                              : user.partnerType}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                        user.status,
                      )}`}
                    >
                      {getStatusLabel(user.status, t)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.lastLoginAt
                      ? formatDate(user.lastLoginAt)
                      : t("never")}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href={`/admin/users/${user.id}`} />}
                      className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400"
                    >
                      <Edit2 className="size-4" />
                      {t("edit")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
