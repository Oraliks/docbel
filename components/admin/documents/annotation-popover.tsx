"use client";

import { createElement, useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  X,
  Check,
  Type as TypeIcon,
  AlignLeft,
  Hash,
  Calendar,
  CheckSquare,
  ChevronDown,
  IdCard,
  CreditCard,
  MapPin,
  Building2,
  Phone,
  PenTool,
  HelpCircle,
  Brain,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CanonicalFieldPreset } from "./field-library-picker";
import type { ClickTarget } from "@/lib/documents/click-targets";
import type { DocumentField, DocumentFieldType } from "@/lib/documents/types";
import { findBestCorrection, type StoredCorrection } from "@/lib/documents/ocr-corrections";

/// Une suggestion qui apparaît au-dessus du popover : indique POURQUOI ce
/// pré-remplissage existe (mémoire, hint regex, ou IA).
type SourceTag = "memory" | "hint" | "ai" | null;

interface Props {
  /// Source de l'annotation. Un ClickTarget = mode création (depuis un élément
  /// natif du PDF). Un DocumentField = mode édition d'un champ existant.
  target: ClickTarget;
  /// Si défini, on est en mode édition d'un champ existant.
  /// Les valeurs initiales viennent de ce champ (priorité absolue), pas du
  /// target ni de la mémoire — l'admin a déjà choisi.
  editingField?: DocumentField;
  /// Position absolue du target sur l'écran (top + left en pixels) — utilisée
  /// pour positionner le popover juste à côté.
  anchor: { left: number; top: number; right: number; bottom: number };
  templateId: string;
  templateName: string;
  organismeName: string | null;
  presets: CanonicalFieldPreset[];
  /// Pool de corrections OCR connues — chargé une fois par l'éditeur parent
  /// et passé ici. Permet le fuzzy match côté client sans aller-retour réseau.
  corrections: StoredCorrection[];
  onCancel: () => void;
  onSave: (field: Omit<DocumentField, "id">) => void;
}

const FIELD_TYPES: DocumentFieldType[] = [
  "text",
  "textarea",
  "number",
  "date",
  "checkbox",
  "select",
  "niss",
  "iban",
  "postal_be",
  "tva_be",
  "bce",
  "phone_be",
  "signature",
];

const TYPE_ICONS: Record<string, LucideIcon> = {
  text: TypeIcon,
  textarea: AlignLeft,
  number: Hash,
  date: Calendar,
  checkbox: CheckSquare,
  select: ChevronDown,
  niss: IdCard,
  iban: CreditCard,
  postal_be: MapPin,
  tva_be: Building2,
  bce: Building2,
  phone_be: Phone,
  signature: PenTool,
};

function typeIcon(t: string): LucideIcon {
  return TYPE_ICONS[t] ?? HelpCircle;
}

