import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UpdatePageSchema } from '@/lib/page-builder/validation'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const page = await prisma.page.findUnique({
      where: { id },
    })

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...page,
      blocks: JSON.parse(page.content),
    })
  } catch (error) {
    console.error('GET /api/pages/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const validated = UpdatePageSchema.parse(body)

    // Check slug uniqueness if slug is being changed
    if (validated.slug) {
      const existing = await prisma.page.findUnique({
        where: { slug: validated.slug },
      })
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: 'Ce slug est déjà utilisé' },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}
    if (validated.title) updateData.title = validated.title
    if (validated.slug) updateData.slug = validated.slug
    if (validated.status) updateData.status = validated.status
    if (validated.metaTitle !== undefined) updateData.metaTitle = validated.metaTitle
    if (validated.metaDesc !== undefined) updateData.metaDesc = validated.metaDesc
    if (validated.ogImage !== undefined) updateData.ogImage = validated.ogImage
    if (validated.content) {
      updateData.content = JSON.stringify(validated.content)
    }

    const page = await prisma.page.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      ...page,
      blocks: JSON.parse(page.content),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('PATCH /api/pages/[id] error:', errorMessage)
    console.error('Error details:', error)
    if (error instanceof Error && error.message.includes('validation')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.page.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/pages/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 })
  }
}
