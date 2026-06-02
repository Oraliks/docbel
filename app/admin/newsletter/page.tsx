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
        toast.error("Erreur lors du chargement des abonnés")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

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
        toast.success(status === "active" ? "Abonné réactivé" : "Abonné désabonné")
      }
    } catch {
      toast.error("Erreur lors de la mise à jour")
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/newsletter?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        setSubscribers((prev) => prev.filter((s) => s.id !== id))
        toast.success("Abonné supprimé")
      }
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }

  function exportCSV() {
    const rows = [
      ["Email", "Statut", "Source", "Date d'inscription"],
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
          <h1 className="text-3xl font-bold tracking-tight">Newsletter</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestion des abonnés à la newsletter de la page Actualités
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <DownloadIcon className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardDescription className="text-sm">Total abonnés</CardDescription>
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
                <CardDescription className="text-sm">Actifs</CardDescription>
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
                <CardDescription className="text-sm">Désabonnés</CardDescription>
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
          <CardTitle>Liste des abonnés</CardTitle>
          <CardDescription>
            Emails collectés via le formulaire sur la page Actualités
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un email..."
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
                  {f === "all" ? "Tous" : f === "active" ? "Actifs" : "Désabonnés"}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? "Aucun résultat pour cette recherche" : "Aucun abonné pour le moment"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Date d&apos;inscription</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                        {subscriber.status === "active" ? "Actif" : "Désabonné"}
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
                              Désabonner
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(subscriber.id, "active")}
                              className="gap-2"
                            >
                              <UserCheckIcon className="h-4 w-4" />
                              Réactiver
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(subscriber.id)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2Icon className="h-4 w-4" />
                            Supprimer
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
