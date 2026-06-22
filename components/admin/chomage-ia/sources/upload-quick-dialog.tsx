"use client";

/**
 * Modal d'upload "quick" depuis le chat — version allégée du `UploadDialog`.
 *
 * - Un seul fichier à la fois (le chat n'a pas besoin de multi-upload)
 * - Champ "Titre (optionnel)" — sinon nom du fichier
 * - Pas de tags / URL / caption au moment de l'upload (édit après création)
 * - Backend : POST /api/chomage-ia/sources/upload avec defaults
 *
 * Le `UploadDialog` complet reste disponible sur la page Sources pour les
 * uploads détaillés (batch, tags, URL source, caption image).
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  FileSpreadsheet,
  FileText,
  FileType2,
  ImageIcon,
  Loader2,
  Presentation,
  Upload as UploadIcon,
  UploadCloud,
  X,
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
import { cn } from "@/lib/utils";
import { useFileDrop } from "@/lib/chomage-ia/use-file-drop";
import { fmtBytes } from "../_shared";

interface UploadQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  /** Callback appelé après upload réussi (parent peut refresh ses compteurs). */
  onSuccess: () => void;
}

type Kind = "pdf" | "image_caption" | "docx" | "xlsx" | "pptx";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
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

export function UploadQuickDialog({
  open,
  onOpenChange,
  domain,
  onSuccess,
}: UploadQuickDialogProps) {
  const t = useTranslations("admin.chomageIa");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFiles(files: File[]) {
    if (files.length === 0) return;
    // Quick = un seul fichier : on prend le premier valide.
    const f = files[0];
    const kind = inferKind(f);
    if (kind === "unsupported") {
      toast.error(t("fileUnsupported", { name: f.name }), {
        description: t("acceptedFormats"),
      });
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast.error(t("fileTooLarge", { name: f.name }), {
        description: t("maxSizeWithCurrent", {
          max: MAX_FILE_SIZE / 1024 / 1024,
          current: fmtBytes(f.size),
        }),
      });
      return;
    }
    setFile(f);
    if (files.length > 1) {
      toast.message(t("singleFileHint"));
    }
  }

  const { dragOver, dropHandlers } = useFileDrop({
    onFiles: handleFiles,
    disabled: uploading,
  });

  async function upload(force = false) {
    if (!file || uploading) return;
    const kind = inferKind(file);
    if (kind === "unsupported") return;

    const finalTitle = title.trim() || stripExt(file.name);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", finalTitle);
    fd.append("kind", kind);
    fd.append("domain", domain);

    setUploading(true);
    try {
      const url = force
        ? "/api/chomage-ia/sources/upload?force=1"
        : "/api/chomage-ia/sources/upload";
      const res = await fetch(url, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      // 409 = doublon détecté côté serveur. On propose au user de confirmer.
      if (res.status === 409 && data?.existingId) {
        const ok = window.confirm(
          t("duplicateConfirm", {
            title: data.existingTitle ?? t("existingSource"),
          })
        );
        if (ok) {
          // Retry avec ?force=1 — le finally remettra uploading=false avant.
          setUploading(false);
          await upload(true);
          return;
        }
        toast.message(t("uploadCancelledDuplicate"));
        return;
      }
      if (!res.ok) {
        const msg = data?.error ?? `HTTP ${res.status}`;
        throw new Error(data?.detail ? `${msg} — ${data.detail}` : msg);
      }
      toast.success(t("sourceAddedToKb"), {
        description: data?.extractWarning
          ? t("partialExtractionWarning", { warning: data.extractWarning })
          : finalTitle,
      });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(t("uploadError"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && uploading) return; // bloque la fermeture pendant upload
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle className="text-[15px]">
            {t("quickUploadTitle")}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {t("quickUploadDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-5 py-4">
          {/* Dropzone */}
          {!file ? (
            <div
              {...dropHandlers}
              onClick={() => !uploading && inputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-6 text-center transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground hover:bg-muted/40",
                uploading && "pointer-events-none opacity-60",
              )}
              role="button"
              tabIndex={0}
              aria-label={t("chooseOrDropFile")}
            >
              <UploadCloud
                className={cn(
                  "size-7",
                  dragOver ? "text-primary" : "text-muted-foreground",
                )}
              />
              <p className="text-[12.5px] font-medium">
                {t("dropOrBrowseSingle")}
              </p>
              <p className="text-[10.5px] text-muted-foreground">
                {t("formatsLineSingle")}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => {
                  const fl = e.currentTarget.files;
                  if (fl) handleFiles(Array.from(fl));
                  e.currentTarget.value = "";
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <KindIcon
                kind={inferKind(file)}
                className="size-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="text-[10.5px] text-muted-foreground">
                  {fmtBytes(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setFile(null)}
                disabled={uploading}
                aria-label={t("removeFile")}
              >
                <X className="size-3" />
              </Button>
            </div>
          )}

          {/* Titre (optionnel) */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="upload-quick-title" className="text-[11.5px]">
              {t("titleLabel")} <span className="text-muted-foreground font-normal">{t("optionalParen")}</span>
            </Label>
            <Input
              id="upload-quick-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              disabled={uploading}
              placeholder={
                file ? stripExt(file.name) : t("titleEmptyPlaceholder")
              }
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <Button
            variant="outline"
            onClick={() => {
              if (uploading) return;
              reset();
              onOpenChange(false);
            }}
            disabled={uploading}
          >
            {t("cancel")}
          </Button>
          <Button onClick={() => upload(false)} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t("uploadingShort")}
              </>
            ) : (
              <>
                <UploadIcon className="size-3.5" />
                {t("upload")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
