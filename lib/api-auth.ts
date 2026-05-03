import { prisma } from "@/lib/prisma"

export async function verifyApiKey(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header")
  }

  const key = authHeader.slice(7)
  const apiKey = await prisma.apiKey.findUnique({
    where: { key },
    include: { user: true }
  })

  if (!apiKey?.active) {
    throw new Error("Invalid or inactive API key")
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  })

  return apiKey.user
}
