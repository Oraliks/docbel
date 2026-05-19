"use client";

import { Globe, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ChangeType = "minor" | "major" | "hotfix";

interface Props {
  open: boolean;
  nextVersion: number;
  /// "published" | "draft" | undefined : indique si la sauvegarde s'accompagne
  /// d'un changement de statut (et lequel).
  pendingStatus: "published" | "draft" | undefined;
  notes: string;
  onNotesChange: (notes: string) => void;
  changeType: ChangeType;
  onChangeTypeChange: (t: ChangeType) => void;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/// Modal "Note de changement" affiché quand l'admin a modifié les champs.
/// Demande une description du changement + son type (minor/major/hotfix) avant
/// d'enregistrer la nouvelle version.
export function ChangeNotesDialog({
  open,
  nextVersion,
  pendingStatus,
  notes,
  onNotesChange,
  changeType,
  onChangeTypeChange,
  saving,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  const intro =
    pendingStatus === "published"
      ? "Vous avez modifié les champs ET demandé la publication. Décrivez le changement, puis confirmez pour enregistrer + publier."
      : pendingStatus === "draft"
      ? "Vous avez modifié les champs ET demandé le retour en brouillon. Décrivez le changement avant de continuer."
      : "Vous avez modifié les champs du formulaire. Décrivez ce qui a changé pour faciliter le suivi des versions.";

  const confirmLabel = saving
    ? pendingStatus === "published"
      ? "Publication…"
      : "Enregistrement…"
    : pendingStatus === "published"
    ? "Enregistrer et publier"
    : pendingStatus === "draft"
    ? "Enregistrer et dépublier"
    : "Enregistrer";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <span>Note de changement (v{nextVersion})</span>
            {pendingStatus === "published" && (
              <Badge variant="default" className="text-xs gap-1">
                <Globe className="w-3 h-3" />
                Sera publié
              </Badge>
            )}
            {pendingStatus === "draft" && (
              <Badge variant="secondary" className="text-xs gap-1">
                <EyeOff className="w-3 h-3" />
                Sera dépublié
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{intro}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type de changement</Label>
            <Select
              value={changeType}
              onValueChange={(v) => v && onChangeTypeChange(v as ChangeType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">
                  Mineur — clarification, ajout d&apos;un champ optionnel
                </SelectItem>
                <SelectItem value="major">
                  Majeur — refonte, ajout de champs obligatoires
                </SelectItem>
                <SelectItem value="hotfix">
                  Correctif — bug, faute de frappe
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (visibles dans l&apos;historique)</Label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={4}
              placeholder="Ajout du champ « numéro de compte ». Suppression de la case « marié » remplacée par un select."
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={onConfirm} disabled={saving}>
              {confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
