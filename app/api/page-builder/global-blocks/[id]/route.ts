import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { BlockSchema } from '@/lib/page-builder/validation'
import { requireAdminAuth } from '@/lib/auth-check'

const UpdateGlobalBlockSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  block: BlockSchema.optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const globalBlock = await prisma.globalBlock.findUnique({ where: { id } })

    if (!globalBlock) {
      return NextResponse.json(
        { error: 'Global block not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(globalBlock)
  } catch (error) {
    console.error('GET /api/page-builder/global-blocks/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch global block' },
      { status: 500 }
    )
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
    const validated = UpdateGlobalBlockSchema.parse(body)

    const data: Prisma.GlobalBlockUpdateInput = {}
    if (validated.name !== undefined) data.name = validated.name
    if (validated.block !== undefined) {
      data.block = validated.block as Prisma.InputJsonValue
    }

    const globalBlock = await prisma.globalBlock.update({
      where: { id },
      data,
    })

    return NextResponse.json(globalBlock)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.issues },
        { status: 400 }
      )
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Global block not found' },
        { status: 404 }
      )
    }
    console.error('PATCH /api/page-builder/global-blocks/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update global block' },
      { status: 500 }
    )
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
    await prisma.globalBlock.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Global block not found' },
        { status: 404 }
      )
    }
    console.error('DELETE /api/page-builder/global-blocks/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to delete global block' },
      { status: 500 }
    )
  }
}
