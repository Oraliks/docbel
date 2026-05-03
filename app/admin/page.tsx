import { auth } from "@/auth"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

export default async function AdminPage() {
  const session = await auth()

  if (!session) {
    notFound()
  }

  const userRole = (session.user as any)?.role
  if (userRole !== "admin") {
    notFound()
  }

  const [rawPages, rawUsers, rawSections] = await Promise.all([
    prisma.page.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.toolSection.findMany({
      include: {
        tools: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    }),
  ])

  const pages = rawPages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    content: p.content,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  const users = rawUsers.map((u) => ({
    id: u.id,
    name: u.name ?? "",
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }))

  const sections = rawSections.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    icon: s.icon ?? undefined,
    order: s.order,
    tools: s.tools as any,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  })) as any

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <AdminDashboard pages={pages} users={users} sections={sections} />
    </div>
  )
}
