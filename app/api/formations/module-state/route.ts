import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTrainingAccess, type ModuleSpace } from "@/lib/formations/module";

const json = { "Content-Type": "application/json; charset=utf-8" };

/** État public du module pour la nav du caller (espace dérivé de son rôle). */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  let role: string | null = null;
  if (session?.user?.id) {
    const u = await prisma.user
      .findUnique({ where: { id: session.user.id }, select: { role: true } })
      .catch(() => null);
    role = u?.role ?? null;
  }
  const space: ModuleSpace =
    role === "employer" ? "employer" : role === "partner" ? "partner" : "public";

  const { access, config } = await getTrainingAccess({ role, isAdmin: role === "admin" }, space);
  return NextResponse.json(
    {
      navVisible: access === "ok" || access === "coming_soon",
      access,
      launchMode: config.launchMode,
      maintenanceMessage: access === "maintenance" ? config.maintenanceMessage : null,
    },
    { headers: json },
  );
}
