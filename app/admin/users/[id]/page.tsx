import { notFound } from "next/navigation"
import { loadUser360 } from "@/lib/admin/user-360"
import {
  UserDetailShell,
  USER_TABS,
  type UserTab,
} from "@/components/admin/users/user-detail-shell"
import { EditUserForm } from "@/components/users/edit-user-form"

export const dynamic = "force-dynamic"

function resolveTab(raw: string | string[] | undefined): UserTab {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value && (USER_TABS as readonly string[]).includes(value)) {
    return value as UserTab
  }
  return "apercu"
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const { tab } = await searchParams

  const data = await loadUser360(id)
  if (!data) notFound()

  const { user } = data

  return (
    <UserDetailShell
      data={data}
      initialTab={resolveTab(tab)}
      editionSlot={
        <EditUserForm
          user={{
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
          }}
        />
      }
    />
  )
}
