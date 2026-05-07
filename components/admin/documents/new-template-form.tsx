"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

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

export function NewTemplateForm({ sections }: NewTemplateFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [sectionId, setSectionId] = useState(sections[0]?.id || "");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📄");
  const [timeMin, setTimeMin] = useState("5");
  const [rgpdNotice, setRgpdNotice] = useState(
    "Les données saisies servent uniquement à générer ce document. Elles ne sont pas conservées en clair sur nos serveurs."
  );
  const [retentionDays, setRetentionDays] = useState("30");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Veuillez sélectionner un fichier source (PDF ou DOCX)");
      return;
    }
    if (!name || !slug || !sectionId) {
      toast.error("Nom, slug et section sont obligatoires");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload du fichier
      const fd = new FormData();
      fd.append("file", file);
      fd.append("isPrivate", "true");
      const upRes = await fetch("/api/files/upload", { method: "POST", body: fd });
      if (!upRes.ok) {
        const j = await upRes.json().catch(() => ({}));
        throw new Error(j.error || "Échec de l'upload");
      }
      const uploaded = await upRes.json();

      // 2. Création du template (avec création du Tool inline)
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

      toast.success("Modèle créé. Vous pouvez maintenant configurer les champs.");
      router.push(`/admin/documents/${template.toolId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div className="flex items-center gap-3">
        <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <h1 className="text-2xl font-bold">Nouveau modèle de document</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identité de l&apos;outil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nom *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Ex: Demande C4"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL) *</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(slugify(e.target.value));
                    setSlugTouched(true);
                  }}
                  placeholder="demande-c4"
                  required
                />
                <p className="text-xs text-muted-foreground">URL : /outils/{slug || "..."}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Section *</Label>
                <Select value={sectionId} onValueChange={(v) => setSectionId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue />
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon">Icône</Label>
                  <Input
                    id="icon"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Durée (min)</Label>
                  <Input
                    id="time"
                    type="number"
                    value={timeMin}
                    onChange={(e) => setTimeMin(e.target.value)}
                    min="1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Brève description affichée à l&apos;utilisateur"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Fichier (PDF ou DOCX) *</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  Sélectionné : {file.name} ({Math.round(file.size / 1024)} Ko)
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Si le PDF contient des champs de formulaire (AcroForm), ils seront détectés automatiquement.
                Sinon, vous pourrez positionner les champs manuellement.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RGPD</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rgpd">Notice affichée à l&apos;utilisateur</Label>
              <Textarea
                id="rgpd"
                value={rgpdNotice}
                onChange={(e) => setRgpdNotice(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="retention">Conservation (jours)</Label>
              <Input
                id="retention"
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                min="1"
                max="365"
              />
              <p className="text-xs text-muted-foreground">
                Les documents générés sont supprimés automatiquement après ce délai.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            render={<Link href="/admin/documents" />}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={submitting}>
            <Upload className="w-4 h-4 mr-2" />
            {submitting ? "Création…" : "Créer le modèle"}
          </Button>
        </div>
      </form>
    </div>
  );
}
