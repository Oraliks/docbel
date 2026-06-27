import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { auth } from "@/lib/auth"
import { AdminLayoutProvider } from "@/components/admin-layout-provider"
import { FloatingChatFabLazy } from "@/components/admin/chomage-ia/floating-chat/floating-chat-fab-lazy"
import { prisma, withDbRetry } from "@/lib/prisma"
import { UserRole, UserStatus } from "@prisma/client"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers()
  const session = await withDbRetry(() => auth.api.getSession({ headers: headerList })).catch(
    () => null
  )
  const userId = session?.user?.id

  if (!userId) {
    notFound()
  }

  const user = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    })
  ).catch(() => null)

  if (!user || user.role !== UserRole.admin || user.status !== UserStatus.active) {
    notFound()
  }

  // Provider i18n IMBRIQUÉ propre à /admin : le root layout ne sert que
  // `public.*` au client (split de poids). Ici on remonte le catalogue COMPLET
  // (admin + public) pour le sous-arbre admin → tous les useTranslations("admin…")
  // et les clés publiques partagées restent résolus côté client.
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AdminLayoutProvider>
        {children}
        {/* FAB mini-chat IA chômage — visible sur toutes les pages /admin/*.
            Stateless (réinitialisé à chaque fermeture), réutilise la KB + la
            mémoire long-terme via /api/chomage-ia/quick-chat. */}
        <FloatingChatFabLazy />
      </AdminLayoutProvider>
    </NextIntlClientProvider>
  )
}
