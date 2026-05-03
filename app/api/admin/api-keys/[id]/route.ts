import { NextRequest, NextResponse } from "next/server"

// Reference to the same mock store as the GET/POST endpoint
// In production, this would be a proper database
const mockApiKeyIds = new Set<string>()

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCookie = req.headers.get("cookie")
    if (!authCookie?.includes("next-auth.session-token")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - please login first" },
        { status: 401 }
      )
    }

    const { id } = await params

    if (mockApiKeyIds.has(id)) {
      mockApiKeyIds.delete(id)
      return NextResponse.json({
        success: true,
        message: "API key deleted"
      })
    }

    return NextResponse.json(
      { success: false, error: "API key not found" },
      { status: 404 }
    )
  } catch (error) {
    console.error("DELETE /api/admin/api-keys/[id] error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
