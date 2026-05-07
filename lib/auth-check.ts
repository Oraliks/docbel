import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@prisma/client";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

export type AuthorizedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
};

export type AdminAuthResult =
  | { isAuthorized: true; user: AuthorizedUser; error?: undefined }
  | { isAuthorized: false; error: NextResponse; user?: undefined };

export async function requireAdminAuth(): Promise<AdminAuthResult> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  if (!dbUser || dbUser.status !== UserStatus.active) {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: jsonHeaders }
      ),
    };
  }

  if (dbUser.role !== "admin") {
    return {
      isAuthorized: false,
      error: NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403, headers: jsonHeaders }
      ),
    };
  }

  return { isAuthorized: true, user: dbUser };
}
