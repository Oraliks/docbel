import {
  Building2,
  IdCard,
  MapPin,
  Phone,
  Landmark,
  Users,
} from "lucide-react"
import { getTranslations } from "next-intl/server"
import type { UserProfileData } from "@/lib/admin/user-360"

/// Onglet Profil : lecture seule (server component). Données sensibles
/// (NISS/IBAN) déjà masquées côté loader — on n'affiche jamais le NRN en clair.
export async function UserProfileTab({ profile }: { profile: UserProfileData }) {
  const t = await getTranslations("admin.userDetail")
  const { citizen, employer } = profile

  if (!citizen && !employer) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
        {t("profNoProfile")}
      </div>
    )
  }

  const hasEmployeesLabel =
    employer?.hasEmployees === null || employer?.hasEmployees === undefined
      ? t("unknown")
      : employer.hasEmployees
        ? t("yes")
        : t("no")

  return (
    <div className="flex flex-col gap-4">
      {citizen && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <IdCard className="size-4" />
              {t("profCitizenTitle")}
            </h2>
          </div>
          <div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Group title={t("profGroupIdentity")} icon={<IdCard className="size-3.5" />}>
              <Field label={t("profFirstName")} value={citizen.firstName} />
              <Field label={t("profLastName")} value={citizen.lastName} />
              <Field label={t("profNiss")} value={citizen.nissLast4 ? `•••• ${citizen.nissLast4}` : null} />
              <Field label={t("profBirthDate")} value={formatDate(citizen.birthDate)} />
              <Field label={t("profBirthPlace")} value={citizen.birthPlace} />
              <Field label={t("profNationality")} value={citizen.nationality} />
              <Field label={t("profGender")} value={citizen.gender} />
            </Group>
            <Group title={t("profGroupAddress")} icon={<MapPin className="size-3.5" />}>
              <Field
                label={t("profStreet")}
                value={
                  [citizen.street, citizen.streetNum].filter(Boolean).join(" ") ||
                  null
                }
              />
              <Field
                label={t("profCity")}
                value={
                  [citizen.postalCode, citizen.city].filter(Boolean).join(" ") ||
                  null
                }
              />
              <Field label={t("profCountry")} value={citizen.country} />
            </Group>
            <Group title={t("profGroupContact")} icon={<Phone className="size-3.5" />}>
              <Field label={t("profPhone")} value={citizen.phone} />
              <Field label={t("profMobile")} value={citizen.mobilePhone} />
            </Group>
            <Group title={t("profGroupBank")} icon={<Landmark className="size-3.5" />}>
              <Field label={t("profIban")} value={citizen.ibanMasked} />
            </Group>
            <Group title={t("profGroupCivil")} icon={<Users className="size-3.5" />}>
              <Field label={t("profMaritalStatus")} value={citizen.maritalStatus} />
              <Field
                label={t("profHouseholdMembers")}
                value={String(citizen.householdMembersCount)}
              />
            </Group>
            <Group title={t("profGroupPro")} icon={<Building2 className="size-3.5" />}>
              <Field label={t("profEmployer")} value={citizen.employer} />
              <Field label={t("profJobTitle")} value={citizen.jobTitle} />
              <Field label={t("profContractType")} value={citizen.contractType} />
              <Field label={t("profOrganismePaiement")} value={citizen.organismePaiement} />
              <Field label={t("profMutuelle")} value={citizen.mutuelleCode} />
              <Field label={t("profCommissionParitaire")} value={citizen.commissionParitaireCode} />
            </Group>
          </div>
        </section>
      )}

      {employer && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4" />
              {t("profEmployerTitle")}
            </h2>
          </div>
          <div className="grid gap-x-8 gap-y-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("profOrganisation")} value={employer.organisationName} />
            <Field label={t("profLegalForm")} value={employer.legalForm} />
            <Field label={t("profEnterpriseNumber")} value={employer.enterpriseNumber} />
            <Field label={t("profRegion")} value={employer.region} />
            <Field label={t("profSector")} value={employer.sector} />
            <Field label={t("profNaceCode")} value={employer.naceCode} />
            <Field label={t("profCommissionParitaire")} value={employer.jointCommitteeNumber} />
            <Field label={t("profHasEmployees")} value={hasEmployeesLabel} />
            <Field label={t("profScenarioCount")} value={String(employer.scenarioCount)} />
          </div>
        </section>
      )}
    </div>
  )
}

function Group({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title}
      </p>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium" title={value ?? undefined}>
        {value || "—"}
      </dd>
    </div>
  )
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}
