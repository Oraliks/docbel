import { headers } from "next/headers"
import { notFound } from "next/navigation"
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

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Historique des modifications</h1>
        <p className="text-muted-foreground mt-1">Gérez les versions et mises à jour</p>
      </div>

      {/* Changelog Manager */}
      <ChangelogManager />
    </div>
  )
}
