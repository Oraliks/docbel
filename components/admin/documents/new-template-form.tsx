"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Upload,
  IdCard,
  Palette,
  FileUp,
  ShieldCheck,
  Clock,
  CloudUpload,
  Sparkles,
  Info,
  Calendar,
  X as XIcon,
  FileText as FileTextIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconPicker, IconDisplay } from "./icon-picker";

interface Section {
  id: string;
  name: string;
}

interface NewTemplateFormProps {
  sections: Section[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function SectionTitle({
  number,
  icon,
  title,
  description,
  accent = "primary",
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  accent?: "primary" | "blue" | "emerald" | "violet";
}) {
  const accentClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  };
  const numberClasses: Record<string, string> = {
    primary: "text-primary",
    blue: "text-blue-600 dark:text-blue-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    violet: "text-violet-600 dark:text-violet-400",
  };
  return (
    <div className="flex items-start gap-3 mb-4">
      <span
        className={`flex size-10 items-center justify-center rounded-lg shrink-0 ${accentClasses[accent]}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold flex items-center gap-1.5">
          <span className={`text-sm font-bold ${numberClasses[accent]}`}>{number}</span>
          {title}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function NewTemplateForm({ sections }: NewTemplateFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [sectionId, setSectionId] = useState(sections[0]?.id || "");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string | null>("FileText");
  const [timeMin, setTimeMin] = useState("5");
  const [rgpdNotice, setRgpdNotice] = useState(
    "Les données saisies servent uniquement à générer ce document. Elles ne sont pas conservées en clair sur nos serveurs."
  );
  const [retentionDays, setRetentionDays] = useState("30");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  const fileSizeKb = file ? Math.round(file.size / 1024) : 0;
  const fileExt = file?.name.split(".").pop()?.toLowerCase();
  const isValidExt = fileExt === "pdf" || fileExt === "docx";

  function handleFileSelect(f: File | null) {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      toast.error(`Format .${ext} non supporté. Utilisez un PDF ou un DOCX.`);
      return;
    }
    setFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Veuillez sélectionner un fichier source");
      return;
    }
    if (!isValidExt) {
      toast.error("Format non supporté — seuls PDF et DOCX sont acceptés");
      return;
    }
    if (!name || !slug || !sectionId) {
      toast.error("Nom, slug et section sont obligatoires");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("isPrivate", "true");
      const upRes = await fetch("/api/files/upload", { method: "POST", body: fd });
      if (!upRes.ok) {
        const j = await upRes.json().catch(() => ({}));
        throw new Error(j.error || "Échec de l'upload");
      }
      const uploaded = await upRes.json();

      const tplRes = await fetch("/api/documents/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newTool: {
            name,
            slug,
            sectionId,
            description,
            icon,
            timeMin: parseInt(timeMin, 10) || null,
          },
          sourceFileId: uploaded.id,
          rgpdNotice,
          retentionDays: parseInt(retentionDays, 10) || 30,
        }),
      });
      if (!tplRes.ok) {
        const j = await tplRes.json().catch(() => ({}));
        throw new Error(j.error || "Échec de création du template");
      }
      const template = await tplRes.json();

      toast.success("Modèle créé.");
      router.push(`/admin/documents/${template.toolId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nouveau modèle de document</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configurez votre modèle pas à pas puis publiez-le dans le catalogue.
            </p>
          </div>
        </div>
      </div>

      {/* Top row : 3 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Identité */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <SectionTitle
              number={1}
              icon={<IdCard className="w-5 h-5" />}
              title="Identité de l'outil"
              description="Informations principales visibles par les utilisateurs."
              accent="primary"
            />
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Ex : Demande C4"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">
                Slug (URL) <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                  /outils/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value));
                    setSlugTouched(true);
                  }}
                  placeholder="demande-c4"
                  required
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Section <span className="text-destructive">*</span>
              </Label>
              <Select
                value={sectionId}
                onValueChange={(v) => setSectionId(v ?? "")}
                items={sections.map((s) => ({ value: s.id, label: s.name }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir une section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Brève description affichée à l'utilisateur"
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. Apparence */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <SectionTitle
              number={2}
              icon={<Palette className="w-5 h-5" />}
              title="Apparence"
              description="Personnalisez la présentation dans le catalogue."
              accent="violet"
            />
            <div className="space-y-1.5">
              <Label>Icône</Label>
              <IconPicker value={icon} onChange={setIcon} />
              <p className="text-xs text-muted-foreground">
                Choisissez parmi 100+ icônes ou collez un emoji.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="time">Durée estimée (minutes)</Label>
              <div className="relative">
                <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="time"
                  type="number"
                  value={timeMin}
                  onChange={(e) => setTimeMin(e.target.value)}
                  min="1"
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Affichée à l&apos;utilisateur pour qu&apos;il sache combien de temps prévoir.
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs text-muted-foreground">Aperçu</Label>
              <div className="rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary shrink-0">
                    <IconDisplay value={icon} className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {name || "Nom de l'outil"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {description || "Description de l'outil"}
                    </p>
                  </div>
                  {timeMin && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      {timeMin} min
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Document source */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <SectionTitle
              number={3}
              icon={<FileUp className="w-5 h-5" />}
              title="Document source"
              description="Le PDF ou DOCX qui sera rempli avec les valeurs saisies."
              accent="emerald"
            />
            <div className="space-y-1.5">
              <Label>
                Fichier (PDF ou DOCX) <span className="text-destructive">*</span>
              </Label>

              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`
                    relative flex flex-col items-center justify-center
                    rounded-lg border-2 border-dashed
                    px-6 py-10 text-center cursor-pointer
                    transition-colors
                    ${
                      dragOver
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }
                  `}
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                    <CloudUpload className="w-6 h-6 text-muted-foreground" />
                  </span>
                  <p className="text-sm font-medium">Glissez-déposez votre fichier ici</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ou{" "}
                    <span className="text-primary font-medium underline-offset-2 hover:underline">
                      cliquez pour parcourir
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-3">
                    Formats acceptés : PDF, DOCX (max. 25 Mo)
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border bg-card p-3 flex items-center gap-3">
                  <span
                    className={`flex size-10 items-center justify-center rounded shrink-0 ${
                      isValidExt
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    <FileTextIcon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fileSizeKb} Ko · {fileExt?.toUpperCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    aria-label="Retirer le fichier"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
              />
              {file && isValidExt && (
                <p className="text-xs text-muted-foreground pt-1">
                  {fileExt === "pdf"
                    ? "Les champs AcroForm seront détectés automatiquement après création."
                    : (
                      <>
                        Les placeholders <code className="font-mono">{"{nom}"}</code> seront
                        détectés automatiquement.
                      </>
                    )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. RGPD (full width) */}
      <Card>
        <CardContent className="pt-6">
          <SectionTitle
            number={4}
            icon={<ShieldCheck className="w-5 h-5" />}
            title="RGPD & conservation"
            description="Informations légales et durée de conservation des documents générés."
            accent="blue"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="rgpd">Notice RGPD</Label>
              <Textarea
                id="rgpd"
                value={rgpdNotice}
                onChange={(e) => setRgpdNotice(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Cette notice s&apos;affichera avant le formulaire avec une case à cocher de
                consentement obligatoire.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="retention">Conservation (jours)</Label>
                <div className="relative max-w-xs">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="retention"
                    type="number"
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                    min="1"
                    max="365"
                    className="pl-8"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Les documents générés sont supprimés automatiquement après ce délai.
                </p>
              </div>

              <div className="rounded-lg border bg-blue-500/5 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    Bon à savoir
                  </p>
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    Ces paramètres pourront être modifiés ultérieurement dans les paramètres du
                    modèle.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-medium">Le modèle sera créé en brouillon.</p>
            <p className="text-xs text-muted-foreground">
              Vous pourrez le configurer davantage avant de le publier.
            </p>
          </div>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button
            type="button"
            variant="outline"
            render={<Link href="/admin/documents" />}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting || !file || !isValidExt}>
            <Upload className="w-4 h-4 mr-2" />
            {submitting ? "Création…" : "Créer le modèle"}
          </Button>
        </div>
      </div>
    </form>
  );
}
