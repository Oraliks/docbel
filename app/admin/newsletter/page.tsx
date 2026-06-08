"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, MailIcon, UserCheckIcon, UserXIcon, Trash2Icon, SearchIcon, DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

interface Subscriber {
  id: string
  email: string
  status: "active" | "unsubscribed"
  source: string
  createdAt: string
  updatedAt: string
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function NewsletterAdminPage() {
  const t = useTranslations("admin.newsletter")
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "unsubscribed">("all")

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/newsletter")
        if (res.ok) {
          const data = await res.json()
          setSubscribers(data)
        }
      } catch {
        toast.error(t("loadError"))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [t])

  async function handleStatusChange(id: string, status: "active" | "unsubscribed") {
    try {
      const res = await fetch("/api/newsletter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        setSubscribers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status } : s))
        )
        toast.success(status === "active" ? t("reactivated") : t("unsubscribed"))
      }
    } catch {
      toast.error(t("updateError"))
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/newsletter?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        setSubscribers((prev) => prev.filter((s) => s.id !== id))
        toast.success(t("deleted"))
      }
    } catch {
      toast.error(t("deleteError"))
    }
  }

  function exportCSV() {
    const rows = [
      [t("colEmail"), t("colStatus"), t("colSource"), t("colSignupDate")],
      ...filtered.map((s) => [s.email, s.status, s.source, formatDate(s.createdAt)]),
    ]
    const csv = rows.map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "newsletter-abonnes.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = subscribers.filter((s) => {
    const matchSearch = s.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "all" || s.status === filter
    return matchSearch && matchFilter
  })

  const activeCount = subscribers.filter((s) => s.status === "active").length
  const unsubCount = subscribers.filter((s) => s.status === "unsubscribed").length

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <DownloadIcon className="h-4 w-4" />
          {t("exportCsv")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardDescription className="text-sm">{t("statTotal")}</CardDescription>
                <CardTitle className="text-2xl font-bold">{subscribers.length}</CardTitle>
              </div>
              <MailIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardDescription className="text-sm">{t("statActive")}</CardDescription>
                <CardTitle className="text-2xl font-bold text-green-600">{activeCount}</CardTitle>
              </div>
              <UserCheckIcon className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardDescription className="text-sm">{t("statUnsubscribed")}</CardDescription>
                <CardTitle className="text-2xl font-bold text-muted-foreground">{unsubCount}</CardTitle>
              </div>
              <UserXIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>
            {t("listSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "active", "unsubscribed"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f)}
                >
                  {t("filter", { value: f })}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t("loading")}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? t("noResults") : t("emptyList")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colEmail")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead>{t("colSource")}</TableHead>
                  <TableHead>{t("colSignupDate")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((subscriber) => (
                  <TableRow key={subscriber.id}>
                    <TableCell className="font-medium">{subscriber.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={subscriber.status === "active" ? "default" : "secondary"}
                        className={subscriber.status === "active" ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-200 dark:border-green-900" : ""}
                      >
                        {subscriber.status === "active" ? t("badgeActive") : t("badgeUnsubscribed")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">
                      {subscriber.source}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(subscriber.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-8 w-8 p-0 hover:bg-muted rounded-md transition-colors inline-flex items-center justify-center">
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {subscriber.status === "active" ? (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(subscriber.id, "unsubscribed")}
                              className="gap-2"
                            >
                              <UserXIcon className="h-4 w-4" />
                              {t("actionUnsubscribe")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(subscriber.id, "active")}
                              className="gap-2"
                            >
                              <UserCheckIcon className="h-4 w-4" />
                              {t("actionReactivate")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(subscriber.id)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2Icon className="h-4 w-4" />
                            {t("actionDelete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
