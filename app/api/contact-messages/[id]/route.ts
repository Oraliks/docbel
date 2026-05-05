import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-logger"
import { requireAdminAuth } from "@/lib/auth-check"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const message = await prisma.contactMessage.findUnique({
      where: { id },
    })

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      )
    }

    if (message.status === "NEW") {
      await prisma.contactMessage.update({
        where: { id },
        data: { status: "READ" },
      })
    }

    return NextResponse.json(message)
  } catch (error) {
    console.error("Error fetching contact message:", error)
    return NextResponse.json(
      { error: "Failed to fetch contact message" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const { adminReply, status } = body

    if (!id) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 }
      )
    }

    const message = await prisma.contactMessage.findUnique({
      where: { id },
    })

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      )
    }

    const updateData: { status?: string; adminReply?: string } = {}
    if (status) updateData.status = status
    if (adminReply) {
      updateData.adminReply = adminReply
      updateData.status = "REPLIED"
    }

    const updatedMessage = await prisma.contactMessage.update({
      where: { id },
      data: updateData,
    })

    await logActivity(
      "Admin",
      "updated",
      "message",
      message.name,
      id,
      `Status: ${status || updateData.status}`
    )

    return NextResponse.json(updatedMessage)
  } catch (error) {
    console.error("Error updating contact message:", error)
    return NextResponse.json(
      { error: "Failed to update contact message" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdminAuth()
  if (!authCheck.isAuthorized) return authCheck.error

  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 }
      )
    }

    const message = await prisma.contactMessage.findUnique({
      where: { id },
    })

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      )
    }

    await prisma.contactMessage.delete({
      where: { id },
    })

    await logActivity(
      "Admin",
      "deleted",
      "message",
      message.name,
      id,
      `Sujet: ${message.subject}`
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting contact message:", error)
    return NextResponse.json(
      { error: "Failed to delete contact message" },
      { status: 500 }
    )
  }
}
