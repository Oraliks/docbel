import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { DossiersView } from "@/components/reglementation/dossiers-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Dossiers de travail — Réglementation | DocBel",
};

/**
 * Dossiers de travail (regroupements d'articles par cas). Stockés côté client
 * (localStorage) : la page se contente de garder le gating et le chrome.
 */
export default async function DossiersPage() {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/partenaire/reglementation"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Réglementation
          </Link>
          <h1 className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
            <FolderOpen className="size-5" aria-hidden />
            Dossiers de travail
          </h1>
        </div>
        <DossiersView />
      </div>
    </div>
  );
}
