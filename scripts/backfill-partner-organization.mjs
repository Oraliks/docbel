// Pour les utilisateurs partenaires créés AVANT l'ajout du champ
// `partnerOrganization`, on rétablit le lien en faisant correspondre le domaine
// de leur email à la liste des PartnerDomain.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    where: { role: "partner", partnerOrganization: null },
    select: { id: true, email: true },
  });
  console.log(`Found ${users.length} partner users without partnerOrganization`);

  let updated = 0;
  let skipped = 0;
  for (const user of users) {
    const at = user.email.lastIndexOf("@");
    if (at <= 0) {
      skipped++;
      continue;
    }
    const domain = user.email.slice(at + 1).toLowerCase();
    const match = await prisma.partnerDomain.findUnique({
      where: { domain },
      select: { organizationName: true },
    });
    if (!match) {
      console.log(`- ${user.email}: no matching domain, skipped`);
      skipped++;
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { partnerOrganization: match.organizationName },
    });
    console.log(`- ${user.email} → ${match.organizationName}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}`);
} finally {
  await prisma.$disconnect();
}
