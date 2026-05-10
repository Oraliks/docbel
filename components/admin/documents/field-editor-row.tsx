"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Plus, Languages, HelpCircle, UserCircle, FoldVertical, Library, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentField, DocumentFieldOption, DocumentFieldType, PrefillSource } from "@/lib/documents/types";
import type { PresetOption } from "./template-editor";

interface FieldEditorRowProps {
  field: DocumentField;
  allFields: DocumentField[];
  presets?: PresetOption[];
  onChange: (field: DocumentField) => void;
  onRemove: () => void;
}

const TYPE_OPTIONS: { value: DocumentFieldType; label: string }[] = [
  { value: "text", label: "Texte" },
  { value: "textarea", label: "Texte multiligne" },
  { value: "number", label: "Nombre" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Case à cocher" },
  { value: "select", label: "Liste déroulante" },
  { value: "niss", label: "NISS belge" },
  { value: "iban", label: "IBAN belge" },
  { value: "postal_be", label: "Code postal belge" },
  { value: "tva_be", label: "TVA belge" },
  { value: "bce", label: "BCE / N° entreprise" },
  { value: "phone_be", label: "Téléphone belge" },
  { value: "signature", label: "Signature électronique" },
];

function SubSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded p-3 bg-background space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export function FieldEditorRow({ field, allFields, presets = [], onChange, onRemove }: FieldEditorRowProps) {
  const [expanded, setExpanded] = useState(false);
  const currentPreset = presets.find((p) => p.id === field.presetId);

  function update<K extends keyof DocumentField>(key: K, value: DocumentField[K]) {
    onChange({ ...field, [key]: value });
  }

  function applyPreset(presetId: string | null) {
    if (!presetId) {
      onChange({ ...field, presetId: undefined });
      return;
    }
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    // Synchronise les champs du preset → champ (l'utilisateur peut ensuite les surcharger)
    onChange({
      ...field,
      presetId,
      type: preset.fieldType as DocumentFieldType,
      regex: preset.regex || undefined,
      errorMsg: preset.errorMsg,
      errorMsgNl: preset.errorMsgNl || field.errorMsgNl,
      helpText: preset.helpText || field.helpText,
      helpTextNl: preset.helpTextNl || field.helpTextNl,
      placeholder: preset.placeholder || field.placeholder,
      placeholderNl: preset.placeholderNl || field.placeholderNl,
      maxLength: preset.maxLength ?? field.maxLength,
      minLength: preset.minLength ?? field.minLength,
      minValue: preset.minValue ?? field.minValue,
      maxValue: preset.maxValue ?? field.maxValue,
    });
  }

  // Filtrer les presets compatibles avec le type courant (souple : on autorise text→textarea, etc.)
  const compatiblePresets = presets.filter((p) => {
    if (p.fieldType === field.type) return true;
    // Souplesse : presets text appliquables sur textarea et vice-versa
    if (
      (p.fieldType === "text" && field.type === "textarea") ||
      (p.fieldType === "textarea" && field.type === "text")
    )
      return true;
    return false;
  });

  // Grouper presets par catégorie pour l'affichage
  const presetsByCategory = compatiblePresets.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, PresetOption[]>);

  function addOption() {
    const opts = [...(field.options || []), { value: "", label: "" }];
    update("options", opts);
  }

  function updateOption(idx: number, patch: Partial<DocumentFieldOption>) {
    const opts = [...(field.options || [])];
    opts[idx] = { ...opts[idx], ...patch };
    update("options", opts);
  }

  function removeOption(idx: number) {
    const opts = (field.options || []).filter((_, i) => i !== idx);
    update("options", opts);
  }

  return (
    <div className="border rounded-md bg-card">
      <div className="flex items-center gap-2 p-3">
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 items-center min-w-0">
          <Input
            value={field.label}
            onChange={(e) => update("label", e.target.value)}
            placeholder="Libellé"
            className="h-9"
          />
          <Select value={field.type} onValueChange={(v) => v && update("type", v as DocumentFieldType)}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 min-w-0">
            <label className="flex items-center gap-2 text-sm whitespace-nowrap">
              <Checkbox
                checked={field.required}
                onCheckedChange={(c) => update("required", c === true)}
              />
              Obligatoire
            </label>
            {currentPreset && (
              <Badge variant="default" className="text-xs gap-1 truncate" title={currentPreset.description ?? undefined}>
                <Library className="w-3 h-3" />
                {currentPreset.name}
              </Badge>
            )}
            {field.section && (
              <Badge variant="secondary" className="text-xs truncate">
                {field.section}
              </Badge>
            )}
            {field.pdfFieldName && (
              <Badge variant="outline" className="text-xs font-mono truncate" title={field.pdfFieldName}>
                {field.pdfFieldName}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-3 bg-muted/30">
          <SubSection icon={<Library className="w-4 h-4 text-muted-foreground" />} title="Preset de validation">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Select
                  value={field.presetId || "__none__"}
                  onValueChange={(v) => applyPreset(!v || v === "__none__" ? null : v)}
                >
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="Choisir un preset…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucun preset —</SelectItem>
                    {Object.entries(presetsByCategory).map(([cat, list]) => (
                      <div key={cat}>
                        <div className="px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                          {cat}
                        </div>
                        {list.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                {field.presetId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(null)}
                    title="Retirer le preset"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {currentPreset && currentPreset.description && (
                <p className="text-xs text-muted-foreground">{currentPreset.description}</p>
              )}
              {compatiblePresets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun preset disponible pour le type <code>{field.type}</code>.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Le preset pré-remplit les règles ci-dessous. Vous pouvez ensuite les surcharger.
              </p>
            </div>
          </SubSection>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Identifiant interne</Label>
              <Input
                value={field.id}
                onChange={(e) => update("id", e.target.value.replace(/[^a-z0-9_]/gi, "_"))}
                className="font-mono text-sm h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valeur par défaut</Label>
              <Input
                value={String(field.defaultValue ?? "")}
                onChange={(e) => update("defaultValue", e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <SubSection icon={<HelpCircle className="w-4 h-4 text-muted-foreground" />} title="Aide utilisateur">
            <div className="space-y-1.5">
              <Label className="text-xs">Texte d&apos;aide (sous le champ)</Label>
              <Textarea
                value={field.helpText || ""}
                onChange={(e) => update("helpText", e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lien d&apos;aide (URL)</Label>
              <Input
                value={field.helpUrl || ""}
                onChange={(e) => update("helpUrl", e.target.value)}
                placeholder="https://docbel.be/aide/qu-est-ce-qu-un-niss"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Si renseigné, une icône (?) cliquable s&apos;affichera à côté du champ.
              </p>
            </div>
          </SubSection>

          <SubSection icon={<Languages className="w-4 h-4 text-muted-foreground" />} title="Multi-langue (Néerlandais)">
            <div className="space-y-1.5">
              <Label className="text-xs">Libellé en néerlandais</Label>
              <Input
                value={field.labelNl || ""}
                onChange={(e) => update("labelNl", e.target.value)}
                placeholder="(facultatif — fallback sur le libellé FR)"
                className="h-9"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Aide en NL</Label>
                <Textarea
                  value={field.helpTextNl || ""}
                  onChange={(e) => update("helpTextNl", e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Message d&apos;erreur en NL</Label>
                <Input
                  value={field.errorMsgNl || ""}
                  onChange={(e) => update("errorMsgNl", e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </SubSection>

          <SubSection icon={<UserCircle className="w-4 h-4 text-muted-foreground" />} title="Pré-remplissage utilisateur connecté">
            <Select
              value={field.prefillFrom || "__none__"}
              onValueChange={(v) =>
                update("prefillFrom", v === "__none__" || !v ? undefined : (v as PrefillSource))
              }
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Pas de pré-remplissage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Désactivé —</SelectItem>
                <SelectItem value="user.name">Nom de l&apos;utilisateur connecté</SelectItem>
                <SelectItem value="user.email">Email de l&apos;utilisateur connecté</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Si l&apos;utilisateur est connecté, ce champ sera pré-rempli automatiquement.
            </p>
          </SubSection>

          <SubSection icon={<FoldVertical className="w-4 h-4 text-muted-foreground" />} title="Wizard (regroupement par section)">
            <div className="space-y-1.5">
              <Label className="text-xs">Section / étape</Label>
              <Input
                value={field.section || ""}
                onChange={(e) => update("section", e.target.value || undefined)}
                placeholder="ex: Employeur, Travailleur, Contrat…"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Si plusieurs champs ont la même section, le formulaire sera affiché en mode wizard
                (étape par étape) côté utilisateur.
              </p>
            </div>
          </SubSection>

          <SubSection icon={<HelpCircle className="w-4 h-4 text-muted-foreground" />} title="Validation">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Regex (optionnel)</Label>
                <Input
                  value={field.regex || ""}
                  onChange={(e) => update("regex", e.target.value)}
                  placeholder="^[A-Z]{2,3}$"
                  className="font-mono text-sm h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Message d&apos;erreur</Label>
                <Input
                  value={field.errorMsg || ""}
                  onChange={(e) => update("errorMsg", e.target.value)}
                  placeholder="Format invalide"
                  className="h-9"
                />
              </div>
            </div>
            {(field.type === "text" || field.type === "textarea") && (
              <div className="space-y-1.5 max-w-xs">
                <Label className="text-xs">Longueur maximale</Label>
                <Input
                  type="number"
                  value={field.maxLength || ""}
                  onChange={(e) =>
                    update("maxLength", e.target.value ? parseInt(e.target.value, 10) : undefined)
                  }
                  min="1"
                  max="5000"
                  placeholder="500"
                  className="h-9"
                />
              </div>
            )}
          </SubSection>

          {field.type === "select" && (
            <SubSection icon={<HelpCircle className="w-4 h-4 text-muted-foreground" />} title="Options de la liste">
              <div className="space-y-2">
                {(field.options || []).map((opt, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <Input
                      value={opt.value}
                      onChange={(e) => updateOption(idx, { value: e.target.value })}
                      placeholder="valeur"
                      className="font-mono text-sm h-9"
                    />
                    <Input
                      value={opt.label}
                      onChange={(e) => updateOption(idx, { label: e.target.value })}
                      placeholder="Libellé FR"
                      className="h-9"
                    />
                    <Input
                      value={opt.labelNl || ""}
                      onChange={(e) => updateOption(idx, { labelNl: e.target.value })}
                      placeholder="Libellé NL (facultatif)"
                      className="h-9"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(idx)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addOption}>
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter une option
                </Button>
              </div>
            </SubSection>
          )}

          <SubSection icon={<HelpCircle className="w-4 h-4 text-muted-foreground" />} title="Affichage conditionnel">
            <div className="grid gap-2 md:grid-cols-2">
              <Select
                value={field.visibleIf?.fieldId || "__none__"}
                onValueChange={(v) =>
                  update(
                    "visibleIf",
                    !v || v === "__none__"
                      ? undefined
                      : { fieldId: v, equals: field.visibleIf?.equals ?? "" }
                  )
                }
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Champ déclencheur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucune condition —</SelectItem>
                  {allFields
                    .filter((f) => f.id !== field.id)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label} ({f.id})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {field.visibleIf && (
                <Input
                  value={String(field.visibleIf.equals)}
                  onChange={(e) =>
                    update("visibleIf", {
                      fieldId: field.visibleIf!.fieldId,
                      equals: e.target.value,
                    })
                  }
                  placeholder="Valeur attendue"
                  className="h-9"
                />
              )}
            </div>
          </SubSection>

          {field.position && (
            <SubSection icon={<HelpCircle className="w-4 h-4 text-muted-foreground" />} title="Rendu PDF">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={field.eraseUnderlay !== false}
                  onCheckedChange={(c) => update("eraseUnderlay", c === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Effacer le filler du PDF original</span>
                  <span className="block text-xs text-muted-foreground">
                    Dessine un rectangle blanc sous le texte pour masquer les pointillés (
                    <code>....</code>) ou underscores (<code>____</code>) du document. Désactive si
                    tu veux garder l&apos;apparence originale.
                  </span>
                </span>
              </label>
            </SubSection>
          )}

          {field.position && (
            <SubSection icon={<HelpCircle className="w-4 h-4 text-muted-foreground" />} title="Position sur le PDF (mode visuel)">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <Label className="text-xs">Page</Label>
                  <Input
                    type="number"
                    value={field.position.page}
                    onChange={(e) =>
                      update("position", {
                        ...field.position!,
                        page: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">X</Label>
                  <Input
                    type="number"
                    value={field.position.x}
                    onChange={(e) =>
                      update("position", {
                        ...field.position!,
                        x: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Y</Label>
                  <Input
                    type="number"
                    value={field.position.y}
                    onChange={(e) =>
                      update("position", {
                        ...field.position!,
                        y: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Largeur</Label>
                  <Input
                    type="number"
                    value={field.position.w}
                    onChange={(e) =>
                      update("position", {
                        ...field.position!,
                        w: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Hauteur</Label>
                  <Input
                    type="number"
                    value={field.position.h}
                    onChange={(e) =>
                      update("position", {
                        ...field.position!,
                        h: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Police</Label>
                  <Input
                    type="number"
                    value={field.position.fontSize}
                    onChange={(e) =>
                      update("position", {
                        ...field.position!,
                        fontSize: parseInt(e.target.value, 10) || 11,
                      })
                    }
                    className="h-9"
                  />
                </div>
              </div>
            </SubSection>
          )}
        </div>
      )}
    </div>
  );
}
