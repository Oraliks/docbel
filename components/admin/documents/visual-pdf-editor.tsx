"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Rnd } from "react-rnd";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Wand2,
  Loader2,
  Layers,
  Database,
  Brain,
  Sparkles,
  // Icônes par type de champ — affichées sur les rectangles à la place des labels textes
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocumentField, DocumentFieldType } from "@/lib/documents/types";
import {
  ocrWordsToPdfCoords,
  detectFields,
  shapesToDetections,
  type DetectedField,
  type OCRWord,
  type GraphicShape,
} from "@/lib/documents/ocr-detector";
import { findBestCorrection, type StoredCorrection } from "@/lib/documents/ocr-corrections";
import {
  OcrEnrichDialog,
  OcrEnrichLoading,
  type EnrichmentApplied,
  type EnrichmentSuggestion,
} from "./ocr-enrich-dialog";
import {
  FieldLibraryPicker,
  type CanonicalFieldPreset,
} from "./field-library-picker";

const PDFDocument = dynamic(() => import("react-pdf").then((m) => m.Document), {
  ssr: false,
});
const PDFPage = dynamic(() => import("react-pdf").then((m) => m.Page), {
  ssr: false,
});

interface PresetLite {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
  fieldType?: string;
  defaultLabel?: string | null;
  defaultWidth?: number | null;
  defaultHeight?: number | null;
  defaultValue?: string | null;
  defaultOptions?: unknown;
  helpText?: string | null;
  placeholder?: string | null;
  popular?: boolean;
  icon?: string | null;
}

interface VisualPdfEditorProps {
  templateId: string;
  templateName?: string;
  organismeName?: string | null;
  sourceFileId: string;
  sourceFileSha256?: string | null;
  schema: DocumentField[];
  onSchemaChange: (next: DocumentField[]) => void;
  presets?: PresetLite[];
}

interface PageDims {
  width: number;
  height: number;
}

