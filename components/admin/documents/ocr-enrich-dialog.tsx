"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  CircleSlash,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { DetectedField } from "@/lib/documents/ocr-detector";
import type { DocumentFieldType } from "@/lib/documents/types";

interface PresetLite {
  id: string;
  name: string;
  category?: string;
}

export interface EnrichmentSuggestion {
  index: number;
  label: string;
  type: string;
  presetName: string | null;
  presetId: string | null;
  helpText: string | null;
}

/// La détection enrichie qu'on renvoie au parent : combine label/type édité +
/// les métadonnées privées `_correctionPresetId` / `_helpText` lues par
/// applyDetections() côté visual-pdf-editor.
export interface EnrichmentApplied {
  index: number;
  label: string;
  type: DocumentFieldType;
  _correctionPresetId?: string;
  _helpText?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /// Détections originales, indexées par leur position dans `pendingDetections`.
  originals: { index: number; original: DetectedField }[];
  /// Suggestions IA correspondantes.
  suggestions: EnrichmentSuggestion[];
  /// Presets disponibles (pour les overrides manuels par l'admin).
  presets: PresetLite[];
  /// Appliquer les modifications acceptées (et potentiellement éditées).
  onApply: (accepted: EnrichmentApplied[]) => void;
  /// Stats coût (optionnel) — affichées en bas pour transparence.
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheRead?: number;
  };
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

const NONE_PRESET = "__none__";

