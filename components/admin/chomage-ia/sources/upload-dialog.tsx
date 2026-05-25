"use client";

/**
 * Modal d'upload multi-fichiers vers la KB chômage.
 *
 * Formats acceptés : PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx),
 * images (JPG/PNG/WebP/GIF). Pour les images, l'IA lit le caption (saisi
 * comme description partagée) — pas le bitmap.
 *
 * Comportement :
 *  - Drag-drop multi-fichiers ou file picker (multiple).
 *  - Queue affichée avec icône typée + état (pending/uploading/success/error).
 *  - Upload SÉQUENTIEL (le backend bosse 1 fichier par requête) → ne sature
 *    pas le serveur sur un drop de 20 fichiers.
 *  - Titre = `baseTitle || nom-fichier-sans-ext` (au cas par cas).
 *  - Tags + URL source + description (caption images) sont partagés.
 *  - Auto-close si 100% succès, reste ouvert si erreurs partielles.
 */

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileType2,
  ImageIcon,
  Loader2,
  Presentation,
  Upload as UploadIcon,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useFileDrop } from "@/lib/chomage-ia/use-file-drop";
import { fmtBytes } from "../_shared";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  onSuccess: () => void;
}

type Kind = "pdf" | "image_caption" | "docx" | "xlsx" | "pptx";
type SlotStatus = "pending" | "uploading" | "success" | "error";

interface FileSlot {
  id: string;
  file: File;
  kind: Kind | "unsupported";
  status: SlotStatus;
  errorMessage?: string;
  resultId?: string;
  warning?: string;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 Mo
const ACCEPT_ATTR = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.webp,.gif",
].join(",");

const MIME_TO_KIND: Record<string, Kind> = {
  "application/pdf": "pdf",
  "image/jpeg": "image_caption",
  "image/png": "image_caption",
  "image/webp": "image_caption",
  "image/gif": "image_caption",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
};

const EXT_TO_KIND: Record<string, Kind> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  jpg: "image_caption",
  jpeg: "image_caption",
  png: "image_caption",
  webp: "image_caption",
  gif: "image_caption",
};

const KIND_LABELS: Record<Kind, string> = {
  pdf: "PDF",
  docx: "Word",
  xlsx: "Excel",
  pptx: "PowerPoint",
  image_caption: "Image",
};

function inferKind(file: File): Kind | "unsupported" {
  if (MIME_TO_KIND[file.type]) return MIME_TO_KIND[file.type];
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return EXT_TO_KIND[ext] ?? "unsupported";
}

function KindIcon({
  kind,
  className,
}: {
  kind: Kind | "unsupported";
  className?: string;
}) {
  switch (kind) {
    case "pdf":
      return <FileText className={className} />;
    case "docx":
      return <FileType2 className={className} />;
    case "xlsx":
      return <FileSpreadsheet className={className} />;
    case "pptx":
      return <Presentation className={className} />;
    case "image_caption":
      return <ImageIcon className={className} />;
    default:
      return <FileText className={className} />;
  }
}

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, "").slice(0, 100);
}

