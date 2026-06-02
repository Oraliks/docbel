import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CreatePageSchema, generateSlug } from '@/lib/page-builder/validation'
import { logActivity } from '@/lib/activity-logger'
import { requireAdminAuth } from '@/lib/auth-check'
import { nanoid } from 'nanoid'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export async function GET(req: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(searchParams.get('limit')) || DEFAULT_LIMIT)
    )
    const cursor = searchParams.get('cursor') || undefined

    // `content` is selected only to derive `blockCount` server-side; the full
    // block tree is never serialized to the list response (use the detail
    // endpoint for that). This keeps the list payload small even for 200 pages.
    const pages = await prisma.page.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        scheduledAt: true,
        metaTitle: true,
        metaDesc: true,
        ogImage: true,
        createdAt: true,
        updatedAt: true,
        content: true,
      },
    })

    const hasMore = pages.length > limit
    const items = hasMore ? pages.slice(0, limit) : pages
    const nextCursor = hasMore ? items[items.length - 1].id : null

    const formatted = items.map(({ content, ...rest }) => ({
      ...rest,
      blockCount: Array.isArray(content) ? content.length : 0,
    }))

    return NextResponse.json({ items: formatted, nextCursor })
  } catch (error) {
    console.error('GET /api/pages error:', error)
    return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const body = await req.json()
    const validated = CreatePageSchema.parse(body)
    const baseSlug = validated.slug || generateSlug(validated.title)
    const content = (validated.content ?? []) as Prisma.InputJsonValue

    let slug = baseSlug
    let attempts = 0
    while (attempts < 5) {
      try {
        const page = await prisma.page.create({
          data: {
            title: validated.title,
            slug,
            content,
            status: 'draft',
          },
        })

        const actor = authCheck.user.email || authCheck.user.name || 'Admin'
        await logActivity('page', 'created', 'page', page.title, page.id, `Page créée par ${actor}`)

        return NextResponse.json(
          { ...page, blocks: page.content },
          { status: 201 }
        )
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          slug = `${baseSlug}-${nanoid(5).toLowerCase()}`
          attempts++
          continue
        }
        throw e
      }
    }

    return NextResponse.json(
      { error: 'Impossible de générer un slug unique' },
      { status: 409 }
    )
  } catch (error) {
    console.error('POST /api/pages error:', error)
    if (error instanceof Error && error.message.includes('validation')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 })
  }
}
