"use client";

import { RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/// Bouton discret « Recommencer » — Phase 5 du plan bindings-canonical-ux.
///
/// Ouvre un AlertDialog de confirmation ; l'action de reset elle-même
/// (suppression du draft + réinitialisation du state React) vit dans le
/// PdfFormRunner. On expose juste un `onConfirm` async pour ne pas
/// coupler cette UI à la logique de reset (draft/values/errors/consent/
/// active).
export function ResetFormButton({
  onConfirm,
  disabled,
}: {
  onConfirm: () => Promise<void> | void;
  disabled?: boolean;
}) {
  const t = useTranslations("public.dossier");
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcwIcon className="size-3.5" />
            {t("runnerResetButton")}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("runnerResetTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("runnerResetDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("runnerResetCancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onConfirm()}>
            {t("runnerResetConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
