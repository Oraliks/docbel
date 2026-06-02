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
  Building2,
  Search,
  X,
  ExternalLink,
  EyeOff,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Organisme {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  type: string;
  color: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  active: boolean;
  order: number;
  templateCount: number;
  createdAt: string;
  updatedAt: string;
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "federal", label: "Fédéral" },
  { value: "regional", label: "Régional" },
  { value: "local", label: "Local (commune, CPAS)" },
  { value: "social", label: "Social (mutuelle, syndicat)" },
  { value: "professional", label: "Professionnel (SS, fiduciaire)" },
  { value: "other", label: "Autre" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map((t) => [t.value, t.label])
);

interface FormState {
  code: string;
  name: string;
  shortName: string;
  type: string;
  color: string;
  logoUrl: string;
  website: string;
  description: string;
  order: number;
  active: boolean;
}

const EMPTY: FormState = {
  code: "",
  name: "",
  shortName: "",
  type: "federal",
  color: "#7C3AED",
  logoUrl: "",
  website: "",
  description: "",
  order: 0,
  active: true,
};

export function OrganismesAdmin({ initial }: { initial: Organisme[] }) {
  const router = useRouter();
  const [organismes, setOrganismes] = useState(initial);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const [editing, setEditing] = useState<Organisme | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Organisme | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return organismes.filter((o) => {
      if (!showInactive && !o.active) return false;
      if (typeFilter !== "all" && o.type !== typeFilter) return false;
      if (q) {
        const hay = `${o.code} ${o.name} ${o.shortName ?? ""} ${o.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [organismes, search, typeFilter, showInactive]);

  function openCreate() {
    setForm(EMPTY);
    setCreating(true);
  }

  function openEdit(o: Organisme) {
    setForm({
      code: o.code,
      name: o.name,
      shortName: o.shortName ?? "",
      type: o.type,
      color: o.color,
      logoUrl: o.logoUrl ?? "",
      website: o.website ?? "",
      description: o.description ?? "",
      order: o.order,
      active: o.active,
    });
    setEditing(o);
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
      const url = isUpdate ? `/api/documents/organismes/${editing!.id}` : `/api/documents/organismes`;
      const method = isUpdate ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      const saved = await res.json();
      if (isUpdate) {
        setOrganismes((prev) =>
          prev.map((o) => (o.id === saved.id ? { ...o, ...saved, templateCount: o.templateCount } : o))
        );
      } else {
        setOrganismes((prev) => [...prev, { ...saved, templateCount: 0 }]);
      }
      toast.success(isUpdate ? "Organisme mis à jour" : "Organisme créé");
      closeDialog();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(o: Organisme) {
    try {
      const res = await fetch(`/api/documents/organismes/${o.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      const result = await res.json();
      if (result.softDelete) {
        setOrganismes((prev) =>
          prev.map((x) => (x.id === o.id ? { ...x, active: false } : x))
        );
        toast.warning(result.message || "Désactivé");
      } else {
        setOrganismes((prev) => prev.filter((x) => x.id !== o.id));
        toast.success("Supprimé");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function toggleActive(o: Organisme) {
    try {
      const res = await fetch(`/api/documents/organismes/${o.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !o.active }),
      });
      if (!res.ok) throw new Error("Échec");
      const updated = await res.json();
      setOrganismes((prev) => prev.map((x) => (x.id === o.id ? { ...x, active: updated.active } : x)));
      toast.success(updated.active ? "Activé" : "Désactivé");
      router.refresh();
    } catch {
      toast.error("Erreur");
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
            <Building2 className="w-7 h-7" />
            Organismes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} sur {organismes.length} organisme{organismes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nouvel organisme
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, code…"
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
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v || "all")}>
          <SelectTrigger className="w-auto min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showInactive ? "default" : "outline"}
          size="sm"
          onClick={() => setShowInactive((v) => !v)}
        >
          {showInactive ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
          {showInactive ? "Tous" : "Actifs uniquement"}
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Organisme</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id} className={!o.active ? "opacity-60" : ""}>
                <TableCell>
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                      style={{ backgroundColor: o.color }}
                    >
                      {(o.shortName || o.name).slice(0, 3).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{o.name}</div>
                      {o.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-md">
                          {o.description}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{o.code}</code>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {TYPE_LABEL[o.type] || o.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{o.templateCount}</span>
                </TableCell>
                <TableCell>
                  {o.active ? (
                    <Badge variant="default" className="text-xs">
                      Actif
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Inactif
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {o.website && (
                      <Button
                        render={<a href={o.website} target="_blank" rel="noopener noreferrer" />}
                        variant="ghost"
                        size="sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(o)}>
                      {o.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(o)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Aucun organisme.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog create/edit */}
      <Dialog open={creating || !!editing} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'organisme" : "Nouvel organisme"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Modifiez les informations de l'organisme."
                : "Créez un nouvel organisme émetteur (ONEM, CPAS, mutuelle, etc.)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Code interne *</Label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") })
                  }
                  placeholder="onem"
                  disabled={!!editing}
                  className="font-mono h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => v && setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nom complet *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Office National de l'Emploi"
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom court</Label>
                <Input
                  value={form.shortName}
                  onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                  placeholder="ONEM"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Couleur</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-9 w-12 rounded border"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="font-mono h-9"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Site web</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://www.onem.be"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">URL du logo (optionnel)</Label>
              <Input
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://…/logo.svg"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Sécurité sociale fédérale…"
              />
            </div>

            <div className="space-y-1.5 max-w-[150px]">
              <Label className="text-xs">Ordre d&apos;affichage</Label>
              <Input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.code || !form.name}
            >
              {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet organisme ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.templateCount > 0
                ? `"${deleteTarget.name}" est utilisé par ${deleteTarget.templateCount} document(s). Il sera désactivé pour préserver les références.`
                : `Cette action supprimera définitivement "${deleteTarget?.name}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTarget && deleteTarget.templateCount > 0 ? "Désactiver" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
