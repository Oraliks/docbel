"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  bundleId: string;
  slug: string;
  variant?: "default" | "outline" | "ghost";
}

/// Crée une NOUVELLE demande (BundleRun dissocié) pour ce dossier puis navigue
/// dessus. Réutilise un run vide s'il en existe (garde-fou serveur `forceNew`).
export function NouvelleDemandeButton({ bundleId, slug, variant = "outline" }: Props) {
  const t = useTranslations("public.dossier");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createDemande() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/documents/bundles/${encodeURIComponent(bundleId)}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceNew: true }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.id) {
        toast.error(
          data?.code === "too_many_runs" ? t("demandeTooMany") : t("demandeNewError"),
        );
        return;
      }
      // `clonedFrom` (date ISO de la demande reprise) → alerte informative dans
      // le runner. Absent si première demande (rien à cloner).
      const cloned =
        typeof data.clonedFromDate === "string" && data.clonedFromDate
          ? `&clonedFrom=${encodeURIComponent(data.clonedFromDate)}`
          : "";
      router.push(
        `/d/${encodeURIComponent(slug)}?bundleRun=${encodeURIComponent(data.id)}&demarrer=1${cloned}`,
      );
    } catch {
      toast.error(t("demandeNewError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="lg"
      className="min-h-11"
      onClick={createDemande}
      disabled={loading}
    >
      <Plus data-icon="inline-start" aria-hidden />
      {t("demandeNew")}
    </Button>
  );
}
