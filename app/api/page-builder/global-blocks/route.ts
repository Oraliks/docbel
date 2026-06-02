import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { BlockSchema } from '@/lib/page-builder/validation'
import { requireAdminAuth } from '@/lib/auth-check'

const CreateGlobalBlockSchema = z.object({
  name: z.string().trim().min(1).max(120),
  block: BlockSchema,
})

export async function GET() {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const items = await prisma.globalBlock.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, name: true, block: true, updatedAt: true },
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error('GET /api/page-builder/global-blocks error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch global blocks' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const body = await req.json()
    const validated = CreateGlobalBlockSchema.parse(body)

    const globalBlock = await prisma.globalBlock.create({
      data: {
        name: validated.name,
        block: validated.block as Prisma.InputJsonValue,
        createdBy: authCheck.user.email || authCheck.user.id,
      },
    })

    return NextResponse.json(globalBlock, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      )
    }
    console.error('POST /api/page-builder/global-blocks error:', error)
    return NextResponse.json(
      { error: 'Failed to create global block' },
      { status: 500 }
    )
  }
}
