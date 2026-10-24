import { notFound } from "next/navigation"
import { requireAdminAuth } from "@/lib/auth-check"
import { BaremesAutonomeWorkspace } from "@/components/admin/baremes-autonome/workspace"

export default async function BaremesAutonomePage() {
  const auth = await requireAdminAuth()
  if (!auth.isAuthorized) notFound()
  return <BaremesAutonomeWorkspace />
}
