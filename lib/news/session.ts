import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@prisma/client";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  isAdmin: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const id = session?.user?.id;
  if (!id) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  if (!dbUser || dbUser.status !== UserStatus.active) return null;

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    isAdmin: dbUser.role === "admin",
  };
}

export function actorLabel(user: { name?: string | null; email?: string | null } | null | undefined): string {
  return user?.name || user?.email || "system";
}
