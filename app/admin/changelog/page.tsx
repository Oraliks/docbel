import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { auth } from "@/lib/auth"
import { ChangelogManager } from "@/components/admin/changelog-manager"

export default async function ChangelogPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    notFound()
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== "admin") {
    notFound()
  }

  const t = await getTranslations("admin.changelog")

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Changelog Manager */}
      <ChangelogManager />
    </div>
  )
}
