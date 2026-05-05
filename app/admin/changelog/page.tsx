import { auth } from "@/auth"
import { notFound } from "next/navigation"
import { ChangelogManager } from "@/components/admin/changelog-manager"

export default async function ChangelogPage() {
  // Vérifier si l'utilisateur est authentifié
  const session = await auth()

  // Si pas authentifié, afficher 404
  if (!session) {
    notFound()
  }

  // Vérifier si l'utilisateur a le rôle admin
  const userRole = (session.user as { role?: string })?.role
  if (userRole !== "admin") {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Historique des modifications</h1>
        <p className="text-muted-foreground mt-1">Gérez les versions et mises à jour</p>
      </div>

      {/* Changelog Manager */}
      <ChangelogManager />
    </div>
  )
}
