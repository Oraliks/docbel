"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  Loader2,
  SaveIcon,
  Trash2Icon,
  AlertTriangleIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TypeToConfirmField, typeToConfirmMatches } from "@/components/ui/type-to-confirm-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface EditUserFormProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    status: string
  }
}

export function EditUserForm({ user }: EditUserFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteTyped, setDeleteTyped] = useState("")
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    password: "",
    confirmPassword: "",
    role: user.role,
    status: user.status,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Le nom est requis"
    }

    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email invalide"
    }

    if (formData.password && formData.password.length < 10) {
      newErrors.password = "Le mot de passe doit contenir au moins 10 caractères"
    } else if (
      formData.password &&
      (!/[a-z]/.test(formData.password) ||
        !/[A-Z]/.test(formData.password) ||
        !/\d/.test(formData.password))
    ) {
      newErrors.password =
        "Le mot de passe doit contenir une minuscule, une majuscule et un chiffre"
    }

    if (formData.password || formData.confirmPassword) {
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Les mots de passe ne correspondent pas"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const updateData: {
        name: string
        email: string
        role: string
        status: string
        password?: string
      } = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
      }
      if (formData.password) updateData.password = formData.password

      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(
          error.error || "Erreur lors de la mise à jour de l'utilisateur",
        )
      }
      toast.success("Utilisateur mis à jour avec succès")
      router.push("/admin/users")
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(
          error.error || "Erreur lors de la suppression de l'utilisateur",
        )
      }
      toast.success("Utilisateur supprimé avec succès")
      router.push("/admin/users")
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(message)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 md:px-6">
      <div>
        <Button
          render={<Link href="/admin/users" />}
          variant="ghost"
          size="sm"
          className="mb-3 gap-2 -ml-2"
        >
          <ArrowLeftIcon className="size-4" />
          Retour aux utilisateurs
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          Modifier l&apos;utilisateur
        </h1>
        <p className="text-muted-foreground mt-1">{user.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations du compte</CardTitle>
          <CardDescription>
            Laissez le mot de passe vide pour ne pas le changer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={loading}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={loading}
                  className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Laisser vide pour ne pas changer"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  disabled={loading}
                  className={errors.password ? "border-red-500" : ""}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  disabled={loading || !formData.password}
                  className={errors.confirmPassword ? "border-red-500" : ""}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rôle</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: string | null) =>
                    value && setFormData({ ...formData, role: value })
                  }
                  disabled={loading}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Utilisateur</SelectItem>
                    <SelectItem value="employer">Employeur</SelectItem>
                    <SelectItem value="moderator">Modérateur</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: string | null) =>
                    value && setFormData({ ...formData, status: value })
                  }
                  disabled={loading}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="disabled">Désactivé</SelectItem>
                    <SelectItem value="locked">Verrouillé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                render={<Link href="/admin/users" />}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                Enregistrer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-red-300 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
            <AlertTriangleIcon className="size-4" />
            Zone de danger
          </CardTitle>
          <CardDescription>
            La suppression du compte est définitive et irréversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!confirmDelete ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmDelete(true)
                setDeleteTyped("")
              }}
              className="gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2Icon className="size-4" />
              Supprimer cet utilisateur
            </Button>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-red-300 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/20">
              <p className="text-sm">
                Confirmer la suppression définitive de{" "}
                <strong>{user.name}</strong> ({user.email}) ?
              </p>
              <TypeToConfirmField
                requireText={user.email}
                value={deleteTyped}
                onChange={setDeleteTyped}
                disabled={deleting}
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting || !typeToConfirmMatches(deleteTyped, user.email)}
                  className="gap-2"
                >
                  {deleting && <Loader2 className="size-4 animate-spin" />}
                  Oui, supprimer définitivement
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
