"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Settings, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CATEGORY_LABELS } from "@/lib/booking/status";

interface TenantRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  partnerOrganization: string | null;
  active: boolean;
  pendingCount: number;
  monthCount: number;
}

const CATEGORIES = ["unemployment", "social_aid", "municipal", "private", "other"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function AdminBookingList({ tenants }: { tenants: TenantRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    category: "private",
    partnerOrganization: "",
  });

  function update(patch: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function toggleActive(t: TenantRow) {
    setToggling(t.id);
    try {
      const res = await fetch(`/api/booking/partner/tenants/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !t.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      toast.success(t.active ? "Guichet désactivé (invisible au public)" : "Guichet activé");
      router.refresh();
    } finally {
      setToggling(null);
    }
  }

  async function create() {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Nom et slug requis");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/booking/partner/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          category: form.category,
          partnerOrganization: form.partnerOrganization.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      toast.success("Guichet créé");
      setOpen(false);
      router.push(`/admin/booking/${data.id}/configuration`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/admin/booking/nouveau")}>
          <Wand2 className="size-4" />
          Assistant guidé
        </Button>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Créer un guichet
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau guichet de rendez-vous</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label>Nom de l&apos;organisation</Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    update({
                      name,
                      ...(slugEdited ? {} : { slug: slugify(name) }),
                    });
                  }}
                  placeholder="Ex : Entreprise Dupont, CPAS de Namur…"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Slug (URL publique)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugEdited(true);
                    update({ slug: slugify(e.target.value) });
                  }}
                  placeholder="entreprise-dupont"
                />
                <p className="text-xs text-muted-foreground">
                  Page publique : <code>/{form.slug || "slug"}/rendez-vous</code>
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Catégorie</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => update({ category: v ?? "private" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c] ?? c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Organisation partenaire (optionnel)</Label>
                <Input
                  value={form.partnerOrganization}
                  onChange={(e) => update({ partnerOrganization: e.target.value })}
                  placeholder="Ex : FGTB"
                />
                <p className="text-xs text-muted-foreground">
                  Donne l&apos;accès automatique aux responsables de cette
                  organisation. Sinon, ajoute les gestionnaires dans l&apos;onglet
                  Équipe.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button onClick={create} disabled={saving}>
                {saving ? "Création…" : "Créer"}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun guichet pour l&apos;instant. Créez-en un pour commencer.
        </p>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>En attente</TableHead>
                <TableHead>Ce mois</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">/{t.slug}</div>
                  </TableCell>
                  <TableCell>{CATEGORY_LABELS[t.category] ?? t.category}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.partnerOrganization ?? "—"}
                  </TableCell>
                  <TableCell>
                    {t.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Actif</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-700">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.pendingCount > 0 ? (
                      <Badge className="bg-amber-100 text-amber-800">
                        {t.pendingCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {t.monthCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={t.active ? "outline" : "default"}
                        size="sm"
                        disabled={toggling === t.id}
                        onClick={() => toggleActive(t)}
                      >
                        {toggling === t.id
                          ? "…"
                          : t.active
                            ? "Désactiver"
                            : "Activer"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/booking/${t.id}/agenda`)}
                      >
                        <Settings className="size-4" />
                        Gérer
                      </Button>
                      <a
                        href={`/${t.slug}/rendez-vous`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground inline-flex items-center"
                        title="Page publique"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
