import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function requireAdminAuth() {
  const session = await auth();

  if (!session || !session.user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
      isAuthorized: false,
    };
  }

  const user = session.user as any;
  if (user.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      ),
      isAuthorized: false,
    };
  }

  return { isAuthorized: true, user };
}
