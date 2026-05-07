import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    notFound()
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== "admin") {
    notFound()
  }

  const [rawPages, rawUsers, rawSections] = await Promise.all([
    prisma.page.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
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
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  const users = rawUsers.map((u) => ({
    id: u.id,
    name: u.name ?? "",
    email: u.email,
    role: u.role,
    status: u.status,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }))

  const sections = rawSections.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    icon: s.icon ?? undefined,
    order: s.order,
    tools: s.tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      description: tool.description,
      type: tool.type,
      icon: tool.icon ?? undefined,
      popular: tool.popular,
      timeMin: tool.timeMin ?? undefined,
      order: tool.order,
    })),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }))

  return (
    <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
      <AdminDashboard pages={pages} users={users} sections={sections} />
    </div>
  )
}
