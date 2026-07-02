import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { ReglementationSearchClient } from "@/components/reglementation/search-client";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("reglMetaTitle"),
    description: t("reglMetaDesc"),
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Recherche dans la réglementation chômage (corpus légal RioLex).
 * Réservé partenaires + admins — les textes sont `visibility: "partner"`.
 * L'API /api/partenaire/reglementation/search applique la même garde.
 */
export default async function ReglementationPage() {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) {
    notFound();
  }
  const t = await getTranslations("public.pro");

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("reglTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("reglSubtitle")}
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <ReglementationSearchClient />
        </Suspense>
      </div>
    </div>
  );
}
