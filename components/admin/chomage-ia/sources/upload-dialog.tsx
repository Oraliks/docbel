"use client";

/**
 * Modal d'upload PDF / image vers la KB.
 *
 * Pour un PDF : si l'extraction texte fonctionne, le contenu est rempli auto.
 * Pour une image : le caption est obligatoire (l'IA lit le caption, pas l'image).
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload as UploadIcon, FileText, ImageIcon } from "lucide-react";
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

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  onSuccess: () => void;
}

type UploadKind = "pdf" | "image_caption";

export function UploadDialog({
  open,
  onOpenChange,
  domain,
  onSuccess,
}: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<UploadKind>("pdf");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setKind("pdf");
    setContent("");
    setSourceUrl("");
    setTagsRaw("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onFileChange(f: File | null) {
    setFile(f);
    if (f) {
      // Auto-fill title (sans extension) si vide
      if (!title) {
        const base = f.name.replace(/\.[^.]+$/, "");
        setTitle(base.slice(0, 100));
      }
      // Détecte le kind
      if (f.type === "application/pdf") {
        setKind("pdf");
      } else if (f.type.startsWith("image/")) {
        setKind("image_caption");
      }
    }
  }

  async function submit() {
    if (!file) {
      toast.error("Aucun fichier sélectionné");
      return;
    }
    if (title.trim().length < 2) {
      toast.error("Titre trop court");
      return;
    }
    if (kind === "image_caption" && content.trim().length < 10) {
      toast.error("Description requise pour une image (10 caractères min)");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", title.trim());
    fd.append("kind", kind);
    fd.append("domain", domain);
    if (content.trim().length > 0) fd.append("content", content.trim());
    if (sourceUrl.trim().length > 0) fd.append("sourceUrl", sourceUrl.trim());
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 50)
      .slice(0, 20);
    if (tags.length > 0) fd.append("tags", JSON.stringify(tags));

    setUploading(true);
    try {
      const res = await fetch("/api/chomage-ia/sources/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data.extractWarning) {
        toast.warning("Source créée — extraction PDF partielle", {
          description: data.extractWarning,
        });
      } else {
        toast.success("Source uploadée");
      }
      reset();
      onSuccess();
    } catch (e) {
      toast.error("Échec de l'upload", {
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
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload PDF ou image</DialogTitle>
          <DialogDescription>
            PDF (max 20 Mo) : texte extrait automatiquement si possible. Image :
            la description est obligatoire (l&apos;IA lit la description, pas
            l&apos;image elle-même).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* File picker */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-file">Fichier *</Label>
            <input
              ref={fileInputRef}
              id="upload-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              className="text-[12.5px]"
            />
            {file ? (
              <div className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                {file.type === "application/pdf" ? (
                  <FileText className="size-3.5" />
                ) : (
                  <ImageIcon className="size-3.5" />
                )}
                <span className="truncate">{file.name}</span>
                <span>·</span>
                <span>{(file.size / 1024 / 1024).toFixed(2)} Mo</span>
              </div>
            ) : null}
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-title">Titre *</Label>
            <Input
              id="upload-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Barème ONEM 2026, AR du 25/11/1991, …"
            />
          </div>

          {/* URL source */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-url">URL source (optionnel)</Label>
            <Input
              id="upload-url"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.onem.be/..."
            />
          </div>

          {/* Content/caption */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-content">
              {kind === "image_caption"
                ? "Description de l'image *"
                : "Contenu (optionnel — extrait auto si vide pour les PDF)"}
            </Label>
            <Textarea
              id="upload-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                kind === "image_caption"
                  ? "Décris en détail ce que montre l'image : tableau, formule, schéma, valeurs visibles…"
                  : "Si l'extraction automatique du PDF échoue, remplis manuellement ici."
              }
              rows={5}
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="upload-tags">Tags (séparés par des virgules)</Label>
            <Input
              id="upload-tags"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="ex: ONEM, barèmes, 2026"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Annuler
          </Button>
          <Button onClick={submit} disabled={uploading || !file}>
            {uploading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Upload…
              </>
            ) : (
              <>
                <UploadIcon className="size-3.5" />
                Uploader
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
