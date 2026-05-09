"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  FolderTree,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Section {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  order: number;
  toolCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  description: string;
  icon: string;
  order: number;
}

const EMPTY: FormState = { name: "", description: "", icon: "", order: 0 };

export function SectionsAdmin({ initial }: { initial: Section[] }) {
  const router = useRouter();
  const [sections, setSections] = useState(initial);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Section | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Section | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => {
      const hay = `${s.name} ${s.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [sections, search]);

  function openCreate() {
    setForm({ ...EMPTY, order: sections.length * 10 });
    setCreating(true);
  }

  function openEdit(s: Section) {
    setForm({
      name: s.name,
      description: s.description ?? "",
      icon: s.icon ?? "",
      order: s.order,
    });
    setEditing(s);
  }

  function closeDialog() {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const isUpdate = !!editing;
      const url = isUpdate ? `/api/documents/sections/${editing!.id}` : `/api/documents/sections`;
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      const saved = await res.json();
      if (isUpdate) {
        setSections((prev) =>
          prev.map((s) =>
            s.id === saved.id ? { ...s, ...saved, toolCount: s.toolCount } : s
          )
        );
      } else {
        setSections((prev) => [...prev, { ...saved, toolCount: 0 }]);
      }
      toast.success(isUpdate ? "Section mise à jour" : "Section créée");
      closeDialog();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Section) {
    try {
      const res = await fetch(`/api/documents/sections/${s.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      setSections((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("Section supprimée");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FolderTree className="w-7 h-7" />
            Sections (thématiques)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} sur {sections.length} section{sections.length !== 1 ? "s" : ""} ·
            Regroupent vos outils dans la navigation publique du site.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle section
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[80px]">Ordre</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Outils</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/40">
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {s.order}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium flex items-center gap-2">
                    {s.icon && <span className="text-muted-foreground">{s.icon}</span>}
                    {s.name}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                    {s.description || "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {s.toolCount} outil{s.toolCount !== 1 ? "s" : ""}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                            <Edit2 className="w-4 h-4" />
                            <span className="sr-only">Éditer</span>
                          </Button>
                        }
                      />
                      <TooltipContent>Éditer</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(s)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={s.toolCount > 0}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">Supprimer</span>
                          </Button>
                        }
                      />
                      <TooltipContent>
                        {s.toolCount > 0
                          ? `Impossible : ${s.toolCount} outil(s) rattaché(s)`
                          : "Supprimer"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Aucune section.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={creating || !!editing} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Modifier "${editing.name}"` : "Nouvelle section"}
            </DialogTitle>
            <DialogDescription>
              Les sections regroupent thématiquement les outils dans la navigation publique
              (Chômage, Emploi, Pension, etc.).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Chômage, Emploi, Pension…"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Brève description affichée dans la nav (optionnel)"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Icône (emoji ou nom Lucide)</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder="📋 ou Briefcase"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ordre d&apos;affichage</Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !form.name}>
              {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette section ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.toolCount > 0 ? (
                <>
                  Cette section contient {deleteTarget.toolCount} outil(s). Déplacez-les vers
                  une autre section avant de la supprimer.
                </>
              ) : (
                <>
                  Cette action supprimera définitivement &quot;{deleteTarget?.name}&quot;.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={!!deleteTarget && deleteTarget.toolCount > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
