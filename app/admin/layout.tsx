import { auth } from "@/auth"
import { AdminLayoutProvider } from "@/components/admin-layout-provider"
import { prisma } from "@/lib/prisma"
import { UserRole, UserStatus } from "@prisma/client"
import { notFound } from "next/navigation"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    notFound()
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  })

  if (!user || user.role !== UserRole.admin || user.status !== UserStatus.active) {
    notFound()
  }

  return (
    <AdminLayoutProvider>
      {children}
    </AdminLayoutProvider>
  )
}
