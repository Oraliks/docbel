import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ChevronRight, MapPin } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { CATEGORY_LABELS } from "@/lib/booking/status";
import { GLASS_CARD } from "@/lib/glass-classes";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.dossier");
  return {
    title: t("guichetsMetaTitle"),
    description: t("guichetsMetaDescription"),
  };
}

export default async function GuichetsDirectoryPage() {
  const t = await getTranslations("public.dossier");
  // Annuaire public : guichets actifs, hors guichets privés (employeurs).
  const tenants = await prisma.bookingTenant.findMany({
    where: { active: true, category: { not: "private" } },
    select: {
      slug: true,
      name: true,
      category: true,
      brandColor: true,
      locations: {
        where: { active: true },
        select: { city: true },
        take: 30,
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/rendez-vous"
          className="flex w-fit items-center gap-1 text-[13px] text-[color:var(--glass-ink-soft)] hover:text-[color:var(--glass-ink)]"
        >
          <ArrowLeft size={14} />
          {t("guichetsBack")}
        </Link>
        <h1 className="glass-display text-[32px] font-semibold leading-[1.05] sm:text-[40px]">
          {t("guichetsTitle")}
        </h1>
        <p className="text-[14px] text-[color:var(--glass-ink-soft)]">
          {t("guichetsIntro")}
        </p>
      </div>

      {tenants.length === 0 ? (
        <div className={`${GLASS_CARD} glass-surface rounded-2xl p-6`}>
          <p className="text-[15px] text-[color:var(--glass-ink-soft)]">
            {t("guichetsEmpty")}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tenants.map((tenant) => {
            const cities = [
              ...new Set(
                tenant.locations.map((l) => l.city).filter((c): c is string => !!c),
              ),
            ];
            return (
              <Link
                key={tenant.slug}
                href={`/${tenant.slug}/rendez-vous`}
                className={`${GLASS_CARD} glass-surface group flex flex-col gap-2 rounded-2xl p-5 transition-shadow hover:shadow-md`}
              >
                <div className="flex items-center gap-2">
                  {tenant.brandColor && (
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ background: tenant.brandColor }}
                    />
                  )}
                  <span className="text-[15px] font-semibold text-[color:var(--glass-ink)]">
                    {tenant.name}
                  </span>
                </div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-[color:var(--glass-ink-faint)]">
                  {CATEGORY_LABELS[tenant.category] ?? tenant.category}
                </p>
                {cities.length > 0 && (
                  <p className="flex items-start gap-1 text-[13px] text-[color:var(--glass-ink-soft)]">
                    <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{cities.slice(0, 4).join(", ")}</span>
                  </p>
                )}
                <span className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-[color:var(--glass-accent-deep)]">
                  {t("guichetsCardCta")}
                  <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
