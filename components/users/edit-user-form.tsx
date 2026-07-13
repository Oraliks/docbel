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
import { Switch } from "@/components/ui/switch"
import { TypeToConfirmField, typeToConfirmMatches } from "@/components/ui/type-to-confirm-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  IMPERSONATION_READ_ONLY_REASON,
  useImpersonationReadOnly,
} from "@/components/admin/use-impersonation-read-only"

type Segment = "" | "partenaire" | "employeur"

interface EditUserFormProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    status: string
    segment?: string | null
    partnerType?: string | null
    partnerOrganization?: string | null
    vatNumber?: string | null
    isOrgManager?: boolean
    canViewRdvHistory?: boolean
  }
  /// true = rendu dans un onglet de la fiche (masque le back + le gros titre,
  /// déjà fournis par le header de la fiche 360°).
  embedded?: boolean
}

const PARTNER_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "onem", label: "ONEM" },
  { value: "organisme_paiement", label: "Organisme de paiement" },
  { value: "service_public", label: "Service public" },
  { value: "prive_asbl", label: "Privé / ASBL" },
]

export function EditUserForm({ user, embedded = false }: EditUserFormProps) {
  const router = useRouter()
  const readOnly = useImpersonationReadOnly()
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
    segment: (user.segment === "partenaire" || user.segment === "employeur"
      ? user.segment
      : "") as Segment,
    partnerType: user.partnerType ?? "",
    partnerOrganization: user.partnerOrganization ?? "",
    vatNumber: user.vatNumber ?? "",
    isOrgManager: Boolean(user.isOrgManager),
    canViewRdvHistory: Boolean(user.canViewRdvHistory),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = (patch: Partial<typeof formData>) =>
    setFormData((prev) => ({ ...prev, ...patch }))

  /// Changer le rôle vers partner/employer aligne le segment (réduction de
  /// friction ; l'admin peut toujours ajuster ensuite).
  const onRoleChange = (role: string) => {
    if (role === "partner") update({ role, segment: "partenaire" })
    else if (role === "employer") update({ role, segment: "employeur" })
    else update({ role })
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = "Le nom est requis"

    if (!formData.email.trim()) newErrors.email = "L'email est requis"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Email invalide"

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

    if (formData.segment === "employeur" && !formData.vatNumber.trim()) {
      newErrors.vatNumber = "Le numéro de TVA est requis pour un employeur"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    try {
      const updateData: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status,
        // Toujours "segment-aware" : le back applique resolveUserSegmentFields.
        segment: formData.segment || "none",
        partnerType: formData.partnerType || null,
        partnerOrganization: formData.partnerOrganization || null,
        vatNumber: formData.vatNumber || null,
        isOrgManager: formData.isOrgManager,
        canViewRdvHistory: formData.canViewRdvHistory,
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
    <div className={embedded ? "flex flex-col gap-6" : "flex flex-col gap-6 px-4 py-6 md:px-6"}>
      {!embedded && (
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
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations du compte</CardTitle>
          <CardDescription>
            Laissez le mot de passe vide pour ne pas le changer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5" id="edit-user-form">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => update({ name: e.target.value })}
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
                  onChange={(e) => update({ email: e.target.value })}
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
                  onChange={(e) => update({ password: e.target.value })}
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
                  onChange={(e) => update({ confirmPassword: e.target.value })}
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
                    value && onRoleChange(value)
                  }
                  disabled={loading}
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Utilisateur</SelectItem>
                    <SelectItem value="partner">Partenaire</SelectItem>
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
                    value && update({ status: value })
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

            {/* Segment & accès */}
            <div className="space-y-5 border-t pt-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="segment">Segment d&apos;accès</Label>
                  <Select
                    value={formData.segment || "none"}
                    onValueChange={(value: string | null) => {
                      if (!value) return
                      update({ segment: value === "none" ? "" : (value as Segment) })
                    }}
                    disabled={loading}
                  >
                    <SelectTrigger id="segment">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun (citoyen / admin)</SelectItem>
                      <SelectItem value="partenaire">Partenaire</SelectItem>
                      <SelectItem value="employeur">Employeur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.segment !== "" && (
                  <div className="space-y-2">
                    <Label htmlFor="org">Organisation</Label>
                    <Input
                      id="org"
                      value={formData.partnerOrganization}
                      onChange={(e) => update({ partnerOrganization: e.target.value })}
                      placeholder="Nom de l'organisation"
                      disabled={loading}
                    />
                  </div>
                )}
              </div>

              {formData.segment === "partenaire" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="partnerType">Type de partenaire</Label>
                    <Select
                      value={formData.partnerType || "none"}
                      onValueChange={(value: string | null) => {
                        if (!value) return
                        update({ partnerType: value === "none" ? "" : value })
                      }}
                      disabled={loading}
                    >
                      <SelectTrigger id="partnerType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {PARTNER_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col justify-center gap-3 pt-1">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        Responsable du service
                        <span className="block text-xs text-muted-foreground">
                          Accès par défaut à l&apos;historique des RDV
                        </span>
                      </span>
                      <Switch
                        checked={formData.isOrgManager}
                        onCheckedChange={(v) => update({ isOrgManager: v })}
                        disabled={loading}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        Accès historique RDV
                        <span className="block text-xs text-muted-foreground">
                          Autorisation individuelle (non-responsable)
                        </span>
                      </span>
                      <Switch
                        checked={formData.canViewRdvHistory}
                        onCheckedChange={(v) => update({ canViewRdvHistory: v })}
                        disabled={loading}
                      />
                    </label>
                  </div>
                </div>
              )}

              {formData.segment === "employeur" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">Numéro de TVA</Label>
                    <Input
                      id="vatNumber"
                      value={formData.vatNumber}
                      onChange={(e) => update({ vatNumber: e.target.value })}
                      placeholder="BE0123456789"
                      disabled={loading}
                      className={errors.vatNumber ? "border-red-500" : ""}
                    />
                    {errors.vatNumber ? (
                      <p className="text-sm text-destructive">{errors.vatNumber}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Obligatoire, unique, validé (checksum mod-97).
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t pt-5">
              {!embedded && (
                <Button
                  type="button"
                  variant="outline"
                  render={<Link href="/admin/users" />}
                >
                  Annuler
                </Button>
              )}
              {readOnly ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span tabIndex={0}>
                          <Button type="button" disabled className="gap-2">
                            <SaveIcon className="size-4" />
                            Enregistrer
                          </Button>
                        </span>
                      }
                    />
                    <TooltipContent>{IMPERSONATION_READ_ONLY_REASON}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <SaveIcon className="size-4" />
                  )}
                  Enregistrer
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card id="danger" className="border-red-300 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
            <AlertTriangleIcon className="size-4" />
            Zone de danger
          </CardTitle>
          <CardDescription>
            La suppression du compte est définitive et irréversible. Les traces
            pseudonymes (dossiers, RDV) restent en base.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!confirmDelete ? (
            readOnly ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span tabIndex={0}>
                        <Button
                          type="button"
                          variant="outline"
                          disabled
                          className="gap-2 border-red-300 text-red-600 dark:border-red-900/50 dark:text-red-400"
                        >
                          <Trash2Icon className="size-4" />
                          Supprimer cet utilisateur
                        </Button>
                      </span>
                    }
                  />
                  <TooltipContent>{IMPERSONATION_READ_ONLY_REASON}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
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
            )
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
