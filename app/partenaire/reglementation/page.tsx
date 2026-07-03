import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Stethoscope } from "lucide-react";

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
  const isAdmin = auth.user.isAdmin === true;
  const t = await getTranslations("public.pro");

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("reglTitle")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("reglSubtitle")}
            </p>
          </div>
          {isAdmin && (
            <Link
              href="/partenaire/reglementation/qualite"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Stethoscope className="size-4" aria-hidden />
              Santé du corpus
            </Link>
          )}
        </div>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <ReglementationSearchClient />
        </Suspense>
      </div>
    </div>
  );
}