export function OcrEnrichDialog({
  open,
  onClose,
  originals,
  suggestions,
  presets,
  onApply,
  usage,
}: Props) {
  // Index local des suggestions par leur `index` (qui correspond à l'index
  // dans le pendingDetections du parent — stable pendant la session).
  const initialSuggestions = useMemo(() => {
    const map = new Map<number, EnrichmentSuggestion>();
    for (const s of suggestions) map.set(s.index, s);
    return map;
  }, [suggestions]);

  // State interne : suggestions éditables + set des indexes acceptés
  const [editedSuggestions, setEditedSuggestions] = useState<Map<number, EnrichmentSuggestion>>(
    () => new Map(initialSuggestions)
  );
  const [accepted, setAccepted] = useState<Set<number>>(() => {
    // Par défaut, on accepte toute suggestion qui change vraiment quelque chose
    const out = new Set<number>();
    for (const { index, original } of originals) {
      const s = initialSuggestions.get(index);
      if (!s) continue;
      const changedLabel = s.label !== original.label;
      const changedType = s.type !== original.type;
      const addedPreset = s.presetId !== null;
      const addedHelp = !!s.helpText;
      if (changedLabel || changedType || addedPreset || addedHelp) {
        out.add(index);
      }
    }
    return out;
  });

  function toggleAccepted(idx: number) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() {
    setAccepted(new Set(originals.map((o) => o.index)));
  }
  function selectNone() {
    setAccepted(new Set());
  }

  function updateSuggestion(idx: number, patch: Partial<EnrichmentSuggestion>) {
    setEditedSuggestions((prev) => {
      const next = new Map(prev);
      const cur = next.get(idx);
      if (!cur) return prev;
      next.set(idx, { ...cur, ...patch });
      return next;
    });
  }

  function handleApply() {
    const toApply: EnrichmentApplied[] = [];
    for (const idx of accepted) {
      const s = editedSuggestions.get(idx);
      if (!s) continue;
      toApply.push({
        index: idx,
        label: s.label,
        type: s.type as DocumentFieldType,
        _correctionPresetId: s.presetId ?? undefined,
        _helpText: s.helpText ?? undefined,
      });
    }
    onApply(toApply);
  }

  const changedCount = accepted.size;
  const totalCount = originals.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            Suggestions IA pour {totalCount} détection{totalCount > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            L&apos;IA a proposé des labels nettoyés, des types ajustés et des presets
            de validation. Décochez les suggestions que vous ne voulez pas, ou éditez-les
            directement avant d&apos;appliquer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b pb-2">
          <Button variant="ghost" size="sm" onClick={selectAll}>
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Tout cocher
          </Button>
          <Button variant="ghost" size="sm" onClick={selectNone}>
            <CircleSlash className="w-3.5 h-3.5 mr-1" />
            Tout décocher
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {changedCount} / {totalCount} accepté{changedCount > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 -mx-1 px-1">
          {originals.map(({ index, original }) => {
            const s = editedSuggestions.get(index);
            if (!s) return null;
            const isAccepted = accepted.has(index);
            const changedLabel = s.label !== original.label;
            const changedType = s.type !== original.type;
            const addedPreset = s.presetId !== null;
            const addedHelp = !!s.helpText;
            const noChange = !changedLabel && !changedType && !addedPreset && !addedHelp;

            return (
              <div
                key={index}
                className={`border rounded-md p-3 transition-colors ${
                  isAccepted
                    ? "border-green-300 bg-green-50/30 dark:border-green-800 dark:bg-green-950/30"
                    : "border-border bg-muted/10"
                }`}
              >
                <div className="flex items-start gap-2">
                  <label className="flex items-center pt-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAccepted}
                      onChange={() => toggleAccepted(index)}
                      disabled={noChange}
                    />
                  </label>
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Tête de la ligne */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-muted-foreground">
                        Détection #{index + 1} · page {original.page + 1}
                      </span>
                      {noChange ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Aucune modif proposée
                        </Badge>
                      ) : (
                        <>
                          {changedLabel && (
                            <Badge variant="outline" className="text-[10px]">
                              Label
                            </Badge>
                          )}
                          {changedType && (
                            <Badge variant="outline" className="text-[10px]">
                              Type
                            </Badge>
                          )}
                          {addedPreset && (
                            <Badge variant="outline" className="text-[10px]">
                              Preset
                            </Badge>
                          )}
                          {addedHelp && (
                            <Badge variant="outline" className="text-[10px]">
                              Aide
                            </Badge>
                          )}
                        </>
                      )}
                    </div>

                    {/* Label original → suggéré */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Original (OCR)
                        </Label>
                        <div className="mt-1 px-2 py-1.5 text-sm bg-muted/50 rounded border text-muted-foreground line-clamp-2">
                          {original.label || "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          type : <code>{original.type}</code>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wide text-green-700 dark:text-green-400">
                          Suggéré (IA — éditable)
                        </Label>
                        <Input
                          value={s.label}
                          onChange={(e) => updateSuggestion(index, { label: e.target.value })}
                          className="mt-1 h-8 text-sm"
                          disabled={!isAccepted}
                        />
                        <div className="grid grid-cols-2 gap-1 mt-1">
                          <Select
                            value={s.type}
                            onValueChange={(v) => v && updateSuggestion(index, { type: v })}
                            disabled={!isAccepted}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map((t) => (
                                <SelectItem key={t} value={t} className="text-xs">
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={s.presetId ?? NONE_PRESET}
                            onValueChange={(v) =>
                              updateSuggestion(index, {
                                presetId: !v || v === NONE_PRESET ? null : v,
                                presetName:
                                  !v || v === NONE_PRESET
                                    ? null
                                    : presets.find((p) => p.id === v)?.name ?? null,
                              })
                            }
                            disabled={!isAccepted}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Aucun preset">
                                {(value: unknown) => {
                                  const v = typeof value === "string" ? value : "";
                                  if (!v || v === NONE_PRESET) return "Aucun preset";
                                  return presets.find((p) => p.id === v)?.name ?? "—";
                                }}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE_PRESET} className="text-xs">
                                — Aucun preset —
                              </SelectItem>
                              {presets.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-xs">
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Help text suggéré */}
                    {s.helpText !== null && (
                      <div>
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Aide pour le citoyen (optionnelle)
                        </Label>
                        <Input
                          value={s.helpText ?? ""}
                          onChange={(e) =>
                            updateSuggestion(index, { helpText: e.target.value || null })
                          }
                          placeholder="Ex: Tel qu'écrit sur votre carte d'identité"
                          className="mt-1 h-8 text-xs"
                          disabled={!isAccepted}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="border-t pt-3">
          <div className="flex items-center gap-3 mr-auto text-[11px] text-muted-foreground">
            {usage && (usage.inputTokens || usage.outputTokens) && (
              <span>
                Tokens : {usage.inputTokens ?? 0} in · {usage.outputTokens ?? 0} out
                {usage.cacheRead ? ` · ${usage.cacheRead} cache` : ""}
              </span>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1" />
            Annuler
          </Button>
          <Button onClick={handleApply} disabled={changedCount === 0}>
            <Check className="w-4 h-4 mr-1" />
            Appliquer {changedCount > 0 ? `(${changedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/// Skeleton de loading affiché à la place du dialog pendant l'appel IA.
export function OcrEnrichLoading({
  count,
  onClose,
}: {
  count: number;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
            L&apos;IA analyse {count} détection{count > 1 ? "s" : ""}…
          </DialogTitle>
          <DialogDescription>
            Claude Haiku nettoie les labels, ajuste les types et propose des
            presets pertinents. Quelques secondes…
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
