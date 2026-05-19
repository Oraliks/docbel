"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DocumentSourceType } from "@/lib/documents/types";

export interface TemplateSettingsValues {
  sourceType: DocumentSourceType;
  rgpdNotice: string;
  retentionDays: number;
  outputFilenameTpl: string;
  organismeId: string | null;
  officialRef: string;
  effectiveDate: string;
  expiresAt: string;
  requiresSignature: boolean;
}

interface OrganismeOption {
  id: string;
  name: string;
  shortName: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: TemplateSettingsValues;
  /// Reçoit un patch partiel — le parent merge dans son state + set dirty=true.
  onChange: (patch: Partial<TemplateSettingsValues>) => void;
  organismes: OrganismeOption[];
  sourceFileName: string;
  isPdf: boolean;
  isDocx: boolean;
}

/// Drawer Sheet contenant les paramètres techniques/juridiques d'un template.
/// Ne touche pas à l'édition visuelle des champs — c'est juste de la config.
export function TemplateSettingsSheet({
  open,
  onOpenChange,
  values,
  onChange,
  organismes,
  sourceFileName,
  isPdf,
  isDocx,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Paramètres du modèle</SheetTitle>
          <SheetDescription>
            Réglages techniques et juridiques. Ne change pas l&apos;édition
            visuelle des champs.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Type de source</Label>
            <Select
              value={values.sourceType}
              onValueChange={(v) => v && onChange({ sourceType: v as DocumentSourceType })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isPdf && (
                  <SelectItem value="pdf_acroform">
                    PDF avec champs (AcroForm)
                  </SelectItem>
                )}
                {isPdf && (
                  <SelectItem value="pdf_flat">
                    PDF plat (positionnement manuel)
                  </SelectItem>
                )}
                {isDocx && <SelectItem value="docx">DOCX (placeholders)</SelectItem>}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Fichier source : <code>{sourceFileName}</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notice RGPD (affichée avant remplissage)</Label>
            <Textarea
              value={values.rgpdNotice}
              onChange={(e) => onChange({ rgpdNotice: e.target.value })}
              rows={4}
            />
          </div>

          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-2">
              <Label>Conservation (jours)</Label>
              <Input
                type="number"
                value={values.retentionDays}
                onChange={(e) =>
                  onChange({ retentionDays: parseInt(e.target.value, 10) || 30 })
                }
                min="1"
                max="365"
              />
            </div>
            <div className="space-y-2">
              <Label>Nom du fichier généré</Label>
              <Input
                value={values.outputFilenameTpl}
                onChange={(e) => onChange({ outputFilenameTpl: e.target.value })}
                placeholder="document-{{date}}.pdf"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Organisme émetteur</Label>
            <Select
              value={values.organismeId || "__none__"}
              onValueChange={(v) =>
                onChange({ organismeId: v === "__none__" ? null : v })
              }
              items={[
                { value: "__none__", label: "— Aucun —" },
                ...organismes.map((o) => ({
                  value: o.id,
                  label: o.shortName ? `${o.shortName} — ${o.name}` : o.name,
                })),
              ]}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Aucun organisme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Aucun —</SelectItem>
                {organismes.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.shortName ? `${o.shortName} — ${o.name}` : o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-2">
              <Label>Référence officielle</Label>
              <Input
                value={values.officialRef}
                onChange={(e) => onChange({ officialRef: e.target.value })}
                placeholder="Formulaire C1, …"
              />
            </div>
            <div className="space-y-2">
              <Label>En vigueur depuis</Label>
              <Input
                type="date"
                value={values.effectiveDate}
                onChange={(e) => onChange({ effectiveDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Expire le (optionnel)</Label>
            <Input
              type="date"
              value={values.expiresAt}
              onChange={(e) => onChange({ expiresAt: e.target.value })}
            />
          </div>

          <div className="space-y-2 border-t pt-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.requiresSignature}
                onChange={(e) => onChange({ requiresSignature: e.target.checked })}
                className="w-4 h-4 mt-0.5 rounded border-input"
              />
              <div>
                <div className="font-medium">Signature électronique requise</div>
                <p className="text-xs text-muted-foreground">
                  L&apos;utilisateur devra signer (canvas tactile/souris) avant
                  génération. Sa position se place dans l&apos;éditeur via un
                  champ de type <code>signature</code>.
                </p>
              </div>
            </label>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
