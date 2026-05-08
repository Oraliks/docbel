import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { prisma, withDbRetry } from "@/lib/prisma"
import { UpdatePageSchema } from "@/lib/page-builder/validation"
import { requireAdminAuth } from "@/lib/auth-check"
import { logActivity } from "@/lib/activity-logger"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const page = await withDbRetry(() =>
      prisma.page.findFirst({
        where: { id, deletedAt: null },
      })
    )

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }

    return NextResponse.json({ ...page, blocks: page.content })
  } catch (error) {
    console.error("GET /api/pages/[id] error:", error)
    return NextResponse.json({ error: "Failed to fetch page" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const body = await req.json()
    const validated = UpdatePageSchema.parse(body)

    const existing = await prisma.page.findFirst({
      where: { id, deletedAt: null },
    })
    if (!existing) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }

    if (validated.slug && validated.slug !== existing.slug) {
      const conflict = await prisma.page.findUnique({
        where: { slug: validated.slug },
      })
      if (conflict && conflict.id !== id) {
        return NextResponse.json(
          { error: "Ce slug est déjà utilisé" },
          { status: 400 }
        )
      }
    }

    const updateData: Prisma.PageUpdateInput = {}
    if (validated.title !== undefined) updateData.title = validated.title
    if (validated.slug !== undefined) updateData.slug = validated.slug
    if (validated.status !== undefined) updateData.status = validated.status
    if (validated.metaTitle !== undefined) updateData.metaTitle = validated.metaTitle
    if (validated.metaDesc !== undefined) updateData.metaDesc = validated.metaDesc
    if (validated.ogImage !== undefined) updateData.ogImage = validated.ogImage
    if (validated.content !== undefined) {
      updateData.content = validated.content as Prisma.InputJsonValue
    }

    const actor = authCheck.user.email || authCheck.user.name || 'Admin'

    const [page] = await prisma.$transaction([
      prisma.page.update({ where: { id }, data: updateData }),
      // Snapshot a revision when content actually changes
      ...(validated.content !== undefined
        ? [
            prisma.pageRevision.create({
              data: {
                pageId: id,
                title: validated.title ?? existing.title,
                content: validated.content as Prisma.InputJsonValue,
                metaTitle:
                  validated.metaTitle !== undefined
                    ? validated.metaTitle
                    : existing.metaTitle,
                metaDesc:
                  validated.metaDesc !== undefined
                    ? validated.metaDesc
                    : existing.metaDesc,
                ogImage:
                  validated.ogImage !== undefined ? validated.ogImage : existing.ogImage,
                createdBy: authCheck.user.id,
              },
            }),
          ]
        : []),
    ])

    // Activity logging
    if (validated.status && validated.status !== existing.status) {
      await logActivity(
        actor,
        validated.status === 'published' ? 'published' : 'unpublished',
        'page',
        page.title,
        page.id,
        `Statut changé : ${existing.status} → ${validated.status}`
      )
    } else {
      await logActivity(
        actor,
        'updated',
        'page',
        page.title,
        page.id,
        'Page mise à jour'
      )
    }

    // Cache invalidation for any slug currently or previously published
    if (existing.slug) revalidatePath(`/${existing.slug}`)
    if (page.slug && page.slug !== existing.slug) revalidatePath(`/${page.slug}`)
    revalidatePath('/[slug]', 'page')

    return NextResponse.json({ ...page, blocks: page.content })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("PATCH /api/pages/[id] error:", errorMessage)
    if (error instanceof Error && error.message.includes("validation")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const existing = await prisma.page.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 })
    }

    const page = await prisma.page.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    const actor = authCheck.user.email || authCheck.user.name || 'Admin'
    await logActivity(actor, 'deleted', 'page', page.title, page.id, 'Page supprimée (soft)')

    if (page.slug) revalidatePath(`/${page.slug}`)
    revalidatePath('/[slug]', 'page')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/pages/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 })
  }
}
