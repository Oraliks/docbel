"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DraftResumeBannerProps {
  updatedAt: string;
  onResume: () => void;
  onDiscard: () => void;
}

export function DraftResumeBanner({ updatedAt, onResume, onDiscard }: DraftResumeBannerProps) {
  return (
    <Alert className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <Save className="w-5 h-5 mt-0.5 shrink-0" />
        <AlertDescription>
          Vous avez un brouillon en cours, sauvegardé le{" "}
          <strong>{new Date(updatedAt).toLocaleString("fr-BE")}</strong>. Souhaitez-vous le
          reprendre ?
        </AlertDescription>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={onDiscard}>
          Recommencer
        </Button>
        <Button size="sm" onClick={onResume}>
          Reprendre
        </Button>
      </div>
    </Alert>
  );
}
