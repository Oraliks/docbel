import { prisma } from "@/lib/prisma";
import { RdvStepper } from "./rdv-stepper";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Prendre rendez-vous — Beldoc",
  description: "Prenez rendez-vous avec un organisme social belge en quelques clics.",
};

export default async function RdvDiscoveryPage() {
  const tenants = await prisma.bookingTenant.findMany({
    where: { active: true },
    select: {
      slug: true,
      name: true,
      category: true,
      brandColor: true,
      logoUrl: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Démarches administratives
        </p>
        <h1 className="glass-display text-[32px] font-semibold leading-[1.05] sm:text-[40px]">
          Prendre rendez-vous
        </h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
          Sélectionnez votre démarche et votre organisme pour choisir un créneau disponible.
        </p>
      </div>
      <RdvStepper tenants={tenants} />
      <a
        href="/rendez-vous/guichets"
        className="text-[13px] text-[color:var(--glass-ink-soft)] underline-offset-2 hover:text-[color:var(--glass-ink)] hover:underline"
      >
        Ou parcourez tous les guichets disponibles →
      </a>
    </section>
  );
}
