"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Package,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface BundleItem {
  id?: string;
  templateId: string;
  order: number;
  required: boolean;
  condition: { fieldId: string; equals: unknown } | null;
  template: {
    id: string;
    toolId: string;
    toolName: string;
    toolSlug: string;
    organisme: { id: string; shortName: string | null; color: string } | null;
  };
}

interface Bundle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  active: boolean;
  order: number;
  items: BundleItem[];
  createdAt: string;
  updatedAt: string;
}

interface AvailableTemplate {
  id: string;
  toolId: string;
  toolName: string;
  toolSlug: string;
  organisme: { id: string; shortName: string | null; color: string } | null;
}

interface Props {
  initialBundles: Bundle[];
  availableTemplates: AvailableTemplate[];
}

export function BundlesAdmin({ initialBundles, availableTemplates }: Props) {
  const router = useRouter();
  const [bundles, setBundles] = useState(initialBundles);
  const [editing, setEditing] = useState<Bundle | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null);

  const [formSlug, setFormSlug] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formColor, setFormColor] = useState("#7C3AED");
  const [formItems, setFormItems] = useState<BundleItem[]>([]);

  function openCreate() {
    setFormSlug("");
    setFormName("");
    setFormDescription("");
    setFormColor("#7C3AED");
    setFormItems([]);
    setCreating(true);
  }

  function openEdit(b: Bundle) {
    setFormSlug(b.slug);
    setFormName(b.name);
    setFormDescription(b.description ?? "");
    setFormColor(b.color);
    setFormItems(b.items);
    setEditing(b);
  }

  function closeDialog() {
    setEditing(null);
    setCreating(false);
  }

  function addItem(templateId: string) {
    const tpl = availableTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    if (formItems.some((it) => it.templateId === templateId)) {
      toast.warning("Document déjà dans le bundle");
      return;
    }
    setFormItems((prev) => [
      ...prev,
      {
        templateId,
        order: prev.length,
        required: true,
        condition: null,
        template: tpl,
      },
    ]);
  }

  function removeItem(templateId: string) {
    setFormItems((prev) => prev.filter((it) => it.templateId !== templateId));
  }

  function moveItem(idx: number, direction: -1 | 1) {
    const target = idx + direction;
    if (target < 0 || target >= formItems.length) return;
    setFormItems((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((it, i) => ({ ...it, order: i }));
    });
  }

  async function handleSubmit() {
    if (!formName) return toast.error("Nom requis");
    if (!formSlug && !editing) return toast.error("Slug requis");

    setSaving(true);
    try {
      const isUpdate = !!editing;
      let bundleId = editing?.id;

      // Create first if needed
      if (!isUpdate) {
        const res = await fetch("/api/documents/bundles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: formSlug,
            name: formName,
            description: formDescription,
            color: formColor,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || "Échec");
        }
        const created = await res.json();
        bundleId = created.id;
      }

      // Update items + meta in PUT
      const res2 = await fetch(`/api/documents/bundles/${bundleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          description: formDescription,
          color: formColor,
          items: formItems.map((it, idx) => ({
            templateId: it.templateId,
            order: idx,
            required: it.required,
            condition: it.condition,
          })),
        }),
      });
      if (!res2.ok) {
        const j = await res2.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      const saved = await res2.json();
      if (isUpdate) {
        setBundles((prev) => prev.map((b) => (b.id === saved.id ? { ...saved } : b)));
      } else {
        setBundles((prev) => [...prev, saved]);
      }
      toast.success(isUpdate ? "Bundle mis à jour" : "Bundle créé");
      closeDialog();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: Bundle) {
    try {
      const res = await fetch(`/api/documents/bundles/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !b.active }),
      });
      if (!res.ok) throw new Error("Échec");
      setBundles((prev) => prev.map((x) => (x.id === b.id ? { ...x, active: !b.active } : x)));
      router.refresh();
    } catch {
      toast.error("Erreur");
    }
  }

  async function handleDelete(b: Bundle) {
    try {
      const res = await fetch(`/api/documents/bundles/${b.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec");
      setBundles((prev) => prev.filter((x) => x.id !== b.id));
      toast.success("Supprimé");
      router.refresh();
    } catch {
      toast.error("Erreur");
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
            <Package className="w-7 h-7" />
            Bundles de documents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {bundles.length} bundle{bundles.length !== 1 ? "s" : ""} · Groupez plusieurs documents
            en un parcours.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nouveau bundle
        </Button>
      </div>

      {bundles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun bundle pour l&apos;instant.</p>
            <Button onClick={openCreate} className="mt-3">
              <Plus className="w-4 h-4 mr-2" />
              Créer le premier bundle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bundles.map((b) => (
            <Card key={b.id} className={!b.active ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: b.color }}
                    >
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{b.name}</CardTitle>
                      <code className="text-xs text-muted-foreground">/bundles/{b.slug}</code>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {b.active && (
                      <Button
                        render={<Link href={`/outils/bundles/${b.slug}`} target="_blank" />}
                        variant="ghost"
                        size="sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(b)}>
                      {b.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(b)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                {b.description && (
                  <p className="text-sm text-muted-foreground">{b.description}</p>
                )}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {b.items.length} document{b.items.length !== 1 ? "s" : ""}
                  </p>
                  {b.items.map((it) => (
                    <div key={it.id || it.templateId} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{it.order + 1}.</span>
                      <span className="truncate flex-1">{it.template.toolName}</span>
                      {it.template.organisme && (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            borderColor: it.template.organisme.color,
                            color: it.template.organisme.color,
                          }}
                        >
                          {it.template.organisme.shortName}
                        </Badge>
                      )}
                      {!it.required && (
                        <Badge variant="secondary" className="text-[10px]">
                          opt.
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating || !!editing} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Modifier "${editing.name}"` : "Nouveau bundle"}</DialogTitle>
            <DialogDescription>
              Un bundle regroupe plusieurs documents à compléter ensemble (ex: dossier complet de
              chômage).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Slug *</Label>
                <Input
                  value={formSlug}
                  onChange={(e) =>
                    setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                  }
                  placeholder="dossier-chomage-complet"
                  disabled={!!editing}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Couleur</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="h-9 w-12 rounded border"
                  />
                  <Input
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Dossier complet de demande de chômage"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2 border-t pt-3">
              <Label className="text-sm font-medium">Documents inclus</Label>
              <Select value="" onValueChange={(v) => v && addItem(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="+ Ajouter un document" />
                </SelectTrigger>
                <SelectContent>
                  {availableTemplates
                    .filter((t) => !formItems.some((it) => it.templateId === t.id))
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.toolName}
                        {t.organisme?.shortName ? ` — ${t.organisme.shortName}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {formItems.length > 0 && (
                <div className="space-y-1.5 border rounded-md p-2 bg-muted/20">
                  {formItems.map((it, idx) => (
                    <div
                      key={it.templateId}
                      className="flex items-center gap-2 p-2 bg-background rounded border"
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                          title="Monter"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === formItems.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs leading-none"
                          title="Descendre"
                        >
                          ▼
                        </button>
                      </div>
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">
                        {idx + 1}. {it.template.toolName}
                      </span>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={it.required}
                          onChange={(e) =>
                            setFormItems((prev) =>
                              prev.map((x) =>
                                x.templateId === it.templateId
                                  ? { ...x, required: e.target.checked }
                                  : x
                              )
                            )
                          }
                        />
                        Obligatoire
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(it.templateId)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {formItems.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucun document. Ajoutez-en au moins un pour activer ce bundle.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !formName}>
              {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bundle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprime définitivement &quot;{deleteTarget?.name}&quot; et la liste des
              documents associés. Les documents eux-mêmes ne sont pas supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
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
