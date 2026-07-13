"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowLeftIcon, Loader2, UserPlusIcon } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Segment = "" | "partenaire" | "employeur"

const PARTNER_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "onem", label: "ONEM" },
  { value: "organisme_paiement", label: "Organisme de paiement" },
  { value: "service_public", label: "Service public" },
  { value: "prive_asbl", label: "Privé / ASBL" },
]

export default function NewUserPage() {
  const router = useRouter()
  const t = useTranslations("admin.users")
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "user",
    status: "active",
    segment: "" as Segment,
    partnerType: "",
    partnerOrganization: "",
    vatNumber: "",
    isOrgManager: false,
    canViewRdvHistory: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = (patch: Partial<typeof formData>) =>
    setFormData((prev) => ({ ...prev, ...patch }))

  const onRoleChange = (role: string) => {
    if (role === "partner") update({ role, segment: "partenaire" })
    else if (role === "employer") update({ role, segment: "employeur" })
    else update({ role })
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = t("errorNameRequired")
    }

    if (!formData.email.trim()) {
      newErrors.email = t("errorEmailRequired")
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("errorEmailInvalid")
    }

    if (!formData.password) {
      newErrors.password = t("errorPasswordRequired")
    } else if (formData.password.length < 10) {
      newErrors.password = t("errorPasswordTooShort")
    } else if (
      !/[a-z]/.test(formData.password) ||
      !/[A-Z]/.test(formData.password) ||
      !/\d/.test(formData.password)
    ) {
      newErrors.password = t("errorPasswordComplexity")
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t("errorPasswordMismatch")
    }

    if (formData.segment === "employeur" && !formData.vatNumber.trim()) {
      newErrors.vatNumber = "Le numéro de TVA est requis pour un employeur"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          status: formData.status,
          segment: formData.segment || "none",
          partnerType: formData.partnerType || null,
          partnerOrganization: formData.partnerOrganization || null,
          vatNumber: formData.vatNumber || null,
          isOrgManager: formData.isOrgManager,
          canViewRdvHistory: formData.canViewRdvHistory,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || t("errorCreateFailed"))
      }

      toast.success(t("toastCreated"))
      router.push("/admin/users")
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("errorUnknown")
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div>
        <Button
          render={<Link href="/admin/users" />}
          variant="ghost"
          size="sm"
          className="mb-3 gap-2 -ml-2"
        >
          <ArrowLeftIcon className="size-4" />
          {t("backToUsers")}
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{t("newUser")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("newUserSubtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlusIcon className="size-4" />
            {t("accountInfo")}
          </CardTitle>
          <CardDescription>
            {t("passwordHint")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">{t("labelFullName")}</Label>
                <Input
                  id="name"
                  placeholder={t("placeholderFullName")}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={loading}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">{t("colEmail")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("placeholderEmail")}
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={loading}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("labelPassword")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  disabled={loading}
                  className={errors.password ? "border-destructive" : ""}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("labelConfirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  disabled={loading}
                  className={errors.confirmPassword ? "border-destructive" : ""}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">{t("colRole")}</Label>
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
                    <SelectItem value="user">{t("roleUser")}</SelectItem>
                    <SelectItem value="partner">{t("rolePartner")}</SelectItem>
                    <SelectItem value="employer">{t("roleEmployer")}</SelectItem>
                    <SelectItem value="moderator">{t("roleModerator")}</SelectItem>
                    <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{t("colStatus")}</Label>
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
                    <SelectItem value="active">{t("statusActive")}</SelectItem>
                    <SelectItem value="pending">{t("statusPending")}</SelectItem>
                    <SelectItem value="disabled">{t("statusDisabled")}</SelectItem>
                    <SelectItem value="locked">{t("statusLocked")}</SelectItem>
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
                      <span>Responsable du service</span>
                      <Switch
                        checked={formData.isOrgManager}
                        onCheckedChange={(v) => update({ isOrgManager: v })}
                        disabled={loading}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>Accès historique RDV</span>
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
                      className={errors.vatNumber ? "border-destructive" : ""}
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
              <Button
                type="button"
                variant="outline"
                render={<Link href="/admin/users" />}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading && <Loader2 className="size-4 animate-spin" />}
                {t("createUser")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
