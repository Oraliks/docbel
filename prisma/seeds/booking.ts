import { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_BOOKING_FORM } from "../../lib/booking/form-fields";

// Les 4 organismes de paiement chômage, prêts à l'emploi. `partnerOrganization`
// fait le pont avec les comptes partenaires existants (auto-accès des
// responsables). Une antenne de démonstration + des créneaux sont créés pour
// rendre la prise de RDV testable immédiatement.
const TENANTS = [
  { slug: "fgtb", name: "FGTB", org: "FGTB", color: "#E2001A" },
  { slug: "csc", name: "CSC", org: "CSC", color: "#F18A00" },
  { slug: "synova", name: "SYNOVA", org: "SYNOVA", color: "#0096D6" },
  { slug: "capac", name: "CAPAC", org: "CAPAC", color: "#1A56DB" },
];

const DEMO_RULES: Array<[number, string, string, number]> = [
  // [weekday (1=lun…), start, end, capacity] — lun/mer/ven
  [1, "09:00", "10:00", 4],
  [1, "10:00", "11:00", 4],
  [1, "14:00", "15:00", 3],
  [3, "09:00", "10:00", 4],
  [3, "10:00", "11:00", 4],
  [5, "09:00", "10:00", 4],
  [5, "10:00", "11:00", 2],
];

export async function seedBookingTenants(prisma: PrismaClient) {
  let created = 0;
  for (const t of TENANTS) {
    const tenant = await prisma.bookingTenant.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        category: "unemployment",
        partnerOrganization: t.org,
        brandColor: t.color,
      },
      create: {
        slug: t.slug,
        name: t.name,
        category: "unemployment",
        partnerOrganization: t.org,
        brandColor: t.color,
        formFields: DEFAULT_BOOKING_FORM as unknown as Prisma.InputJsonValue,
        requireApproval: true,
        autoApproveAfterHours: 48,
        dedupeField: "email",
        dedupeWindowDays: 30,
      },
    });

    const locCount = await prisma.bookingLocation.count({
      where: { tenantId: tenant.id },
    });
    if (locCount === 0) {
      const loc = await prisma.bookingLocation.create({
        data: {
          tenantId: tenant.id,
          name: `${t.name} — Bruxelles (démo)`,
          street: "Rue de la Loi 1",
          postalCode: "1000",
          city: "Bruxelles",
          lat: 50.8466,
          lng: 4.3528,
        },
      });
      await prisma.bookingSlotRule.createMany({
        data: DEMO_RULES.map(([weekday, startTime, endTime, capacity]) => ({
          locationId: loc.id,
          weekday,
          startTime,
          endTime,
          capacity,
          createdById: "seed",
        })),
      });
      created++;
    }
  }
  console.log(`   ✓ ${TENANTS.length} tenants booking (dont ${created} avec antenne démo)`);
}
