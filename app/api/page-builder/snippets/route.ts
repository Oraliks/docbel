import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { BlockSchema } from '@/lib/page-builder/validation'
import { requireAdminAuth } from '@/lib/auth-check'

const CreateSnippetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  block: BlockSchema,
})

export async function GET() {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const items = await prisma.snippet.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error('GET /api/page-builder/snippets error:', error)
    return NextResponse.json({ error: 'Failed to fetch snippets' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const body = await req.json()
    const validated = CreateSnippetSchema.parse(body)

    const snippet = await prisma.snippet.create({
      data: {
        name: validated.name,
        description: validated.description ?? null,
        block: validated.block as Prisma.InputJsonValue,
        createdBy: authCheck.user.email || authCheck.user.id,
      },
    })

    return NextResponse.json(snippet, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      )
    }
    console.error('POST /api/page-builder/snippets error:', error)
    return NextResponse.json({ error: 'Failed to create snippet' }, { status: 500 })
  }
}
