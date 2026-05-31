"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trash2, Edit2, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { EditUserDialog } from "@/components/users/edit-user-dialog"
import { DeleteUserDialog } from "@/components/users/delete-user-dialog"

interface User {
  id: string
  name: string
  email: string
  role: string
  status: string
  segment: string | null
  partnerType: string | null
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

const ROLE_LABELS: Record<string, string> = {
  user: "Utilisateur",
  partner: "Partenaire",
  employer: "Employeur",
  moderator: "Modérateur",
  admin: "Administrateur",
}

const SEGMENT_LABELS: Record<string, string> = {
  partenaire: "Partenaire",
  employeur: "Employeur",
}

const PARTNER_TYPE_LABELS: Record<string, string> = {
  onem: "ONEM",
  organisme_paiement: "Organisme de paiement",
  service_public: "Service public",
  prive_asbl: "Privé-ASBL",
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users")
      if (!response.ok) throw new Error("Failed to fetch users")
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      toast.error("Erreur lors du chargement des utilisateurs")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function load() { await fetchUsers() }
    void load()
  }, [])

  const handleUserUpdated = (updatedUser: User) => {
    setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u))
    setEditingUser(null)
    toast.success("Utilisateur mis à jour avec succès")
  }

  const handleUserDeleted = async () => {
    if (!deletingUser) return

    try {
      const response = await fetch(`/api/users/${deletingUser.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete user")

      setUsers(users.filter(u => u.id !== deletingUser.id))
      setDeletingUser(null)
      toast.success("Utilisateur supprimé avec succès")
    } catch (error) {
      toast.error("Erreur lors de la suppression de l'utilisateur")
      console.error(error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getRoleBadgeColor = (role: string) => {
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

  const getStatusBadgeColor = (status: string) => {
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Actif"
      case "pending":
        return "En attente"
      case "locked":
        return "Verrouillé"
      case "disabled":
        return "Désactivé"
      default:
        return status
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">Gérez les utilisateurs du système</p>
        </div>
        <Button render={<Link href="/admin/users/new" />} className="gap-2">
          <Plus className="size-4" />
          Nouvel utilisateur
        </Button>
      </div>

      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onUserUpdated={handleUserUpdated}
      />

      <DeleteUserDialog
        user={deletingUser}
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        onConfirm={handleUserDeleted}
      />

      <div className="rounded-lg border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Nom</TableHead>
                <TableHead className="font-semibold">Email</TableHead>
                <TableHead className="font-semibold">Rôle</TableHead>
                <TableHead className="font-semibold">Segment</TableHead>
                <TableHead className="font-semibold">Statut</TableHead>
                <TableHead className="font-semibold">Dernière connexion</TableHead>
                <TableHead className="font-semibold">Créé le</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    {user.segment ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {SEGMENT_LABELS[user.segment] ?? user.segment}
                        </span>
                        {user.partnerType && (
                          <span className="text-xs text-muted-foreground">
                            {PARTNER_TYPE_LABELS[user.partnerType] ?? user.partnerType}
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
                        user.status
                      )}`}
                    >
                      {getStatusLabel(user.status)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Jamais"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUser(user)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit2 className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingUser(user)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
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
