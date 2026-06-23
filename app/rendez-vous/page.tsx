import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { RdvStepper } from "./rdv-stepper";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.dossier");
  return {
    title: t("rdvMetaTitle"),
    description: t("rdvMetaDescription"),
  };
}

export default async function RdvDiscoveryPage() {
  const t = await getTranslations("public.dossier");
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
          {t("rdvEyebrow")}
        </p>
        <h1 className="glass-display text-[32px] font-semibold leading-[1.05] sm:text-[40px]">
          {t("rdvTitle")}
        </h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
          {t("rdvIntro")}
        </p>
      </div>
      <RdvStepper tenants={tenants} />
      <a
        href="/rendez-vous/guichets"
        className="text-[13px] text-[color:var(--glass-ink-soft)] underline-offset-2 hover:text-[color:var(--glass-ink)] hover:underline"
      >
        {t("rdvBrowseAll")}
      </a>
    </section>
  );
}
