import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminAuth } from "@/lib/auth-check"

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" }

export type LinkableItem = {
  group: string
  label: string
  url: string
}

/**
 * Liste des cibles internes "linkables" pour le sélecteur de lien du page-builder.
 * Réservé aux admins (même garde que le reste de l'éditeur).
 */
export async function GET() {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const [pages, news] = await Promise.all([
      prisma.page.findMany({
        where: { status: "published", deletedAt: null },
        select: { title: true, slug: true },
        take: 200,
        orderBy: { title: "asc" },
      }),
      prisma.news.findMany({
        where: { status: "published" },
        select: { title: true, slug: true },
        take: 200,
        orderBy: { title: "asc" },
      }),
    ])

    const items: LinkableItem[] = [
      ...pages.map((p) => ({
        group: "Pages",
        label: p.title,
        url: `/${p.slug}`,
      })),
      ...news.map((n) => ({
        group: "Actualités",
        label: n.title,
        url: `/actualites/${n.slug}`,
      })),
    ]

    return NextResponse.json({ items }, { headers: jsonHeaders })
  } catch (error) {
    console.error("Error fetching linkable items:", error)
    return NextResponse.json(
      { error: "Failed to fetch links" },
      { status: 500, headers: jsonHeaders }
    )
  }
}
