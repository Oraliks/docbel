import { notFound } from "next/navigation"
import {
  loadUser360,
  loadUserActivity,
  loadUserProfileDetail,
  loadUserSecurity,
} from "@/lib/admin/user-360"
import {
  UserDetailShell,
  USER_TABS,
  type UserTab,
} from "@/components/admin/users/user-detail-shell"
import { UserSecurityTab } from "@/components/admin/users/user-security-tab"
import { UserProfileTab } from "@/components/admin/users/user-profile-tab"
import { UserActivityTab } from "@/components/admin/users/user-activity-tab"
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
  const [security, profile, activity] = await Promise.all([
    loadUserSecurity(id),
    loadUserProfileDetail(id),
    loadUserActivity(id),
  ])

  return (
    <UserDetailShell
      data={data}
      initialTab={resolveTab(tab)}
      securitySlot={
        <UserSecurityTab userId={user.id} user={user} security={security} />
      }
      profileSlot={<UserProfileTab profile={profile} />}
      activitySlot={<UserActivityTab activity={activity} />}
      editionSlot={
        <EditUserForm
          embedded
          user={{
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            segment: user.segment,
            partnerType: user.partnerType,
            partnerOrganization: user.partnerOrganization,
            vatNumber: user.vatNumber,
            isOrgManager: user.isOrgManager,
            canViewRdvHistory: user.canViewRdvHistory,
          }}
        />
      }
    />
  )
}
