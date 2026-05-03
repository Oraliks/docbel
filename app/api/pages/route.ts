import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CreatePageSchema, generateSlug } from '@/lib/page-builder/validation'
import { logActivity } from '@/lib/activity-logger'
import { requireAdminAuth } from '@/lib/auth-check'

export async function GET() {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const pages = await prisma.page.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const formattedPages = pages.map((page) => ({
      ...page,
      blocks: JSON.parse(page.content),
    }))

    return NextResponse.json(formattedPages)
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

    let slug = validated.slug || generateSlug(validated.title)

    // Ensure slug is unique
    let existingPage = await prisma.page.findUnique({ where: { slug } })
    let counter = 1
    while (existingPage) {
      slug = `${generateSlug(validated.title)}-${counter}`
      existingPage = await prisma.page.findUnique({ where: { slug } })
      counter++
    }

    const page = await prisma.page.create({
      data: {
        title: validated.title,
        slug,
        content: JSON.stringify(validated.content || []),
        status: 'draft',
      },
    })

    // Log activity
    await logActivity('Admin', 'created', 'page', page.title, page.id, `Page créée: ${page.title}`)

    return NextResponse.json(
      {
        ...page,
        blocks: JSON.parse(page.content),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/pages error:', error)
    if (error instanceof Error && error.message.includes('validation')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 })
  }
}
