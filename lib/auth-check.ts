import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export async function requireAdminAuth() {
  const session = await auth();

  if (!session || !session.user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
      isAuthorized: false,
    };
  }

  const user = session.user as { role?: string; id?: string; name?: string | null; email?: string | null };
  if (!user.id) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
      isAuthorized: false,
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  if (!dbUser || dbUser.status !== UserStatus.active) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
      isAuthorized: false,
    };
  }

  if (dbUser.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403, headers: jsonHeaders }
      ),
      isAuthorized: false,
    };
  }

  return { isAuthorized: true, user: dbUser };
}
