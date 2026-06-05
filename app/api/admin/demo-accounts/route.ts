import { NextResponse } from "next/server"
import { requireAdminAuth } from "@/lib/auth-check"
import { prisma } from "@/lib/prisma"

/// GET /api/admin/demo-accounts — liste les comptes "demo+*@docbel.local" pour
/// alimenter le dropdown "Voir en tant que" du shell admin (cf. ViewAsMenu).
/// Réservé aux admins. Renvoie l'id + des champs d'affichage uniquement.
export async function GET() {
  const authResult = await requireAdminAuth()
  if (!authResult.isAuthorized) return authResult.error

  const accounts = await prisma.user.findMany({
    where: { email: { startsWith: "demo+", endsWith: "@docbel.local" } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      partnerOrganization: true,
      segment: true,
    },
    orderBy: { role: "asc" },
  })

  return NextResponse.json({ accounts })
}
