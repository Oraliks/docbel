// Seed ciblé des tenants de booking (sans relancer le seed complet).
//   pnpm seed:booking
import { PrismaClient } from "@prisma/client";
import { seedBookingTenants } from "../prisma/seeds/booking";

const prisma = new PrismaClient();

seedBookingTenants(prisma)
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
