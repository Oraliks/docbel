import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminLayoutProvider } from "@/components/admin-layout-provider"
import { FloatingChatFabLazy } from "@/components/admin/chomage-ia/floating-chat/floating-chat-fab-lazy"
import { prisma, withDbRetry } from "@/lib/prisma"
import { UserRole, UserStatus } from "@prisma/client"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers()
  const session = await withDbRetry(() => auth.api.getSession({ headers: headerList })).catch(
    () => null
  )
  const userId = session?.user?.id

  if (!userId) {
    notFound()
  }

  const user = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    })
  ).catch(() => null)

  if (!user || user.role !== UserRole.admin || user.status !== UserStatus.active) {
    notFound()
  }

  return (
    <AdminLayoutProvider>
      {children}
      {/* FAB mini-chat IA chômage — visible sur toutes les pages /admin/*.
          Stateless (réinitialisé à chaque fermeture), réutilise la KB + la
          mémoire long-terme via /api/chomage-ia/quick-chat. */}
      <FloatingChatFabLazy />
    </AdminLayoutProvider>
  )
}