function makeSlotId(file: File) {
  return `${file.name}-${file.size}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function UploadDialog({
  open,
  onOpenChange,
  domain,
  onSuccess,
}: UploadDialogProps) {
  const [slots, setSlots] = useState<FileSlot[]>([]);
  const [baseTitle, setBaseTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setSlots([]);
    setBaseTitle("");
    setSourceUrl("");
    setTagsRaw("");
    setImageCaption("");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const newSlots: FileSlot[] = [];
    for (const file of incoming) {
      const kind = inferKind(file);
      if (kind === "unsupported") {
        toast.error(`${file.name} : format non supporté`, {
          description: "Accepté : PDF, Word, Excel, PowerPoint, images.",
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} : fichier trop volumineux`, {
          description: `Max ${MAX_FILE_SIZE / 1024 / 1024} Mo (taille actuelle : ${fmtBytes(file.size)}).`,
        });
        continue;
      }
      newSlots.push({
        id: makeSlotId(file),
        file,
        kind,
        status: "pending",
      });
    }
    if (newSlots.length === 0) return;
    setSlots((prev) => [...prev, ...newSlots]);
  };

  const { dragOver, dropHandlers } = useFileDrop({
    onFiles: addFiles,
    disabled: uploading,
  });

  const removeSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const hasImages = useMemo(
    () => slots.some((s) => s.kind === "image_caption"),
    [slots]
  );

  const stats = useMemo(() => {
    const pending = slots.filter((s) => s.status === "pending").length;
    const uploading_ = slots.filter((s) => s.status === "uploading").length;
    const success = slots.filter((s) => s.status === "success").length;
    const error = slots.filter((s) => s.status === "error").length;
    return { total: slots.length, pending, uploading: uploading_, success, error };
  }, [slots]);

  async function uploadAll() {
    const queue = slots.filter((s) => s.status === "pending");
    if (queue.length === 0) {
      toast.error("Aucun fichier à uploader");
      return;
    }
    // Caption images : plus obligatoire — le backend tente OCR automatiquement
    // via Tesseract.js (fr+nl+en). Si l'OCR échoue ET caption vide, le backend
    // renvoie 400 avec un message clair que le front affichera.

    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 50)
      .slice(0, 20);
    const tagsJson = tags.length > 0 ? JSON.stringify(tags) : null;
    const trimmedUrl = sourceUrl.trim();
    const trimmedBase = baseTitle.trim();

    setUploading(true);

    let successCount = 0;
    let errorCount = 0;

    for (const slot of queue) {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slot.id ? { ...s, status: "uploading" as SlotStatus } : s
        )
      );

      const baseFileTitle = stripExt(slot.file.name);
      const title = trimmedBase
        ? `${trimmedBase} — ${baseFileTitle}`.slice(0, 200)
        : baseFileTitle;

      const fd = new FormData();
      fd.append("file", slot.file);
      fd.append("title", title);
      fd.append("kind", slot.kind);
      fd.append("domain", domain);
      if (trimmedUrl.length > 0) fd.append("sourceUrl", trimmedUrl);
      if (tagsJson) fd.append("tags", tagsJson);
      if (slot.kind === "image_caption" && imageCaption.trim().length >= 10) {
        // Caption manuel optionnel : si vide ou trop court, on laisse le
        // backend tenter OCR Tesseract automatiquement.
        fd.append("content", imageCaption.trim());
      }

      try {
        const res = await fetch("/api/chomage-ia/sources/upload", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          // Concat error + detail si présent (la route logge le stack en 500)
          const msg = data?.error ?? `HTTP ${res.status}`;
          throw new Error(data?.detail ? `${msg} — ${data.detail}` : msg);
        }
        successCount++;
        setSlots((prev) =>
          prev.map((s) =>
            s.id === slot.id
              ? {
                  ...s,
                  status: "success" as SlotStatus,
                  resultId: data.id,
                  warning: data.extractWarning ?? undefined,
                }
              : s
          )
        );
      } catch (e) {
        errorCount++;
        setSlots((prev) =>
          prev.map((s) =>
            s.id === slot.id
              ? {
                  ...s,
                  status: "error" as SlotStatus,
                  errorMessage:
                    e instanceof Error ? e.message : String(e),
                }
              : s
          )
        );
      }
    }

    setUploading(false);

    if (errorCount === 0) {
      toast.success(
        `${successCount} fichier${successCount > 1 ? "s" : ""} uploadé${successCount > 1 ? "s" : ""}`
      );
      reset();
      onSuccess();
    } else {
      toast.warning(
        `${successCount} succès, ${errorCount} erreur${errorCount > 1 ? "s" : ""}`,
        {
          description:
            "Les fichiers en erreur restent dans la liste — corrige et relance.",
        }
      );
      // Refresh la liste parente pour afficher les succès quand-même.
      onSuccess();
    }
  }

  const canSubmit = stats.pending > 0 && !uploading;

  const hasErrors = stats.error > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Bloque la fermeture pendant un upload OU s'il reste des erreurs
        // visibles à corriger — sinon le user perd la trace du message.
        if (!o && (uploading || hasErrors)) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,960px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[960px]">
        {/* Click-outside et ESC sont déjà interceptés via onOpenChange ci-dessus
            qui bloque la fermeture pendant l'upload ou s'il reste des erreurs. */}
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Upload de fichiers vers la KB</DialogTitle>
          <DialogDescription>
            Glissez plusieurs fichiers à la fois. Formats : PDF, Word (.docx),
            Excel (.xlsx), PowerPoint (.pptx), images. Le texte est extrait
            automatiquement quand c&apos;est possible. Max 20 Mo par fichier.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* Dropzone */}
          <div
            {...dropHandlers}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground hover:bg-muted/40",
              uploading && "opacity-60 pointer-events-none cursor-not-allowed"
            )}
          >
            <UploadCloud
              className={cn(
                "size-8",
                dragOver ? "text-primary" : "text-muted-foreground"
              )}
            />
            <p className="text-sm font-medium">
              Glissez vos fichiers ici ou cliquez pour parcourir
            </p>
            <p className="text-[12px] text-muted-foreground">
              PDF · Word · Excel · PowerPoint · Images — multi-fichiers
              supporté
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              className="hidden"
              onChange={(e) => {
                const fl = e.currentTarget.files;
                if (fl) addFiles(Array.from(fl));
                e.currentTarget.value = "";
              }}
            />
          </div>

          {/* Queue */}
          {slots.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[12.5px]">
                  File d&apos;attente ({slots.length})
                </Label>
                <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                  {stats.success > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {stats.success} ok
                    </span>
                  )}
                  {stats.error > 0 && (
                    <span className="text-destructive">
                      {stats.error} erreur{stats.error > 1 ? "s" : ""}
                    </span>
                  )}
                  {stats.pending > 0 && (
                    <span>{stats.pending} en attente</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto rounded-md border bg-muted/20 p-2">
                {slots.map((slot) => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    disabled={uploading}
                    onRemove={() => removeSlot(slot.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Champs partagés */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-base-title" className="text-[12.5px]">
                Préfixe de titre (optionnel)
              </Label>
              <Input
                id="upload-base-title"
                value={baseTitle}
                onChange={(e) => setBaseTitle(e.target.value)}
                placeholder="Ex: Barème ONEM 2026"
                disabled={uploading}
              />
              <p className="text-[11px] text-muted-foreground">
                Vide → titre = nom du fichier. Sinon → « préfixe — nom ».
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="upload-url" className="text-[12.5px]">
                URL source (optionnel)
              </Label>
              <Input
                id="upload-url"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.onem.be/..."
                disabled={uploading}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="upload-tags" className="text-[12.5px]">
                Tags (séparés par des virgules)
              </Label>
              <Input
                id="upload-tags"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="ex: ONEM, barèmes, 2026"
                disabled={uploading}
              />
            </div>

            {hasImages && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="upload-caption" className="text-[12.5px]">
                  Description des images{" "}
                  <span className="text-muted-foreground font-normal">
                    (optionnel — OCR auto via Tesseract)
                  </span>
                </Label>
                <Textarea
                  id="upload-caption"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  placeholder="Le texte des images est extrait automatiquement par OCR (Tesseract.js, fr+nl+en). Tu peux laisser vide pour utiliser l'OCR, ou décrire toi-même si tu veux un caption custom."
                  rows={3}
                  disabled={uploading}
                />
                <p className="text-[11px] text-muted-foreground">
                  Si vide, l&apos;OCR Tesseract tentera d&apos;extraire le texte
                  (10-30 s la première fois, puis 3-10 s par image). Sinon ta
                  description manuelle est utilisée telle quelle.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-3">
          <Button
            variant="outline"
            onClick={() => {
              // Force la fermeture quel que soit l'état d'erreur (le user
              // a cliqué explicitement sur le bouton — on ne pas se met en
              // travers ici, contrairement au click outside).
              if (uploading) return;
              reset();
              onOpenChange(false);
            }}
            disabled={uploading}
          >
            {stats.success > 0 || hasErrors ? "Fermer" : "Annuler"}
          </Button>
          <Button onClick={uploadAll} disabled={!canSubmit}>
            {uploading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Upload… ({stats.uploading + stats.success}/{stats.total})
              </>
            ) : (
              <>
                <UploadIcon className="size-3.5" />
                Uploader {stats.pending} fichier{stats.pending > 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SlotRow({
  slot,
  disabled,
  onRemove,
}: {
  slot: FileSlot;
  disabled: boolean;
  onRemove: () => void;
}) {
  const label =
    slot.kind === "unsupported" ? "?" : KIND_LABELS[slot.kind as Kind];

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
        slot.status === "success" &&
          "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/10",
        slot.status === "error" &&
          "border-destructive/40 bg-destructive/5"
      )}
    >
      <KindIcon kind={slot.kind} className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] font-medium" title={slot.file.name}>
            {slot.file.name}
          </span>
          <span className="shrink-0 rounded-sm bg-muted px-1 text-[10px] font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{fmtBytes(slot.file.size)}</span>
          {slot.status === "error" && slot.errorMessage && (
            <>
              <span>·</span>
              <span className="text-destructive truncate" title={slot.errorMessage}>
                {slot.errorMessage}
              </span>
            </>
          )}
          {slot.status === "success" && slot.warning && (
            <>
              <span>·</span>
              <span
                className="text-amber-700 dark:text-amber-400 truncate"
                title={slot.warning}
              >
                extraction partielle
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="shrink-0">
        {slot.status === "pending" && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
            aria-label="Retirer"
            title="Retirer de la liste"
          >
            <X className="size-4" />
          </button>
        )}
        {slot.status === "uploading" && (
          <Loader2 className="size-4 animate-spin text-primary" />
        )}
        {slot.status === "success" && (
          <CheckCircle2 className="size-4 text-emerald-600" />
        )}
        {slot.status === "error" && (
          <XCircle className="size-4 text-destructive" />
        )}
      </div>
    </div>
  );
}
