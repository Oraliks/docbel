"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleSlash,
  Edit2,
  Handshake,
  MoreVertical,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  Trash2,
  User as UserIcon,
  Users as UsersIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type UsersListUser = {
  id: string
  name: string | null
  email: string
  role: "user" | "partner" | "employer" | "moderator" | "admin"
  status: "active" | "pending" | "locked" | "disabled"
  segment: "partenaire" | "employeur" | null
  partnerType: string | null
  lastLoginAt: string | null
  createdAt: string
}

interface UsersListClientProps {
  users: UsersListUser[]
}

const ROLE_LABEL_KEYS: Record<UsersListUser["role"], string> = {
  user: "roleUser",
  partner: "rolePartner",
  employer: "roleEmployer",
  moderator: "roleModerator",
  admin: "roleAdmin",
}

const SEGMENT_LABEL_KEYS: Record<NonNullable<UsersListUser["segment"]>, string> = {
  partenaire: "segmentPartenaire",
  employeur: "segmentEmployeur",
}

const PARTNER_TYPE_LABEL_KEYS: Record<string, string> = {
  onem: "partnerTypeOnem",
  organisme_paiement: "partnerTypeOrganismePaiement",
  service_public: "partnerTypeServicePublic",
  prive_asbl: "partnerTypePriveAsbl",
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getInitials(user: UsersListUser): string {
  const source = user.name?.trim() || user.email
  return (
    source
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

const AVATAR_PALETTE = [
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
  "bg-orange-500/15 text-orange-600 dark:text-orange-300",
]

function avatarColorClass(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

function roleBadgeClass(role: UsersListUser["role"]): string {
  switch (role) {
    case "admin":
      return "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-300"
    case "moderator":
      return "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
    case "partner":
      return "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300"
    case "employer":
      return "bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300"
    default:
      return "bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300"
  }
}

function statusDotClass(status: UsersListUser["status"]): string {
  switch (status) {
    case "active":
      return "bg-emerald-500"
    case "pending":
      return "bg-amber-500"
    case "locked":
      return "bg-orange-500"
    case "disabled":
    default:
      return "bg-muted-foreground/60"
  }
}

function statusTextClass(status: UsersListUser["status"]): string {
  switch (status) {
    case "active":
      return "text-emerald-600 dark:text-emerald-400"
    case "pending":
      return "text-amber-600 dark:text-amber-400"
    case "locked":
      return "text-orange-600 dark:text-orange-400"
    case "disabled":
    default:
      return "text-muted-foreground"
  }
}

export function UsersListClient({ users }: UsersListClientProps) {
  const t = useTranslations("admin.users")

  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [segmentFilter, setSegmentFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(20)

  const stats = useMemo(() => {
    const counts = {
      total: users.length,
      active: 0,
      inactive: 0,
      admin: 0,
      employer: 0,
      partner: 0,
      user: 0,
    }
    for (const u of users) {
      if (u.status === "active") counts.active++
      else counts.inactive++
      if (u.role === "admin") counts.admin++
      else if (u.role === "employer") counts.employer++
      else if (u.role === "partner") counts.partner++
      else if (u.role === "user") counts.user++
    }
    return counts
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false
      if (segmentFilter !== "all") {
        if (segmentFilter === "none" && u.segment) return false
        if (segmentFilter !== "none" && u.segment !== segmentFilter) return false
      }
      if (statusFilter !== "all" && u.status !== statusFilter) return false
      if (q) {
        const name = (u.name ?? "").toLowerCase()
        const email = u.email.toLowerCase()
        if (!name.includes(q) && !email.includes(q)) return false
      }
      return true
    })
  }, [users, search, roleFilter, segmentFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const pageRows = filtered.slice(start, start + pageSize)

  const filtersActive =
    search.trim() !== "" ||
    roleFilter !== "all" ||
    segmentFilter !== "all" ||
    statusFilter !== "all"

  function resetFilters() {
    setSearch("")
    setRoleFilter("all")
    setSegmentFilter("all")
    setStatusFilter("all")
    setPage(1)
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <StatsCards stats={stats} t={t as (key: string) => string} />

      <div className="rounded-xl border bg-card p-3 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder={t("searchPlaceholder")}
              className="h-10 pl-9"
            />
          </div>

          <FloatingSelect
            label={t("filterRole")}
            value={roleFilter}
            onValueChange={(v) => {
              setRoleFilter(v)
              setPage(1)
            }}
            items={[
              { value: "all", label: t("filterAll") },
              { value: "admin", label: t("roleAdmin") },
              { value: "moderator", label: t("roleModerator") },
              { value: "partner", label: t("rolePartner") },
              { value: "employer", label: t("roleEmployer") },
              { value: "user", label: t("roleUser") },
            ]}
          />
          <FloatingSelect
            label={t("filterSegment")}
            value={segmentFilter}
            onValueChange={(v) => {
              setSegmentFilter(v)
              setPage(1)
            }}
            items={[
              { value: "all", label: t("filterAll") },
              { value: "partenaire", label: t("segmentPartenaire") },
              { value: "employeur", label: t("segmentEmployeur") },
              { value: "none", label: t("segmentNone") },
            ]}
          />
          <FloatingSelect
            label={t("filterStatus")}
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v)
              setPage(1)
            }}
            items={[
              { value: "all", label: t("filterAll") },
              { value: "active", label: t("statusActive") },
              { value: "pending", label: t("statusPending") },
              { value: "locked", label: t("statusLocked") },
              { value: "disabled", label: t("statusDisabled") },
            ]}
          />

          <Button
            variant="ghost"
            size="lg"
            onClick={resetFilters}
            disabled={!filtersActive}
            className="gap-1.5"
          >
            <RefreshCcw className="size-4" />
            {t("filterReset")}
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Button
              render={<Link href="/admin/users/new" />}
              size="lg"
              className="gap-1.5"
            >
              <Plus className="size-4" />
              {t("newUser")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-lg" aria-label={t("more")}>
                    <MoreVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={resetFilters}>
                  <RefreshCcw />
                  {t("filterReset")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/admin/impersonation" />}>
                  <Shield />
                  {t("openImpersonationAudit")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card ring-1 ring-foreground/10">
        {filtered.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <p>{t("emptyState")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">{t("colName")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("colEmail")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("colRole")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("colSegment")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("colStatus")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("colLastLogin")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("colCreatedAt")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((u) => (
                  <UserRow key={u.id} user={u} t={t as (key: string, vars?: Record<string, string | number>) => string} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {t("rowsCount", { count: filtered.length })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground">{t("rowsPerPage")}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                if (!v) return
                setPageSize(Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="h-8 w-fit min-w-[68px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <span className="mr-2 text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage(1)}
              disabled={currentPage === 1}
              aria-label={t("pageFirst")}
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label={t("pagePrev")}
            >
              <ChevronLeft />
            </Button>
            <span
              className="grid h-7 min-w-[32px] place-items-center rounded-[10px] border bg-background px-2 text-xs"
              aria-current="page"
            >
              {currentPage}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label={t("pageNext")}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPage(totalPages)}
              disabled={currentPage === totalPages}
              aria-label={t("pageLast")}
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatsCardsProps {
  stats: {
    total: number
    active: number
    inactive: number
    admin: number
    employer: number
    partner: number
    user: number
  }
  t: (key: string) => string
}

function StatsCards({ stats, t }: StatsCardsProps) {
  const cards: Array<{
    label: string
    value: number
    icon: React.ComponentType<{ className?: string }>
    bg: string
    fg: string
  }> = [
    {
      label: t("statTotal"),
      value: stats.total,
      icon: UsersIcon,
      bg: "bg-violet-500/15",
      fg: "text-violet-600 dark:text-violet-300",
    },
    {
      label: t("statActive"),
      value: stats.active,
      icon: CheckCircle2,
      bg: "bg-emerald-500/15",
      fg: "text-emerald-600 dark:text-emerald-300",
    },
    {
      label: t("statInactive"),
      value: stats.inactive,
      icon: CircleSlash,
      bg: "bg-slate-500/15",
      fg: "text-slate-600 dark:text-slate-300",
    },
    {
      label: t("statAdmins"),
      value: stats.admin,
      icon: Shield,
      bg: "bg-red-500/15",
      fg: "text-red-600 dark:text-red-300",
    },
    {
      label: t("statEmployers"),
      value: stats.employer,
      icon: Briefcase,
      bg: "bg-teal-500/15",
      fg: "text-teal-600 dark:text-teal-300",
    },
    {
      label: t("statPartners"),
      value: stats.partner,
      icon: Handshake,
      bg: "bg-fuchsia-500/15",
      fg: "text-fuchsia-600 dark:text-fuchsia-300",
    },
    {
      label: t("statUsers"),
      value: stats.user,
      icon: UserIcon,
      bg: "bg-blue-500/15",
      fg: "text-blue-600 dark:text-blue-300",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 ring-1 ring-foreground/10"
          >
            <div
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full",
                card.bg,
                card.fg,
              )}
            >
              <Icon className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-medium text-muted-foreground">
                {card.label}
              </span>
              <span className="text-xl font-bold leading-tight">{card.value}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface FloatingSelectProps {
  label: string
  value: string
  onValueChange: (v: string) => void
  items: Array<{ value: string; label: string }>
}

function FloatingSelect({ label, value, onValueChange, items }: FloatingSelectProps) {
  const selected = items.find((i) => i.value === value)
  return (
    <div className="relative">
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === null) return
          onValueChange(v)
        }}
      >
        <SelectTrigger className="h-12 w-fit min-w-[140px] pt-4">
          <SelectValue>{selected?.label ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="pointer-events-none absolute left-2.5 top-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

interface UserRowProps {
  user: UsersListUser
  t: (key: string, vars?: Record<string, string | number>) => string
}

function UserRow({ user, t }: UserRowProps) {
  const initials = getInitials(user)
  const isInactive = user.status !== "active"

  return (
    <tr className="border-b last:border-b-0 transition-colors hover:bg-muted/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
              isInactive
                ? "bg-muted text-muted-foreground"
                : avatarColorClass(user.id),
            )}
            aria-hidden
          >
            {initials}
          </div>
          <span className="font-medium">
            {user.name?.trim() || t("unnamed")}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
            roleBadgeClass(user.role),
          )}
        >
          {t(ROLE_LABEL_KEYS[user.role])}
        </span>
      </td>
      <td className="px-4 py-3">
        {user.segment ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">
              {t(SEGMENT_LABEL_KEYS[user.segment])}
            </span>
            {user.partnerType && PARTNER_TYPE_LABEL_KEYS[user.partnerType] && (
              <span className="text-xs text-muted-foreground">
                {t(PARTNER_TYPE_LABEL_KEYS[user.partnerType])}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span
            className={cn("size-1.5 rounded-full", statusDotClass(user.status))}
            aria-hidden
          />
          <span className={statusTextClass(user.status)}>
            {t(`status${capitalize(user.status)}`)}
          </span>
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {user.lastLoginAt ? formatDate(user.lastLoginAt) : t("never")}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatDate(user.createdAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("rowActions")}
              >
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/admin/users/${user.id}`} />}>
              <Edit2 />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              render={<Link href={`/admin/users/${user.id}#danger`} />}
            >
              <Trash2 />
              {t("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
