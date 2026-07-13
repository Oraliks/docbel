import {
  Building2,
  IdCard,
  MapPin,
  Phone,
  Landmark,
  Users,
} from "lucide-react"
import type { UserProfileData } from "@/lib/admin/user-360"

/// Onglet Profil : lecture seule. Données sensibles (NISS/IBAN) déjà masquées
/// côté loader (loadUserProfileDetail) — on n'affiche jamais le NRN en clair.
export function UserProfileTab({ profile }: { profile: UserProfileData }) {
  const { citizen, employer } = profile

  if (!citizen && !employer) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
        Aucun profil enrichi pour ce compte.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {citizen && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <IdCard className="size-4" />
              Profil citoyen
            </h2>
          </div>
          <div className="grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Group title="Identité" icon={<IdCard className="size-3.5" />}>
              <Field label="Prénom" value={citizen.firstName} />
              <Field label="Nom" value={citizen.lastName} />
              <Field label="NISS" value={citizen.nissLast4 ? `•••• ${citizen.nissLast4}` : null} />
              <Field label="Naissance" value={formatDate(citizen.birthDate)} />
              <Field label="Lieu de naissance" value={citizen.birthPlace} />
              <Field label="Nationalité" value={citizen.nationality} />
              <Field label="Genre" value={citizen.gender} />
            </Group>
            <Group title="Adresse" icon={<MapPin className="size-3.5" />}>
              <Field
                label="Rue"
                value={
                  [citizen.street, citizen.streetNum].filter(Boolean).join(" ") ||
                  null
                }
              />
              <Field
                label="Localité"
                value={
                  [citizen.postalCode, citizen.city].filter(Boolean).join(" ") ||
                  null
                }
              />
              <Field label="Pays" value={citizen.country} />
            </Group>
            <Group title="Contact" icon={<Phone className="size-3.5" />}>
              <Field label="Téléphone" value={citizen.phone} />
              <Field label="Mobile" value={citizen.mobilePhone} />
            </Group>
            <Group title="Bancaire" icon={<Landmark className="size-3.5" />}>
              <Field label="IBAN" value={citizen.ibanMasked} />
            </Group>
            <Group title="Civil" icon={<Users className="size-3.5" />}>
              <Field label="État civil" value={citizen.maritalStatus} />
              <Field
                label="Membres du ménage"
                value={String(citizen.householdMembersCount)}
              />
            </Group>
            <Group title="Professionnel" icon={<Building2 className="size-3.5" />}>
              <Field label="Employeur" value={citizen.employer} />
              <Field label="Fonction" value={citizen.jobTitle} />
              <Field label="Contrat" value={citizen.contractType} />
              <Field label="Organisme paiement" value={citizen.organismePaiement} />
              <Field label="Mutuelle" value={citizen.mutuelleCode} />
              <Field label="Commission paritaire" value={citizen.commissionParitaireCode} />
            </Group>
          </div>
        </section>
      )}

      {employer && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4" />
              Profil employeur
            </h2>
          </div>
          <div className="grid gap-x-8 gap-y-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Organisation" value={employer.organisationName} />
            <Field label="Forme juridique" value={employer.legalForm} />
            <Field label="N° entreprise (BCE)" value={employer.enterpriseNumber} />
            <Field label="Région" value={employer.region} />
            <Field label="Secteur" value={employer.sector} />
            <Field label="Code NACE" value={employer.naceCode} />
            <Field label="Commission paritaire" value={employer.jointCommitteeNumber} />
            <Field
              label="Emploie du personnel"
              value={
                employer.hasEmployees === null
                  ? "Inconnu"
                  : employer.hasEmployees
                    ? "Oui"
                    : "Non"
              }
            />
            <Field label="Scénarios d'engagement" value={String(employer.scenarioCount)} />
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
