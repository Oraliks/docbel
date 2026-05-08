import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminLayoutProvider } from "@/components/admin-layout-provider"
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
    </AdminLayoutProvider>
  )
}