/// Wrapper qui rend l'icône lucide pour un type donné. Utilise `createElement`
/// pour éviter le pattern interdit "composant JSX assigné en variable pendant le
/// render" (lint react-hooks/static-components).
function TypeIconView({ type, className }: { type: string; className?: string }) {
  return createElement(typeIcon(type), { className });
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function AnnotationPopover({
  target,
  editingField,
  anchor,
  templateId,
  templateName,
  organismeName,
  presets,
  corrections,
  onCancel,
  onSave,
}: Props) {
  const isEdit = !!editingField;

  /// Pré-remplissage initial.
  /// - Mode édition : les valeurs viennent du champ existant, point.
  /// - Mode création : mémoire fuzzy match → hint regex → label voisin.
  const memoryHit = useMemo(() => {
    if (isEdit) return null;
    if (!target.nearbyLabel) return null;
    return findBestCorrection(target.nearbyLabel, corrections);
  }, [isEdit, target.nearbyLabel, corrections]);

  const initialPresetId = isEdit
    ? editingField?.presetId ?? null
    : memoryHit?.presetId
    ? memoryHit.presetId
    : presets.find((p) => p.name === target.suggestedPresetName)?.id ?? null;

  const [label, setLabel] = useState(
    isEdit
      ? editingField?.label ?? ""
      : memoryHit?.cleanLabel || target.nearbyLabel
  );
  const [type, setType] = useState<DocumentFieldType>(
    isEdit
      ? (editingField?.type as DocumentFieldType)
      : (memoryHit?.fieldType as DocumentFieldType) || target.suggestedType
  );
  const [presetId, setPresetId] = useState<string | null>(initialPresetId);
  const [helpText, setHelpText] = useState(
    isEdit ? editingField?.helpText ?? "" : ""
  );
  const [internalNote, setInternalNote] = useState(
    isEdit ? editingField?.internalNote ?? "" : ""
  );
  const [source, setSource] = useState<SourceTag>(
    isEdit
      ? null
      : memoryHit
      ? "memory"
      : target.suggestedPresetName
      ? "hint"
      : null
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");

  /// Filtre + tri des presets : populaires d'abord, puis ceux dont le label
  /// canonique contient la recherche.
  const filteredPresets = useMemo(() => {
    const q = normalize(presetSearch || label);
    const scored = presets
      .filter((p) => p.defaultLabel && p.defaultWidth && p.defaultHeight)
      .map((p) => {
        const hay = normalize(`${p.name} ${p.defaultLabel ?? ""} ${p.description ?? ""}`);
        const hit = q && hay.includes(q);
        const typeMatch = p.fieldType === type;
        const score =
          (hit ? 100 : 0) +
          (typeMatch ? 50 : 0) +
          (p.popular ? 10 : 0) +
          (p.id === presetId ? 200 : 0);
        return { preset: p, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((s) => s.preset);
    return scored.slice(0, 20);
  }, [presets, presetSearch, label, type, presetId]);

  async function askAi() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/documents/ocr/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName,
          organisme: organismeName ?? undefined,
          templateId,
          detections: [{ index: 0, label: label || target.nearbyLabel || target.text, type }],
          presets: presets.map((p) => ({ id: p.id, name: p.name, category: p.category })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) toast.error("Aide IA désactivée dans les paramètres.");
        else if (res.status === 429) toast.error("Trop de requêtes — patiente quelques secondes.");
        else if (res.status === 503) toast.error("ANTHROPIC_API_KEY non configurée.");
        else toast.error(data.error || "Échec de l'appel IA");
        return;
      }
      const data = (await res.json()) as {
        suggestions: Array<{
          label: string;
          type: string;
          presetId: string | null;
          helpText: string | null;
        }>;
      };
      const s = data.suggestions?.[0];
      if (s) {
        if (s.label) setLabel(s.label);
        if (s.type) setType(s.type as DocumentFieldType);
        if (s.presetId) setPresetId(s.presetId);
        if (s.helpText) setHelpText(s.helpText);
        setSource("ai");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau IA");
    } finally {
      setAiLoading(false);
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!label.trim()) {
      toast.error("Donne un nom au champ.");
      return;
    }
    const preset = presets.find((p) => p.id === presetId) ?? null;
    let options: DocumentField["options"] | undefined;
    if (type === "select" && preset?.defaultOptions && Array.isArray(preset.defaultOptions)) {
      options = (preset.defaultOptions as { value: string; label: string }[])
        .filter((o) => o && typeof o.value === "string" && typeof o.label === "string")
        .map((o) => ({ value: o.value, label: o.label }));
    }
    // En mode édition on conserve la position et required existants — le
    // popover ne modifie que label/type/preset/helpText. Le parent merge.
    onSave({
      label: label.trim(),
      type,
      required: isEdit ? !!editingField?.required : false,
      ...(presetId ? { presetId } : {}),
      ...(helpText ? { helpText } : {}),
      ...(internalNote ? { internalNote } : {}),
      ...(options ? { options } : {}),
      position: isEdit && editingField?.position
        ? editingField.position
        : {
            page: 0, // sera réécrit par le parent avec le bon page index
            x: target.x,
            y: target.y,
            w: target.w,
            h: target.h,
            fontSize: 11,
          },
    });
  }

  /// Position du popover : à droite du target si on a la place, sinon à gauche
  /// ou en-dessous. Largeur fixe = 360px.
  const POPOVER_W = 360;
  const POPOVER_H_EST = 460;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1400;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const placeRight = anchor.right + 16 + POPOVER_W < viewportW;
  const popLeft = placeRight ? anchor.right + 12 : Math.max(8, anchor.left - POPOVER_W - 12);
  const popTop = Math.max(8, Math.min(anchor.top, viewportH - POPOVER_H_EST - 8));

  const selectedPreset = presets.find((p) => p.id === presetId);

  return (
    <>
      {/* Backdrop click-to-close */}
      <div
        className="fixed inset-0 z-40"
        onClick={onCancel}
        onContextMenu={(e) => {
          e.preventDefault();
          onCancel();
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="fixed z-50 w-[360px] rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ left: popLeft, top: popTop }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <TypeIconView type={type} className="size-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium truncate">
              {isEdit ? "Modifier le champ" : "Annoter ce champ"}
            </span>
            {source === "memory" && memoryHit && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1 ml-1">
                <Brain className="size-3" />
                Mémoire · {memoryHit.occurrences}×
              </Badge>
            )}
            {source === "hint" && !memoryHit && (
              <Badge variant="outline" className="text-[10px] h-5 ml-1">
                Suggéré
              </Badge>
            )}
            {source === "ai" && (
              <Badge variant="secondary" className="text-[10px] h-5 gap-1 ml-1 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-200">
                <Sparkles className="size-3" />
                IA
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground rounded p-0.5 hover:bg-muted"
            title="Annuler"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Label */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Nom du champ
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex. Nom et prénom, NISS, Date de naissance…"
              className="h-9 text-sm"
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Type
            </Label>
            <Select value={type} onValueChange={(v) => v && setType(v as DocumentFieldType)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="text-sm">
                    <span className="inline-flex items-center gap-2">
                      <TypeIconView type={t} className="size-3.5" />
                      {t}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preset picker — palette canonique */}
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center justify-between">
              <span>Preset</span>
              {selectedPreset && (
                <button
                  type="button"
                  onClick={() => setPresetId(null)}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  retirer
                </button>
              )}
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={presetSearch}
                onChange={(e) => setPresetSearch(e.target.value)}
                placeholder={selectedPreset ? selectedPreset.defaultLabel ?? selectedPreset.name : "Chercher un preset…"}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="max-h-[140px] overflow-y-auto rounded border bg-background">
              {filteredPresets.length === 0 ? (
                <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                  Aucun preset
                </div>
              ) : (
                <ul>
                  {filteredPresets.map((p) => {
                    const selected = p.id === presetId;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPresetId(p.id);
                            if (p.fieldType !== type) setType(p.fieldType as DocumentFieldType);
                            if (!label.trim() && p.defaultLabel) setLabel(p.defaultLabel);
                          }}
                          className={`w-full text-left px-2 py-1.5 text-xs flex items-center gap-2 hover:bg-muted transition-colors ${
                            selected ? "bg-primary/10 text-primary" : ""
                          }`}
                        >
                          <TypeIconView type={p.fieldType} className="size-3.5 flex-shrink-0" />
                          <span className="truncate flex-1">
                            {p.defaultLabel ?? p.name}
                          </span>
                          {p.popular && <span className="text-amber-500 text-[10px]">★</span>}
                          {selected && <Check className="size-3.5 flex-shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Help text (optional, affiché si rempli ou si IA en a généré un) */}
          {(helpText || source === "ai") && (
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Aide pour le citoyen (optionnel)
              </Label>
              <Input
                value={helpText}
                onChange={(e) => setHelpText(e.target.value)}
                placeholder="Ex. 11 chiffres au dos de votre carte d'identité"
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* Note interne (visible uniquement en mode édition) */}
          {isEdit && (
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Note interne (admin uniquement)
              </Label>
              <Input
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Ex. À retirer quand le décret entre en vigueur"
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* Original text preview (debug helper) */}
          {target.text && target.text.length < 40 && (
            <div className="text-[10px] text-muted-foreground border-t pt-2">
              Texte du PDF&nbsp;: <code className="px-1 bg-muted rounded">{target.text}</code>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-muted/20">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={askAi}
            disabled={aiLoading}
            className="text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950 h-8"
            title="Demander à l'IA une suggestion pour ce champ"
          >
            {aiLoading ? (
              <Loader2 className="size-3.5 mr-1 animate-spin" />
            ) : (
              <Sparkles className="size-3.5 mr-1" />
            )}
            IA
          </Button>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8">
              Annuler
            </Button>
            <Button type="submit" size="sm" className="h-8">
              <Check className="size-3.5 mr-1" />
              {isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
