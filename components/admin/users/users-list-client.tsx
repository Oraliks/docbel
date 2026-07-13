"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleSlash,
  Download,
  Edit2,
  Eye,
  Handshake,
  Loader2,
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
import {
  DEFAULT_USER_SORT,
  usersQueryToSearchParams,
  type UserListSort,
  type UsersQuery,
} from "@/lib/users-query"
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
  partnerOrganization: string | null
  vatNumber: string | null
  emailVerifiedAt: string | null
  lastLoginAt: string | null
  createdAt: string
}

export type UsersListStats = {
  total: number
  active: number
  inactive: number
  admin: number
  employer: number
  partner: number
  user: number
}

/// Filtres résolus côté serveur (source de vérité = URL). `q` est répliqué en
/// state local pour le champ de recherche (debounce), le reste pilote l'URL.
export type UsersListQuery = {
  q: string
  role: UsersListUser["role"] | null
  segment: "partenaire" | "employeur" | "none" | null
  status: UsersListUser["status"] | null
  sort: UserListSort
}

interface UsersListClientProps {
  users: UsersListUser[]
  stats: UsersListStats
  total: number
  page: number
  pageSize: number
  query: UsersListQuery
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

export function UsersListClient({
  users,
  stats,
  total,
  page,
  pageSize,
  query,
}: UsersListClientProps) {
  const t = useTranslations("admin.users")
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  // Recherche : state local (frappe fluide) synchronisé vers l'URL en debounce.
  const [search, setSearch] = useState(query.q)
  // Réinitialise le champ si la query serveur change hors frappe (reset filtres).
  const lastPushedSearch = useRef(query.q)
  useEffect(() => {
    if (query.q !== lastPushedSearch.current) {
      setSearch(query.q)
      lastPushedSearch.current = query.q
    }
  }, [query.q])

  /// Construit l'URL cible depuis la query courante + un patch, puis navigue
  /// (replace = pas d'entrée d'historique par frappe). La page serveur re-résout
  /// filtres/tri/pagination.
  function navigate(patch: Partial<UsersQuery>, resetPage = true) {
    const next: Partial<UsersQuery> = {
      q: query.q,
      role: query.role,
      segment: query.segment,
      status: query.status,
      sort: query.sort,
      page,
      pageSize,
      ...patch,
    }
    if (resetPage && patch.page === undefined) next.page = 1
    const params = usersQueryToSearchParams(next)
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  // Debounce de la recherche (300ms). On ne pousse que si la valeur diffère de
  // ce que le serveur connaît déjà, pour éviter une navigation au montage.
  useEffect(() => {
    const term = search.trim()
    if (term === query.q) return
    const timer = setTimeout(() => {
      lastPushedSearch.current = term
      navigate({ q: term })
    }, 300)
    return () => clearTimeout(timer)
    // navigate/query capturés volontairement à chaque rendu ; seul `search`
    // déclenche le debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const filtersActive =
    query.q !== "" ||
    query.role !== null ||
    query.segment !== null ||
    query.status !== null ||
    query.sort !== DEFAULT_USER_SORT

  function resetFilters() {
    setSearch("")
    lastPushedSearch.current = ""
    navigate({
      q: "",
      role: null,
      segment: null,
      status: null,
      sort: DEFAULT_USER_SORT,
      page: 1,
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, total)

  const exportParams = usersQueryToSearchParams({
    q: query.q,
    role: query.role,
    segment: query.segment,
    status: query.status,
    sort: query.sort,
  }).toString()
  const exportHref = exportParams
    ? `/api/users/export?${exportParams}`
    : "/api/users/export"

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <StatsStrip
        stats={stats}
        query={query}
        t={t as (key: string) => string}
        onFilterRole={(role) => navigate({ role })}
        onFilterStatus={(status) => navigate({ status })}
      />

      <div className="rounded-xl border bg-card p-3 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-10 pl-9"
            />
            {isPending && (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          <FloatingSelect
            label={t("filterRole")}
            value={query.role ?? "all"}
            onValueChange={(v) =>
              navigate({ role: v === "all" ? null : (v as UsersListUser["role"]) })
            }
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
            value={query.segment ?? "all"}
            onValueChange={(v) =>
              navigate({
                segment: v === "all" ? null : (v as UsersListQuery["segment"]),
              })
            }
            items={[
              { value: "all", label: t("filterAll") },
              { value: "partenaire", label: t("segmentPartenaire") },
              { value: "employeur", label: t("segmentEmployeur") },
              { value: "none", label: t("segmentNone") },
            ]}
          />
          <FloatingSelect
            label={t("filterStatus")}
            value={query.status ?? "all"}
            onValueChange={(v) =>
              navigate({
                status: v === "all" ? null : (v as UsersListUser["status"]),
              })
            }
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
              render={<a href={exportHref} />}
              variant="outline"
              size="lg"
              className="gap-1.5"
            >
              <Download className="size-4" />
              {t("exportCsv")}
            </Button>
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
        {total === 0 ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <p>{t("emptyState")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <SortableHeader
                    label={t("colName")}
                    field="name"
                    sort={query.sort}
                    onSort={(sort) => navigate({ sort })}
                  />
                  <th className="px-4 py-3 text-left font-medium">{t("colEmail")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("colRole")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("colSegment")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("colOrganisation")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("colStatus")}</th>
                  <SortableHeader
                    label={t("colLastLogin")}
                    field="lastLoginAt"
                    sort={query.sort}
                    onSort={(sort) => navigate({ sort })}
                  />
                  <SortableHeader
                    label={t("colCreatedAt")}
                    field="createdAt"
                    sort={query.sort}
                    onSort={(sort) => navigate({ sort })}
                  />
                  <th className="px-4 py-3 text-right font-medium">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    t={t as (key: string, vars?: Record<string, string | number>) => string}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {total === 0
              ? t("rowsCount", { count: 0 })
              : t("rowsRange", { start: rangeStart, end: rangeEnd, total })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground">{t("rowsPerPage")}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                if (!v) return
                navigate({ pageSize: Number(v), page: 1 })
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
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate({ page: 1 }, false)}
              disabled={page === 1}
              aria-label={t("pageFirst")}
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate({ page: Math.max(1, page - 1) }, false)}
              disabled={page === 1}
              aria-label={t("pagePrev")}
            >
              <ChevronLeft />
            </Button>
            <span
              className="grid h-7 min-w-[32px] place-items-center rounded-[10px] border bg-background px-2 text-xs tabular-nums"
              aria-current="page"
            >
              {page}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate({ page: Math.min(totalPages, page + 1) }, false)}
              disabled={page >= totalPages}
              aria-label={t("pageNext")}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate({ page: totalPages }, false)}
              disabled={page >= totalPages}
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

interface StatsStripProps {
  stats: UsersListStats
  query: UsersListQuery
  t: (key: string) => string
  onFilterRole: (role: UsersListUser["role"] | null) => void
  onFilterStatus: (status: UsersListUser["status"] | null) => void
}

/// Bandeau de stats en grammaire cockpit (cartes compactes, valeurs tabulaires,
/// cliquables pour filtrer). Reprend la densité de components/admin/dashboard/*.
function StatsStrip({
  stats,
  query,
  t,
  onFilterRole,
  onFilterStatus,
}: StatsStripProps) {
  const cards: Array<{
    key: string
    label: string
    value: number
    icon: React.ComponentType<{ className?: string }>
    fg: string
    active: boolean
    onClick: () => void
  }> = [
    {
      key: "total",
      label: t("statTotal"),
      value: stats.total,
      icon: UsersIcon,
      fg: "text-violet-600 dark:text-violet-300",
      active:
        query.role === null && query.status === null && query.segment === null,
      onClick: () => {
        onFilterRole(null)
      },
    },
    {
      key: "active",
      label: t("statActive"),
      value: stats.active,
      icon: CheckCircle2,
      fg: "text-emerald-600 dark:text-emerald-300",
      active: query.status === "active",
      onClick: () => onFilterStatus(query.status === "active" ? null : "active"),
    },
    {
      key: "inactive",
      label: t("statInactive"),
      value: stats.inactive,
      icon: CircleSlash,
      fg: "text-slate-600 dark:text-slate-300",
      active: false,
      onClick: () => onFilterStatus(null),
    },
    {
      key: "admin",
      label: t("statAdmins"),
      value: stats.admin,
      icon: Shield,
      fg: "text-red-600 dark:text-red-300",
      active: query.role === "admin",
      onClick: () => onFilterRole(query.role === "admin" ? null : "admin"),
    },
    {
      key: "employer",
      label: t("statEmployers"),
      value: stats.employer,
      icon: Briefcase,
      fg: "text-teal-600 dark:text-teal-300",
      active: query.role === "employer",
      onClick: () => onFilterRole(query.role === "employer" ? null : "employer"),
    },
    {
      key: "partner",
      label: t("statPartners"),
      value: stats.partner,
      icon: Handshake,
      fg: "text-fuchsia-600 dark:text-fuchsia-300",
      active: query.role === "partner",
      onClick: () => onFilterRole(query.role === "partner" ? null : "partner"),
    },
    {
      key: "user",
      label: t("statUsers"),
      value: stats.user,
      icon: UserIcon,
      fg: "text-blue-600 dark:text-blue-300",
      active: query.role === "user",
      onClick: () => onFilterRole(query.role === "user" ? null : "user"),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <button
            key={card.key}
            type="button"
            onClick={card.onClick}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left ring-1 transition-colors hover:bg-muted/40",
              card.active
                ? "ring-2 ring-primary/60"
                : "ring-foreground/10",
            )}
          >
            <div className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-muted/60", card.fg)}>
              <Icon className="size-5" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[11px] font-medium text-muted-foreground">
                {card.label}
              </span>
              <span className="text-xl font-semibold leading-tight tabular-nums">
                {card.value}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

interface SortableHeaderProps {
  label: string
  field: "name" | "createdAt" | "lastLoginAt"
  sort: UserListSort
  onSort: (sort: UserListSort) => void
}

/// En-tête de colonne triable : clique = bascule asc/desc sur ce champ.
function SortableHeader({ label, field, sort, onSort }: SortableHeaderProps) {
  const isActive = sort === field || sort === `-${field}`
  const isDesc = sort === `-${field}`
  const next: UserListSort = isActive && isDesc ? field : (`-${field}` as UserListSort)

  return (
    <th className="px-4 py-3 text-left font-medium">
      <button
        type="button"
        onClick={() => onSort(next)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {!isActive ? (
          <ArrowUpDown className="size-3.5 opacity-50" />
        ) : isDesc ? (
          <ArrowDown className="size-3.5" />
        ) : (
          <ArrowUp className="size-3.5" />
        )}
      </button>
    </th>
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
          <Link
            href={`/admin/users/${user.id}`}
            className="font-medium hover:underline"
          >
            {user.name?.trim() || t("unnamed")}
          </Link>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          {user.email}
          {user.emailVerifiedAt ? (
            <BadgeCheck
              className="size-3.5 text-emerald-500"
              aria-label={t("emailVerified")}
            />
          ) : null}
        </span>
      </td>
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
        {user.partnerOrganization ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm">{user.partnerOrganization}</span>
            {user.vatNumber && (
              <span className="font-mono text-xs text-muted-foreground">
                {user.vatNumber}
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
              <Eye />
              {t("openProfile")}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/admin/users/${user.id}?tab=edition`} />}>
              <Edit2 />
              {t("edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              render={<Link href={`/admin/users/${user.id}?tab=securite#danger`} />}
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
