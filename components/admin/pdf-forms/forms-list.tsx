"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PlusIcon, Loader2Icon, FileInputIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Locale } from "@/lib/pdf-forms/types";

interface FormRow {
  id: string;
  slug: string;
  title: string;
  issuer: string | null;
  status: "draft" | "published" | "archived";
  version: number;
  locales: Locale[];
  pageCount: number;
  updatedAt: string;
}

const STATUS_BADGE: Record<FormRow["status"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  published: { label: "Publié", variant: "default" },
  draft: { label: "Brouillon", variant: "secondary" },
  archived: { label: "Archivé", variant: "outline" },
};

export function PdfFormsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [forms, setForms] = useState<FormRow[] | null>(null);
  // État initial dérivé du deep-link ?new=1 (pas de setState en effet).
  const [dialogOpen, setDialogOpen] = useState(() => searchParams.get("new") === "1");

  const load = useCallback(() => {
    fetch("/api/admin/pdf/forms")
      .then((r) => r.json())
      .then((d) => setForms(Array.isArray(d) ? d : []))
      .catch(() => setForms([]));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <PlusIcon className="size-4" /> Nouveau formulaire
        </Button>
      </div>

      {forms === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <Empty className="rounded-lg border py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileInputIcon className="size-6" /></EmptyMedia>
            <EmptyTitle>Aucun formulaire</EmptyTitle>
            <EmptyDescription>Importez un PDF officiel à champs pour créer votre premier formulaire.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead className="hidden sm:table-cell">Organisme</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden sm:table-cell">Langues</TableHead>
                <TableHead className="text-right">Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((f) => {
                const badge = STATUS_BADGE[f.status];
                return (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/pdf/${f.id}`)}
                  >
                    <TableCell className="font-medium">{f.title}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{f.issuer || "—"}</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs uppercase text-muted-foreground">{f.locales.join(" · ")}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">v{f.version}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <NewFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => router.push(`/admin/pdf/${id}`)}
      />
    </div>
  );
}

function NewFormDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [locales, setLocales] = useState<Locale[]>(["fr"]);
  const [submitting, setSubmitting] = useState(false);

  function toggleLocale(l: Locale) {
    if (l === "fr") return; // FR toujours présent
    setLocales((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }

  async function submit() {
    if (!file) {
      toast.error("Sélectionnez un PDF.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      if (title.trim()) fd.set("title", title.trim());
      if (issuer.trim()) fd.set("issuer", issuer.trim());
      fd.set("locales", locales.join(","));
      const res = await fetch("/api/admin/pdf/forms", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Échec de l'import.");
        return;
      }
      toast.success("Formulaire créé. Champs détectés automatiquement.");
      onOpenChange(false);
      onCreated(data.id);
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau formulaire PDF</DialogTitle>
          <DialogDescription>
            Importez un PDF officiel <strong>à champs (AcroForm)</strong>. Les champs sont extraits et pré-enrichis.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pdf-file">Fichier PDF</Label>
            <Input
              id="pdf-file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pdf-title">Titre (optionnel)</Label>
            <Input id="pdf-title" value={title} placeholder="Déduit du nom du fichier" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pdf-issuer">Organisme (optionnel)</Label>
            <Input id="pdf-issuer" value={issuer} placeholder="ONEM, CPAS…" onChange={(e) => setIssuer(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Langues disponibles</Label>
            <div className="flex gap-3">
              {(["fr", "nl", "de"] as Locale[]).map((l) => (
                <label key={l} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={locales.includes(l)} disabled={l === "fr"} onCheckedChange={() => toggleLocale(l)} />
                  <span className="uppercase">{l}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2Icon className="size-4 animate-spin" />}
            Importer &amp; analyser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