/// Mappe un type de champ vers l'icône à afficher sur le rectangle visuel
/// (au lieu d'un label texte qui cache le PDF en dessous). Le label complet
/// reste accessible via tooltip + dans la liste latérale.
const FIELD_TYPE_ICONS: Record<string, LucideIcon> = {
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

function getFieldTypeIcon(type: string): LucideIcon {
  return FIELD_TYPE_ICONS[type] ?? HelpCircle;
}

export function VisualPdfEditor({
  templateId,
  templateName,
  organismeName,
  sourceFileId,
  sourceFileSha256,
  schema,
  onSchemaChange,
  presets = [],
}: VisualPdfEditorProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageDims, setPageDims] = useState<Record<number, PageDims>>({});
  const [scale, setScale] = useState(1.3);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [pdfWorkerReady, setPdfWorkerReady] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrPageStatus, setOcrPageStatus] = useState<string>("");
  const [pendingDetections, setPendingDetections] = useState<DetectedField[] | null>(null);
  /// Détection sélectionnée pour édition inline (index dans pendingDetections, pas un id stable).
  /// Mutuellement exclusif avec selectedFieldId : on ne sélectionne qu'une chose à la fois.
  const [selectedDetectionIdx, setSelectedDetectionIdx] = useState<number | null>(null);
  /// Flow IA — état d'enrichissement par lot via Claude Haiku.
  /// `enrichLoading` : pendant l'appel API
  /// `enrichResult` : résultat à valider dans le dialog de revue
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{
    suggestions: EnrichmentSuggestion[];
    usage?: { inputTokens?: number; outputTokens?: number; cacheRead?: number };
  } | null>(null);
  /// Flow détection IA Vision (Sonnet) — alternative à l'auto-détection heuristique.
  const [visionRunning, setVisionRunning] = useState(false);
  /// Référence vers le PDFDocumentProxy chargé par react-pdf.
  /// On le réutilise pour les détections (OCR / IA Vision) au lieu de charger
  /// un doublon via `pdfjs.getDocument()`, qui causait des conflits internes
  /// avec react-pdf (erreur "Cannot read properties of null sendWithPromise").
  const pdfDocRef = useRef<{ getPage: (n: number) => Promise<unknown> } | null>(null);
  /// Snapshot connu pour ce PDF (par hash), proposé en restauration rapide.
  const [knownSnapshot, setKnownSnapshot] = useState<{
    detectedFields: DetectedField[];
    pageCount: number;
    createdAt: string;
  } | null>(null);
  /// Guard interne pour ne pas relancer le check snapshot. Pas de state : il
  /// n'est lu qu'à l'intérieur de l'effect, donc un ref évite les re-renders
  /// inutiles et le lint React 19 (set-state-in-effect).
  const snapshotCheckedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("react-pdf").then(({ pdfjs }) => {
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      setPdfWorkerReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /// Au mount : si on connaît le sha256 du PDF, vérifier s'il existe un snapshot OCR.
  /// Ne propose le snapshot que si le schema courant n'a pas de champs déjà placés.
  useEffect(() => {
    if (!sourceFileSha256 || snapshotCheckedRef.current) return;
    if (schema.some((f) => f.position)) {
      // Schema déjà rempli, pas besoin de proposer une restauration
      snapshotCheckedRef.current = true;
      return;
    }
    let cancelled = false;
    fetch(`/api/documents/ocr/snapshot/${sourceFileSha256}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        snapshotCheckedRef.current = true;
        if (!data || data.found !== true) return;
        setKnownSnapshot({
          detectedFields: data.detectedFields as DetectedField[],
          pageCount: data.pageCount,
          createdAt: data.createdAt,
        });
      })
      .catch(() => {
        snapshotCheckedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFileSha256]);

  const fieldsOnPage = schema.filter((f) => f.position && f.position.page === currentPage);
  const dims = pageDims[currentPage];

  function updateField(id: string, updates: Partial<DocumentField>) {
    onSchemaChange(schema.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  function updatePosition(id: string, htmlPos: { x: number; y: number; w: number; h: number }) {
    if (!dims) return;
    const pdfH = dims.height;
    onSchemaChange(
      schema.map((f) => {
        if (f.id !== id) return f;
        return {
          ...f,
          position: {
            page: f.position?.page ?? currentPage,
            x: htmlPos.x / scale,
            y: pdfH - (htmlPos.y / scale) - (htmlPos.h / scale),
            w: htmlPos.w / scale,
            h: htmlPos.h / scale,
            fontSize: f.position?.fontSize || 11,
          },
        };
      })
    );
  }

  function addZone() {
    if (!dims) return;
    const id = `field_${nanoid(6)}`;
    const defaultW = 150;
    const defaultH = 20;
    const defaultX = 50;
    const defaultY = dims.height - 100;
    onSchemaChange([
      ...schema,
      {
        id,
        label: "Nouveau champ",
        type: "text",
        required: false,
        position: {
          page: currentPage,
          x: defaultX,
          y: defaultY,
          w: defaultW,
          h: defaultH,
          fontSize: 11,
        },
      },
    ]);
    setSelectedFieldId(id);
  }

  /// Crée une nouvelle zone depuis un preset canonique (palette bibliothèque).
  /// La zone est positionnée au CENTRE de la page courante, avec les dimensions
  /// par défaut du preset (defaultWidth × defaultHeight). L'admin n'a plus qu'à
  /// la déplacer au bon endroit sur le PDF.
  function addFromLibrary(preset: CanonicalFieldPreset) {
    if (!dims) return;
    const id = `field_${nanoid(6)}`;
    const w = preset.defaultWidth ?? 150;
    const h = preset.defaultHeight ?? 14;
    // Centre approximatif de la page courante (en coords PDF, origine bas-gauche)
    const x = Math.max(10, dims.width / 2 - w / 2);
    const y = Math.max(10, dims.height / 2 - h / 2);

    // Parse les options canoniques (pour select)
    let options: DocumentField["options"] | undefined;
    if (preset.fieldType === "select" && Array.isArray(preset.defaultOptions)) {
      options = (preset.defaultOptions as { value: string; label: string }[])
        .filter((o) => o && typeof o.value === "string" && typeof o.label === "string")
        .map((o) => ({ value: o.value, label: o.label }));
    }

    const newField: DocumentField = {
      id,
      label: preset.defaultLabel ?? preset.name,
      type: preset.fieldType as DocumentFieldType,
      required: false,
      presetId: preset.id,
      ...(preset.helpText ? { helpText: preset.helpText } : {}),
      ...(preset.placeholder ? { placeholder: preset.placeholder } : {}),
      ...(preset.defaultValue ? { defaultValue: preset.defaultValue } : {}),
      ...(options ? { options } : {}),
      position: {
        page: currentPage,
        x,
        y,
        w,
        h,
        fontSize: 11,
      },
    };
    onSchemaChange([...schema, newField]);
    selectField(id);
    toast.success(`« ${preset.defaultLabel ?? preset.name} » ajouté(e)`);
  }

  function removeZone(id: string) {
    onSchemaChange(schema.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  }

  /// Sélection d'un champ existant — désélectionne toute détection en attente.
  function selectField(id: string | null) {
    setSelectedFieldId(id);
    if (id !== null) setSelectedDetectionIdx(null);
  }

  /// Sélection d'une détection — désélectionne tout champ existant.
  function selectDetection(idx: number | null) {
    setSelectedDetectionIdx(idx);
    if (idx !== null) setSelectedFieldId(null);
  }

  /// Met à jour les propriétés (label, type, etc.) d'une détection en attente.
  function updateDetection(idx: number, patch: Partial<DetectedField>) {
    setPendingDetections((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  /// Met à jour la position (drag/resize) d'une détection en convertissant les
  /// coordonnées HTML écran → PDF (origine bas-gauche, en points).
  function updateDetectionPosition(
    idx: number,
    htmlPos: { x: number; y: number; w: number; h: number }
  ) {
    if (!dims) return;
    const pdfH = dims.height;
    setPendingDetections((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const d = next[idx];
      if (!d) return prev;
      next[idx] = {
        ...d,
        x: htmlPos.x / scale,
        y: pdfH - htmlPos.y / scale - htmlPos.h / scale,
        w: htmlPos.w / scale,
        h: htmlPos.h / scale,
      };
      return next;
    });
  }

  /// Supprime une détection en attente. Si elle était sélectionnée, désélectionne.
  function removeDetection(idx: number) {
    setPendingDetections((prev) => {
      if (!prev) return prev;
      const next = prev.filter((_, i) => i !== idx);
      return next.length > 0 ? next : null;
    });
    if (selectedDetectionIdx === idx) {
      setSelectedDetectionIdx(null);
    } else if (selectedDetectionIdx !== null && selectedDetectionIdx > idx) {
      // Décale l'index si la détection sélectionnée était après celle supprimée
      setSelectedDetectionIdx(selectedDetectionIdx - 1);
    }
  }

  /// Applique UNE seule détection (la convertit en champ) et la retire de la liste.
  function applyOneDetection(idx: number) {
    if (!pendingDetections) return;
    const d = pendingDetections[idx];
    if (!d) return;
    const presetByName = new Map(presets.map((p) => [p.name.toLowerCase(), p.id]));
    const presetIds = new Set(presets.map((p) => p.id));
    const dx = d as DetectedField & { _correctionPresetId?: string; _helpText?: string };
    let presetId: string | undefined;
    if (dx._correctionPresetId && presetIds.has(dx._correctionPresetId)) {
      presetId = dx._correctionPresetId;
    } else if (d.suggestedPresetName) {
      presetId = presetByName.get(d.suggestedPresetName.toLowerCase());
    }
    const newField: DocumentField = {
      id: `field_${nanoid(6)}`,
      label: d.label || "Champ détecté",
      type: d.type as DocumentFieldType,
      required: false,
      presetId: presetId || undefined,
      helpText: dx._helpText || undefined,
      position: {
        page: d.page,
        x: d.x,
        y: d.y,
        w: d.w,
        h: d.h,
        fontSize: 11,
      },
    };
    onSchemaChange([...schema, newField]);
    removeDetection(idx);
    selectField(newField.id);
    toast.success("Détection appliquée");
  }

  /// Lance l'enrichissement IA en lot des détections en attente.
  /// Envoie la liste à `/api/documents/ocr/enrich` qui appelle Claude Haiku.
  async function runEnrichment() {
    if (!pendingDetections || pendingDetections.length === 0) return;
    setEnrichLoading(true);
    try {
      const res = await fetch("/api/documents/ocr/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: templateName || "Document",
          organisme: organismeName || undefined,
          templateId,
          detections: pendingDetections.map((d, idx) => ({
            index: idx,
            label: d.label,
            type: d.type,
          })),
          presets: presets.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          toast.error(
            "Aide IA désactivée — activez le toggle dans les paramètres documents."
          );
        } else if (res.status === 429) {
          toast.error("Trop de requêtes — patientez quelques secondes.");
        } else if (res.status === 503) {
          toast.error("ANTHROPIC_API_KEY non configurée côté serveur.");
        } else {
          toast.error(data.error || "Échec de l'enrichissement IA");
        }
        return;
      }
      const data = (await res.json()) as {
        suggestions: EnrichmentSuggestion[];
        usage?: { inputTokens?: number; outputTokens?: number; cacheRead?: number };
      };
      setEnrichResult({ suggestions: data.suggestions, usage: data.usage });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setEnrichLoading(false);
    }
  }

  /// Applique les corrections IA acceptées par l'admin dans le dialog de revue.
  /// Mute en place les détections en attente (label, type, presetId, helpText).
  function applyEnrichment(accepted: EnrichmentApplied[]) {
    if (!pendingDetections || accepted.length === 0) {
      setEnrichResult(null);
      return;
    }
    const byIndex = new Map(accepted.map((a) => [a.index, a]));
    setPendingDetections((prev) => {
      if (!prev) return prev;
      return prev.map((d, idx) => {
        const change = byIndex.get(idx);
        if (!change) return d;
        return {
          ...d,
          label: change.label,
          type: change.type,
          ...(change._correctionPresetId
            ? { _correctionPresetId: change._correctionPresetId }
            : {}),
          ...(change._helpText ? { _helpText: change._helpText } : {}),
        } as DetectedField;
      });
    });
    setEnrichResult(null);
    toast.success(
      `${accepted.length} correction${accepted.length > 1 ? "s" : ""} IA appliquée${
        accepted.length > 1 ? "s" : ""
      }`
    );
  }

  /// Détection IA Vision via Claude Sonnet 4.5 + snap-to-native.
  ///
  /// Pipeline :
  /// 1. Rend la page courante en image (échelle 2×)
  /// 2. En **parallèle** :
  ///    a) envoi de l'image à Sonnet → liste de champs avec positions approximatives
  ///    b) extraction native PDF (pdfjs) → fillers + shapes exacts au pixel près
  /// 3. Pour chaque détection Sonnet, **snap** sa position au candidat natif le
  ///    plus proche (distance + similitude de taille) → on récupère la précision
  ///    pixel-perfect des positions PDF tout en gardant l'intelligence visuelle
  ///    de Sonnet sur ce qui EST un champ.
  ///
  /// Si aucun candidat natif n'est dans le rayon de tolérance, on garde la
  /// position Sonnet telle quelle (mieux qu'aucune détection).
  async function runVisionDetection() {
    if (!dims || visionRunning) return;
    setVisionRunning(true);
    setPendingDetections(null);
    setSelectedDetectionIdx(null);
    try {
      // Réutilise le PDFDocumentProxy chargé par react-pdf (évite les conflits
      // qui causaient "Cannot read properties of null sendWithPromise" quand
      // deux instances coexistaient).
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc) {
        toast.error("Le PDF n'est pas encore chargé. Patiente quelques secondes.");
        return;
      }
      type PdfPage = {
        getTextContent: () => Promise<{ items: { str: string; transform: number[]; width: number; height: number }[] }>;
        getViewport: (opts: { scale: number }) => { width: number; height: number };
        render: (opts: {
          canvasContext: CanvasRenderingContext2D;
          viewport: unknown;
          canvas: HTMLCanvasElement;
        }) => { promise: Promise<void> };
      };
      const page = (await pdfDoc.getPage(currentPage + 1)) as PdfPage;

      const renderScale = 2;
      const pdfViewport = page.getViewport({ scale: 1 });
      const renderViewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement("canvas");
      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossible d'initialiser le canvas");
      await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);

      // Pré-extrait les mots natifs du PDF (avec position) pour la stratégie
      // "snap-to-text-after-label" qui calcule la zone de saisie depuis la
      // position du label sur la page.
      const pageHeightPts = pdfViewport.height;
      const textContent = await page.getTextContent();
      const pageWords: OCRWord[] = textContent.items
        .filter((it) => it.str && it.str.length > 0)
        .map((it) => ({
          text: it.str,
          x: it.transform[4],
          y: it.transform[5],
          w: it.width,
          h: it.height || Math.abs(it.transform[3]) || 10,
          confidence: 100,
        }));

      // Lance EN PARALLÈLE :
      //   - L'appel Vision IA (10-15s)
      //   - L'extraction native pour le snap heuristique (<1s)
      const [visionRes, nativeCandidates] = await Promise.all([
        fetch("/api/documents/ocr/detect-vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: dataUrl,
            pageIndex: currentPage,
            templateName: templateName || "Document",
            organisme: organismeName || undefined,
            templateId,
            pdfPageWidth: pdfViewport.width,
            pdfPageHeight: pdfViewport.height,
          }),
        }),
        detectOnePage(pdfDoc, currentPage).then((r) => r.detections).catch(() => [] as DetectedField[]),
      ]);

      if (!visionRes.ok) {
        const errData = await visionRes.json().catch(() => ({}));
        if (visionRes.status === 403) {
          toast.error("Aide IA désactivée — activez-la dans les paramètres documents.");
        } else if (visionRes.status === 429) {
          toast.error("Trop de requêtes — patientez quelques secondes.");
        } else if (visionRes.status === 503) {
          toast.error("ANTHROPIC_API_KEY non configurée côté serveur.");
        } else {
          toast.error(errData.error || "Échec de la détection IA");
        }
        return;
      }

      const data = (await visionRes.json()) as {
        detections: Array<{
          type: string;
          label: string;
          x: number;
          y: number;
          w: number;
          h: number;
          confidence: number;
          page: number;
          helpText: string | null;
          presetName: string | null;
          presetId: string | null;
        }>;
        durationMs: number;
        usage?: { inputTokens?: number; outputTokens?: number };
      };

      // Snap-to-native HYBRIDE — 3 stratégies, on garde la première qui marche :
      //   Pass 0 — labelPosition : on cherche le LABEL dans les mots natifs du
      //            PDF, on identifie la fin du label sur la ligne, et on calcule
      //            la zone de saisie qui s'étend du label jusqu'au prochain mot
      //            (ou la marge droite). Très précis car ne dépend pas de
      //            l'heuristique : utilise directement les positions exactes
      //            des mots PDF.
      //   Pass 1 — label : match du label Sonnet contre les labels des candidats
      //            natifs détectés par l'heuristique (Levenshtein).
      //   Pass 2 — position : centres proches + tailles similaires (fallback).
      //   Sinon : on garde la position Sonnet (mieux que rien).
      const usedCandidateIds = new Set<number>();
      const usedWordKeys = new Set<string>(); // empêche qu'un mot soit utilisé comme label par 2 détections
      let snappedByLabelPosition = 0;
      let snappedByLabel = 0;
      let snappedByPosition = 0;
      const newDetections: DetectedField[] = data.detections.map((d) => {
        const snapped = snapDetectionToNative(
          d,
          nativeCandidates,
          pageWords,
          pdfViewport.width,
          pageHeightPts,
          usedCandidateIds,
          usedWordKeys
        );
        if (snapped.snapped === "labelPosition") snappedByLabelPosition++;
        else if (snapped.snapped === "label") snappedByLabel++;
        else if (snapped.snapped === "position") snappedByPosition++;
        return {
          type: d.type as DetectedField["type"],
          label: d.label,
          x: snapped.x,
          y: snapped.y,
          w: snapped.w,
          h: snapped.h,
          confidence: d.confidence,
          page: d.page,
          suggestedPresetName: d.presetName ?? undefined,
          ...(d.presetId ? { _correctionPresetId: d.presetId } : {}),
          ...(d.helpText ? { _helpText: d.helpText } : {}),
          ...(snapped.snapped ? { _snappedToNative: true } : {}),
          ...(snapped.snapped ? { _snappedBy: snapped.snapped } : {}),
        } as DetectedField;
      });

      // Filtre les overlaps avec les champs déjà placés
      const filtered = newDetections.filter((d) => !overlapsExistingField(d, schema));
      const skipped = newDetections.length - filtered.length;

      if (filtered.length === 0) {
        toast.info(
          `Détection IA terminée : aucun nouveau champ${skipped > 0 ? ` (${skipped} déjà placé(s))` : ""}.`
        );
        return;
      }

      setPendingDetections(filtered);
      const seconds = Math.round(data.durationMs / 1000);
      const snapParts: string[] = [];
      if (snappedByLabelPosition > 0) snapParts.push(`${snappedByLabelPosition} calculée(s) depuis le label`);
      if (snappedByLabel > 0) snapParts.push(`${snappedByLabel} par label heuristique`);
      if (snappedByPosition > 0) snapParts.push(`${snappedByPosition} par proximité`);
      const snapNote = snapParts.length > 0
        ? ` · position ajustée : ${snapParts.join(" + ")}`
        : "";
      toast.success(
        `${filtered.length} champ(s) détecté(s) par l'IA Vision en ${seconds}s${snapNote}${
          skipped > 0 ? ` (${skipped} ignoré(s))` : ""
        }.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de détection IA");
    } finally {
      setVisionRunning(false);
    }
  }

  /// Normalise un texte pour comparaison fuzzy : minuscules, sans accents,
  /// sans ponctuation, espaces collapsés.
  function normalizeForMatch(s: string): string {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /// Snap d'une détection Sonnet vers la position native PDF la plus précise.
  ///
  /// Stratégie en 3 passes (la 1ère est la plus précise) :
  ///   Pass 0 — labelPosition : on trouve le label Sonnet dans les MOTS NATIFS
  ///            du PDF (chacun avec sa position exacte), on identifie la fin
  ///            du label sur la ligne, et on calcule la zone de saisie qui
  ///            s'étend du label jusqu'au prochain mot (ou la marge droite).
  ///            Pour les checkbox, on regarde à GAUCHE du label.
  ///   Pass 1 — label : match du label Sonnet contre les labels des candidats
  ///            natifs détectés par l'heuristique (Levenshtein 70% similarité).
  ///   Pass 2 — position : centres proches + tailles similaires (fallback).
  ///   Sinon : on garde la position Sonnet.
  ///
  /// `usedIds` empêche qu'un même candidat heuristique soit pris 2×.
  /// `usedWordKeys` empêche qu'un même mot natif serve de label 2×.
  function snapDetectionToNative(
    aiDet: { x: number; y: number; w: number; h: number; page: number; label: string; type: string },
    candidates: DetectedField[],
    pageWords: OCRWord[],
    pageWidth: number,
    pageHeight: number,
    usedIds: Set<number>,
    usedWordKeys: Set<string>
  ): {
    x: number;
    y: number;
    w: number;
    h: number;
    snapped: "labelPosition" | "label" | "position" | null;
  } {
    const normAi = normalizeForMatch(aiDet.label);

    // ===== Pass 0 : label-position (le plus précis) =====
    if (normAi.length >= 3 && pageWords.length > 0) {
      const labelMatch = findLabelInPageWords(normAi, pageWords, usedWordKeys);
      if (labelMatch) {
        // Marque les mots du label comme utilisés (évite réutilisation)
        for (const w of labelMatch.matchedWords) {
          usedWordKeys.add(wordKey(w));
        }
        const inputArea = calculateInputAreaFromLabel(
          labelMatch.bbox,
          labelMatch.lineWords,
          pageWidth,
          pageHeight,
          aiDet.type === "checkbox"
        );
        if (inputArea) {
          return { ...inputArea, snapped: "labelPosition" };
        }
      }
    }

    // ===== Pass 1 : label match contre candidats heuristiques =====
    if (normAi.length >= 3) {
      let bestLabelMatch: { idx: number; dist: number } | null = null;
      for (let i = 0; i < candidates.length; i++) {
        if (usedIds.has(i)) continue;
        const c = candidates[i];
        if (c.page !== aiDet.page) continue;
        const normC = normalizeForMatch(c.label);
        if (!normC || normC.length < 3) continue;
        const dist = levenshtein(normAi, normC);
        const maxLen = Math.max(normAi.length, normC.length);
        const ratio = dist / maxLen;
        if (ratio > 0.3) continue;
        if (!bestLabelMatch || dist < bestLabelMatch.dist) {
          bestLabelMatch = { idx: i, dist };
        }
      }
      if (bestLabelMatch) {
        usedIds.add(bestLabelMatch.idx);
        const c = candidates[bestLabelMatch.idx];
        return { x: c.x, y: c.y, w: c.w, h: c.h, snapped: "label" };
      }
    }

    // ===== Pass 2 : position match (fallback) =====
    const TOLERANCE = 100;
    const aiCenterX = aiDet.x + aiDet.w / 2;
    const aiCenterY = aiDet.y + aiDet.h / 2;
    let bestPosMatch: { idx: number; score: number } | null = null;
    for (let i = 0; i < candidates.length; i++) {
      if (usedIds.has(i)) continue;
      const c = candidates[i];
      if (c.page !== aiDet.page) continue;
      const cCenterX = c.x + c.w / 2;
      const cCenterY = c.y + c.h / 2;
      const dist = Math.hypot(aiCenterX - cCenterX, aiCenterY - cCenterY);
      if (dist > TOLERANCE) continue;
      const sizeDiff = Math.abs(aiDet.w - c.w) + Math.abs(aiDet.h - c.h);
      const score = dist + sizeDiff * 0.3;
      if (!bestPosMatch || score < bestPosMatch.score) {
        bestPosMatch = { idx: i, score };
      }
    }
    if (bestPosMatch) {
      usedIds.add(bestPosMatch.idx);
      const c = candidates[bestPosMatch.idx];
      return { x: c.x, y: c.y, w: c.w, h: c.h, snapped: "position" };
    }

    // ===== Aucun snap : on garde la position Sonnet =====
    return { x: aiDet.x, y: aiDet.y, w: aiDet.w, h: aiDet.h, snapped: null };
  }

  /// Identifiant unique d'un mot natif (basé sur position) pour la
  /// déduplication entre détections.
  function wordKey(w: OCRWord): string {
    return `${Math.round(w.x)},${Math.round(w.y)},${w.text.slice(0, 12)}`;
  }

  /// Cherche le label Sonnet (déjà normalisé) parmi les mots natifs du PDF.
  /// Stratégie : pour chaque "ligne" (regroupement par y), tente de matcher la
  /// séquence des tokens du label dans l'ordre. Si ≥ 70% des tokens trouvés,
  /// c'est un match. Retourne la bbox du label + les mots de la ligne entière
  /// (utiles pour calculer la zone de saisie).
  function findLabelInPageWords(
    normLabel: string,
    pageWords: OCRWord[],
    usedWordKeys: Set<string>
  ): {
    bbox: { x: number; y: number; w: number; h: number };
    matchedWords: OCRWord[];
    lineWords: OCRWord[];
  } | null {
    const labelTokens = normLabel.split(/\s+/).filter((t) => t.length >= 2);
    if (labelTokens.length === 0) return null;

    // Regroupe les mots par ligne (cluster par y, tolérance 4pt)
    const lines = new Map<number, OCRWord[]>();
    for (const w of pageWords) {
      const bucket = Math.round(w.y / 4) * 4;
      if (!lines.has(bucket)) lines.set(bucket, []);
      lines.get(bucket)!.push(w);
    }

    let best: { score: number; matched: OCRWord[]; lineWords: OCRWord[] } | null = null;

    for (const lineWords of lines.values()) {
      const sorted = [...lineWords].sort((a, b) => a.x - b.x);
      // Filtre les mots déjà utilisés
      const available = sorted.filter((w) => !usedWordKeys.has(wordKey(w)));
      if (available.length === 0) continue;

      // Tente de matcher les tokens dans l'ordre — chaque mot peut "absorber"
      // 1+ tokens (cas où l'extraction PDF concatène) ou être ignoré.
      let tokenIdx = 0;
      const matched: OCRWord[] = [];
      for (const w of available) {
        if (tokenIdx >= labelTokens.length) break;
        const wn = normalizeForMatch(w.text);
        if (!wn) continue;
        // Le mot natif "absorbe" autant de tokens consécutifs du label qu'il contient
        let absorbed = 0;
        while (
          tokenIdx + absorbed < labelTokens.length &&
          wn.includes(labelTokens[tokenIdx + absorbed])
        ) {
          absorbed++;
        }
        if (absorbed > 0) {
          matched.push(w);
          tokenIdx += absorbed;
        }
      }

      const ratio = tokenIdx / labelTokens.length;
      if (ratio < 0.7) continue; // au moins 70% des tokens trouvés
      if (matched.length === 0) continue;

      // Score : moins de mots non-matchés = meilleur ; bonus si ratio = 1
      const score = labelTokens.length - tokenIdx + (matched.length === labelTokens.length ? -1 : 0);
      if (!best || score < best.score) {
        best = { score, matched, lineWords: sorted };
      }
    }

    if (!best) return null;

    const xs = best.matched.map((w) => w.x);
    const rights = best.matched.map((w) => w.x + w.w);
    const ys = best.matched.map((w) => w.y);
    const tops = best.matched.map((w) => w.y + w.h);
    return {
      bbox: {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...rights) - Math.min(...xs),
        h: Math.max(...tops) - Math.min(...ys),
      },
      matchedWords: best.matched,
      lineWords: best.lineWords,
    };
  }

  /// À partir de la bbox d'un label trouvé sur la page et des mots de sa ligne,
  /// calcule la zone de saisie associée :
  ///   - Pour `text/date/number/etc` : à DROITE du label, jusqu'au prochain mot
  ///     (ou jusqu'à la marge droite si rien n'est à droite).
  ///   - Pour `checkbox` : à GAUCHE du label, petite case ~14×14pt collée au label.
  function calculateInputAreaFromLabel(
    labelBbox: { x: number; y: number; w: number; h: number },
    lineWords: OCRWord[],
    pageWidth: number,
    pageHeight: number,
    isCheckbox: boolean
  ): { x: number; y: number; w: number; h: number } | null {
    void pageHeight; // pas utilisé pour l'instant — pourrait servir pour des champs sur plusieurs lignes
    const labelEnd = labelBbox.x + labelBbox.w;

    if (isCheckbox) {
      // Case à cocher à GAUCHE du label : ~14pt collée juste avant
      const size = Math.max(10, Math.min(16, labelBbox.h * 1.1));
      const x = Math.max(0, labelBbox.x - size - 2);
      return { x, y: labelBbox.y, w: size, h: size };
    }

    // Trouve le mot le plus proche à DROITE du label sur la même ligne
    const yTolerance = Math.max(labelBbox.h * 1.5, 6);
    const rightWords = lineWords.filter(
      (w) =>
        w.x > labelEnd + 1 &&
        Math.abs(w.y + w.h / 2 - (labelBbox.y + labelBbox.h / 2)) < yTolerance
    );

    const startX = labelEnd + 4;
    let endX: number;
    if (rightWords.length === 0) {
      // Pas de mot à droite — input jusqu'à la marge droite (avec un padding)
      endX = pageWidth - 40;
    } else {
      const leftmost = rightWords.reduce((a, b) => (a.x < b.x ? a : b));
      endX = leftmost.x - 4;
    }

    const width = endX - startX;
    if (width < 20) return null; // input trop étroit, peu probable

    return {
      x: startX,
      y: labelBbox.y,
      w: width,
      h: labelBbox.h,
    };
  }

  /// Distance de Levenshtein. Réimplémentée localement (au lieu d'importer celle
  /// de ocr-corrections) pour rester self-contained dans cette fonction.
  function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /// Extrait les shapes (rectangles, lignes) dessinés dans le PDF via la liste
  /// d'opérations pdfjs. Utile pour les PDFs avec des zones de saisie dessinées
  /// vectoriellement plutôt qu'écrites en underscores texte.
  async function extractGraphicShapes(page: {
    getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
    getViewport: (opts: { scale: number }) => { width: number; height: number; height2?: number };
  }): Promise<GraphicShape[]> {
    try {
      const opList = await page.getOperatorList();
      const pageHeight = page.getViewport({ scale: 1 }).height;
      const shapes: GraphicShape[] = [];
      // OPS de pdfjs : 91 = constructPath. Les args contiennent des sous-ops :
      // 19 = re (rectangle), 13 = m (moveTo), 14 = l (lineTo)
      // pdfjs.OPS values can vary; on utilise les valeurs numériques connues v4.
      const OP_CONSTRUCT_PATH = 91;
      const SUB_OP_RECT = 19;
      const SUB_OP_MOVE = 13;
      const SUB_OP_LINE = 14;

      for (let i = 0; i < opList.fnArray.length; i++) {
        if (opList.fnArray[i] !== OP_CONSTRUCT_PATH) continue;
        const args = opList.argsArray[i] as [number[], number[], unknown];
        if (!Array.isArray(args) || args.length < 2) continue;
        const subOps = args[0];
        const subArgs = args[1];
        if (!Array.isArray(subOps) || !Array.isArray(subArgs)) continue;

        // Parcourir les sous-ops pour extraire rectangles et lignes
        let argIdx = 0;
        let lineStart: { x: number; y: number } | null = null;
        for (const sub of subOps) {
          if (sub === SUB_OP_RECT) {
            // re : x, y, w, h
            const [x, y, w, h] = subArgs.slice(argIdx, argIdx + 4) as number[];
            argIdx += 4;
            // Convertir en coords PDF (y bas-gauche)
            shapes.push({
              type: "rectangle",
              x,
              y: pageHeight - y - h,
              w,
              h,
            });
          } else if (sub === SUB_OP_MOVE) {
            const [x, y] = subArgs.slice(argIdx, argIdx + 2) as number[];
            argIdx += 2;
            lineStart = { x, y: pageHeight - y };
          } else if (sub === SUB_OP_LINE) {
            const [x, y] = subArgs.slice(argIdx, argIdx + 2) as number[];
            argIdx += 2;
            if (lineStart) {
              const yEnd = pageHeight - y;
              const isHorizontal = Math.abs(yEnd - lineStart.y) < 1;
              if (isHorizontal) {
                const xMin = Math.min(lineStart.x, x);
                const w = Math.abs(x - lineStart.x);
                shapes.push({
                  type: "line",
                  x: xMin,
                  y: yEnd - 1,
                  w,
                  h: 2,
                });
              }
              lineStart = { x, y: yEnd };
            }
          }
        }
      }
      return shapes;
    } catch (err) {
      console.warn("Extraction graphic shapes échouée:", err);
      return [];
    }
  }

  /// Analyse une page : extraction texte natif si possible, sinon OCR fallback.
  /// PLUS extraction des shapes graphiques (lignes/rectangles dessinés vectoriellement).
  async function detectOnePage(
    pdfDoc: { getPage: (n: number) => Promise<unknown> },
    pageIdx: number,
    onOcrProgress?: (p: number) => void
  ): Promise<{ detections: DetectedField[]; method: string }> {
    type PdfPage = {
      getTextContent: () => Promise<{ items: { str: string; transform: number[]; width: number; height: number }[] }>;
      getViewport: (opts: { scale: number }) => { width: number; height: number };
      render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }) => { promise: Promise<void> };
      getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
    };
    const page = (await pdfDoc.getPage(pageIdx + 1)) as PdfPage;
    const pageHeight = page.getViewport({ scale: 1 }).height;

    const textContent = await page.getTextContent();
    const items = textContent.items.filter((it) => it.str && it.str.length > 0);

    let words: OCRWord[];
    let method: string;

    if (items.length >= 5) {
      // Texte natif PDF — instantané et précis
      words = items.map((it) => ({
        text: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        h: it.height || Math.abs(it.transform[3]) || 10,
        confidence: 100,
      }));
      method = "texte natif";
    } else {
      // Fallback OCR (PDF scanné)
      const OCR_SCALE = 4.0;
      const viewport = page.getViewport({ scale: OCR_SCALE });
      const offCanvas = document.createElement("canvas");
      offCanvas.width = Math.ceil(viewport.width);
      offCanvas.height = Math.ceil(viewport.height);
      const offCtx = offCanvas.getContext("2d");
      if (!offCtx) throw new Error("Canvas OCR indisponible");
      offCtx.fillStyle = "#ffffff";
      offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
      await page.render({ canvasContext: offCtx, viewport, canvas: offCanvas }).promise;

      const Tesseract = await import("tesseract.js");
      const worker = await Tesseract.createWorker("fra", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text" && onOcrProgress) {
            onOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      const { data } = await worker.recognize(offCanvas, {}, { blocks: true });
      await worker.terminate();

      type RawWord = {
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
        confidence: number;
      };
      const rawWords: RawWord[] = [];
      type Block = { paragraphs?: { lines?: { words?: RawWord[] }[] }[] };
      const blocks = (data as { blocks?: Block[] }).blocks || [];
      for (const block of blocks) {
        for (const para of block.paragraphs || []) {
          for (const line of para.lines || []) {
            for (const word of line.words || []) {
              if (word.text.trim()) rawWords.push(word);
            }
          }
        }
      }
      words = ocrWordsToPdfCoords(rawWords, pageHeight, OCR_SCALE);
      method = "OCR";
    }

    // Extraction des shapes graphiques (rectangles vides / lignes pointillées vectorielles)
    const shapes = await extractGraphicShapes(page);
    const shapeDetections = shapes.length > 0 ? shapesToDetections(shapes, words, pageIdx) : [];

    // Fusion : on garde les détections texte + on ajoute les shapes qui ne chevauchent pas
    const textDetections = detectFields(words, pageIdx);
    const all = [...textDetections];
    for (const sd of shapeDetections) {
      const overlaps = all.some(
        (td) =>
          Math.abs(td.x - sd.x) < 15 &&
          Math.abs(td.y - sd.y) < 8
      );
      if (!overlaps) all.push(sd);
    }

    const methodNote = shapeDetections.length > 0 ? `${method}+shapes` : method;
    return { detections: all, method: methodNote };
  }

  /// Mode mono-page (currentPage) ou multi-pages (toutes les pages du PDF).
  async function runOCR(allPages = false) {
    if (!dims) {
      toast.error("PDF non chargé");
      return;
    }
    setOcrRunning(true);
    setOcrProgress(0);
    setOcrPageStatus("");
    setPendingDetections(null);
    try {
      // Réutilise le PDFDocumentProxy chargé par react-pdf — évite les conflits
      // de double-load qui cassaient le rendu interne de PDFPage.
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc) {
        toast.error("Le PDF n'est pas encore chargé. Patiente quelques secondes.");
        return;
      }
      const pagesToProcess = allPages
        ? Array.from({ length: numPages }, (_, i) => i)
        : [currentPage];

      // Fetch les corrections OCR connues pour ce template + globales
      let knownCorrections: StoredCorrection[] = [];
      try {
        const cRes = await fetch(`/api/documents/ocr/corrections?templateId=${templateId}`);
        if (cRes.ok) knownCorrections = await cRes.json();
      } catch {
        // tant pis, on continue sans corrections
      }

      const rawDetections: DetectedField[] = [];
      const methods = new Set<string>();
      for (let i = 0; i < pagesToProcess.length; i++) {
        const pageIdx = pagesToProcess[i];
        if (allPages) setOcrPageStatus(`Page ${pageIdx + 1}/${numPages}`);
        const baseProgress = Math.round((i / pagesToProcess.length) * 100);
        setOcrProgress(baseProgress);

        const { detections, method } = await detectOnePage(pdfDoc, pageIdx, (ocrPct) => {
          // Mix progression globale + progression OCR de la page
          const pageWeight = 1 / pagesToProcess.length;
          setOcrProgress(Math.round((i + ocrPct / 100) * pageWeight * 100));
        });
        rawDetections.push(...detections);
        methods.add(method);
      }

      // Filtrer les détections qui chevauchent un champ déjà placé.
      // Évite les doublons quand l'admin relance Auto-détecter après avoir
      // déjà appliqué une première vague.
      const filtered = rawDetections.filter((d) => !overlapsExistingField(d, schema));
      const skipped = rawDetections.length - filtered.length;

      // Appliquer les corrections OCR mémorisées (fuzzy match du label)
      let correctionsApplied = 0;
      const allDetections = filtered.map((d) => {
        const match = findBestCorrection(d.label, knownCorrections);
        if (!match) return d;
        correctionsApplied++;
        return {
          ...d,
          label: match.cleanLabel,
          type: (match.fieldType as DetectedField["type"]) || d.type,
          // suggestedPresetName écrasé si une correction préfère un preset
          // (on stocke ID, qu'on résoudra dans applyDetections)
          suggestedPresetName: undefined,
          // Marqueurs transitoires :
          //  - _correctionPresetId : preset à appliquer si la correction en suggère un
          //  - _memoryHit : indique que la détection a été corrigée par la mémoire
          //  - _memoryMatchedRaw : le label original mémorisé (pour le tooltip)
          //  - _memoryOccurrences : nombre de fois cette correction a été confirmée
          ...(match.presetId ? { _correctionPresetId: match.presetId } : {}),
          _memoryHit: true,
          _memoryMatchedRaw: match.rawLabel,
          _memoryOccurrences: match.occurrences,
        } as DetectedField;
      });

      // Persister snapshot pour ce PDF (si on connaît son hash)
      if (sourceFileSha256 && allDetections.length > 0) {
        fetch(`/api/documents/ocr/snapshot/${sourceFileSha256}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            detectedFields: allDetections,
            pageCount: numPages,
            fileId: sourceFileId,
            templateId,
          }),
        }).catch(() => {
          // best-effort
        });
      }

      const methodStr = methods.size === 1 ? Array.from(methods)[0] : "mixte";
      const scope = allPages ? `${pagesToProcess.length} pages` : `page ${currentPage + 1}`;

      if (allDetections.length === 0) {
        if (skipped > 0) {
          toast.info(
            `${skipped} champ(s) détecté(s) déjà présent(s) — rien de nouveau à proposer.`
          );
        } else {
          toast.info(`Aucun champ détecté via ${methodStr} sur ${scope}.`);
        }
      } else {
        const notes: string[] = [];
        if (skipped > 0) notes.push(`${skipped} doublon${skipped > 1 ? "s" : ""} ignoré${skipped > 1 ? "s" : ""}`);
        if (correctionsApplied > 0) notes.push(`${correctionsApplied} correction${correctionsApplied > 1 ? "s" : ""} mémorisée${correctionsApplied > 1 ? "s" : ""} appliquée${correctionsApplied > 1 ? "s" : ""}`);
        const noteStr = notes.length > 0 ? ` (${notes.join(", ")})` : "";
        toast.success(
          `${allDetections.length} nouveau(x) champ(s) détecté(s) sur ${scope} via ${methodStr}${noteStr}.`
        );
        setPendingDetections(allDetections);
      }
    } catch (err) {
      console.error("Detection error:", err);
      toast.error(err instanceof Error ? err.message : "Erreur de détection");
    } finally {
      setOcrRunning(false);
      setOcrProgress(0);
      setOcrPageStatus("");
    }
  }

  /// Détermine si une détection chevauche significativement un champ existant
  /// déjà placé sur la même page. Utilisé pour éviter de proposer 2 fois
  /// la même position quand l'admin relance Auto-détecter.
  function overlapsExistingField(detection: DetectedField, existingFields: DocumentField[]): boolean {
    for (const f of existingFields) {
      if (!f.position || f.position.page !== detection.page) continue;
      const a = detection;
      const b = f.position;
      // Centre de la détection
      const cx = a.x + a.w / 2;
      const cy = a.y + a.h / 2;
      // Le centre est-il dans le rectangle existant (avec un padding de tolérance) ?
      const PAD = 4;
      if (
        cx >= b.x - PAD &&
        cx <= b.x + b.w + PAD &&
        cy >= b.y - PAD &&
        cy <= b.y + b.h + PAD
      ) {
        return true;
      }
      // OU le centre du champ existant est-il dans le rectangle détecté ?
      const cxB = b.x + b.w / 2;
      const cyB = b.y + b.h / 2;
      if (
        cxB >= a.x - PAD &&
        cxB <= a.x + a.w + PAD &&
        cyB >= a.y - PAD &&
        cyB <= a.y + a.h + PAD
      ) {
        return true;
      }
    }
    return false;
  }

  /// Restaure les détections du snapshot précédent (sans relancer l'OCR).
  function restoreSnapshot() {
    if (!knownSnapshot) return;
    setPendingDetections(knownSnapshot.detectedFields);
    setKnownSnapshot(null);
    toast.success(
      `${knownSnapshot.detectedFields.length} champ(s) restauré(s) du snapshot précédent.`
    );
  }

  /// Sauvegarde toutes les modifications de label/type/preset comme corrections OCR
  /// pour les futures détections sur des PDFs similaires.
  async function learnCorrections() {
    // On compare les champs actuels (avec position) à leur état de détection initial.
    // Sans tracking explicite, on assume que tous les champs avec position sont
    // candidats à mémoriser (label utilisateur considéré comme "correct").
    const candidates = schema.filter((f) => f.position && f.label && f.label.trim().length > 0);
    if (candidates.length === 0) {
      toast.info("Aucun champ à mémoriser (placez d'abord des champs).");
      return;
    }
    let saved = 0;
    let errors = 0;
    for (const f of candidates) {
      try {
        const res = await fetch("/api/documents/ocr/corrections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId,
            rawLabel: f.label, // ici on suppose label = correction (l'admin a déjà édité)
            cleanLabel: f.label,
            fieldType: f.type,
            presetId: f.presetId,
          }),
        });
        if (res.ok) saved++;
        else errors++;
      } catch {
        errors++;
      }
    }
    if (saved > 0) {
      toast.success(`${saved} correction(s) mémorisée(s) pour les futures détections.`);
    }
    if (errors > 0) {
      toast.warning(`${errors} erreur(s) lors de la mémorisation.`);
    }
  }

  function applyDetections() {
    if (!pendingDetections) return;
    // Index des presets par nom (case-insensitive) pour lookup rapide
    const presetByName = new Map(presets.map((p) => [p.name.toLowerCase(), p.id]));
    const presetIds = new Set(presets.map((p) => p.id));
    let presetMatched = 0;
    const newFields: DocumentField[] = pendingDetections.map((d) => {
      // Priorité au preset venant d'une correction mémorisée (ID direct), sinon match par nom
      const dx = d as DetectedField & { _correctionPresetId?: string; _helpText?: string };
      let presetId: string | undefined;
      if (dx._correctionPresetId && presetIds.has(dx._correctionPresetId)) {
        presetId = dx._correctionPresetId;
      } else if (d.suggestedPresetName) {
        presetId = presetByName.get(d.suggestedPresetName.toLowerCase());
      }
      if (presetId) presetMatched++;
      return {
        id: `field_${nanoid(6)}`,
        label: d.label || "Champ détecté",
        type: d.type as DocumentFieldType,
        required: false,
        presetId: presetId || undefined,
        helpText: dx._helpText || undefined,
        position: {
          page: d.page,
          x: d.x,
          y: d.y,
          w: d.w,
          h: d.h,
          fontSize: 11,
        },
      };
    });
    onSchemaChange([...schema, ...newFields]);
    const presetNote = presetMatched > 0 ? ` (${presetMatched} avec preset auto)` : "";
    toast.success(`${newFields.length} champ(s) ajouté(s)${presetNote}`);
    setPendingDetections(null);
    setSelectedDetectionIdx(null);
  }

  if (!pdfWorkerReady) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Chargement du moteur PDF…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Cliquez sur <b>Ajouter une zone</b> pour placer un nouveau champ, ou{" "}
          <b>Auto-détecter</b> pour analyser la page courante. Pour scanner d&apos;un coup tout le
          document, utilisez <b>Toutes les pages</b>. Les rectangles bleus sont les champs déjà
          enregistrés ; les rectangles verts en pointillés sont les détections en attente que
          vous pouvez modifier, déplacer, supprimer ou appliquer une à une avant de les valider.
        </AlertDescription>
      </Alert>

      {/* Bandeau snapshot connu (PDF déjà OCRisé auparavant) */}
      {knownSnapshot && (
        <Alert className="bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-800">
          <Database className="w-4 h-4" />
          <AlertDescription className="text-sm flex items-center justify-between gap-3 flex-wrap">
            <span className="text-blue-800 dark:text-blue-300">
              <b>Détection précédente trouvée</b> pour ce PDF (
              {knownSnapshot.detectedFields.length} champs sur {knownSnapshot.pageCount} pages,{" "}
              {new Date(knownSnapshot.createdAt).toLocaleDateString("fr-BE")}). Restaurer sans
              relancer l&apos;OCR ?
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setKnownSnapshot(null)}>
                Ignorer
              </Button>
              <Button size="sm" onClick={restoreSnapshot}>
                Restaurer
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {pendingDetections && pendingDetections.length > 0 && (
        <Alert className="bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-800">
          <AlertDescription className="text-sm flex items-center justify-between gap-3 flex-wrap">
            <span className="text-green-800 dark:text-green-300">
              <b>{pendingDetections.filter((d) => d.page === currentPage).length}</b> détection{pendingDetections.filter((d) => d.page === currentPage).length > 1 ? "s" : ""} sur cette
              page (<b>{pendingDetections.length}</b> au total).{" "}
              {(() => {
                const memoryHits = pendingDetections.filter(
                  (d) => (d as DetectedField & { _memoryHit?: boolean })._memoryHit
                ).length;
                if (memoryHits === 0) return null;
                return (
                  <span className="inline-flex items-center gap-1 ml-1 text-purple-700 dark:text-purple-300 font-medium">
                    <Brain className="size-3.5" />
                    {memoryHits} auto-corrigée{memoryHits > 1 ? "s" : ""} d&apos;après vos templates précédents.
                  </span>
                );
              })()}{" "}
              Cliquez une zone verte pour l&apos;éditer, glissez-la pour la déplacer.
            </span>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={runEnrichment}
                disabled={enrichLoading}
                title="Nettoie les labels, ajuste les types et propose des presets en lot via Claude Haiku"
              >
                {enrichLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Analyse IA…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    Améliorer avec IA
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPendingDetections(null);
                  setSelectedDetectionIdx(null);
                }}
              >
                Tout annuler
              </Button>
              <Button size="sm" onClick={applyDetections}>
                Tout appliquer ({pendingDetections.length})
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Page {currentPage + 1} / {numPages || "?"}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(numPages - 1, p + 1))}
              disabled={currentPage >= numPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm self-center">{Math.round(scale * 100)}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale((s) => Math.min(3, s + 0.1))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runOCR(false)}
              disabled={!dims || ocrRunning || visionRunning}
              title="Détection heuristique sur la page courante (rapide, gratuit)"
            >
              {ocrRunning && !ocrPageStatus ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {ocrProgress}%
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-1" />
                  Auto-détecter
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runOCR(true)}
              disabled={!dims || ocrRunning || visionRunning || numPages <= 1}
              title="Détection heuristique sur toutes les pages"
            >
              {ocrRunning && ocrPageStatus ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {ocrPageStatus} · {ocrProgress}%
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 mr-1" />
                  Toutes les pages
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={runVisionDetection}
              disabled={!dims || ocrRunning || visionRunning}
              title="Détection IA Vision (Claude Sonnet 4.5) — plus précise pour les formulaires complexes, mais plus lente (~10s) et coûte quelques centimes"
              className="border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950"
            >
              {visionRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin text-amber-600" />
                  Analyse IA…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1 text-amber-600" />
                  Détection IA
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={learnCorrections}
              disabled={!dims || schema.filter((f) => f.position).length === 0}
              title="Mémorise vos labels/types/presets actuels pour les futures détections sur PDFs similaires"
            >
              <Brain className="w-4 h-4 mr-1" />
              Apprendre
            </Button>
            <FieldLibraryPicker
              presets={presets as unknown as CanonicalFieldPreset[]}
              onPick={addFromLibrary}
              disabled={!dims}
            />
            <Button size="sm" variant="outline" onClick={addZone} disabled={!dims}>
              <Plus className="w-4 h-4 mr-1" />
              Zone vide
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div
            ref={containerRef}
            className="relative inline-block border rounded overflow-auto bg-muted/20 mx-auto"
            style={{ maxWidth: "100%" }}
          >
            <PDFDocument
              file={`/api/files/${sourceFileId}/download`}
              onLoadSuccess={(pdf) => {
                setNumPages(pdf.numPages);
                // On garde la référence pour la réutiliser dans runOCR /
                // runVisionDetection → évite de charger un doublon de
                // PDFDocumentProxy qui rentrait en conflit avec celui-ci.
                pdfDocRef.current = pdf as unknown as {
                  getPage: (n: number) => Promise<unknown>;
                };
              }}
              loading={<div className="p-12 text-center">Chargement du PDF…</div>}
              error={<div className="p-12 text-center text-destructive">Erreur de chargement du PDF</div>}
            >
              <PDFPage
                pageNumber={currentPage + 1}
                scale={scale}
                onLoadSuccess={(p) =>
                  setPageDims((prev) => ({
                    ...prev,
                    [currentPage]: { width: p.originalWidth, height: p.originalHeight },
                  }))
                }
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
              {/* Détections OCR en attente — interactives (drag, resize, sélection) */}
              {dims && pendingDetections &&
                pendingDetections
                  .map((d, idx) => ({ d, idx }))
                  .filter(({ d }) => d.page === currentPage)
                  .map(({ d, idx }) => {
                    const htmlX = d.x * scale;
                    const htmlY = (dims.height - d.y - d.h) * scale;
                    const htmlW = d.w * scale;
                    const htmlH = d.h * scale;
                    const isSelected = selectedDetectionIdx === idx;
                    return (
                      <Rnd
                        key={`detect-${idx}`}
                        bounds="parent"
                        position={{ x: htmlX, y: htmlY }}
                        size={{ width: htmlW, height: htmlH }}
                        cancel=".detection-toolbar"
                        onDragStop={(_, p) =>
                          updateDetectionPosition(idx, {
                            x: p.x,
                            y: p.y,
                            w: htmlW,
                            h: htmlH,
                          })
                        }
                        onResizeStop={(_e, _dir, ref, _delta, position) =>
                          updateDetectionPosition(idx, {
                            x: position.x,
                            y: position.y,
                            w: ref.offsetWidth,
                            h: ref.offsetHeight,
                          })
                        }
                        onClick={() => selectDetection(idx)}
                        style={{
                          border: `2px ${isSelected ? "solid" : "dashed"} ${
                            isSelected ? "#15803d" : "#16a34a"
                          }`,
                          background: isSelected
                            ? "rgba(22, 163, 74, 0.22)"
                            : "rgba(22, 163, 74, 0.08)",
                          cursor: "move",
                          zIndex: isSelected ? 20 : 10,
                        }}
                      >
                        {/* Icône par type (au lieu d'un label texte qui cache
                            le PDF dessous). Le label complet reste dispo en
                            tooltip + dans la liste latérale + dans le panneau
                            d'édition. */}
                        {(() => {
                          const Icon = getFieldTypeIcon(d.type);
                          return (
                            <span
                              className="absolute -top-2 -left-2 inline-flex items-center justify-center size-5 rounded bg-green-600 text-white shadow pointer-events-none"
                              title={`${d.label} (${d.type})`}
                            >
                              <Icon className="size-3" />
                            </span>
                          );
                        })()}
                        {/* Barre d'actions flottante — visible seulement quand la détection
                            est sélectionnée. Positionnée HORS de la zone (au-dessus à droite)
                            pour éviter les hit-targets minuscules et le chevauchement entre
                            détections voisines. */}
                        {isSelected && (
                          <div
                            className="detection-toolbar absolute flex items-center gap-1 rounded-md border bg-background shadow-md p-1"
                            style={{
                              bottom: "calc(100% + 6px)",
                              right: 0,
                              cursor: "default",
                              zIndex: 30,
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                applyOneDetection(idx);
                              }}
                              className="h-7 gap-1 px-2 text-xs"
                              title="Convertir cette détection en champ"
                            >
                              <Plus className="size-3.5" />
                              Appliquer
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeDetection(idx);
                              }}
                              className="h-7 gap-1 px-2 text-xs text-destructive"
                              title="Supprimer cette détection (sans l'appliquer)"
                            >
                              <Trash2 className="size-3.5" />
                              Supprimer
                            </Button>
                          </div>
                        )}
                      </Rnd>
                    );
                  })}

              {dims &&
                fieldsOnPage.map((f) => {
                  const htmlX = f.position!.x * scale;
                  const htmlY = (dims.height - f.position!.y - f.position!.h) * scale;
                  const htmlW = f.position!.w * scale;
                  const htmlH = f.position!.h * scale;
                  const isSelected = selectedFieldId === f.id;
                  return (
                    <Rnd
                      key={f.id}
                      bounds="parent"
                      position={{ x: htmlX, y: htmlY }}
                      size={{ width: htmlW, height: htmlH }}
                      onDragStop={(_, d) =>
                        updatePosition(f.id, { x: d.x, y: d.y, w: htmlW, h: htmlH })
                      }
                      onResizeStop={(_e, _dir, ref, _delta, position) =>
                        updatePosition(f.id, {
                          x: position.x,
                          y: position.y,
                          w: ref.offsetWidth,
                          h: ref.offsetHeight,
                        })
                      }
                      onClick={() => selectField(f.id)}
                      style={{
                        border: `2px solid ${isSelected ? "#0070f3" : "#3b82f6"}`,
                        background: isSelected ? "rgba(0,112,243,0.12)" : "rgba(59,130,246,0.08)",
                        cursor: "move",
                      }}
                    >
                      {/* Icône par type — pas de label texte qui cacherait le
                          PDF dessous. Le label complet reste accessible via
                          tooltip + panneau "Champ sélectionné" + liste latérale. */}
                      {(() => {
                        const Icon = getFieldTypeIcon(f.type);
                        return (
                          <span
                            className="absolute -top-2 -left-2 inline-flex items-center justify-center size-5 rounded bg-blue-500 text-white shadow pointer-events-none"
                            title={`${f.label || f.id} (${f.type})`}
                          >
                            <Icon className="size-3" />
                          </span>
                        );
                      })()}
                    </Rnd>
                  );
                })}
            </PDFDocument>
          </div>

          {/* ============================================================
              Panneau latéral : liste des détections + champs de la page courante
              Permet de cliquer un item au lieu d'essayer de viser un rectangle
              chevauchant sur le PDF. Suit toujours `currentPage`.
              ============================================================ */}
          <aside className="space-y-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:sticky lg:top-4 self-start">
            {(() => {
              const detectionsOnPage =
                pendingDetections
                  ?.map((d, idx) => ({ d, idx }))
                  .filter(({ d }) => d.page === currentPage) ?? [];
              return (
                <>
                  {detectionsOnPage.length > 0 && (
                    <div className="border rounded-md border-green-300 dark:border-green-800">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-green-50 dark:bg-green-950">
                        <div className="text-xs font-semibold text-green-900 dark:text-green-200 flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-green-600" />
                          Détections en attente
                          <span className="text-muted-foreground font-normal">
                            ({detectionsOnPage.length})
                          </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-green-700 dark:text-green-400">
                          Page {currentPage + 1}
                        </span>
                      </div>
                      <ul className="divide-y">
                        {detectionsOnPage.map(({ d, idx }) => {
                          const isSelected = selectedDetectionIdx === idx;
                          const memMeta = d as DetectedField & {
                            _memoryHit?: boolean;
                            _memoryMatchedRaw?: string;
                            _memoryOccurrences?: number;
                            _snappedToNative?: boolean;
                            _snappedBy?: "labelPosition" | "label" | "position";
                          };
                          return (
                            <li
                              key={`side-det-${idx}`}
                              className={`group relative px-2 py-1.5 cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-green-100 dark:bg-green-900"
                                  : "hover:bg-green-50 dark:hover:bg-green-950"
                              }`}
                              onClick={() => selectDetection(idx)}
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0 pr-1">
                                  <div className="text-xs font-medium truncate flex items-center gap-1">
                                    <span className="truncate">{d.label || "(sans libellé)"}</span>
                                    {memMeta._memoryHit && (
                                      <span
                                        className="inline-flex items-center gap-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 px-1 text-[9px] font-bold flex-shrink-0"
                                        title={`Auto-corrigé d'après "${memMeta._memoryMatchedRaw ?? ""}" (vu ${memMeta._memoryOccurrences ?? 1}×)`}
                                      >
                                        <Brain className="size-2.5" />
                                        {memMeta._memoryOccurrences ?? 1}
                                      </span>
                                    )}
                                    {memMeta._snappedToNative && (
                                      <span
                                        className="inline-flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 px-1 text-[9px] font-bold flex-shrink-0"
                                        title={
                                          memMeta._snappedBy === "labelPosition"
                                            ? "Position calculée depuis le label trouvé sur le PDF (le plus précis)"
                                            : memMeta._snappedBy === "label"
                                              ? "Position ajustée par match de label heuristique (fiable)"
                                              : "Position ajustée par proximité (approximatif)"
                                        }
                                      >
                                        📍{
                                          memMeta._snappedBy === "labelPosition"
                                            ? "L+"
                                            : memMeta._snappedBy === "label"
                                              ? "L"
                                              : "P"
                                        }
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {d.type}
                                    {d.confidence != null && (
                                      <span className="ml-1">
                                        · {Math.round(d.confidence)}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      applyOneDetection(idx);
                                    }}
                                    title="Appliquer (convertir en champ)"
                                    aria-label="Appliquer cette détection"
                                  >
                                    <Plus className="size-3.5" />
                                  </Button>
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeDetection(idx);
                                    }}
                                    className="text-destructive"
                                    title="Supprimer la détection"
                                    aria-label="Supprimer cette détection"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div className="border rounded-md">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
                      <div className="text-xs font-semibold flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                        Champs placés
                        <span className="text-muted-foreground font-normal">
                          ({fieldsOnPage.length})
                        </span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Page {currentPage + 1}
                      </span>
                    </div>
                    {fieldsOnPage.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic px-3 py-4 text-center">
                        Aucun champ placé sur cette page.
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {fieldsOnPage.map((f) => {
                          const isSelected = selectedFieldId === f.id;
                          return (
                            <li
                              key={`side-field-${f.id}`}
                              className={`group relative px-2 py-1.5 cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-blue-100 dark:bg-blue-900"
                                  : "hover:bg-muted"
                              }`}
                              onClick={() => selectField(f.id)}
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0 pr-1">
                                  <div className="text-xs font-medium truncate">
                                    {f.label || f.id}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    {f.type}
                                    {f.required && <span className="ml-1">· requis</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  <Button
                                    size="icon-xs"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeZone(f.id);
                                    }}
                                    className="text-destructive"
                                    title="Supprimer le champ"
                                    aria-label="Supprimer ce champ"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {numPages > 1 && (
                    <p className="text-[10px] text-muted-foreground italic px-1">
                      Naviguez entre les pages pour voir les éléments des autres pages.
                    </p>
                  )}
                </>
              );
            })()}
          </aside>
          </div>
        </CardContent>
      </Card>

      {selectedFieldId && (() => {
        const f = schema.find((x) => x.id === selectedFieldId);
        if (!f) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Champ sélectionné</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Libellé</label>
                  <input
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={f.label}
                    onChange={(e) => updateField(f.id, { label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Identifiant</label>
                  <input
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm font-mono"
                    value={f.id}
                    onChange={(e) =>
                      updateField(f.id, {
                        id: e.target.value.replace(/[^a-z0-9_]/gi, "_"),
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">X (pt)</label>
                  <input
                    type="number"
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={Math.round(f.position?.x || 0)}
                    onChange={(e) =>
                      updateField(f.id, {
                        position: {
                          ...(f.position || {
                            page: currentPage,
                            y: 0,
                            w: 100,
                            h: 20,
                            fontSize: 11,
                          }),
                          x: parseFloat(e.target.value) || 0,
                        } as DocumentField["position"],
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Y (pt)</label>
                  <input
                    type="number"
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={Math.round(f.position?.y || 0)}
                    onChange={(e) =>
                      updateField(f.id, {
                        position: {
                          ...(f.position || {
                            page: currentPage,
                            x: 0,
                            w: 100,
                            h: 20,
                            fontSize: 11,
                          }),
                          y: parseFloat(e.target.value) || 0,
                        } as DocumentField["position"],
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Police</label>
                  <input
                    type="number"
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={f.position?.fontSize || 11}
                    onChange={(e) =>
                      updateField(f.id, {
                        position: {
                          ...(f.position || {
                            page: currentPage,
                            x: 0,
                            y: 0,
                            w: 100,
                            h: 20,
                          }),
                          fontSize: parseInt(e.target.value, 10) || 11,
                        } as DocumentField["position"],
                      })
                    }
                  />
                </div>
              </div>
              {/* Toggle "Effacer le fond" — affiché directement ici plutôt que dans
                  l'onglet Champs pour éviter de basculer entre tabs. Par défaut le
                  champ efface le filler du PDF d'origine ; décocher si l'overlay
                  doit se superposer sans masquer ce qu'il y avait dessous. */}
              <label className="flex items-start gap-2 text-sm cursor-pointer pt-2 border-t">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={f.eraseUnderlay !== false}
                  onChange={(e) => updateField(f.id, { eraseUnderlay: e.target.checked })}
                />
                <span className="flex-1">
                  <span className="font-medium">Effacer le filler du PDF</span>
                  <span className="block text-xs text-muted-foreground">
                    Dessine un rectangle blanc sous le texte pour masquer les pointillés
                    (<code>....</code>) ou underscores (<code>____</code>) à la génération.
                    Décocher pour préserver le PDF d&apos;origine intact (le texte se
                    superposera).
                  </span>
                </span>
              </label>

              <Button variant="outline" size="sm" onClick={() => removeZone(f.id)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-1" />
                Supprimer la zone
              </Button>
            </CardContent>
          </Card>
        );
      })()}

      {/* Panneau d'édition d'une détection sélectionnée (avant application) */}
      {selectedDetectionIdx !== null && pendingDetections && pendingDetections[selectedDetectionIdx] && (() => {
        const idx = selectedDetectionIdx;
        const d = pendingDetections[idx];
        const fieldTypes: DocumentFieldType[] = [
          "text", "textarea", "number", "date", "checkbox", "select",
          "niss", "iban", "postal_be", "tva_be", "bce", "phone_be", "signature",
        ];
        return (
          <Card className="border-green-300 dark:border-green-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-600" />
                Détection sélectionnée
                <span className="text-xs font-normal text-muted-foreground">
                  (en attente — non encore appliquée)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Libellé</label>
                  <input
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={d.label}
                    onChange={(e) => updateDetection(idx, { label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Type</label>
                  <select
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={d.type}
                    onChange={(e) =>
                      updateDetection(idx, { type: e.target.value as DetectedField["type"] })
                    }
                  >
                    {fieldTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-sm font-medium">X (pt)</label>
                  <input
                    type="number"
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={Math.round(d.x)}
                    onChange={(e) =>
                      updateDetection(idx, { x: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Y (pt)</label>
                  <input
                    type="number"
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={Math.round(d.y)}
                    onChange={(e) =>
                      updateDetection(idx, { y: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Largeur</label>
                  <input
                    type="number"
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={Math.round(d.w)}
                    onChange={(e) =>
                      updateDetection(idx, { w: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Hauteur</label>
                  <input
                    type="number"
                    className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm"
                    value={Math.round(d.h)}
                    onChange={(e) =>
                      updateDetection(idx, { h: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              {d.suggestedPresetName && (
                <p className="text-xs text-muted-foreground">
                  Preset suggéré : <code>{d.suggestedPresetName}</code>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Confiance : {Math.round(d.confidence)}% · Page {d.page + 1}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => applyOneDetection(idx)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Appliquer cette détection
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeDetection(idx)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Supprimer cette détection
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Dialog de revue des suggestions IA (s'affiche après l'appel à /api/documents/ocr/enrich) */}
      {enrichLoading && pendingDetections && (
        <OcrEnrichLoading
          count={pendingDetections.length}
          onClose={() => setEnrichLoading(false)}
        />
      )}
      {enrichResult && pendingDetections && (
        <OcrEnrichDialog
          open
          onClose={() => setEnrichResult(null)}
          originals={pendingDetections.map((original, index) => ({ index, original }))}
          suggestions={enrichResult.suggestions}
          presets={presets}
          usage={enrichResult.usage}
          onApply={applyEnrichment}
        />
      )}
    </div>
  );
}
