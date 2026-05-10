"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RelatedCount {
  generated: number;
  revisions: number;
  drafts: number;
  bundleItems: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateName: string;
  templateSlug: string;
  related: RelatedCount;
  onConfirm: () => Promise<void>;
}

export function DeleteTemplateDialog({
  open,
  onOpenChange,
  templateName,
  templateSlug,
  related,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Reset à chaque ouverture
  useEffect(() => {
    if (open) {
      setTyped("");
      setDeleting(false);
    }
  }, [open]);

  const canConfirm = typed.trim() === templateSlug;
  const totalAffected =
    related.generated + related.revisions + related.drafts + related.bundleItems;

  async function handleConfirm() {
    if (!canConfirm) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !deleting && onOpenChange(v)}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Suppression définitive
          </AlertDialogTitle>
          <AlertDialogDescription>
            Vous êtes sur le point de supprimer définitivement le template{" "}
            <b>{templateName}</b>. Cette action est <b>irréversible</b>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {totalAffected > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-xs">
              <div className="font-medium mb-1">Données associées qui seront perdues :</div>
              <ul className="space-y-0.5 list-disc list-inside">
                {related.generated > 0 && (
                  <li>
                    {related.generated} document{related.generated > 1 ? "s" : ""} généré
                    {related.generated > 1 ? "s" : ""} (et leurs signatures)
                  </li>
                )}
                {related.revisions > 0 && (
                  <li>
                    {related.revisions} révision{related.revisions > 1 ? "s" : ""}{" "}
                    historique
                  </li>
                )}
                {related.drafts > 0 && (
                  <li>
                    {related.drafts} brouillon{related.drafts > 1 ? "s" : ""} utilisateur
                  </li>
                )}
                {related.bundleItems > 0 && (
                  <li>
                    Présence dans {related.bundleItems} bundle
                    {related.bundleItems > 1 ? "s" : ""}
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">
            Pour confirmer, tapez le slug{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{templateSlug}</code>
          </Label>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={templateSlug}
            className="font-mono"
            disabled={deleting}
            autoFocus
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm || deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Suppression…
              </>
            ) : (
              "Supprimer définitivement"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
